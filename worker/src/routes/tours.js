/**
 * 行程 / 租車 訂單 API
 * ------------------------------------------------------------
 * 公開：商品列表（只回牌價，絕不回成本）、下單（後端算成本 snapshot）
 * owner：訂單列表、財報（按供應商月結利潤）、改訂單狀態
 *
 * 安全鐵則：cost_* 只在後端用來算 costAmount，永不回傳給公開端。
 */

import { json } from '../lib/utils.js';
import { calcOrderTotal, calcCarSegment, calcTourBooking } from '../lib/tourPricing.js';
import { calcFerry } from '../lib/ferryPricing.js';
import { sendEmail } from '../lib/email.js';
import { linePush } from '../lib/line.js';
import { tourOrderPendingHtml, tourOrderAdminHtml } from '../lib/emailTemplates.js';

function toInt(v) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : 0; }

/* 安全機制（2026-06 拍板）：成本算不出/沒填時不存 0、擋下單，對客婉轉導專人（不講「成本未設定」）。
   利潤寧可保守不可高估——cost 缺漏 → 不讓線上成立。 */
const CONTACT_MSG = '此商品目前需專人為您確認報價，請加 LINE @dropinn 或來電，我們盡快為您處理 🙏';
// 賣價>0 但成本算不出(null)或為 0(沒填) → 視為「成本缺漏」，擋下單
function costMissing(sell, cost) { return Number(sell) > 0 && (cost == null || Number(cost) <= 0); }

// 台灣今天（YYYY-MM-DD）
function todayTW() { return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10); }
// 出發/用車日是否「已過去」（早於今天）；當天可訂。空值不擋（交給各自必填檢查）
function isPastDate(d) {
  const day = String(d || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && day < todayTW();
}

/* 出團/用車日期分月（財報與訂單列表共用，確保口徑一致）：
   tour→detail.date、ferry→detail.outDate、rental→detail.segments[0].pickup，無日期 fallback createdAt。
   需搭配 TOUR_CTE（json_valid 防壞 JSON 讓 json_extract 整段炸掉）。subLen 由本端給(7=月/4=年)，無注入。 */
const TOUR_CTE = "WITH o AS (SELECT *, CASE WHEN json_valid(detail) THEN detail ELSE '{}' END AS jd FROM tour_orders)";
const tourMonthExpr = (subLen) =>
  `substr(COALESCE(json_extract(jd,'$.date'),json_extract(jd,'$.outDate'),json_extract(jd,'$.segments[0].pickup'),createdAt), 1, ${subLen})`;

/* 下單後寄信：客人(有填 email 才寄)＋管理員。沿用 Resend。不阻塞回應。 */
function sendTourEmails(env, ctx, o) {
  const tasks = [];
  if (o.email) {
    tasks.push(sendEmail(env, {
      to: o.email,
      subject: `【雫旅】預訂需求已收到　${o.orderId}`,
      html: tourOrderPendingHtml(o),
    }).catch((e) => console.error('[tour/email] 客人信失敗', e)));
  }
  if (env.ADMIN_NOTIFY_EMAIL) {
    tasks.push(sendEmail(env, {
      to: env.ADMIN_NOTIFY_EMAIL,
      subject: `【雫旅】新${o.kindLabel || '行程'}訂單　${o.orderId}`,
      html: tourOrderAdminHtml(o),
    }).catch((e) => console.error('[tour/email] 管理員信失敗', e)));
  }
  if (!tasks.length) return;
  if (ctx && ctx.waitUntil) ctx.waitUntil(Promise.all(tasks));
  else return Promise.all(tasks);
}

/* 通用須知（該筆未填 meta.notice 時自動套用，與前台/後台一致） */
const UNIVERSAL_NOTICE =
  '・報到：請於場次前 30 分鐘到集合點（實際時間以業者前一天通知為準）\n' +
  '・攜帶：身分證正本（實名制，含船／登島必備）；兒童、嬰幼兒帶健保卡或生日\n' +
  '・天候：因天氣或船班停航可全額退費或改期\n' +
  '・取消：出發前如需取消，依業者規定可能收取手續費，請儘早告知\n' +
  '・成立：名額有限，送出僅為預訂，待雫旅向業者確認後才正式成立\n' +
  '・聯絡：建議加入雫旅 LINE，確認與後續通知更即時';

/* 從 product.meta 取須知（客人面）；未填套通用版 */
function noticeOf(product) {
  try {
    const n = JSON.parse(product.meta || '{}').notice;
    if (n && String(n).trim()) return String(n);
  } catch (e) { /* ignore */ }
  return UNIVERSAL_NOTICE;
}

/* 人數文字 */
function peopleText(c) {
  const a = []; if (+c.adult) a.push('全票×' + +c.adult); if (+c.child) a.push('半票×' + +c.child); if (+c.infant) a.push('嬰幼兒×' + +c.infant);
  return a.join('、');
}

function genOrderId() {
  const d = new Date(Date.now() + 8 * 3600 * 1000); // 台灣時間
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TR-${ymd}-${rnd}`;
}

/* ═══════════════════════════════════════════════════════════
   公開：商品列表  GET /api/tours/products
   ⚠️ 只回牌價（price_*），絕不 SELECT cost_*
═══════════════════════════════════════════════════════════ */
export async function getTourProducts(request, env) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category'); // 選填過濾
  // 只回對客公開欄位：賣價 + 介紹 + 加價規則；絕不 SELECT cost_* / cost_json
  let sql = `SELECT id, category, vendor, name, seats, unit, kind, description,
                    price_day, price_half, price_hour,
                    price_adult, price_child, price_infant,
                    meta, rules_json, sortOrder
             FROM tour_products WHERE active = 1`;
  const binds = [];
  if (category) { sql += ' AND category = ?'; binds.push(category); }
  sql += ' ORDER BY sortOrder, name';
  const rows = await env.DB.prepare(sql).bind(...binds).all();
  // meta 內含內部欄位（notes 可能寫到「同業 XXX」成本、source_ref 是內部來源檔名）
  // → 對外輸出前一律剝除，只留對客欄位，避免同業/成本外洩。
  const META_INTERNAL = ['notes', 'source_ref'];
  const products = (rows.results || []).map((p) => {
    if (p.meta) {
      try {
        const m = JSON.parse(p.meta);
        for (const k of META_INTERNAL) delete m[k];
        p.meta = JSON.stringify(m);
      } catch (e) { p.meta = '{}'; } // 解析失敗就清空，寧可少資料也不外洩
    }
    return p;
  });
  return json({ success: true, products });
}

/* ═══════════════════════════════════════════════════════════
   公開：下單  POST /api/tours/orders
   body: { productId, kind, contactName, contactPhone,
           segments:[{pickup,return,store}], detail, bookingOrderID? }
   後端用 productId 查 cost 算 costAmount（snapshot），不信任前端金額。
═══════════════════════════════════════════════════════════ */
export async function createTourOrder(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const { productId, contactName, contactPhone, segments, bookingOrderID } = body;
  const kind = body.kind || 'rental';

  if (!productId) return json({ error: '缺少車種' }, 400);
  if (!contactName || !contactPhone) return json({ error: '請填聯絡人姓名與電話' }, 400);
  if (!Array.isArray(segments) || !segments.length) return json({ error: '缺少租期' }, 400);
  if (segments.some((s) => isPastDate(s.pickup))) return json({ error: '取車日期不能是過去，請重新選擇', past: true }, 400);

  // 每段各自的車（segment.productId 優先，沒帶 fallback 頂層 productId）→ 一次查齊、逐段加總
  const carCache = {};
  const getCar = async (cid) => {
    if (!(cid in carCache)) {
      carCache[cid] = (await env.DB.prepare('SELECT * FROM tour_products WHERE id = ? AND active = 1').bind(cid).first()) || null;
    }
    return carCache[cid];
  };

  // 後端各算一次（不信前端），任一段缺成本→導專人
  let sellAmount = 0, costAmount = 0;
  const segOut = [];
  for (const s of segments) {
    const car = await getCar(s.productId || productId);
    if (!car) return json({ error: '車種不存在' }, 404);
    const sFee = calcCarSegment(car, s, false);
    const cFee = calcCarSegment(car, s, true);
    if (sFee == null) return json({ error: '租期時間有誤' }, 400);
    if (costMissing(sFee, cFee)) return json({ error: CONTACT_MSG, needContact: true }, 422);
    sellAmount += sFee;
    costAmount += (cFee || 0);
    segOut.push({ pickup: s.pickup, return: s.return, store: s.store || '', productId: car.id, carName: car.name, seats: car.seats, fee: sFee });
  }

  const headCar = await getCar(productId);
  if (!headCar) return json({ error: '車種不存在' }, 404);

  // bookingOrderID 選填：若給了，驗證住客訂單存在（避免亂填）
  let linkedBooking = null;
  if (bookingOrderID) {
    const bk = await env.DB.prepare('SELECT orderID FROM orders WHERE orderID = ?')
      .bind(bookingOrderID).first();
    if (bk) linkedBooking = bookingOrderID; // 不存在就當獨立訂單，不報錯
  }

  const id = genOrderId();
  const detailJson = JSON.stringify({
    segments: segOut,
    note: body.detail || '',
    depart: body.depart || '',
    backflight: body.backflight || '',
    productName: headCar.name,
    seats: headCar.seats,
    multiCar: new Set(segOut.map((x) => x.productId)).size > 1,
  });

  await env.DB.prepare(`
    INSERT INTO tour_orders
      (id, kind, bookingOrderID, productId, vendor, contactName, contactPhone,
       detail, sellAmount, costAmount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待確認')
  `).bind(
    id, kind, linkedBooking, headCar.id, headCar.vendor,
    contactName, contactPhone, detailJson, sellAmount, costAmount
  ).run();

  const segText = segOut.map((s) => `${s.carName}　${String(s.pickup).replace('T', ' ')}→${String(s.return).replace('T', ' ')}`).join('；');
  sendTourEmails(env, ctx, {
    orderId: id, kindLabel: '租車', productName: headCar.name,
    date: segText, session: '', peopleText: '',
    total: sellAmount, contactName, contactPhone, email: (body.email || '').trim(),
    notice: '・成立：車輛數量有限，待車行確認有車才正式成立\n・證件：取車務必攜帶駕照（汽車帶汽車駕照、機車帶機車駕照）\n・保險：強烈建議加保，事故維修／第三責任有保障，可現場跟車行加保\n・費用：以實際還車時間計、現場由車行收取\n・接送：出發前一天車行會電話聯絡接送，未接到請主動聯繫',
  });

  // 回前端：只回 orderId + 賣價，絕不回 costAmount
  return json({ success: true, orderId: id, sellAmount, linkedBooking: !!linkedBooking });
}

/* ═══════════════════════════════════════════════════════════
   公開：行程下單  POST /api/tours/tour-order
   body: { productId, counts:{adult,child,infant}, addons:[name],
           date, contactName, contactPhone, passengers?, bookingOrderID? }
═══════════════════════════════════════════════════════════ */
export async function createTourBookingOrder(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { productId, contactName, contactPhone } = body;
  if (!productId) return json({ error: '缺少行程' }, 400);
  if (!contactName || !contactPhone) return json({ error: '請填聯絡人姓名與電話' }, 400);
  const c = body.counts || {};
  if (!((+c.adult || 0) + (+c.child || 0) + (+c.infant || 0))) return json({ error: '請填人數' }, 400);
  if (isPastDate(body.date)) return json({ error: '出發日期不能是過去，請重新選擇', past: true }, 400);

  const product = await env.DB.prepare(
    "SELECT * FROM tour_products WHERE id = ? AND kind = 'tour' AND active = 1"
  ).bind(productId).first();
  if (!product) return json({ error: '行程不存在' }, 404);

  const sell = calcTourBooking(product, body, false);
  const cost = calcTourBooking(product, body, true);
  if (costMissing(sell, cost)) return json({ error: CONTACT_MSG, needContact: true }, 422);

  let linkedBooking = null;
  if (body.bookingOrderID) {
    const bk = await env.DB.prepare('SELECT orderID FROM orders WHERE orderID = ?').bind(body.bookingOrderID).first();
    if (bk) linkedBooking = body.bookingOrderID;
  }

  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const id = 'TO-' + d.toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const detail = JSON.stringify({
    productName: product.name, date: body.date || '', session: body.session || '', counts: c,
    addons: body.addons || [], board: body.board || '', passengers: body.passengers || [],
  });

  await env.DB.prepare(`
    INSERT INTO tour_orders
      (id, kind, bookingOrderID, productId, vendor, contactName, contactPhone, detail, sellAmount, costAmount, status)
    VALUES (?, 'tour', ?, ?, ?, ?, ?, ?, ?, ?, '待確認')
  `).bind(id, linkedBooking, productId, product.vendor, contactName, contactPhone, detail, sell, cost || 0).run();

  sendTourEmails(env, ctx, {
    orderId: id, kindLabel: '行程', productName: product.name,
    date: body.date || '', session: body.session || '', peopleText: peopleText(c),
    total: sell, contactName, contactPhone, email: (body.email || '').trim(),
    notice: noticeOf(product),
  });

  return json({ success: true, orderId: id, sellAmount: sell, linkedBooking: !!linkedBooking });
}

/* 哪些行程需實名（搭船/活動類）：預設要，BBQ/門票/烤肉不用；meta.realname 可逐筆覆寫 */
export function needsRealname(product) {
  try { const m = JSON.parse(product.meta || '{}'); if (typeof m.realname === 'boolean') return m.realname; } catch (e) { /* ignore */ }
  return !/BBQ|門票|烤肉/i.test(product.category || '');
}

/* ═══════════════════════════════════════════════════════════
   公開：購物車批次下單  POST /api/tours/cart-order
   body: { items:[{productId,counts,addons,board,date,session}],
           contactName, contactPhone, email,
           passengers:[{name,id,birth}], bookingOrderID? }
   每個行程各建一筆訂單（vendor 各自正確）、同 groupId 綁定、共用實名名單。
   實名僅供業者安排，已完成/已取消或出團日後清除（見 stripRealname / scheduled）。
═══════════════════════════════════════════════════════════ */
export async function createCartOrder(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { contactName, contactPhone } = body;
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return json({ error: '清單是空的' }, 400);
  if (!contactName || !contactPhone) return json({ error: '請填聯絡人姓名與電話' }, 400);

  // 一次查齊所有行程
  const products = {};
  for (const it of items) {
    if (!it.productId) return json({ error: '清單有缺少行程' }, 400);
    if (!(it.productId in products)) {
      products[it.productId] = await env.DB.prepare(
        "SELECT * FROM tour_products WHERE id = ? AND kind = 'tour' AND active = 1"
      ).bind(it.productId).first();
    }
  }

  // 需實名檢查：清單裡有需實名行程 → 旅客名單必填、且足夠最大人數
  let maxPax = 0, anyRealname = false;
  for (const it of items) {
    const p = products[it.productId];
    if (!p) return json({ error: '行程不存在' }, 404);
    const c = it.counts || {};
    const head = (+c.adult || 0) + (+c.child || 0) + (+c.infant || 0);
    if (!head) return json({ error: '行程人數未填' }, 400);
    if (isPastDate(it.date)) return json({ error: `「${p.name}」出發日期不能是過去，請重新選擇`, past: true }, 400);
    if (needsRealname(p)) { anyRealname = true; if (head > maxPax) maxPax = head; }
  }
  const passengers = Array.isArray(body.passengers)
    ? body.passengers.filter((x) => x && (x.name || x.id)).map((x) => ({ name: x.name || '', id: x.id || '', birth: x.birth || '' }))
    : [];
  if (anyRealname && passengers.length < maxPax) {
    return json({ error: `需實名行程請填滿 ${maxPax} 位旅客（姓名/身分證/生日）` }, 400);
  }

  let linkedBooking = null;
  if (body.bookingOrderID) {
    const bk = await env.DB.prepare('SELECT orderID FROM orders WHERE orderID = ?').bind(body.bookingOrderID).first();
    if (bk) linkedBooking = body.bookingOrderID;
  }

  // 先全部算好（任一缺成本→整組擋、不建單）
  const rows = [];
  for (const it of items) {
    const p = products[it.productId];
    const sub = { productId: it.productId, counts: it.counts || {}, addons: it.addons || [], board: it.board || '', date: it.date || '', session: it.session || '' };
    const sell = calcTourBooking(p, sub, false);
    const cost = calcTourBooking(p, sub, true);
    if (costMissing(sell, cost)) return json({ error: `「${p.name}」${CONTACT_MSG}`, needContact: true, product: p.name }, 422);
    rows.push({ p, sub, sell, cost: cost || 0 });
  }

  const email = (body.email || '').trim();
  const stamp = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
  const groupId = 'G-' + stamp + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
  const out = [];
  let total = 0;
  for (const r of rows) {
    const id = 'TO-' + stamp + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    const pax = needsRealname(r.p) ? passengers : [];   // 不需實名的行程不存旅客資料
    const detail = JSON.stringify({
      productName: r.p.name, date: r.sub.date, session: r.sub.session, counts: r.sub.counts,
      addons: r.sub.addons, board: r.sub.board, passengers: pax, contactEmail: email,
    });
    await env.DB.prepare(`
      INSERT INTO tour_orders
        (id, kind, groupId, bookingOrderID, productId, vendor, contactName, contactPhone, detail, sellAmount, costAmount, status)
      VALUES (?, 'tour', ?, ?, ?, ?, ?, ?, ?, ?, ?, '待確認')
    `).bind(id, groupId, linkedBooking, r.p.id, r.p.vendor, contactName, contactPhone, detail, r.sell, r.cost).run();
    out.push({ orderId: id, productName: r.p.name, sell: r.sell });
    total += r.sell;
  }

  // 一封合併確認信給客人＋管理員
  const names = out.map((o) => o.productName);
  sendTourEmails(env, ctx, {
    orderId: groupId, kindLabel: '行程', productName: `${names[0]}${names.length > 1 ? ` 等 ${names.length} 項` : ''}`,
    date: '', session: '', peopleText: `${out.length} 個行程`,
    total, contactName, contactPhone, email, notice: noticeOf(rows[0].p),
  });

  return json({ success: true, groupId, orders: out, total });
}

/* 個資生命週期：清除單筆訂單的同行旅客實名（姓名/身分證/生日）。
   留：聯絡人姓名+電話（欄位）、contactEmail、金額/供應商/行程（財報）。 */
export async function stripOrderRealname(env, id) {
  await env.DB.prepare(
    "UPDATE tour_orders SET detail = json_remove(detail, '$.passengers') WHERE id = ? AND json_valid(detail) AND json_extract(detail,'$.passengers') IS NOT NULL"
  ).bind(id).run();
}

/* 每日排程掃尾：出團/船班日已過、仍留著實名的訂單 → 清除（個資最小化，行程結束就用不到）。*/
export async function sweepExpiredRealname(env) {
  const r = await env.DB.prepare(`
    WITH o AS (SELECT id, CASE WHEN json_valid(detail) THEN detail ELSE '{}' END AS jd FROM tour_orders)
    UPDATE tour_orders SET detail = json_remove(detail, '$.passengers')
    WHERE id IN (
      SELECT id FROM o
      WHERE json_extract(jd,'$.passengers') IS NOT NULL
        AND json_array_length(json_extract(jd,'$.passengers')) > 0
        AND substr(COALESCE(json_extract(jd,'$.backDate'), json_extract(jd,'$.outDate'), json_extract(jd,'$.date')), 1, 10) < date('now','+8 hours')
    )
  `).run();
  const n = r?.meta?.changes ?? 0;
  if (n) console.log('[cron] 清除出團已過實名訂單:', n);
  return n;
}

/* ═══════════════════════════════════════════════════════════
   公開：船票下單  POST /api/tours/ferry-order
   body: { tripType, outDate, backDate, direction, counts,
           shuttle:{station,type}, contactName, contactPhone,
           passengers:[{name,id,birth}], bookingOrderID? }
   後端用 meta 算售價、cost_json 算成本估算，不信前端金額。
═══════════════════════════════════════════════════════════ */
export async function createFerryOrder(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { contactName, contactPhone } = body;
  if (!contactName || !contactPhone) return json({ error: '請填聯絡人姓名與電話' }, 400);
  if (!body.outDate) return json({ error: '缺少出發日期' }, 400);
  if (isPastDate(body.outDate) || isPastDate(body.backDate)) return json({ error: '出發/回程日期不能是過去，請重新選擇', past: true }, 400);

  const product = await env.DB.prepare(
    "SELECT * FROM tour_products WHERE id = 'ferry-united' AND active = 1"
  ).first();
  if (!product) return json({ error: '船票暫無資料' }, 404);

  const sell = calcFerry(product, body, false);
  const cost = calcFerry(product, body, true);
  if (sell == null) return json({ error: '日期或人數有誤' }, 400);
  if (costMissing(sell, cost)) return json({ error: CONTACT_MSG, needContact: true }, 422);

  let linkedBooking = null;
  if (body.bookingOrderID) {
    const bk = await env.DB.prepare('SELECT orderID FROM orders WHERE orderID = ?').bind(body.bookingOrderID).first();
    if (bk) linkedBooking = body.bookingOrderID;
  }

  const d = new Date(Date.now() + 8 * 3600 * 1000);
  const id = 'FR-' + d.toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const detail = JSON.stringify({
    tripType: body.tripType, outDate: body.outDate, backDate: body.backDate, direction: body.direction,
    counts: body.counts, shuttle: body.shuttle || null,
    passengers: body.passengers || [], productName: '聯營船票',
  });

  await env.DB.prepare(`
    INSERT INTO tour_orders
      (id, kind, bookingOrderID, productId, vendor, contactName, contactPhone, detail, sellAmount, costAmount, status)
    VALUES (?, 'ferry', ?, 'ferry-united', '澎湖之美', ?, ?, ?, ?, ?, '待確認')
  `).bind(id, linkedBooking, contactName, contactPhone, detail, sell, cost || 0).run();

  const ferryDate = body.tripType === 'round' ? `${body.outDate} → ${body.backDate || ''}` : (body.outDate || '');
  sendTourEmails(env, ctx, {
    orderId: id, kindLabel: '船票', productName: `布袋－馬公 ${body.tripType === 'round' ? '來回' : '單程'}`,
    date: ferryDate, session: '', peopleText: peopleText(body.counts || {}),
    total: sell, contactName, contactPhone, email: (body.email || '').trim(),
    notice: '・領票：請提前 40 分鐘到船公司櫃檯、出示身分證領票（布袋船為現場紙本票，無電子票）\n・實名制：每位旅客需身分證＋生日（半票／嬰兒可填健保卡號或生日）\n・暈船：會暈船請自備暈船藥，依船公司指示登船\n・取消：出發前一天 12:00 後取消恕不退費；停航可全額退或改期\n・接駁：上車時間地點以出發前通知為準',
  });

  return json({ success: true, orderId: id, sellAmount: sell, linkedBooking: !!linkedBooking });
}

/* ═══════════════════════════════════════════════════════════
   owner：訂單列表  GET /api/admin/tours/orders?status=&vendor=
   含成本/利潤（owner 限定，外層已驗 role===owner）
═══════════════════════════════════════════════════════════ */
export async function adminTourOrders(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const vendor = url.searchParams.get('vendor');
  const year   = url.searchParams.get('year');
  const month  = url.searchParams.get('month');
  const page   = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = 10;

  // 期間過濾用「出團/用車日期」分月（與財報同口徑），分頁 10 筆/頁。
  const where = ['1=1'];
  const binds = [];
  if (year) {                                    // 有帶 year 才按期間過濾（沒帶=全部）
    const useM = month && month !== '0';
    where.push(`${tourMonthExpr(useM ? 7 : 4)} = ?`);
    binds.push(useM ? `${year}-${String(month).padStart(2, '0')}` : String(year));
  }
  if (status) { where.push('status = ?'); binds.push(status); }
  if (vendor) { where.push('vendor = ?'); binds.push(vendor); }
  const whereSql = where.join(' AND ');

  const cntRow = await env.DB.prepare(`${TOUR_CTE} SELECT COUNT(*) AS n FROM o WHERE ${whereSql}`)
    .bind(...binds).first();
  const total = toInt(cntRow?.n);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;

  const rows = await env.DB.prepare(`
    ${TOUR_CTE}
    SELECT id, kind, groupId, bookingOrderID, productId, vendor, contactName, contactPhone,
           detail, sellAmount, costAmount, (sellAmount-costAmount) AS profit, status, createdAt
    FROM o WHERE ${whereSql}
    ORDER BY createdAt DESC LIMIT ? OFFSET ?
  `).bind(...binds, pageSize, offset).all();

  return json({ success: true, orders: rows.results || [], page: safePage, pageSize, total, totalPages });
}

/* owner：取一個購物車組的所有訂單（給旅行社合併貼文用）。不回成本。 */
export async function adminTourGroup(request, env) {
  const groupId = new URL(request.url).searchParams.get('groupId');
  if (!groupId) return json({ error: '缺少 groupId' }, 400);
  const rows = await env.DB.prepare(
    'SELECT id, kind, groupId, productId, vendor, contactName, contactPhone, detail, sellAmount, status FROM tour_orders WHERE groupId = ? ORDER BY createdAt'
  ).bind(groupId).all();
  return json({ success: true, orders: rows.results || [] });
}

/* ═══════════════════════════════════════════════════════════
   owner：財報（按供應商月結利潤）
   GET /api/admin/tours/report?year=2026&month=6
═══════════════════════════════════════════════════════════ */
export async function adminTourReport(request, env) {
  const url = new URL(request.url);
  const year = url.searchParams.get('year') || String(new Date().getFullYear());
  const month = url.searchParams.get('month'); // 選填，無=整年

  // 月份口徑（2026-06 拍板）：用「出團/用車日期」分月，不是下單日（見 tourMonthExpr）。
  const useMonth = month && month !== '0';
  const period = useMonth ? `${year}-${String(month).padStart(2, '0')}` : String(year);
  const CTE = TOUR_CTE;
  const monthExpr = tourMonthExpr(useMonth ? 7 : 4);

  // 主營收：只算訂單成立 / 已完成（已取消不計營收）
  const rows = await env.DB.prepare(`
    ${CTE}
    SELECT vendor,
           COUNT(*) AS orderCount,
           SUM(sellAmount) AS revenue,
           SUM(costAmount) AS cost,
           SUM(sellAmount - costAmount) AS profit
    FROM o
    WHERE ${monthExpr} = ? AND status IN ('訂單成立','已完成')
    GROUP BY vendor
  `).bind(period).all();

  const byVendor = rows.results || [];
  const totals = byVendor.reduce((a, v) => ({
    revenue: a.revenue + toInt(v.revenue),
    cost:    a.cost    + toInt(v.cost),
    profit:  a.profit  + toInt(v.profit),
    orders:  a.orders  + toInt(v.orderCount),
  }), { revenue: 0, cost: 0, profit: 0, orders: 0 });

  // 待確認（未成立）：另列提醒，不進營收（同房間口徑：洽談中/待確認另列）
  const pendRow = await env.DB.prepare(`
    ${CTE}
    SELECT COUNT(*) AS cnt, COALESCE(SUM(sellAmount),0) AS amount
    FROM o
    WHERE ${monthExpr} = ? AND status = '待確認'
  `).bind(period).first();
  const pending = { count: toInt(pendRow?.cnt), amount: toInt(pendRow?.amount) };

  // 待結清（各供應商當月成本 vs 已結算）
  const settleRows = await env.DB.prepare(
    'SELECT vendor, totalCost, settledAt FROM tour_settlements WHERE monthKey = ?'
  ).bind(period).all();

  return json({ success: true, year, month: month || 0, byVendor, totals, pending, settlements: settleRows.results || [] });
}

/* ═══════════════════════════════════════════════════════════
   owner：改訂單狀態  POST /api/admin/tours/order-status
   body: { id, status, cancelReason? }
═══════════════════════════════════════════════════════════ */
export async function adminTourOrderStatus(request, env, ctx) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { id, status } = body;
  const allowed = ['待確認', '訂單成立', '已取消', '已完成'];
  if (!id || !allowed.includes(status)) return json({ error: '參數錯誤' }, 400);

  // 已結算月擋改（比照房務）：該訂單供應商當月已結清 → 鎖住，要先解除結算才能改
  const settledChk = await env.DB.prepare(`
    ${TOUR_CTE}
    SELECT s.settledAt FROM o
    JOIN tour_settlements s ON s.vendor = o.vendor AND s.monthKey = ${tourMonthExpr(7)}
    WHERE o.id = ?
  `).bind(id).first();
  if (settledChk?.settledAt) return json({ error: '該供應商當月已結清，請先解除結算再改訂單' }, 409);

  // 取舊狀態與綁定的 LINE，狀態真的變成「訂單成立」才推播（避免重複）
  const before = await env.DB.prepare('SELECT status, lineUserId, detail FROM tour_orders WHERE id = ?').bind(id).first();

  await env.DB.prepare(`
    UPDATE tour_orders
    SET status = ?, cancelReason = ?, updatedAt = datetime('now','+8 hours'), updatedBy = 'admin'
    WHERE id = ?
  `).bind(status, body.cancelReason || '', id).run();

  if (status === '訂單成立' && before && before.status !== '訂單成立' && before.lineUserId) {
    let name = '';
    try { name = JSON.parse(before.detail || '{}').productName || ''; } catch (e) { /* ignore */ }
    const msg = `🎉 雫旅為您訂到了！\n單號：${id}${name ? `\n項目：${name}` : ''}\n\n名額已確認成立，後續行前資訊會再通知您，期待與您相遇 🌊`;
    const task = linePush(env, before.lineUserId, msg).catch((e) => console.error('[tour/line] 成立推播失敗', e));
    if (ctx && ctx.waitUntil) ctx.waitUntil(task); else await task;
  }

  // 個資：已完成/已取消 → 立即清同行旅客實名（業者已不需要）
  if (status === '已完成' || status === '已取消') {
    await stripOrderRealname(env, id).catch((e) => console.error('[tour] 清實名失敗', e));
  }
  return json({ success: true });
}

/* ═══════════════════════════════════════════════════════════
   owner：行程結算（按供應商月結，比照房務 adminSettle）
   POST /api/admin/tours/settle   { monthKey:'YYYY-MM', vendor }
   算當月該供應商成本快照（出團日口徑、訂單成立+已完成）→ 鎖定，settledAt=now。已結清擋重複。
═══════════════════════════════════════════════════════════ */
export async function adminTourSettle(request, env) {
  const body = await request.json().catch(() => ({}));
  const monthKey = body.monthKey;
  const vendor = (body.vendor || '').trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return json({ error: 'monthKey 需為 YYYY-MM' }, 400);
  if (!vendor) return json({ error: '缺少供應商' }, 400);

  const existing = await env.DB.prepare(
    'SELECT settledAt FROM tour_settlements WHERE monthKey = ? AND vendor = ?'
  ).bind(monthKey, vendor).first();
  if (existing?.settledAt) return json({ error: '該供應商本月已結清' }, 409);

  // 成本快照：與財報 byVendor 同口徑（出團/用車日分月、只算訂單成立+已完成）
  const row = await env.DB.prepare(`
    ${TOUR_CTE}
    SELECT COALESCE(SUM(costAmount),0) AS total
    FROM o
    WHERE ${tourMonthExpr(7)} = ? AND vendor = ? AND status IN ('訂單成立','已完成')
  `).bind(monthKey, vendor).first();
  const total = toInt(row?.total);

  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO tour_settlements (monthKey, vendor, totalCost, settledAt, settledBy)
    VALUES (?, ?, ?, ?, 'admin')
    ON CONFLICT(monthKey, vendor) DO UPDATE SET totalCost = ?, settledAt = ?, settledBy = 'admin'
  `).bind(monthKey, vendor, total, now, total, now).run();

  return json({ success: true, monthKey, vendor, totalCost: total, settledAt: now });
}

/* owner：解除結算  POST /api/admin/tours/unsettle  { monthKey, vendor }（結算錯了或要重開）*/
export async function adminTourUnsettle(request, env) {
  const body = await request.json().catch(() => ({}));
  const monthKey = body.monthKey;
  const vendor = (body.vendor || '').trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) return json({ error: 'monthKey 需為 YYYY-MM' }, 400);
  if (!vendor) return json({ error: '缺少供應商' }, 400);
  const r = await env.DB.prepare(
    'DELETE FROM tour_settlements WHERE monthKey = ? AND vendor = ?'
  ).bind(monthKey, vendor).run();
  return json({ success: true, deleted: r?.meta?.changes || 0 });
}

/* ═══════════════════════════════════════════════════════════
   owner：商品管理（含成本）GET /api/admin/tours/products-full
═══════════════════════════════════════════════════════════ */
export async function adminTourProductsFull(_request, env) {
  const rows = await env.DB.prepare(
    'SELECT * FROM tour_products ORDER BY sortOrder, name'
  ).all();
  return json({ success: true, products: rows.results || [] });
}

/* ═══════════════════════════════════════════════════════════
   owner：改商品  POST /api/admin/tours/product
   body: { id, price_day?, price_half?, price_hour?,
           cost_day?, cost_half?, cost_hour?, name?, meta?, active? }
═══════════════════════════════════════════════════════════ */
export async function adminUpdateProduct(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { id } = body;
  if (!id) return json({ error: '缺少 id' }, 400);

  const intFields = ['price_day','price_half','price_hour','cost_day','cost_half','cost_hour',
                     'price_adult','price_child','price_infant','cost_adult','cost_child','cost_infant',
                     'active','sortOrder'];
  const txtFields = ['name','meta','description'];
  // cost_json（船票票價成本/板型成本/接駁成本）、rules_json（加購/逢單補/板型售價）：
  // 原本後台沒地方填、只能改 D1。存前驗 JSON 合法，避免壞字串讓計價整段炸掉。
  const jsonFields = ['cost_json','rules_json'];
  const sets = [], binds = [];
  for (const f of intFields) if (body[f] !== undefined) { sets.push(`${f} = ?`); binds.push(toInt(body[f])); }
  for (const f of txtFields) if (body[f] !== undefined) { sets.push(`${f} = ?`); binds.push(String(body[f])); }
  for (const f of jsonFields) if (body[f] !== undefined) {
    const s = String(body[f] ?? '').trim();
    if (s !== '') { try { JSON.parse(s); } catch { return json({ error: `${f} 不是合法 JSON，未儲存` }, 400); } }
    sets.push(`${f} = ?`); binds.push(s);
  }
  if (!sets.length) return json({ error: '無可更新欄位' }, 400);

  sets.push("updatedAt = datetime('now','+8 hours')");
  binds.push(id);
  await env.DB.prepare(`UPDATE tour_products SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
  return json({ success: true });
}

/* ═══════════════════════════════════════════════════════════
   連動：房間訂單取消時，連帶取消其關聯的租車/行程訂單
   （由 orders 取消流程呼叫，非獨立路由）
═══════════════════════════════════════════════════════════ */
export async function cancelLinkedTourOrders(env, bookingOrderID, reason) {
  if (!bookingOrderID) return 0;
  const r = await env.DB.prepare(`
    UPDATE tour_orders
    SET status = '已取消', cancelReason = ?, updatedAt = datetime('now','+8 hours'), updatedBy = 'system(連動)'
    WHERE bookingOrderID = ? AND status NOT IN ('已取消','已完成')
  `).bind(reason || '房間訂單取消連動', bookingOrderID).run();
  return r?.meta?.changes ?? 0;
}

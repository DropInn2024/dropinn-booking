/**
 * 行程 / 租車 訂單 API
 * ------------------------------------------------------------
 * 公開：商品列表（只回牌價，絕不回成本）、下單（後端算成本 snapshot）
 * owner：訂單列表、財報（按供應商月結利潤）、改訂單狀態
 *
 * 安全鐵則：cost_* 只在後端用來算 costAmount，永不回傳給公開端。
 */

import { json } from '../lib/utils.js';
import { calcOrderTotal } from '../lib/tourPricing.js';
import { calcFerry } from '../lib/ferryPricing.js';

function toInt(v) { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : 0; }

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
  // 只回對客公開欄位：賣價 + 介紹；絕不 SELECT cost_*
  let sql = `SELECT id, category, vendor, name, seats, unit, kind, description,
                    price_day, price_half, price_hour,
                    price_adult, price_child, price_infant,
                    meta, sortOrder
             FROM tour_products WHERE active = 1`;
  const binds = [];
  if (category) { sql += ' AND category = ?'; binds.push(category); }
  sql += ' ORDER BY sortOrder, name';
  const rows = await env.DB.prepare(sql).bind(...binds).all();
  return json({ success: true, products: rows.results || [] });
}

/* ═══════════════════════════════════════════════════════════
   公開：下單  POST /api/tours/orders
   body: { productId, kind, contactName, contactPhone,
           segments:[{pickup,return,store}], detail, bookingOrderID? }
   後端用 productId 查 cost 算 costAmount（snapshot），不信任前端金額。
═══════════════════════════════════════════════════════════ */
export async function createTourOrder(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

  const { productId, contactName, contactPhone, segments, bookingOrderID } = body;
  const kind = body.kind || 'rental';

  if (!productId) return json({ error: '缺少車種' }, 400);
  if (!contactName || !contactPhone) return json({ error: '請填聯絡人姓名與電話' }, 400);
  if (!Array.isArray(segments) || !segments.length) return json({ error: '缺少租期' }, 400);

  // 查商品（含成本，後端用）
  const product = await env.DB.prepare(
    'SELECT * FROM tour_products WHERE id = ? AND active = 1'
  ).bind(productId).first();
  if (!product) return json({ error: '車種不存在' }, 404);

  // 後端各算一次（不信前端）
  const sellAmount = calcOrderTotal(product, segments, false);
  const costAmount = calcOrderTotal(product, segments, true);
  if (sellAmount == null || costAmount == null) return json({ error: '租期時間有誤' }, 400);

  // bookingOrderID 選填：若給了，驗證住客訂單存在（避免亂填）
  let linkedBooking = null;
  if (bookingOrderID) {
    const bk = await env.DB.prepare('SELECT orderID FROM orders WHERE orderID = ?')
      .bind(bookingOrderID).first();
    if (bk) linkedBooking = bookingOrderID; // 不存在就當獨立訂單，不報錯
  }

  const id = genOrderId();
  const detailJson = JSON.stringify({
    segments,
    note: body.detail || '',
    depart: body.depart || '',
    backflight: body.backflight || '',
    productName: product.name,
    seats: product.seats,
  });

  await env.DB.prepare(`
    INSERT INTO tour_orders
      (id, kind, bookingOrderID, productId, vendor, contactName, contactPhone,
       detail, sellAmount, costAmount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '待確認')
  `).bind(
    id, kind, linkedBooking, productId, product.vendor,
    contactName, contactPhone, detailJson, sellAmount, costAmount
  ).run();

  // 回前端：只回 orderId + 賣價，絕不回 costAmount
  return json({ success: true, orderId: id, sellAmount, linkedBooking: !!linkedBooking });
}

/* ═══════════════════════════════════════════════════════════
   公開：船票下單  POST /api/tours/ferry-order
   body: { tripType, outDate, backDate, direction, counts,
           shuttle:{station,type}, contactName, contactPhone,
           passengers:[{name,id,birth}], bookingOrderID? }
   後端用 meta 算售價、cost_json 算成本估算，不信前端金額。
═══════════════════════════════════════════════════════════ */
export async function createFerryOrder(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { contactName, contactPhone } = body;
  if (!contactName || !contactPhone) return json({ error: '請填聯絡人姓名與電話' }, 400);
  if (!body.outDate) return json({ error: '缺少出發日期' }, 400);

  const product = await env.DB.prepare(
    "SELECT * FROM tour_products WHERE id = 'ferry-united' AND active = 1"
  ).first();
  if (!product) return json({ error: '船票暫無資料' }, 404);

  const sell = calcFerry(product, body, false);
  const cost = calcFerry(product, body, true);
  if (sell == null) return json({ error: '日期或人數有誤' }, 400);

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
  let sql = `SELECT id, kind, bookingOrderID, productId, vendor, contactName, contactPhone,
                    detail, sellAmount, costAmount, (sellAmount-costAmount) AS profit,
                    status, createdAt
             FROM tour_orders WHERE 1=1`;
  const binds = [];
  if (status) { sql += ' AND status = ?'; binds.push(status); }
  if (vendor) { sql += ' AND vendor = ?'; binds.push(vendor); }
  sql += ' ORDER BY createdAt DESC LIMIT 200';
  const rows = await env.DB.prepare(sql).bind(...binds).all();
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

  let dateCond, binds;
  if (month && month !== '0') {
    dateCond = "substr(createdAt,1,7) = ?";
    binds = [`${year}-${String(month).padStart(2, '0')}`];
  } else {
    dateCond = "substr(createdAt,1,4) = ?";
    binds = [String(year)];
  }

  // 只算成立 / 完成（取消不計營收）
  const rows = await env.DB.prepare(`
    SELECT vendor,
           COUNT(*) AS orderCount,
           SUM(sellAmount) AS revenue,
           SUM(costAmount) AS cost,
           SUM(sellAmount - costAmount) AS profit
    FROM tour_orders
    WHERE ${dateCond} AND status IN ('已成立','完成')
    GROUP BY vendor
  `).bind(...binds).all();

  const byVendor = rows.results || [];
  const totals = byVendor.reduce((a, v) => ({
    revenue: a.revenue + toInt(v.revenue),
    cost:    a.cost    + toInt(v.cost),
    profit:  a.profit  + toInt(v.profit),
    orders:  a.orders  + toInt(v.orderCount),
  }), { revenue: 0, cost: 0, profit: 0, orders: 0 });

  // 待結清（各供應商當月成本 vs 已結算）
  const settleRows = await env.DB.prepare(
    'SELECT vendor, totalCost, settledAt FROM tour_settlements WHERE monthKey = ?'
  ).bind(month && month !== '0' ? `${year}-${String(month).padStart(2, '0')}` : `${year}`).all();

  return json({ success: true, year, month: month || 0, byVendor, totals, settlements: settleRows.results || [] });
}

/* ═══════════════════════════════════════════════════════════
   owner：改訂單狀態  POST /api/admin/tours/order-status
   body: { id, status, cancelReason? }
═══════════════════════════════════════════════════════════ */
export async function adminTourOrderStatus(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }
  const { id, status } = body;
  const allowed = ['待確認', '已成立', '取消', '完成'];
  if (!id || !allowed.includes(status)) return json({ error: '參數錯誤' }, 400);

  await env.DB.prepare(`
    UPDATE tour_orders
    SET status = ?, cancelReason = ?, updatedAt = datetime('now','+8 hours'), updatedBy = 'admin'
    WHERE id = ?
  `).bind(status, body.cancelReason || '', id).run();
  return json({ success: true });
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
  const sets = [], binds = [];
  for (const f of intFields) if (body[f] !== undefined) { sets.push(`${f} = ?`); binds.push(toInt(body[f])); }
  for (const f of txtFields) if (body[f] !== undefined) { sets.push(`${f} = ?`); binds.push(String(body[f])); }
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
    SET status = '取消', cancelReason = ?, updatedAt = datetime('now','+8 hours'), updatedBy = 'system(連動)'
    WHERE bookingOrderID = ? AND status NOT IN ('取消','完成')
  `).bind(reason || '房間訂單取消連動', bookingOrderID).run();
  return r?.meta?.changes ?? 0;
}

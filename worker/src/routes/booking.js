import { json, normalizeDate } from '../lib/utils.js';
import { sendEmail } from '../lib/email.js';
import { bookingPendingHtml, adminNewOrderHtml } from '../lib/emailTemplates.js';

/* ── 計價規則（後端唯一來源，前端 originalTotal 一律忽略）──────────
   包棟每晚定價：
     3 間（6 人）  → 10,800
     4 間（8 人）  → 12,800
     5 間（10 人） → 14,800
   加床（201、302 限定）：每床每晚 1,000
   前端傳 rooms (3/4/5) 與 extraBeds (0/1/2)，後端自行算總額。
────────────────────────────────────────────────────────────────── */
const ROOM_PRICES = { 3: 10800, 4: 12800, 5: 14800 };
const EXTRA_BED_PRICE = 1000;

/* Cloudflare Turnstile 驗證（防機器人灌單／佔位攻擊）。
   - 未設定 env.TURNSTILE_SECRET → 視為「尚未啟用」直接放行（安全預設，可分階段上線、不影響現狀）。
   - 已啟用但 token 缺/驗不過 → 擋下。
   - siteverify 服務本身出錯 → 保守「放行」(fail-open)，避免 CF 端故障時全站訂不了房；靠 48h 自動取消等其他防線。 */
export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;     // 尚未啟用
  if (!token) return false;
  try {
    const form = new URLSearchParams();
    form.set('secret', env.TURNSTILE_SECRET);
    form.set('response', token);
    if (ip) form.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form,
    });
    const data = await res.json().catch(() => ({}));
    return data.success === true;
  } catch (e) {
    console.error('[turnstile] verify error (fail-open):', e);
    return true;
  }
}

function calcOriginalTotal(rooms, extraBeds, checkIn, checkOut) {
  const nightly = ROOM_PRICES[Number(rooms)];
  if (!nightly) return 0;                         // 無效房型 → 0（後面會被擋）
  const nights = Math.round(
    (new Date(checkOut) - new Date(checkIn)) / 86400000
  );
  if (nights <= 0) return 0;
  return (nightly + Number(extraBeds || 0) * EXTRA_BED_PRICE) * nights;
}

/* ── 工具 ─────────────────────────────────────────────────────────── */
function expandDates(checkIn, checkOut) {
  const dates = [];
  let cur = new Date(checkIn + 'T00:00:00');
  const end = new Date(checkOut + 'T00:00:00');
  while (cur < end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

/* ── GET /api/booking/dates 取得已訂日期清單 ──────────────────────── */
export async function getBookedDates(env) {
  // agency_blocks 屬於同業夥伴自家民宿的佔房記錄，與雫旅訂單完全無關，
  // 不應出現在雫旅客戶端日曆，只以 orders 為唯一來源。
  // 只取「尚未完全過去」的訂單（checkOut 在 2 天內或未來）。已過去的訂單不影響未來日曆，
  // 不需每次載入全部歷史訂單。-2 天緩衝避開 UTC/台北時區邊界。
  const { results: orders } = await env.DB.prepare(
    `SELECT checkIn, checkOut FROM orders
     WHERE status != '取消' AND checkOut >= date('now','-2 days')`
  ).all();

  // booked      = 訂單內部佔用日（checkIn+1 到 checkOut-1），前端顯示斜線
  // boundaries  = 每筆訂單的 checkIn 日，可作退房終點，前端不顯示斜線
  // noCheckIn   = MIN_STAY 約束日：不可作入住起點，但可被更早入住的範圍掃描穿越
  const bookedSet    = new Set();
  const boundarySet  = new Set();
  const noCheckInSet = new Set();

  for (const b of orders) {
    boundarySet.add(b.checkIn);
    const all = expandDates(b.checkIn, b.checkOut);
    all.slice(1).forEach((d) => bookedSet.add(d)); // checkIn+1 到 checkOut-1
  }

  // ── 孤立短缺口偵測：缺口尾端距下一筆 checkIn 不足 MIN_STAY 晚，無法作為合法 checkIn ──
  const MIN_STAY = 2;
  const sorted = [...orders].sort((a, b) => (a.checkIn < b.checkIn ? -1 : 1));

  // 在第一筆訂單前：緊鄰 checkIn 前 (MIN_STAY-1) 天須劃掉（不可作入住起點）
  if (sorted.length > 0) {
    const firstCI = sorted[0].checkIn;
    const tailStart = new Date(firstCI + 'T00:00:00');
    tailStart.setDate(tailStart.getDate() - (MIN_STAY - 1));
    expandDates(tailStart.toISOString().slice(0, 10), firstCI)
      .forEach(d => noCheckInSet.add(d));
  }

  // 在連續訂單之間：分兩種情況
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i].checkOut;
    const gapEnd   = sorted[i + 1].checkIn;
    if (gapEnd <= gapStart) continue; // 無缺口（back-to-back 或重疊）

    const gapDays = Math.round(
      (new Date(gapEnd + 'T00:00:00') - new Date(gapStart + 'T00:00:00')) / 86400000
    );

    if (gapDays < MIN_STAY) {
      // 短孤島：整段缺口不足 MIN_STAY 晚，任何日期都無法作為合法入住起點
      // 缺口本身 + gapEnd（下一筆的 checkIn / boundary）一起封鎖：
      // 因為前方已無合法入住起點能抵達 gapEnd 作為退房終點
      expandDates(gapStart, gapEnd).forEach(d => bookedSet.add(d));
      boundarySet.delete(gapEnd);
      bookedSet.add(gapEnd);
    } else {
      // 正常缺口：只約束尾端 (MIN_STAY-1) 天不可作入住起點（靜默）
      const tailStart = new Date(gapEnd + 'T00:00:00');
      tailStart.setDate(tailStart.getDate() - (MIN_STAY - 1));
      const slashFrom = tailStart.toISOString().slice(0, 10) >= gapStart
        ? tailStart.toISOString().slice(0, 10)
        : gapStart;
      if (slashFrom < gapEnd) {
        expandDates(slashFrom, gapEnd).forEach(d => noCheckInSet.add(d));
      }
    }
  }

  // ── back-to-back 偵測：某日同時是 A.checkOut 又是 B.checkIn → 完全佔用
  // （gap loop 遇到 gapEnd === gapStart 會 continue，此日沒被處理）
  const checkOutSet = new Set(orders.map(b => b.checkOut));
  for (const d of [...boundarySet]) {
    if (checkOutSet.has(d)) {
      boundarySet.delete(d);
      bookedSet.add(d);
    }
  }

  // 防禦：若 boundary 落在另一訂單的內部日，視為完全封鎖
  for (const d of [...boundarySet]) {
    if (bookedSet.has(d)) boundarySet.delete(d);
  }

  return json({
    success: true,
    booked:     [...bookedSet].sort(),
    boundaries: [...boundarySet].sort(),
    noCheckIn:  [...noCheckInSet].sort(),   // MIN_STAY 約束日，不擋範圍掃描
  });
}

/* ── GET /api/booking/availability 檢查日期是否可訂 ──────────────── */
export async function checkAvailability(request, env) {
  const url = new URL(request.url);
  const checkIn = normalizeDate(url.searchParams.get('checkIn'));
  const checkOut = normalizeDate(url.searchParams.get('checkOut'));
  if (!checkIn || !checkOut) return json({ available: false, error: '缺少參數' }, 400);

  // 衝突檢查直接用 SQL 找有無重疊（LIMIT 1），不再把全部訂單載入記憶體迴圈比對。
  // 重疊條件：既有 checkIn < 新 checkOut 且 既有 checkOut > 新 checkIn（日期為 YYYY-MM-DD，字串比較等同日期比較）
  const conflict = await env.DB.prepare(
    `SELECT checkIn, checkOut FROM orders
     WHERE status != '取消' AND checkIn < ? AND checkOut > ? LIMIT 1`
  ).bind(checkOut, checkIn).first();
  if (conflict) {
    return json({ available: false, conflict: { checkIn: conflict.checkIn, checkOut: conflict.checkOut } });
  }

  // agency_blocks 是同業夥伴標記自己民宿的佔房，與雫旅訂單無關，不影響可用性
  return json({ available: true });
}

/* ── 查優惠碼（含年度後綴容錯）───────────────────────────────────
   先精確比對；找不到且代碼結尾是 4 位數字（老客碼可加年度，如 stilldropinn2026）
   → 去掉年份後綴再試一次，讓感謝信教學的年度寫法能自動對到基本碼。 */
async function lookupCoupon(env, code) {
  if (!code) return null;
  let row = await env.DB.prepare(
    `SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1`
  ).bind(code).first();
  if (!row) {
    const m = String(code).match(/^(.+?)(\d{4})$/);
    if (m && m[1]) {
      row = await env.DB.prepare(
        `SELECT * FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1`
      ).bind(m[1]).first();
    }
  }
  return row;
}

/* ── POST /api/booking/coupon 驗證優惠碼 ─────────────────────────── */
export async function checkCoupon(request, env) {
  const body = await request.json().catch(() => ({}));
  const { code, originalTotal = 0, nights = 1 } = body;
  if (!code) return json({ valid: false });

  const row = await lookupCoupon(env, code);
  if (!row) return json({ valid: false });

  const today = new Date().toISOString().slice(0, 10);
  if (row.validFrom && today < row.validFrom) return json({ valid: false });
  if (row.validTo && today > row.validTo) return json({ valid: false });
  if (row.useLimit > 0 && row.usedCount >= row.useLimit) return json({ valid: false });

  let discountAmount = 0;
  if (row.type === 'fixed') discountAmount = Math.round(row.value);
  else if (row.type === 'percent') discountAmount = Math.floor(originalTotal * row.value / 100);
  else if (row.type === 'per_night_fixed') discountAmount = Math.round(row.value * nights);

  // 確保折扣不超過原價
  discountAmount = Math.min(discountAmount, originalTotal);

  return json({ valid: true, discountAmount, description: row.description || '' });
}

/* ── 產生 DROP-YYYYMMDD-XXX 格式的 orderID（用 system_counters 表）── */
async function generateOrderID(env, checkInISO) {
  const datePrefix = checkInISO.replace(/-/g, ''); // YYYYMMDD
  const result = await env.DB.prepare(
    `INSERT INTO system_counters (datePrefix, currentCount)
     VALUES (?, 1)
     ON CONFLICT(datePrefix) DO UPDATE SET currentCount = currentCount + 1
     RETURNING currentCount`
  ).bind(datePrefix).first();
  const seq = String(result.currentCount).padStart(3, '0');
  return `DROP-${datePrefix}-${seq}`;
}

/* ── POST /api/booking/order 建立訂單 ─────────────────────────────── */
export async function createBooking(request, env, ctx) {
  const body = await request.json().catch(() => ({}));

  // 必填欄位
  const required = ['name', 'phone', 'checkIn', 'checkOut'];
  for (const k of required) {
    if (!body[k]) return json({ success: false, error: `缺少欄位: ${k}` }, 400);
  }
  const checkIn = normalizeDate(body.checkIn);
  const checkOut = normalizeDate(body.checkOut);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    return json({ success: false, error: '日期格式錯誤' }, 400);
  }
  if (new Date(checkIn) >= new Date(checkOut)) {
    return json({ success: false, error: '退房日需晚於入住日' }, 400);
  }

  // 防機器人灌單（Turnstile）：未設定密鑰時自動略過，不影響現狀。放在最前面、任何 DB 動作之前。
  const tsOk = await verifyTurnstile(env, body.token, request.headers.get('CF-Connecting-IP'));
  if (!tsOk) {
    return json({ success: false, error: '安全驗證未通過，請重新整理頁面後再送出一次' }, 403);
  }

  // 房型 / 計價驗證：放在任何 side effect（優惠碼用量 / orderID / 鎖定）之前。
  // 否則房型無效時 return，卻已寫入 booking_locks → 留下孤兒鎖把日期永久卡死（cron 只在訂單取消時釋放）。
  const rooms     = Number(body.rooms) || 3;
  const extraBeds = Number(body.extraBeds) || 0;
  if (!ROOM_PRICES[rooms]) {
    return json({ success: false, error: '無效的房型選擇' }, 400);
  }
  const originalTotal = calcOriginalTotal(rooms, extraBeds, checkIn, checkOut);
  if (originalTotal <= 0) {
    return json({ success: false, error: '計價失敗，請確認入住/退房日期' }, 400);
  }

  // 快速初步衝突檢查（SELECT，不鎖定；真正的原子防呆是後面的 booking_locks batch）
  // 直接用 SQL 找重疊，不載入全表。重疊：既有 checkIn < 新 checkOut 且 既有 checkOut > 新 checkIn
  const preConflict = await env.DB.prepare(
    `SELECT 1 FROM orders WHERE status != '取消' AND checkIn < ? AND checkOut > ? LIMIT 1`
  ).bind(checkOut, checkIn).first();
  if (preConflict) {
    return json({ success: false, error: '所選日期已被預訂' }, 409);
  }

  // 驗證優惠碼（若有）
  let discountAmount = 0;
  let discountType = '';
  let discountValue = '';
  let couponToConsume = null;   // #3：建單成功後才扣用量，避免鎖衝突/驗證失敗時虛耗限量券
  if (body.discountCode) {
    const row = await lookupCoupon(env, body.discountCode);
    if (row) {
      discountType = row.type || '';
      discountValue = String(row.value || '');
      const nights = Number(body.nights) || 1;
      const orig = Number(body.originalTotal) || 0;
      if (row.type === 'fixed') discountAmount = Math.round(row.value);
      else if (row.type === 'percent') discountAmount = Math.floor(orig * row.value / 100);
      else if (row.type === 'per_night_fixed') discountAmount = Math.round(row.value * nights);

      // 確保折扣不超過原價
      discountAmount = Math.min(discountAmount, orig);
      couponToConsume = row.code;   // 用實際對到的券碼（年度後綴會對到基本碼），建單成功後才扣用量
    }
  }

  // 生成 orderID
  const orderID = await generateOrderID(env, checkIn);

  // ── 原子鎖定每一個入住夜晚（解決 race condition）─────────────────
  // booking_locks 表以 date 為 PRIMARY KEY；
  // D1 .batch() 是原子性的，任何一晚已被鎖就整批 FAIL → 409。
  const lockNights = expandDates(checkIn, checkOut); // checkIn 到 checkOut-1
  const lockStmts = lockNights.map((d) =>
    env.DB.prepare(
      `INSERT INTO booking_locks (date, orderID) VALUES (?, ?)`
    ).bind(d, orderID)
  );
  try {
    await env.DB.batch(lockStmts);
  } catch (_) {
    // UNIQUE constraint 衝突 → 有另一筆訂單在同時下單且已鎖到同一天
    return json({ success: false, error: '所選日期剛剛已被預訂，請重新選擇' }, 409);
  }

  // rooms / extraBeds / originalTotal 已於鎖定前驗證並算好（見上）。
  // 折扣用後端算出的 originalTotal 重算（percent 型優惠碼需要）
  if (discountType === 'percent' && couponToConsume) {
    const row2 = await env.DB.prepare(
      `SELECT value FROM coupons WHERE code = ? COLLATE NOCASE AND active = 1`
    ).bind(couponToConsume).first();
    if (row2) discountAmount = Math.min(Math.floor(originalTotal * row2.value / 100), originalTotal);
  }
  const totalPrice = Math.max(0, originalTotal - discountAmount);
  const remainingBalance = totalPrice;

  // ── 老客人判斷：同手機號碼有過「已付訂」或「完成」訂單 ────────
  const returningRow = await env.DB.prepare(
    `SELECT orderID FROM orders
     WHERE phone = ? AND status IN ('已付訂','完成') LIMIT 1`
  ).bind(body.phone).first();
  const isReturningGuest = returningRow ? 1 : 0;
  const complimentaryNote = isReturningGuest ? '招待仙草冰' : '';

  // 寫入 orders 表（對齊 0001_init.sql 完整 schema）
  await env.DB.prepare(`
    INSERT INTO orders (
      orderID, name, phone, email,
      checkIn, checkOut, rooms, extraBeds,
      originalTotal, totalPrice, paidDeposit, remainingBalance,
      discountCode, discountType, discountValue, discountAmount,
      isReturningGuest, complimentaryNote,
      sourceType, agencyName, addonAmount, extraIncome,
      notes, internalNotes, housekeepingNote, hasCarRental,
      status, cancelReason,
      agreementSignedName, agreementSignedAt,
      lastUpdated, updatedBy, timestamp
    ) VALUES (
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?
    )
  `).bind(
    orderID, body.name, body.phone, body.email || '',
    checkIn, checkOut, rooms, extraBeds,
    originalTotal, totalPrice, 0, remainingBalance,
    body.discountCode || '', discountType, discountValue, discountAmount,
    isReturningGuest, complimentaryNote,
    '自家', '', 0, 0,
    body.notes || '', '', '', 0,
    '洽談中', '',
    body.agreementSignedName || '', body.agreementSignedAt || '',
    new Date().toISOString(), 'web',
    new Date().toISOString()
  ).run();

  // #3：優惠碼用量在「建單成功後」才扣（前面鎖衝突/驗證失敗就不會虛耗限量券）
  if (couponToConsume) {
    await env.DB.prepare(
      `UPDATE coupons SET usedCount = usedCount + 1
       WHERE code = ? COLLATE NOCASE AND (useLimit = 0 OR usedCount < useLimit)`
    ).bind(couponToConsume).run();
  }

  // ── 自動建立 cost_rows（招待費預填，其餘欄位留空待後台補）─────
  await env.DB.prepare(`
    INSERT OR IGNORE INTO cost_rows
      (orderID, name, checkIn, rebateAmount, complimentaryAmount, otherCost, addonCost, note)
    VALUES (?, ?, ?, 0, ?, 0, 0, ?)
  `).bind(
    orderID,
    body.name,
    checkIn,
    isReturningGuest ? 200 : 0,   // 老客人預設招待費 200，可後台調整
    isReturningGuest ? '招待仙草冰' : ''
  ).run();

  // ── 發信通知（ctx.waitUntil 確保 Worker 不提早 kill）───────────
  const orderForEmail = {
    orderID, name: body.name, phone: body.phone, email: body.email || '',
    checkIn, checkOut, totalPrice, remainingBalance,
    notes: body.notes || '',
  };

  const emailTasks = [];

  // 洽談中確認信給客人（48h LINE 催促版）
  if (orderForEmail.email) {
    emailTasks.push(
      sendEmail(env, {
        to: orderForEmail.email,
        subject: `【雫旅】Hihi ${body.name}，預約申請已收到`,
        html: bookingPendingHtml(orderForEmail),
      }).catch((e) => console.error('[booking/email] 客人洽談中確認信失敗:', e))
    );
  }

  // 管理員通知
  const adminEmail = env.ADMIN_NOTIFY_EMAIL;
  if (adminEmail) {
    emailTasks.push(
      sendEmail(env, {
        to: adminEmail,
        subject: `🔔 新訂單通知 — ${body.name}（${checkIn}）`,
        html: adminNewOrderHtml(orderForEmail),
      }).catch((e) => console.error('[booking/email] 管理員通知失敗:', e))
    );
  }

  // 確保 Worker 回傳 response 後繼續跑完所有寄信任務
  if (emailTasks.length && ctx?.waitUntil) {
    ctx.waitUntil(Promise.all(emailTasks));
  }

  // 訂金 = 總價 30%，連同匯款資訊回給成功畫面顯示。
  // 匯款帳號放 secret（BANK_TRANSFER_INFO），不寫死在前端 → 不會進公開 repo。
  return json({
    success: true,
    orderID,
    bookingId: orderID,
    depositAmount: Math.round(totalPrice * 0.3),
    bankInfo: env.BANK_TRANSFER_INFO || '',
  });
}

/* ── GET /api/booking/lookup 客人自助查詢預約狀態 ──────────────────
   雙條件比對：訂單編號 + 電話都對才回資料（只回必要欄位，不回姓名/備註）。
   電話只比數字，容忍 0912-345-678 / 0912345678 等輸入差異。 */
const LOOKUP_STATUS_LABELS = {
  '洽談中': '已收到預約，等待訂金確認',
  '已付訂': '訂金已確認，預約成立',
  '完成':   '已完成入住，謝謝您',
  '取消':   '此筆預約已取消',
};

export async function lookupBooking(request, env) {
  const url = new URL(request.url);
  const orderID = (url.searchParams.get('orderID') || '').trim();
  const phone = (url.searchParams.get('phone') || '').trim();
  if (!orderID || !phone) {
    return json({ success: false, error: '請提供訂單編號與聯絡電話' }, 400);
  }

  const order = await env.DB.prepare(
    `SELECT orderID, status, checkIn, checkOut, rooms, extraBeds,
            totalPrice, paidDeposit, remainingBalance, phone
     FROM orders WHERE orderID = ?`
  ).bind(orderID).first();

  const digits = (s) => String(s || '').replace(/\D/g, '');
  if (!order || !digits(phone) || digits(order.phone) !== digits(phone)) {
    // 編號不存在與電話不符回同一句話，避免被拿來探測訂單編號是否存在
    return json({ success: false, error: '查無資料，請確認訂單編號與電話是否正確' }, 404);
  }

  return json({
    success: true,
    order: {
      orderID: order.orderID,
      status: order.status,
      statusLabel: LOOKUP_STATUS_LABELS[order.status] || order.status,
      checkIn: order.checkIn,
      checkOut: order.checkOut,
      rooms: order.rooms,
      extraBeds: order.extraBeds,
      totalPrice: order.totalPrice,
      paidDeposit: order.paidDeposit,
      remainingBalance: order.remainingBalance,
      depositDue: Math.round(Number(order.totalPrice || 0) * 0.3),
      // 洽談中才附匯款資訊（弄丟成功畫面的客人可再查到帳號）
      bankInfo: order.status === '洽談中' ? (env.BANK_TRANSFER_INFO || '') : '',
    },
  });
}

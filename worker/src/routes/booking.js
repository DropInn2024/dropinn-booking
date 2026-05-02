import { json } from '../lib/utils.js';

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

function normalizeDate(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return s;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/* ── GET /api/booking/dates 取得已訂日期清單 ──────────────────────── */
export async function getBookedDates(env) {
  const { results } = await env.DB.prepare(
    `SELECT checkIn, checkOut, status FROM orders WHERE status != '取消'`
  ).all();

  const paidSet = new Set();
  const pendingSet = new Set();
  const checkInSet = new Set();

  for (const b of results) {
    const dates = expandDates(b.checkIn, b.checkOut);
    if (b.status === '已付訂' || b.status === '完成') {
      dates.forEach((d) => paidSet.add(d));
    } else if (b.status === '洽談中') {
      dates.forEach((d) => pendingSet.add(d));
    }
    checkInSet.add(b.checkIn);
  }
  return json({
    success: true,
    booked: [...paidSet].sort(),
    pending: [...pendingSet].sort(),
    checkInDates: [...checkInSet].sort(),
  });
}

/* ── GET /api/booking/availability 檢查日期是否可訂 ──────────────── */
export async function checkAvailability(request, env) {
  const url = new URL(request.url);
  const checkIn = normalizeDate(url.searchParams.get('checkIn'));
  const checkOut = normalizeDate(url.searchParams.get('checkOut'));
  if (!checkIn || !checkOut) return json({ available: false, error: '缺少參數' }, 400);

  const newStart = new Date(checkIn).getTime();
  const newEnd = new Date(checkOut).getTime();

  const { results } = await env.DB.prepare(
    `SELECT checkIn, checkOut FROM orders WHERE status != '取消'`
  ).all();

  for (const b of results) {
    const s = new Date(b.checkIn).getTime();
    const e = new Date(b.checkOut).getTime();
    // 區間 [s, e) 與 [newStart, newEnd) 重疊判定
    if (newStart < e && newEnd > s) {
      return json({ available: false, conflict: { checkIn: b.checkIn, checkOut: b.checkOut } });
    }
  }
  return json({ available: true });
}

/* ── POST /api/booking/coupon 驗證優惠碼 ─────────────────────────── */
export async function checkCoupon(request, env) {
  const body = await request.json().catch(() => ({}));
  const { code, originalTotal = 0, nights = 1 } = body;
  if (!code) return json({ valid: false });

  const row = await env.DB.prepare(
    `SELECT * FROM coupons WHERE code = ? AND active = 1`
  ).bind(code).first();
  if (!row) return json({ valid: false });

  const today = new Date().toISOString().slice(0, 10);
  if (row.validFrom && today < row.validFrom) return json({ valid: false });
  if (row.validTo && today > row.validTo) return json({ valid: false });
  if (row.useLimit > 0 && row.usedCount >= row.useLimit) return json({ valid: false });

  let discountAmount = 0;
  if (row.type === 'fixed') discountAmount = Math.round(row.value);
  else if (row.type === 'percent') discountAmount = Math.floor(originalTotal * row.value / 100);
  else if (row.type === 'per_night_fixed') discountAmount = Math.round(row.value * nights);

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
export async function createBooking(request, env) {
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

  // 再次檢查日期是否仍可訂（避免併發）
  const newStart = new Date(checkIn).getTime();
  const newEnd = new Date(checkOut).getTime();
  const { results: existing } = await env.DB.prepare(
    `SELECT checkIn, checkOut FROM orders WHERE status != '取消'`
  ).all();
  for (const b of existing) {
    const s = new Date(b.checkIn).getTime();
    const e = new Date(b.checkOut).getTime();
    if (newStart < e && newEnd > s) {
      return json({ success: false, error: '所選日期已被預訂' }, 409);
    }
  }

  // 驗證優惠碼（若有）
  let discountAmount = 0;
  let discountType = '';
  let discountValue = '';
  if (body.discountCode) {
    const row = await env.DB.prepare(
      `SELECT * FROM coupons WHERE code = ? AND active = 1`
    ).bind(body.discountCode).first();
    if (row) {
      discountType = row.type || '';
      discountValue = String(row.value || '');
      const nights = Number(body.nights) || 1;
      const orig = Number(body.originalTotal) || 0;
      if (row.type === 'fixed') discountAmount = Math.round(row.value);
      else if (row.type === 'percent') discountAmount = Math.floor(orig * row.value / 100);
      else if (row.type === 'per_night_fixed') discountAmount = Math.round(row.value * nights);

      // 增加使用次數
      await env.DB.prepare(
        `UPDATE coupons SET usedCount = usedCount + 1 WHERE code = ?`
      ).bind(body.discountCode).run();
    }
  }

  // 生成 orderID
  const orderID = await generateOrderID(env, checkIn);

  // 計算金額
  const originalTotal = Number(body.originalTotal) || 0;
  const totalPrice = Math.max(0, originalTotal - discountAmount);
  const remainingBalance = totalPrice;

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
    checkIn, checkOut, Number(body.rooms) || 1, Number(body.extraBeds) || 0,
    originalTotal, totalPrice, 0, remainingBalance,
    body.discountCode || '', discountType, discountValue, discountAmount,
    0, '',
    '自家', '', 0, 0,
    body.notes || '', '', '', 0,
    '洽談中', '',
    body.agreementSignedName || '', body.agreementSignedAt || '',
    new Date().toISOString(), 'web',
    new Date().toISOString()
  ).run();

  return json({ success: true, orderID, bookingId: orderID });
}

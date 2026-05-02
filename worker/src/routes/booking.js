import { json } from '../lib/utils.js';

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

export async function getBookedDates(env) {
  const { results } = await env.DB.prepare(
    `SELECT checkIn, checkOut, status FROM bookings WHERE status != '取消'`
  ).all();
  const paidSet = new Set();
  const pendingSet = new Set();
  const checkInSet = new Set();
  for (const b of results) {
    const dates = expandDates(b.checkIn, b.checkOut);
    if (b.status === '已付訂') dates.forEach(d => paidSet.add(d));
    else if (b.status === '洽談中') dates.forEach(d => pendingSet.add(d));
    checkInSet.add(b.checkIn);
  }
  return json({
    success: true,
    booked: [...paidSet].sort(),
    pending: [...pendingSet].sort(),
    checkInDates: [...checkInSet].sort(),
  });
}

export async function checkAvailability(request, env) {
  const url = new URL(request.url);
  const checkIn = url.searchParams.get('checkIn');
  const checkOut = url.searchParams.get('checkOut');
  if (!checkIn || !checkOut) return json({ error: '缺少參數' }, 400);
  const newStart = new Date(checkIn).getTime();
  const newEnd = new Date(checkOut).getTime();
  const { results } = await env.DB.prepare(
    `SELECT checkIn, checkOut FROM bookings WHERE status != '取消'`
  ).all();
  for (const b of results) {
    const s = new Date(b.checkIn).getTime();
    const e = new Date(b.checkOut).getTime();
    if (newStart < e && newEnd > s) {
      return json({ available: false, conflict: { checkIn: b.checkIn, checkOut: b.checkOut } });
    }
  }
  return json({ available: true });
}

export async function checkCoupon(request, env) {
  const body = await request.json().catch(() => ({}));
  const { code, originalTotal, nights } = body;
  if (!code) return json({ valid: false });
  const row = await env.DB.prepare(
    `SELECT * FROM coupons WHERE code = ? AND active = 1`
  ).bind(code).first();
  if (!row) return json({ valid: false });
  const now = new Date().toISOString().slice(0, 10);
  if (row.validFrom && now < row.validFrom) return json({ valid: false });
  if (row.validTo   && now > row.validTo)   return json({ valid: false });
  if (row.useLimit > 0 && row.usedCount >= row.useLimit) return json({ valid: false });
  let discountAmount = 0;
  if (row.type === 'fixed')           discountAmount = row.value;
  else if (row.type === 'percent')    discountAmount = Math.floor(originalTotal * row.value / 100);
  else if (row.type === 'per_night_fixed') discountAmount = row.value * nights;
  return json({ valid: true, discountAmount, description: row.description });
}

export async function createBooking(request, env) {
  const body = await request.json().catch(() => ({}));
  const required = ['name', 'phone', 'checkIn', 'checkOut'];
  for (const k of required) {
    if (!body[k]) return json({ error: `缺少欄位: ${k}` }, 400);
  }
  // Re-check availability
  const newStart = new Date(body.checkIn).getTime();
  const newEnd   = new Date(body.checkOut).getTime();
  const { results } = await env.DB.prepare(
    `SELECT checkIn, checkOut FROM bookings WHERE status != '取消'`
  ).all();
  for (const b of results) {
    const s = new Date(b.checkIn).getTime();
    const e = new Date(b.checkOut).getTime();
    if (newStart < e && newEnd > s) {
      return json({ success: false, error: '所選日期已被預訂' }, 409);
    }
  }
  // Validate coupon if provided
  let discountAmount = 0;
  if (body.discountCode) {
    const row = await env.DB.prepare(
      `SELECT * FROM coupons WHERE code = ? AND active = 1`
    ).bind(body.discountCode).first();
    if (row) {
      if (row.type === 'fixed')           discountAmount = row.value;
      else if (row.type === 'percent')    discountAmount = Math.floor((body.originalTotal || 0) * row.value / 100);
      else if (row.type === 'per_night_fixed') discountAmount = row.value * (body.nights || 1);
      await env.DB.prepare(
        `UPDATE coupons SET usedCount = usedCount + 1 WHERE code = ?`
      ).bind(body.discountCode).run();
    }
  }
  const bookingId = 'BK' + Date.now();
  const totalPrice = (body.originalTotal || 0) - discountAmount;
  await env.DB.prepare(`
    INSERT INTO bookings
      (bookingId,checkIn,checkOut,guestName,guestPhone,guestEmail,
       rooms,nights,extraBeds,packagePrice,extraBedPrice,
       originalTotal,totalPrice,discountCode,discountAmount,notes,status)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'洽談中')
  `).bind(
    bookingId, body.checkIn, body.checkOut, body.name, body.phone, body.email||'',
    body.rooms||1, body.nights||1, body.extraBeds||0,
    body.packagePrice||0, body.extraBedPrice||1000,
    body.originalTotal||0, totalPrice, body.discountCode||'', discountAmount,
    body.notes||''
  ).run();
  return json({ success: true, bookingId });
}

/**
 * housekeeping.js — 房務日曆 API 路由
 *
 * 路由（無需 owner 角色，使用獨立密碼 + 短期 token）：
 *   POST /api/housekeeping/login    → 回傳 token
 *   GET  /api/housekeeping/orders   → 依月份列出訂單（含 housekeepingNote）
 *
 * 環境變數：
 *   env.HOUSEKEEPING_PASSWORD  — 房務登入密碼（wrangler secret put HOUSEKEEPING_PASSWORD）
 *   env.TOKEN_SECRET           — 簽 JWT 用（共用）
 */

import { createToken, verifyToken } from '../lib/token.js';
import { json } from '../lib/utils.js';

/* ── POST /api/housekeeping/login ───────────────────────────────── */
export async function housekeepingLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const { password } = body;

  const correctPwd = env.HOUSEKEEPING_PASSWORD;
  if (!correctPwd) {
    return json({ success: false, error: '房務密碼未設定' }, 500);
  }
  if (!password || password !== correctPwd) {
    return json({ success: false, error: '密碼錯誤' }, 401);
  }

  const token = await createToken(
    { role: 'housekeeping', userId: 'hk' },
    env.TOKEN_SECRET
  );
  return json({ success: true, token });
}

/* ── 驗證 housekeeping token middleware ─────────────────────────── */
export async function verifyHkToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw { status: 401 };
  const payload = await verifyToken(token, env.TOKEN_SECRET);
  if (!payload || payload.role !== 'housekeeping') throw { status: 401 };
  return payload;
}

/* ── GET /api/housekeeping/orders?month=YYYY-MM ─────────────────── */
export async function housekeepingOrders(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '';

  let where = "status != '取消'";
  const binds = [];

  if (/^\d{4}-\d{2}$/.test(month)) {
    // 取得「checkIn 在本月」或「checkOut 在本月」的訂單
    where += ` AND (substr(checkIn,1,7) = ? OR substr(checkOut,1,7) = ?)`;
    binds.push(month, month);
  }

  const stmt = env.DB.prepare(`
    SELECT orderID, name, phone, email,
           checkIn, checkOut, rooms, extraBeds,
           status, housekeepingNote, notes
    FROM orders
    WHERE ${where}
    ORDER BY checkIn ASC
  `);

  const { results } = await (binds.length ? stmt.bind(...binds) : stmt).all();
  return json({ success: true, orders: results || [] });
}

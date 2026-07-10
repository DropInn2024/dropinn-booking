/**
 * restoretheblank.js — 房務日曆 API 路由
 *
 * 路由（無需 owner 角色，使用獨立密碼 + 短期 token）：
 *   POST /api/restoretheblank/login    → 回傳 token
 *   GET  /api/restoretheblank/orders   → 依月份列出訂單（含 housekeepingNote）
 *
 * 環境變數：
 *   env.RTB_PASSWORD   — 房務登入密碼（wrangler secret put RTB_PASSWORD）
 *   env.TOKEN_SECRET   — 簽 JWT 用（共用）
 */

import { createToken, verifyToken } from '../lib/token.js';
import { json } from '../lib/utils.js';
import { rateLimitStrong } from '../lib/rateLimit.js';
import { checkTokenEpoch } from '../lib/middleware.js';

/* ── POST /api/restoretheblank/login ───────────────────────────────── */
export async function rtbLogin(request, env) {
  // 速率限制（audit Phase 2）：共用密碼最怕被暴力猜——CF 原生 binding（5 次/分）＋記憶體兜底
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateLimitStrong(env.LOGIN_RL, 'rtb:' + ip, 8))) {
    return json({ success: false, error: '嘗試次數過多，請稍後再試' }, 429);
  }
  const body = await request.json().catch(() => ({}));
  const { password } = body;

  const correctPwd = env.RTB_PASSWORD;
  if (!correctPwd) {
    return json({ success: false, error: '房務密碼未設定' }, 500);
  }
  if (!password || password !== correctPwd) {
    return json({ success: false, error: '密碼錯誤' }, 401);
  }

  const token = await createToken(
    { role: 'rtb', userId: 'rtb' },
    env.TOKEN_SECRET
  );
  return json({ success: true, token });
}

/* ── 驗證 token middleware ───────────────────────────────────────── */
export async function verifyRtbToken(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw { status: 401 };
  const payload = await verifyToken(token, env.TOKEN_SECRET);
  if (!payload || payload.role !== 'rtb') throw { status: 401 };
  // 換房務密碼（wrangler secret put RTB_PASSWORD）後，把 site_config 的
  // rtb_token_epoch 設成當下 Unix 秒，所有舊 token 即刻失效
  return checkTokenEpoch(env, payload);
}

/* ── GET /api/restoretheblank/orders?month=YYYY-MM ──────────────── */
export async function rtbOrders(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '';

  let where = "status != '取消'";
  const binds = [];

  if (/^\d{4}-\d{2}$/.test(month)) {
    // 重疊條件（checkIn < 次月初 AND checkOut >= 本月初）取代 substr OR：
    // 舊寫法會漏掉「橫跨整個月」的訂單（入住/退房都不在本月）
    const [y, m] = month.split('-').map(Number);
    const monthStart = `${month}-01`;
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    where += ` AND checkIn < ? AND checkOut >= ?`;
    binds.push(nextMonth, monthStart);
  }

  // 個資最小化：房務只需要排班資訊（日期/房數/房務備註）。
  // 姓名/電話/email/客人備註前端從未使用，不再回傳——
  // 共用密碼的房務端不該拿得到全客戶聯絡名單。
  const stmt = env.DB.prepare(`
    SELECT orderID,
           checkIn, checkOut, rooms, extraBeds,
           status, housekeepingNote
    FROM orders
    WHERE ${where}
    ORDER BY checkIn ASC
  `);

  const { results } = await (binds.length ? stmt.bind(...binds) : stmt).all();
  return json({ success: true, orders: results || [] });
}

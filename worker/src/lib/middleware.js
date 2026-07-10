/**
 * Middleware：CORS 處理 + 登入驗證
 */

import { verifyToken } from './token.js';

// 允許的來源
const ALLOWED_ORIGINS = [
  'https://dropinn.tw',
  'https://www.dropinn.tw',
  'http://localhost:3000',
  'http://localhost:8788', // wrangler dev 預設 port
];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

/** 幫 Response 加上 CORS + 安全 headers */
export function cors(response, request) {
  const res = new Response(response.body, response);
  const origin = request?.headers?.get('Origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => res.headers.set(k, v));
  return res;
}

/* Token 撤銷 epoch：site_config 存 owner_token_epoch / rtb_token_epoch（Unix 秒）。
   token 的 iat 早於 epoch ＝ 改密碼前簽的 → 一律作廢（audit Phase 2）。
   60 秒 isolate 快取，避免每個 admin 請求都多打一次 D1。 */
const EPOCH_KEYS = { owner: 'owner_token_epoch', rtb: 'rtb_token_epoch' };
let _epochCache = { t: 0, map: {} };
export async function checkTokenEpoch(env, payload) {
  const key = EPOCH_KEYS[payload?.role];
  if (!key) return payload;                       // guest / friend 不套 epoch
  const now = Date.now();
  if (now - _epochCache.t > 60000) {
    const rows = await env.DB.prepare(
      "SELECT key, value FROM site_config WHERE key IN ('owner_token_epoch','rtb_token_epoch')"
    ).all().catch(() => ({ results: [] }));
    _epochCache = {
      t: now,
      map: Object.fromEntries((rows.results || []).map((r) => [r.key, parseInt(r.value, 10) || 0])),
    };
  }
  if ((payload.iat || 0) < (_epochCache.map[key] || 0)) {
    throw Object.assign(new Error('token revoked'), { status: 401 });
  }
  return payload;
}

/** 從 Authorization header 取出並驗證 token，回傳 user */
export async function withAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const secret = env.TOKEN_SECRET;
  if (!secret) throw Object.assign(new Error('TOKEN_SECRET not set'), { status: 500 });
  const payload = await verifyToken(token, secret); // 失敗會丟 { status: 401 } 的錯誤
  return checkTokenEpoch(env, payload);
}

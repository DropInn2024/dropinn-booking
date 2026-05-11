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

/** 從 Authorization header 取出並驗證 token，回傳 user */
export async function withAuth(request, env) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const secret = env.TOKEN_SECRET;
  if (!secret) throw Object.assign(new Error('TOKEN_SECRET not set'), { status: 500 });
  return verifyToken(token, secret); // 失敗會丟 { status: 401 } 的錯誤
}

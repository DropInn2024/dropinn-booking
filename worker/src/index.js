/**
 * Drop Inn — Cloudflare Worker
 * 路由入口：所有 /api/* 請求都進這裡
 */

import { handleAuth }    from './routes/auth.js';
import { handleReviews } from './routes/reviews.js';
import { handleAdmin }   from './routes/admin.js';
import { cors, withAuth } from './lib/middleware.js';

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return cors(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);
    const path = url.pathname; // e.g. /api/drift/login

    try {
      // ── Auth 路由（公開）──────────────────────────────────
      if (path === '/api/drift/login')    return cors(await handleAuth(request, env, 'login'));
      if (path === '/api/drift/register') return cors(await handleAuth(request, env, 'register'));

      // ── 評論讀取（公開）──────────────────────────────────
      if (path === '/api/drift/reviews' && request.method === 'GET') {
        return cors(await handleReviews(request, env, null, 'list'));
      }

      // ── 需要登入的路由 ────────────────────────────────────
      const user = await withAuth(request, env);

      // 評論新增/更新
      if (path === '/api/drift/reviews' && request.method === 'POST') {
        return cors(await handleReviews(request, env, user, 'save'));
      }
      // 評論刪除
      const delMatch = path.match(/^\/api\/drift\/reviews\/(.+)$/);
      if (delMatch && request.method === 'DELETE') {
        return cors(await handleReviews(request, env, user, 'delete', delMatch[1]));
      }

      // 主理人專用路由
      if (path.startsWith('/api/drift/admin')) {
        if (user.role !== 'owner') return cors(json({ error: '權限不足' }, 403));
        return cors(await handleAdmin(request, env, user, path));
      }

      // 個人資料
      if (path === '/api/drift/profile' && request.method === 'GET') {
        return cors(await handleAuth(request, env, 'profile', user));
      }
      if (path === '/api/drift/profile' && request.method === 'PUT') {
        return cors(await handleAuth(request, env, 'updateProfile', user));
      }

      return cors(json({ error: '找不到路由' }, 404));

    } catch (err) {
      // 未登入
      if (err.status === 401) return cors(json({ error: '請先登入' }, 401));
      console.error('Worker error:', err);
      return cors(json({ error: '伺服器錯誤' }, 500));
    }
  }
};

// 小工具：快速回傳 JSON
export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

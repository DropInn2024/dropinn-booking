/**
 * Drop Inn — Cloudflare Worker
 * 路由入口：所有 /api/* 請求都進這裡
 */

import { handleAuth }    from './routes/auth.js';
import { handleReviews } from './routes/reviews.js';
import { handleAdmin }   from './routes/admin.js';
import { getBookedDates, checkAvailability, checkCoupon, createBooking } from './routes/booking.js';
import {
  listOrders, getOrder, updateOrder, deleteOrder,
  listOrderCosts, upsertOrderCost, monthStats,
} from './routes/orders.js';
import { cors, withAuth } from './lib/middleware.js';
import { json } from './lib/utils.js';

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

      if (path === '/api/booking/dates' && request.method === 'GET')
        return cors(await getBookedDates(env));
      if (path === '/api/booking/availability' && request.method === 'GET')
        return cors(await checkAvailability(request, env));
      if (path === '/api/booking/coupon' && request.method === 'POST')
        return cors(await checkCoupon(request, env));
      if (path === '/api/booking/order' && request.method === 'POST')
        return cors(await createBooking(request, env));

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

      // ── 後台訂單管理（owner 限定）─────────────────────────
      if (path === '/api/orders' || path === '/api/stats/month' ||
          path.startsWith('/api/orders/')) {
        if (user.role !== 'owner') return cors(json({ error: '權限不足' }, 403));

        if (path === '/api/orders' && request.method === 'GET') {
          return cors(await listOrders(request, env));
        }
        if (path === '/api/stats/month' && request.method === 'GET') {
          return cors(await monthStats(request, env));
        }

        // /api/orders/:id/costs
        const costsMatch = path.match(/^\/api\/orders\/([^/]+)\/costs$/);
        if (costsMatch) {
          const orderId = decodeURIComponent(costsMatch[1]);
          if (request.method === 'GET')
            return cors(await listOrderCosts(request, env, orderId));
          if (request.method === 'PUT')
            return cors(await upsertOrderCost(request, env, orderId));
          return cors(json({ error: 'method not allowed' }, 405));
        }

        // /api/orders/:id
        const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
        if (orderMatch) {
          const orderId = decodeURIComponent(orderMatch[1]);
          if (request.method === 'GET')
            return cors(await getOrder(request, env, orderId));
          if (request.method === 'PATCH')
            return cors(await updateOrder(request, env, orderId, user));
          if (request.method === 'DELETE')
            return cors(await deleteOrder(request, env, orderId, user));
          return cors(json({ error: 'method not allowed' }, 405));
        }
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


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
import {
  agencyLogin, agencyRegister,
  getAgencyProperties, addProperty, manageProperty,
  getAgencyBlocks, setAgencyBlock,
  getPartnerCalendar,
} from './routes/agency.js';
import {
  adminHealth,
  adminFinanceStats, adminFinanceDetailed,
  getMonthlyExpense, saveMonthlyExpense,
  adminCreateOrder, markCompletedOrders, adminGetOrderCost,
  listCoupons, saveCoupon, deleteCoupon,
  agencyPendingList, agencyApprovedList, agencyAllData,
  agencyApprove, agencyReject, agencyAdminDelete,
  listGroups, createGroup, addGroupMember, removeGroupMember,
  listReferrals, addReferral,
} from './routes/notforyouAdmin.js';
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

      // ── 同業 (agency) 公開路由 ────────────────────────────
      if (path === '/api/agency/login' && request.method === 'POST')
        return cors(await agencyLogin(request, env));
      if (path === '/api/agency/register' && request.method === 'POST')
        return cors(await agencyRegister(request, env));

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

      // ── 同業 (agency) 受保護路由 ──────────────────────────
      if (path.startsWith('/api/agency/')) {
        if (user.role !== 'agency' && user.role !== 'owner') {
          return cors(json({ error: '權限不足' }, 403));
        }
        const agencyId = user.userId;

        if (path === '/api/agency/properties' && request.method === 'GET')
          return cors(await getAgencyProperties(request, env, agencyId));
        if (path === '/api/agency/properties' && request.method === 'POST')
          return cors(await addProperty(request, env, agencyId));

        if (path === '/api/agency/blocks' && request.method === 'GET')
          return cors(await getAgencyBlocks(request, env));
        if (path === '/api/agency/blocks' && request.method === 'POST')
          return cors(await setAgencyBlock(request, env, agencyId));

        if (path === '/api/agency/partner-calendar' && request.method === 'GET')
          return cors(await getPartnerCalendar(request, env, agencyId));

        const propMatch = path.match(/^\/api\/agency\/properties\/(.+)$/);
        if (propMatch) {
          const propertyId = decodeURIComponent(propMatch[1]);
          return cors(await manageProperty(request, env, agencyId, propertyId, request.method));
        }
      }

      // ── 後台管理（owner 限定）─────────────────────────────────────
      if (path.startsWith('/api/admin/')) {
        if (user.role !== 'owner') return cors(json({ error: '權限不足' }, 403));

        if (path === '/api/admin/health' && request.method === 'GET')
          return cors(await adminHealth(request, env));

        if (path === '/api/admin/finance' && request.method === 'GET')
          return cors(await adminFinanceStats(request, env));
        if (path === '/api/admin/finance/detailed' && request.method === 'GET')
          return cors(await adminFinanceDetailed(request, env));

        if (path === '/api/admin/monthly-expense' && request.method === 'GET')
          return cors(await getMonthlyExpense(request, env));
        if (path === '/api/admin/monthly-expense' && request.method === 'PUT')
          return cors(await saveMonthlyExpense(request, env));

        if (path === '/api/admin/coupons' && request.method === 'GET')
          return cors(await listCoupons(env));
        if (path === '/api/admin/coupons' && request.method === 'POST')
          return cors(await saveCoupon(request, env));
        const couponDelMatch = path.match(/^\/api\/admin\/coupons\/(.+)$/);
        if (couponDelMatch && request.method === 'DELETE')
          return cors(await deleteCoupon(env, decodeURIComponent(couponDelMatch[1])));

        if (path === '/api/admin/referrals' && request.method === 'GET')
          return cors(await listReferrals(env));
        if (path === '/api/admin/referrals' && request.method === 'POST')
          return cors(await addReferral(request, env));

        if (path === '/api/admin/agency/pending' && request.method === 'GET')
          return cors(await agencyPendingList(env));
        if (path === '/api/admin/agency/approved' && request.method === 'GET')
          return cors(await agencyApprovedList(env));
        if (path === '/api/admin/agency/all' && request.method === 'GET')
          return cors(await agencyAllData(env));
        if (path === '/api/admin/agency/groups' && request.method === 'GET')
          return cors(await listGroups(env));
        if (path === '/api/admin/agency/groups' && request.method === 'POST')
          return cors(await createGroup(request, env));

        const groupMemberDelMatch = path.match(/^\/api\/admin\/agency\/groups\/([^/]+)\/members\/(.+)$/);
        if (groupMemberDelMatch && request.method === 'DELETE')
          return cors(await removeGroupMember(env,
            decodeURIComponent(groupMemberDelMatch[1]),
            decodeURIComponent(groupMemberDelMatch[2])));

        const groupPatchMatch = path.match(/^\/api\/admin\/agency\/groups\/([^/]+)$/);
        if (groupPatchMatch && request.method === 'PATCH')
          return cors(await addGroupMember(request, env, decodeURIComponent(groupPatchMatch[1])));

        const agencyActionMatch = path.match(/^\/api\/admin\/agency\/([^/]+)\/(approve|reject)$/);
        if (agencyActionMatch && request.method === 'PATCH') {
          const loginId = decodeURIComponent(agencyActionMatch[1]);
          return cors(agencyActionMatch[2] === 'approve'
            ? await agencyApprove(env, loginId)
            : await agencyReject(env, loginId));
        }
        const agencyDelMatch = path.match(/^\/api\/admin\/agency\/([^/]+)$/);
        if (agencyDelMatch && request.method === 'DELETE')
          return cors(await agencyAdminDelete(env, decodeURIComponent(agencyDelMatch[1])));

        if (path === '/api/admin/orders' && request.method === 'POST')
          return cors(await adminCreateOrder(request, env));
        if (path === '/api/admin/orders/mark-completed' && request.method === 'POST')
          return cors(await markCompletedOrders(env));

        const adminOrderCostMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/costs$/);
        if (adminOrderCostMatch && request.method === 'GET')
          return cors(await adminGetOrderCost(env, decodeURIComponent(adminOrderCostMatch[1])));

        const adminOrderMatch = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
        if (adminOrderMatch && request.method === 'PATCH')
          return cors(await updateOrder(request, env, decodeURIComponent(adminOrderMatch[1]), user));

        return cors(json({ error: '找不到路由' }, 404));
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


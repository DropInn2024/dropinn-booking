/**
 * Drop Inn — Cloudflare Worker
 * 路由入口：所有 /api/* 請求都進這裡
 * Cron：洽談中 48h 自動取消 + 入住前一天提醒信
 */

import { handleAuth }    from './routes/auth.js';
import { handleReviews } from './routes/reviews.js';
import { handleAdmin }   from './routes/admin.js';
import { getBookedDates, checkAvailability, checkCoupon, createBooking } from './routes/booking.js';
import { sendEmail } from './lib/email.js';
import { checkInReminderHtml, cancellationHtml, thankYouHtml, adminNewOrderHtml, bookingConfirmHtml } from './lib/emailTemplates.js';
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
  updateVisiblePartners,
} from './routes/notforyouAdmin.js';
import { housekeepingLogin, housekeepingOrders, verifyHkToken } from './routes/housekeeping.js';
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

      // ── 房務 (housekeeping) 公開路由 ─────────────────────
      if (path === '/api/housekeeping/login' && request.method === 'POST')
        return cors(await housekeepingLogin(request, env));

      // ── 房務 (housekeeping) 受保護路由 ───────────────────
      if (path.startsWith('/api/housekeeping/')) {
        await verifyHkToken(request, env); // throws 401 if invalid
        if (path === '/api/housekeeping/orders' && request.method === 'GET')
          return cors(await housekeepingOrders(request, env));
        return cors(json({ error: '找不到路由' }, 404));
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
        const agencyVpMatch = path.match(/^\/api\/admin\/agency\/([^/]+)\/visible-partners$/);
        if (agencyVpMatch && request.method === 'PATCH')
          return cors(await updateVisiblePartners(request, env, decodeURIComponent(agencyVpMatch[1])));

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
  },

  /* ── Cron Triggers ─────────────────────────────────────────────
     crons[0] = "0 * * * *"   → 每小時整點：自動取消洽談中超過 48h 的訂單
     crons[1] = "0 4 * * *"   → UTC 04:00 (台灣 12:00)：入住前一天提醒信
  */
  async scheduled(event, env, _ctx) {
    const cron = event.cron;
    console.log('[cron] trigger:', cron);

    // ── 每小時整點：洽談中 48h 自動取消 ─────────────────────────
    if (cron === '0 * * * *') {
      await autoCancelPending(env);
    }

    // ── UTC 04:00（台灣 12:00）：入住前一天提醒信 ────────────────
    if (cron === '0 4 * * *') {
      await sendCheckInReminders(env);
    }
  },
};

/* ══════════════════════════════════════════════════════════════════
   Cron handlers
══════════════════════════════════════════════════════════════════ */

/**
 * 自動取消超過 48 小時的「洽談中」訂單
 * 建立時間 (timestamp) 早於 now-48h 的洽談中訂單 → 改為「取消」
 */
async function autoCancelPending(env) {
  try {
    // 48 小時前的 ISO timestamp
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { results } = await env.DB.prepare(`
      SELECT orderID, name, email, phone, checkIn, checkOut,
             totalPrice, remainingBalance, cancelReason
      FROM orders
      WHERE status = '洽談中' AND timestamp <= ?
    `).bind(cutoff).all();

    if (!results?.length) {
      console.log('[cron/cancel] 無需取消的訂單');
      return;
    }

    for (const order of results) {
      await env.DB.prepare(`
        UPDATE orders
        SET status = '取消',
            cancelReason = '洽談中逾期 48 小時自動取消',
            lastUpdated = datetime('now', '+8 hours'),
            updatedBy = 'cron'
        WHERE orderID = ?
      `).bind(order.orderID).run();

      console.log('[cron/cancel] 已取消:', order.orderID);

      // 寄取消通知給客人（有 email 才寄）
      if (order.email) {
        await sendEmail(env, {
          to: order.email,
          subject: `雫旅 — 訂單已取消（${order.orderID}）`,
          html: cancellationHtml({ ...order, cancelReason: '洽談中逾期 48 小時自動取消' }),
        });
      }
    }

    console.log(`[cron/cancel] 共取消 ${results.length} 筆`);
  } catch (err) {
    console.error('[cron/cancel] 錯誤:', err);
  }
}

/**
 * 寄送入住前一天提醒信
 * 今天（台灣時間）日期 +1 = 明天；找出 checkIn = 明天 且 reminderSent != 1 的訂單
 */
async function sendCheckInReminders(env) {
  try {
    // 台灣時間 = UTC+8
    const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const tomorrow = new Date(nowTW);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10); // YYYY-MM-DD

    const { results } = await env.DB.prepare(`
      SELECT orderID, name, email, phone, checkIn, checkOut,
             totalPrice, remainingBalance, notes
      FROM orders
      WHERE checkIn = ?
        AND status IN ('洽談中', '已付訂')
        AND (reminderSent IS NULL OR reminderSent = 0)
        AND email != '' AND email IS NOT NULL
    `).bind(tomorrowStr).all();

    if (!results?.length) {
      console.log('[cron/reminder] 明天無入住，或已寄出提醒');
      return;
    }

    for (const order of results) {
      const result = await sendEmail(env, {
        to: order.email,
        subject: `雫旅 — 明天見！入住提醒（${order.checkIn}）`,
        html: checkInReminderHtml(order),
      });

      if (result.success) {
        await env.DB.prepare(`
          UPDATE orders SET reminderSent = 1, lastUpdated = datetime('now', '+8 hours')
          WHERE orderID = ?
        `).bind(order.orderID).run();
        console.log('[cron/reminder] 已寄提醒:', order.orderID, order.email);
      } else {
        console.error('[cron/reminder] 寄信失敗:', order.orderID, result.error);
      }
    }
  } catch (err) {
    console.error('[cron/reminder] 錯誤:', err);
  }
}

/* ── 公開工具函式（給 booking.js 呼叫）─────────────────────────── */

/**
 * 新訂單建立後寄信（給 booking.js 使用）
 * @param {object} env
 * @param {object} order  新建立的訂單資料
 */
export async function notifyNewBooking(env, order) {
  // 寄確認信給客人
  if (order.email) {
    await sendEmail(env, {
      to: order.email,
      subject: `雫旅 — 已收到您的預訂申請（${order.orderID}）`,
      html: bookingConfirmHtml(order),
    });
  }

  // 寄通知信給管理員
  const adminEmail = env.ADMIN_NOTIFY_EMAIL;
  if (adminEmail) {
    await sendEmail(env, {
      to: adminEmail,
      subject: `[雫旅] 新訂單：${order.name} ${order.checkIn} — ${order.checkOut}`,
      html: adminNewOrderHtml(order),
    });
  }
}

/**
 * 訂單狀態變更時寄通知（給 orders.js 使用）
 * @param {object} env
 * @param {object} order  更新後的訂單
 * @param {string} newStatus  新狀態
 */
export async function notifyStatusChange(env, order, newStatus) {
  if (!order.email) return;

  if (newStatus === '取消') {
    await sendEmail(env, {
      to: order.email,
      subject: `雫旅 — 訂單已取消（${order.orderID}）`,
      html: cancellationHtml(order),
    });
  } else if (newStatus === '完成') {
    await sendEmail(env, {
      to: order.email,
      subject: `雫旅 — 感謝您的到來（${order.orderID}）`,
      html: thankYouHtml(order),
    });
  }
}

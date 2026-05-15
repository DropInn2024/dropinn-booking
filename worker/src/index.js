/**
 * Drop Inn — Cloudflare Worker
 * 路由入口：所有 /api/* 請求都進這裡
 * Cron：洽談中 48h 自動取消 + 40h 警告 + 入住前一天提醒 + 入住前 7 天旅遊手冊 + 退房隔天感謝信
 */

import { handleAuth }    from './routes/auth.js';
import { handleReviews } from './routes/reviews.js';
import { handleAdmin }   from './routes/admin.js';
import { getBookedDates, checkAvailability, checkCoupon, createBooking } from './routes/booking.js';
import { sendEmail } from './lib/email.js';
import {
  checkInReminderHtml, cancellationHtml,
  travelGuideHtml, thankYouHtml, pendingWarningHtml,
  adminStatusNotifyHtml,
} from './lib/emailTemplates.js';
import {
  listOrders, getOrder, updateOrder, deleteOrder,
  listOrderCosts, upsertOrderCost, monthStats,
} from './routes/orders.js';
import {
  agencyLogin, agencyRegister,
  getAgencyProperties, addProperty, manageProperty,
  getAgencyBlocks, setAgencyBlock,
  getPartnerCalendar,
  changeAgencyPassword,
} from './routes/agency.js';
import {
  adminHealth,
  adminFinanceStats, adminFinanceDetailed,
  getMonthlyExpense, saveMonthlyExpense,
  adminCreateOrder, markCompletedOrders, adminGetOrderCost,
  listCoupons, saveCoupon, deleteCoupon,
  agencyPendingList, agencyApprovedList, agencyAllData,
  agencyApprove, agencyReject, agencyAdminDelete, agencyAdminCreate, agencyAdminResetPassword,
  listGroups, createGroup, addGroupMember, removeGroupMember,
  listReferrals, addReferral,
  updateVisiblePartners,
} from './routes/notforyouAdmin.js';
import { rtbLogin, rtbOrders, verifyRtbToken } from './routes/restoretheblank.js';
import { cors, withAuth } from './lib/middleware.js';
import { json } from './lib/utils.js';

export default {
  async fetch(request, env, ctx) {
    // 本地 wrapper：確保所有回應都帶正確的 CORS + 安全 headers
    const c = (res) => cors(res, request);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return c(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);
    const path = url.pathname; // e.g. /api/drift/login

    try {
      // ── Auth 路由（公開）──────────────────────────────────
      if (path === '/api/drift/login')    return c(await handleAuth(request, env, 'login'));
      if (path === '/api/drift/register') return c(await handleAuth(request, env, 'register'));

      // ── 評論讀取（公開）──────────────────────────────────
      if (path === '/api/drift/reviews' && request.method === 'GET') {
        return c(await handleReviews(request, env, null, 'list'));
      }

      if (path === '/api/booking/dates' && request.method === 'GET')
        return c(await getBookedDates(env));
      if (path === '/api/booking/availability' && request.method === 'GET')
        return c(await checkAvailability(request, env));
      if (path === '/api/booking/coupon' && request.method === 'POST')
        return c(await checkCoupon(request, env));
      if (path === '/api/booking/order' && request.method === 'POST')
        return c(await createBooking(request, env));

      // ── 同業 (agency) 公開路由 ────────────────────────────
      if (path === '/api/agency/login' && request.method === 'POST')
        return c(await agencyLogin(request, env));
      if (path === '/api/agency/register' && request.method === 'POST')
        return c(await agencyRegister(request, env));

      // ── 房務 (restoretheblank) 公開路由 ──────────────────
      if (path === '/api/restoretheblank/login' && request.method === 'POST')
        return c(await rtbLogin(request, env));

      // ── 房務 (restoretheblank) 受保護路由 ────────────────
      if (path.startsWith('/api/restoretheblank/')) {
        await verifyRtbToken(request, env); // throws 401 if invalid
        if (path === '/api/restoretheblank/orders' && request.method === 'GET')
          return c(await rtbOrders(request, env));
        return c(json({ error: '找不到路由' }, 404));
      }

      // ── 需要登入的路由 ────────────────────────────────────
      const user = await withAuth(request, env);

      // 評論新增/更新
      if (path === '/api/drift/reviews' && request.method === 'POST') {
        return c(await handleReviews(request, env, user, 'save'));
      }
      // 評論刪除
      const delMatch = path.match(/^\/api\/drift\/reviews\/(.+)$/);
      if (delMatch && request.method === 'DELETE') {
        return c(await handleReviews(request, env, user, 'delete', delMatch[1]));
      }

      // 主理人專用路由
      if (path.startsWith('/api/drift/admin')) {
        if (user.role !== 'owner') return c(json({ error: '權限不足' }, 403));
        return c(await handleAdmin(request, env, user, path));
      }

      // ── 後台訂單管理（owner 限定）─────────────────────────
      if (path === '/api/orders' || path === '/api/stats/month' ||
          path.startsWith('/api/orders/')) {
        if (user.role !== 'owner') return c(json({ error: '權限不足' }, 403));

        if (path === '/api/orders' && request.method === 'GET') {
          return c(await listOrders(request, env));
        }
        if (path === '/api/stats/month' && request.method === 'GET') {
          return c(await monthStats(request, env));
        }

        // /api/orders/:id/costs
        const costsMatch = path.match(/^\/api\/orders\/([^/]+)\/costs$/);
        if (costsMatch) {
          const orderId = decodeURIComponent(costsMatch[1]);
          if (request.method === 'GET')
            return c(await listOrderCosts(request, env, orderId));
          if (request.method === 'PUT')
            return c(await upsertOrderCost(request, env, orderId));
          return c(json({ error: 'method not allowed' }, 405));
        }

        // /api/orders/:id
        const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
        if (orderMatch) {
          const orderId = decodeURIComponent(orderMatch[1]);
          if (request.method === 'GET')
            return c(await getOrder(request, env, orderId));
          if (request.method === 'PATCH')
            return c(await updateOrder(request, env, orderId, user));
          if (request.method === 'DELETE')
            return c(await deleteOrder(request, env, orderId, user));
          return c(json({ error: 'method not allowed' }, 405));
        }
      }

      // ── 同業 (agency) 受保護路由 ──────────────────────────
      if (path.startsWith('/api/agency/')) {
        if (user.role !== 'agency' && user.role !== 'owner') {
          return c(json({ error: '權限不足' }, 403));
        }
        const agencyId = user.userId;

        if (path === '/api/agency/properties' && request.method === 'GET')
          return c(await getAgencyProperties(request, env, agencyId));
        if (path === '/api/agency/properties' && request.method === 'POST')
          return c(await addProperty(request, env, agencyId));

        if (path === '/api/agency/blocks' && request.method === 'GET')
          return c(await getAgencyBlocks(request, env));
        if (path === '/api/agency/blocks' && request.method === 'POST')
          return c(await setAgencyBlock(request, env, agencyId));

        if (path === '/api/agency/partner-calendar' && request.method === 'GET')
          return c(await getPartnerCalendar(request, env, agencyId));

        if (path === '/api/agency/change-password' && request.method === 'POST')
          return c(await changeAgencyPassword(request, env, agencyId));

        const propMatch = path.match(/^\/api\/agency\/properties\/(.+)$/);
        if (propMatch) {
          const propertyId = decodeURIComponent(propMatch[1]);
          return c(await manageProperty(request, env, agencyId, propertyId, request.method));
        }
      }

      // ── 後台管理（owner 限定）─────────────────────────────────────
      if (path.startsWith('/api/admin/')) {
        if (user.role !== 'owner') return c(json({ error: '權限不足' }, 403));

        if (path === '/api/admin/health' && request.method === 'GET')
          return c(await adminHealth(request, env));

        if (path === '/api/admin/finance' && request.method === 'GET')
          return c(await adminFinanceStats(request, env));
        if (path === '/api/admin/finance/detailed' && request.method === 'GET')
          return c(await adminFinanceDetailed(request, env));

        if (path === '/api/admin/monthly-expense' && request.method === 'GET')
          return c(await getMonthlyExpense(request, env));
        if (path === '/api/admin/monthly-expense' && request.method === 'PUT')
          return c(await saveMonthlyExpense(request, env));

        if (path === '/api/admin/coupons' && request.method === 'GET')
          return c(await listCoupons(env));
        if (path === '/api/admin/coupons' && request.method === 'POST')
          return c(await saveCoupon(request, env));
        const couponDelMatch = path.match(/^\/api\/admin\/coupons\/(.+)$/);
        if (couponDelMatch && request.method === 'DELETE')
          return c(await deleteCoupon(env, decodeURIComponent(couponDelMatch[1])));

        if (path === '/api/admin/referrals' && request.method === 'GET')
          return c(await listReferrals(env));
        if (path === '/api/admin/referrals' && request.method === 'POST')
          return c(await addReferral(request, env));

        if (path === '/api/admin/agency/create' && request.method === 'POST')
          return c(await agencyAdminCreate(request, env));

        const agencyResetPwMatch = path.match(/^\/api\/admin\/agency\/([^/]+)\/reset-password$/);
        if (agencyResetPwMatch && request.method === 'POST')
          return c(await agencyAdminResetPassword(request, env, decodeURIComponent(agencyResetPwMatch[1])));

        if (path === '/api/admin/agency/pending' && request.method === 'GET')
          return c(await agencyPendingList(env));
        if (path === '/api/admin/agency/approved' && request.method === 'GET')
          return c(await agencyApprovedList(env));
        if (path === '/api/admin/agency/all' && request.method === 'GET')
          return c(await agencyAllData(env));
        if (path === '/api/admin/agency/groups' && request.method === 'GET')
          return c(await listGroups(env));
        if (path === '/api/admin/agency/groups' && request.method === 'POST')
          return c(await createGroup(request, env));

        const groupMemberDelMatch = path.match(/^\/api\/admin\/agency\/groups\/([^/]+)\/members\/(.+)$/);
        if (groupMemberDelMatch && request.method === 'DELETE')
          return c(await removeGroupMember(env,
            decodeURIComponent(groupMemberDelMatch[1]),
            decodeURIComponent(groupMemberDelMatch[2])));

        const groupPatchMatch = path.match(/^\/api\/admin\/agency\/groups\/([^/]+)$/);
        if (groupPatchMatch && request.method === 'PATCH')
          return c(await addGroupMember(request, env, decodeURIComponent(groupPatchMatch[1])));

        const agencyActionMatch = path.match(/^\/api\/admin\/agency\/([^/]+)\/(approve|reject)$/);
        if (agencyActionMatch && request.method === 'PATCH') {
          const loginId = decodeURIComponent(agencyActionMatch[1]);
          return c(agencyActionMatch[2] === 'approve'
            ? await agencyApprove(env, loginId)
            : await agencyReject(env, loginId));
        }
        const agencyVpMatch = path.match(/^\/api\/admin\/agency\/([^/]+)\/visible-partners$/);
        if (agencyVpMatch && request.method === 'PATCH')
          return c(await updateVisiblePartners(request, env, decodeURIComponent(agencyVpMatch[1])));

        const agencyDelMatch = path.match(/^\/api\/admin\/agency\/([^/]+)$/);
        if (agencyDelMatch && request.method === 'DELETE')
          return c(await agencyAdminDelete(env, decodeURIComponent(agencyDelMatch[1])));

        if (path === '/api/admin/orders' && request.method === 'POST')
          return c(await adminCreateOrder(request, env));
        if (path === '/api/admin/orders/mark-completed' && request.method === 'POST')
          return c(await markCompletedOrders(env));

        const adminOrderCostMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/costs$/);
        if (adminOrderCostMatch && request.method === 'GET')
          return c(await adminGetOrderCost(env, decodeURIComponent(adminOrderCostMatch[1])));

        const adminOrderMatch = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
        if (adminOrderMatch && request.method === 'PATCH')
          return c(await updateOrder(request, env, decodeURIComponent(adminOrderMatch[1]), user));

        return c(json({ error: '找不到路由' }, 404));
      }

      // 個人資料
      if (path === '/api/drift/profile' && request.method === 'GET') {
        return c(await handleAuth(request, env, 'profile', user));
      }
      if (path === '/api/drift/profile' && request.method === 'PUT') {
        return c(await handleAuth(request, env, 'updateProfile', user));
      }

      return c(json({ error: '找不到路由' }, 404));

    } catch (err) {
      // 未登入
      if (err.status === 401) return c(json({ error: '請先登入' }, 401));
      console.error('Worker error:', err);
      return c(json({ error: '伺服器錯誤' }, 500));
    }
  },

  /* ── Cron Triggers ─────────────────────────────────────────────
     "0 * * * *"  → 每小時整點：洽談中 48h 自動取消 & 40h 警告
     "0 2 * * *"  → UTC 02:00 (台灣 10:00)：入住前 7 天旅遊手冊 + 退房隔天感謝信
     "0 4 * * *"  → UTC 04:00 (台灣 12:00)：入住前一天提醒信
  */
  async scheduled(event, env, _ctx) {
    const cron = event.cron;
    console.log('[cron] trigger:', cron);

    // ── 每小時整點：洽談中 48h 自動取消 & 40h 警告 ──────────────
    if (cron === '0 * * * *') {
      await autoCancelPending(env);
      await sendPendingWarnings(env);
    }

    // ── UTC 02:00 (台灣 10:00)：7 天旅遊手冊 & 退房隔天感謝信 & 自動完成訂單 ───
    if (cron === '0 2 * * *') {
      await sendTravelGuides(env);
      await sendPostStayThankYou(env);
      await autoMarkCompleted(env);
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
        const cancelledOrder = { ...order, cancelReason: '洽談中逾期 48 小時自動取消', paidDeposit: 0 };
        await sendEmail(env, {
          to: order.email,
          subject: `【雫旅】謝謝您，${order.name}`,
          html: cancellationHtml(cancelledOrder),
        });
      }
    }

    console.log(`[cron/cancel] 共取消 ${results.length} 筆`);
  } catch (err) {
    console.error('[cron/cancel] 錯誤:', err);
  }
}

/**
 * 洽談中 40 小時警告信（距 48h 自動取消還有約 8 小時）
 * 條件：timestamp 介於 40–48 小時前、reminderSent IS NULL or 0
 */
async function sendPendingWarnings(env) {
  try {
    // 40h ~ 48h 前
    const now = Date.now();
    const t40 = new Date(now - 40 * 60 * 60 * 1000).toISOString();
    const t48 = new Date(now - 48 * 60 * 60 * 1000).toISOString();

    const { results } = await env.DB.prepare(`
      SELECT orderID, name, email, phone, checkIn, checkOut, totalPrice, timestamp
      FROM orders
      WHERE status = '洽談中'
        AND timestamp <= ?
        AND timestamp >  ?
        AND (reminderSent IS NULL OR reminderSent = 0)
        AND email != '' AND email IS NOT NULL
    `).bind(t40, t48).all();

    if (!results?.length) {
      console.log('[cron/warning] 無需發出 40h 警告');
      return;
    }

    for (const order of results) {
      const result = await sendEmail(env, {
        to: order.email,
        subject: `【雫旅】${order.name}，預約即將自動取消，請盡快確認`,
        html: pendingWarningHtml(order),
      });

      if (result.success) {
        await env.DB.prepare(`
          UPDATE orders SET reminderSent = 1, lastUpdated = datetime('now', '+8 hours')
          WHERE orderID = ?
        `).bind(order.orderID).run();
        console.log('[cron/warning] 已寄警告:', order.orderID, order.email);
      } else {
        console.error('[cron/warning] 寄信失敗:', order.orderID, result.error);
      }
    }
  } catch (err) {
    console.error('[cron/warning] 錯誤:', err);
  }
}

/**
 * 入住前 7 天旅遊手冊寄送
 * 條件：checkIn = 台灣時間今天 +7 天、status = '已付訂'、travelGuideSent != 1
 */
async function sendTravelGuides(env) {
  try {
    // 台灣時間 = UTC+8
    const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const target = new Date(nowTW);
    target.setDate(target.getDate() + 7);
    const targetStr = target.toISOString().slice(0, 10);

    const { results } = await env.DB.prepare(`
      SELECT orderID, name, email, phone, checkIn, checkOut,
             totalPrice, remainingBalance, notes
      FROM orders
      WHERE checkIn = ?
        AND status = '已付訂'
        AND (travelGuideSent IS NULL OR travelGuideSent = 0)
        AND email != '' AND email IS NOT NULL
    `).bind(targetStr).all();

    if (!results?.length) {
      console.log('[cron/travel] 七天後無入住，或已寄出旅遊手冊');
      return;
    }

    for (const order of results) {
      const result = await sendEmail(env, {
        to: order.email,
        subject: `【雫旅】${order.name}，出發前準備——旅遊手冊送到了！`,
        html: travelGuideHtml(order),
      });

      if (result.success) {
        await env.DB.prepare(`
          UPDATE orders
          SET travelGuideSent = 1,
              travelGuideSentAt = datetime('now', '+8 hours'),
              lastUpdated = datetime('now', '+8 hours')
          WHERE orderID = ?
        `).bind(order.orderID).run();
        console.log('[cron/travel] 已寄旅遊手冊:', order.orderID, order.email);
      } else {
        console.error('[cron/travel] 寄信失敗:', order.orderID, result.error);
      }
    }
  } catch (err) {
    console.error('[cron/travel] 錯誤:', err);
  }
}

/**
 * 退房隔天感謝信（島嶼的餘韻）
 * 條件：checkOut = 台灣時間昨天、status = '完成'、email 有填
 * （orders.js 手動改狀態時也會觸發，此為批次補漏版本）
 */
async function sendPostStayThankYou(env) {
  try {
    // 台灣時間 = UTC+8
    const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const yesterday = new Date(nowTW);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const { results } = await env.DB.prepare(`
      SELECT orderID, name, email, checkIn, checkOut, totalPrice
      FROM orders
      WHERE checkOut = ?
        AND status = '完成'
        AND email != '' AND email IS NOT NULL
    `).bind(yesterdayStr).all();

    if (!results?.length) {
      console.log('[cron/thankyou] 昨天無退房訂單');
      return;
    }

    for (const order of results) {
      const result = await sendEmail(env, {
        to: order.email,
        subject: `【雫旅】${order.name}，島嶼的餘韻`,
        html: thankYouHtml(order),
      });

      if (result.success) {
        console.log('[cron/thankyou] 已寄感謝信:', order.orderID, order.email);
      } else {
        console.error('[cron/thankyou] 寄信失敗:', order.orderID, result.error);
      }
    }
  } catch (err) {
    console.error('[cron/thankyou] 錯誤:', err);
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
        subject: `【雫旅】明天見！入住提醒（${order.checkIn}）`,
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

/* ══════════════════════════════════════════════════════════════════
   自動將已過退房日的「已付訂」訂單改為「完成」
   每日 UTC 02:00（台灣 10:00）執行
══════════════════════════════════════════════════════════════════ */
async function autoMarkCompleted(env) {
  try {
    const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const todayStr = nowTW.toISOString().slice(0, 10); // 今天台灣日期
    // checkOut < 今天 且 狀態為「已付訂」→ 改成「完成」
    const result = await env.DB.prepare(`
      UPDATE orders
      SET status = '完成', lastUpdated = datetime('now', '+8 hours'), updatedBy = 'cron-auto'
      WHERE status = '已付訂' AND checkOut < ?
    `).bind(todayStr).run();
    if (result.meta && result.meta.changes > 0) {
      console.log('[cron/autoComplete] 自動完成', result.meta.changes, '筆訂單');
    }
  } catch (err) {
    console.error('[cron/autoComplete] 錯誤:', err);
  }
}



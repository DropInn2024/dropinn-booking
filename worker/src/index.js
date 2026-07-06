/**
 * Drop Inn — Cloudflare Worker
 * 路由入口：所有 /api/* 請求都進這裡
 * Cron：洽談中 48h 自動取消 + 40h 警告 + 入住前一天提醒 + 入住前 7 天旅遊手冊 + 退房隔天感謝信
 * Deploy：push 到 main 自動觸發 .github/workflows/deploy-worker.yml
 */

import { handleAuth }    from './routes/auth.js';
import { handleReviews } from './routes/reviews.js';
import { handleAdmin }   from './routes/admin.js';
import { listSpots, getSpot, createSpot, updateSpot, deleteSpot } from './routes/spots.js';
import { listPhotos, servePhoto, createPhoto, listPendingPhotos, approvePhoto, deletePhoto } from './routes/photos.js';
import { getRating, setRating } from './routes/ratings.js';
import { saveItinerary, loadItinerary, deleteItinerary, serveItineraryPhoto, sweepExpiredItineraries } from './routes/itinerary.js';
import { getBookedDates, checkAvailability, checkCoupon, createBooking, lookupBooking } from './routes/booking.js';
import {
  getTourProducts, createTourOrder, createFerryOrder, createTourBookingOrder, createCartOrder,
  adminTourOrders, adminTourGroup, adminTourReport, adminTourOrderStatus,
  adminTourSettle, adminTourUnsettle,
  adminTourProductsFull, adminUpdateProduct,
  cancelLinkedTourOrders, sweepExpiredRealname,
} from './routes/tours.js';
import { lineWebhook } from './routes/line.js';
import { sendEmail } from './lib/email.js';
import {
  checkInReminderHtml, cancellationHtml,
  travelGuideHtml, thankYouHtml, pendingWarningHtml,
} from './lib/emailTemplates.js';
import {
  listOrders, getOrder, updateOrder, deleteOrder,
  listOrderCosts, upsertOrderCost,
} from './routes/orders.js';
import {
  agencyLogin, agencyRegister,
  getAgencyProperties, addProperty, manageProperty,
  getAgencyBlocks, setAgencyBlock,
  getPartnerCalendar, getRangeAvailability,
  getPublicCalendar,
  changeAgencyPassword,
} from './routes/agency.js';
import {
  adminHealth,
  adminFinanceStats, adminFinanceDetailed, getFinanceTarget, setFinanceTarget,
  adminMiscLedgerList, adminMiscLedgerAdd, adminMiscLedgerDelete, adminAddonReport,
  adminAddonSettle, adminAddonUnsettle, adminAddonSummary, getMonthlyExpenseRecent,
  getMonthlyExpense, saveMonthlyExpense,
  adminCreateOrder, markCompletedOrders, adminGetOrderCost,
  listCoupons, saveCoupon, deleteCoupon,
  agencyPendingList, agencyApprovedList, agencyAllData,
  agencyApprove, agencyReject, agencyAdminDelete, agencyAdminCreate, agencyAdminResetPassword,
  listGroups, createGroup, addGroupMember, removeGroupMember,
  listReferrals, addReferral,
  updateVisiblePartners,
  adminBackup, dumpAllTables,
} from './routes/notforyouAdmin.js';
import { rtbLogin, rtbOrders, verifyRtbToken } from './routes/restoretheblank.js';
import {
  rtbHkCosts, rtbSetHkCost, rtbHkExtras, rtbAddHkExtra, rtbDeleteHkExtra,
  adminHkReport, adminHkSummary, adminAddHkExtra, adminDeleteHkExtra, adminSettle, adminUnsettle,
  adminHkReceived,
  getExpenseTemplates, addExpenseTemplate, updateExpenseTemplate, deleteExpenseTemplate,
  getMonthlyExpenses, initMonthlyExpenses, addMonthlyExpense, updateMonthlyExpense, deleteMonthlyExpense,
  hkDashCard,
} from './routes/housekeeping.js';
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
      if (path === '/api/drift/login')       return c(await handleAuth(request, env, 'login'));
      if (path === '/api/drift/code-login')  return c(await handleAuth(request, env, 'codeLogin'));
      if (path === '/api/drift/register')    return c(await handleAuth(request, env, 'register'));

      // ── 評論讀取（公開）──────────────────────────────────
      if (path === '/api/drift/reviews' && request.method === 'GET') {
        return c(await handleReviews(request, env, null, 'list'));
      }

      // ── Spots 讀取（公開）────────────────────────────────
      if (path === '/api/drift/spots' && request.method === 'GET') {
        return c(await listSpots(request, env));
      }
      const spotMatch = path.match(/^\/api\/drift\/spots\/([^/]+)$/);
      if (spotMatch && request.method === 'GET') {
        return c(await getSpot(env, spotMatch[1]));
      }

      // drift 照片（公開讀）：列出已審核 / 串流圖片
      if (path === '/api/drift/photos' && request.method === 'GET') {
        return c(await listPhotos(request, env));
      }
      const photoImgMatch = path.match(/^\/api\/drift\/photos\/([^/]+)\/img$/);
      if (photoImgMatch && request.method === 'GET') {
        return await servePhoto(env, photoImgMatch[1]); // 直接回圖片（非 json）
      }
      if (path === '/api/drift/ratings' && request.method === 'GET') {
        return c(await getRating(request, env)); // 公開讀彙總
      }

      // 遊記雲端照片（公開串流；檔名為內容雜湊，不可枚舉）
      const itinPhotoMatch = path.match(/^\/api\/itinerary\/photo\/([^/]+)\/([^/]+)$/);
      if (itinPhotoMatch && request.method === 'GET') {
        return await serveItineraryPhoto(env, itinPhotoMatch[1], itinPhotoMatch[2]);
      }

      if (path === '/api/booking/dates' && request.method === 'GET')
        return c(await getBookedDates(env));
      if (path === '/api/booking/availability' && request.method === 'GET')
        return c(await checkAvailability(request, env));
      if (path === '/api/booking/coupon' && request.method === 'POST')
        return c(await checkCoupon(request, env));
      if (path === '/api/booking/order' && request.method === 'POST')
        return c(await createBooking(request, env, ctx));
      if (path === '/api/booking/lookup' && request.method === 'GET')
        return c(await lookupBooking(request, env));

      // ── 行程 / 租車（公開）────────────────────────────────
      if (path === '/api/tours/products' && request.method === 'GET')
        return c(await getTourProducts(request, env));
      if (path === '/api/tours/orders' && request.method === 'POST')
        return c(await createTourOrder(request, env, ctx));
      if (path === '/api/tours/ferry-order' && request.method === 'POST')
        return c(await createFerryOrder(request, env, ctx));
      if (path === '/api/tours/tour-order' && request.method === 'POST')
        return c(await createTourBookingOrder(request, env, ctx));
      if (path === '/api/tours/cart-order' && request.method === 'POST')
        return c(await createCartOrder(request, env, ctx));

      // ── LINE webhook（官方帳號，簽章驗證、非 admin）──────────
      if (path === '/api/line/webhook' && request.method === 'POST')
        return c(await lineWebhook(request, env, ctx));

      // ── 同業 (agency) 公開路由 ────────────────────────────
      if (path === '/api/agency/login' && request.method === 'POST')
        return c(await agencyLogin(request, env));
      if (path === '/api/agency/register' && request.method === 'POST')
        return c(await agencyRegister(request, env));
      if (path === '/api/agency/public-cal' && request.method === 'GET')
        return c(await getPublicCalendar(request, env));

      // ── 房務 (restoretheblank) 公開路由 ──────────────────
      if (path === '/api/restoretheblank/login' && request.method === 'POST')
        return c(await rtbLogin(request, env));

      // ── 房務 (restoretheblank) 受保護路由 ────────────────
      if (path.startsWith('/api/restoretheblank/')) {
        await verifyRtbToken(request, env); // throws 401 if invalid
        if (path === '/api/restoretheblank/orders' && request.method === 'GET')
          return c(await rtbOrders(request, env));

        // 清潔費模組
        if (path === '/api/restoretheblank/hk/costs' && request.method === 'GET')
          return c(await rtbHkCosts(request, env));
        if (path === '/api/restoretheblank/hk/costs' && request.method === 'POST')
          return c(await rtbSetHkCost(request, env));
        if (path === '/api/restoretheblank/hk/extras' && request.method === 'GET')
          return c(await rtbHkExtras(request, env));
        if (path === '/api/restoretheblank/hk/extras' && request.method === 'POST')
          return c(await rtbAddHkExtra(request, env));
        const rtbExtraMatch = path.match(/^\/api\/restoretheblank\/hk\/extras\/(\d+)$/);
        if (rtbExtraMatch && request.method === 'DELETE')
          return c(await rtbDeleteHkExtra(request, env, Number(rtbExtraMatch[1])));

        return c(json({ error: '找不到路由' }, 404));
      }

      // ── 需要登入的路由 ────────────────────────────────────
      const user = await withAuth(request, env);

      // 評論新增/更新
      if (path === '/api/drift/reviews' && request.method === 'POST') {
        return c(await handleReviews(request, env, user, 'save'));
      }
      // 評論刪除
      const delMatch = path.match(/^\/api\/drift\/reviews\/([^/]+)$/);
      if (delMatch && request.method === 'DELETE') {
        return c(await handleReviews(request, env, user, 'delete', delMatch[1]));
      }
      // 評論置頂（雫編 only）
      const pinMatch = path.match(/^\/api\/drift\/reviews\/([^/]+)\/pin$/);
      if (pinMatch && request.method === 'PATCH') {
        return c(await handleReviews(request, env, user, 'pin', pinMatch[1]));
      }

      // ── Spots CUD（雫編 only，權限檢查在 spots.js 內部）─────
      if (path === '/api/drift/spots' && request.method === 'POST') {
        return c(await createSpot(request, env, user));
      }
      const spotCudMatch = path.match(/^\/api\/drift\/spots\/([^/]+)$/);
      if (spotCudMatch && request.method === 'PUT') {
        return c(await updateSpot(request, env, user, spotCudMatch[1]));
      }
      if (spotCudMatch && request.method === 'DELETE') {
        return c(await deleteSpot(env, user, spotCudMatch[1]));
      }

      // ── drift 照片（需登入）─────────────────────────────
      if (path === '/api/drift/photos/pending' && request.method === 'GET') {
        return c(await listPendingPhotos(env, user));        // 雫編
      }
      if (path === '/api/drift/photos' && request.method === 'POST') {
        return c(await createPhoto(request, env, user));       // 登入者上傳
      }
      if (path === '/api/drift/ratings' && request.method === 'POST') {
        return c(await setRating(request, env, user));          // 登入者評分
      }

      // ── 付費版雲端遊記（premium only，權限檢查在 itinerary.js 內）──
      if (path === '/api/itinerary/save' && request.method === 'POST') {
        return c(await saveItinerary(request, env, user));
      }
      if (path === '/api/itinerary/load' && request.method === 'GET') {
        return c(await loadItinerary(request, env, user));
      }
      if (path === '/api/itinerary' && request.method === 'DELETE') {
        return c(await deleteItinerary(request, env, user));
      }
      const photoApproveMatch = path.match(/^\/api\/drift\/photos\/([^/]+)\/approve$/);
      if (photoApproveMatch && request.method === 'POST') {
        return c(await approvePhoto(env, user, photoApproveMatch[1])); // 雫編
      }
      const photoDelMatch = path.match(/^\/api\/drift\/photos\/([^/]+)$/);
      if (photoDelMatch && request.method === 'DELETE') {
        return c(await deletePhoto(env, user, photoDelMatch[1]));      // 雫編
      }

      // 雫編專用路由
      if (path.startsWith('/api/drift/admin')) {
        if (user.role !== 'owner') return c(json({ error: '權限不足' }, 403));
        return c(await handleAdmin(request, env, user, path));
      }

      // ── 後台訂單管理（owner 限定）─────────────────────────
      if (path === '/api/orders' ||
          path.startsWith('/api/orders/')) {
        if (user.role !== 'owner') return c(json({ error: '權限不足' }, 403));

        if (path === '/api/orders' && request.method === 'GET') {
          return c(await listOrders(request, env));
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
            return c(await updateOrder(request, env, orderId, user, ctx));
          if (request.method === 'DELETE')
            return c(await deleteOrder(request, env, orderId, user, ctx));
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
          return c(await getAgencyBlocks(request, env, agencyId));
        if (path === '/api/agency/blocks' && request.method === 'POST')
          return c(await setAgencyBlock(request, env, agencyId));

        if (path === '/api/agency/partner-calendar' && request.method === 'GET')
          return c(await getPartnerCalendar(request, env, agencyId));

        if (path === '/api/agency/range-check' && request.method === 'GET')
          return c(await getRangeAvailability(request, env, agencyId));

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
        if (path === '/api/admin/finance/target' && request.method === 'GET')
          return c(await getFinanceTarget(request, env));
        if (path === '/api/admin/finance/target' && request.method === 'POST')
          return c(await setFinanceTarget(request, env));
        if (path === '/api/admin/misc-ledger' && request.method === 'GET')
          return c(await adminMiscLedgerList(request, env));
        if (path === '/api/admin/misc-ledger' && request.method === 'POST')
          return c(await adminMiscLedgerAdd(request, env));
        if (path.startsWith('/api/admin/misc-ledger/') && request.method === 'DELETE')
          return c(await adminMiscLedgerDelete(env, path.split('/').pop()));
        if (path === '/api/admin/addon-report' && request.method === 'GET')
          return c(await adminAddonReport(request, env));

        // ── 行程 / 租車 財報（owner）──
        if (path === '/api/admin/tours/orders' && request.method === 'GET')
          return c(await adminTourOrders(request, env));
        if (path === '/api/admin/tours/group' && request.method === 'GET')
          return c(await adminTourGroup(request, env));
        if (path === '/api/admin/tours/report' && request.method === 'GET')
          return c(await adminTourReport(request, env));
        if (path === '/api/admin/tours/order-status' && request.method === 'POST')
          return c(await adminTourOrderStatus(request, env, ctx));
        if (path === '/api/admin/tours/settle' && request.method === 'POST')
          return c(await adminTourSettle(request, env));
        if (path === '/api/admin/tours/unsettle' && request.method === 'POST')
          return c(await adminTourUnsettle(request, env));
        if (path === '/api/admin/tours/products-full' && request.method === 'GET')
          return c(await adminTourProductsFull(request, env));
        if (path === '/api/admin/tours/product' && request.method === 'POST')
          return c(await adminUpdateProduct(request, env));
        if (path === '/api/admin/addon-summary' && request.method === 'GET')
          return c(await adminAddonSummary(request, env));
        if (path === '/api/admin/addon-settle' && request.method === 'POST')
          return c(await adminAddonSettle(request, env));
        if (path === '/api/admin/addon-unsettle' && request.method === 'POST')
          return c(await adminAddonUnsettle(request, env));

        if (path === '/api/admin/monthly-expense' && request.method === 'GET')
          return c(await getMonthlyExpense(request, env));
        if (path === '/api/admin/monthly-expense/recent' && request.method === 'GET')
          return c(await getMonthlyExpenseRecent(request, env));
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
          return c(await updateOrder(request, env, decodeURIComponent(adminOrderMatch[1]), user, ctx));

        if (path === '/api/admin/backup' && request.method === 'GET')
          return c(await adminBackup(request, env));

        return c(json({ error: '找不到路由' }, 404));
      }

      // ── 清潔費 + 固定費用（owner 限定）──────────────────────
      if (path.startsWith('/api/hk/') || path === '/api/hk/settle') {
        if (user.role !== 'owner') return c(json({ error: '權限不足' }, 403));

        if (path === '/api/hk/report' && request.method === 'GET')
          return c(await adminHkReport(request, env));
        if (path === '/api/hk/summary' && request.method === 'GET')
          return c(await adminHkSummary(request, env));
        if (path === '/api/hk/dash-card' && request.method === 'GET')
          return c(await hkDashCard(request, env));
        if (path === '/api/hk/settle' && request.method === 'POST')
          return c(await adminSettle(request, env));
        if (path === '/api/hk/unsettle' && request.method === 'POST')
          return c(await adminUnsettle(request, env));
        if (path === '/api/hk/received' && request.method === 'POST')
          return c(await adminHkReceived(request, env));

        if (path === '/api/hk/extras' && request.method === 'POST')
          return c(await adminAddHkExtra(request, env));
        const hkExtraMatch = path.match(/^\/api\/hk\/extras\/(\d+)$/);
        if (hkExtraMatch && request.method === 'DELETE')
          return c(await adminDeleteHkExtra(request, env, Number(hkExtraMatch[1])));

        if (path === '/api/hk/expense-templates' && request.method === 'GET')
          return c(await getExpenseTemplates(request, env));
        if (path === '/api/hk/expense-templates' && request.method === 'POST')
          return c(await addExpenseTemplate(request, env));
        const tplMatch = path.match(/^\/api\/hk\/expense-templates\/(\d+)$/);
        if (tplMatch && request.method === 'PATCH')
          return c(await updateExpenseTemplate(request, env, Number(tplMatch[1])));
        if (tplMatch && request.method === 'DELETE')
          return c(await deleteExpenseTemplate(request, env, Number(tplMatch[1])));

        if (path === '/api/hk/monthly-expenses' && request.method === 'GET')
          return c(await getMonthlyExpenses(request, env));
        if (path === '/api/hk/monthly-expenses/init' && request.method === 'POST')
          return c(await initMonthlyExpenses(request, env));
        if (path === '/api/hk/monthly-expenses' && request.method === 'POST')
          return c(await addMonthlyExpense(request, env));
        const meMatch = path.match(/^\/api\/hk\/monthly-expenses\/(\d+)$/);
        if (meMatch && request.method === 'PATCH')
          return c(await updateMonthlyExpense(request, env, Number(meMatch[1])));
        if (meMatch && request.method === 'DELETE')
          return c(await deleteMonthlyExpense(request, env, Number(meMatch[1])));

        return c(json({ error: '找不到路由' }, 404));
      }

      // 個人資料
      if (path === '/api/drift/profile' && request.method === 'GET') {
        return c(await handleAuth(request, env, 'profile', user));
      }
      if (path === '/api/drift/profile' && request.method === 'PUT') {
        return c(await handleAuth(request, env, 'updateProfile', user));
      }

      // 管理員改密碼（owner 專用）
      if (path === '/api/drift/change-password' && request.method === 'POST') {
        return c(await handleAuth(request, env, 'changePassword', user));
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

    // ── UTC 02:00 (台灣 10:00)：先完成昨日訂單、再寄感謝信、再寄旅遊手冊 ───
    if (cron === '0 2 * * *') {
      await autoMarkCompleted(env);       // 先把昨日退房單改成「完成」
      await sendPostStayThankYou(env);    // 再寄感謝信（需要 status = '完成'）
      await sendTravelGuides(env);
      await sweepExpiredRealname(env);    // 個資掃尾：清出團日已過的同行旅客實名
      await sweepExpiredItineraries(env); // 雲端遊記：清 14 天到期的（含 R2 照片）
    }

    // ── UTC 04:00（台灣 12:00）：入住前一天提醒信 ────────────────
    if (cron === '0 4 * * *') {
      await sendCheckInReminders(env);
    }

    // ── 每週日 UTC 02:00（台灣 10:00）：自動備份資料庫至 R2 ──────
    if (cron === '0 2 * * SUN') {
      await autoBackupToR2(env);
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

      // 釋放佔位鎖，讓該日期可再被預訂
      await env.DB.prepare(
        `DELETE FROM booking_locks WHERE orderID = ?`
      ).bind(order.orderID).run();

      // 連動取消關聯的租車/行程訂單
      await cancelLinkedTourOrders(env, order.orderID, '房間逾期 48h 自動取消連動')
        .catch((e) => console.error('[cron/cancel] 連動取消租車失敗:', e));

      console.log('[cron/cancel] 已取消並釋放日期:', order.orderID);

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
 * 條件：timestamp 介於 40–48 小時前、pendingWarningSent IS NULL or 0
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
        AND (pendingWarningSent IS NULL OR pendingWarningSent = 0)
    `).bind(t40, t48).all();

    if (!results?.length) {
      console.log('[cron/warning] 無需發出 40h 警告');
      return;
    }

    for (const order of results) {
      // 客人警告信（有留 email 才寄；無 email 的單靠下面的老闆提醒信兜底）
      let customerOk = false;
      if (order.email) {
        const result = await sendEmail(env, {
          to: order.email,
          subject: `【雫旅】${order.name}，預約即將自動取消，請盡快確認`,
          html: pendingWarningHtml(order),
        });
        customerOk = result.success;
        if (result.success) {
          console.log('[cron/warning] 已寄客人警告:', order.orderID, order.email);
        } else {
          console.error('[cron/warning] 客人警告寄信失敗:', order.orderID, result.error);
        }
      }

      // 老闆提醒信：重點全在主旨，不點開也能決定要不要去後台對帳。
      // 刻意不放任何操作連結——信箱防毒會自動預抓信內連結，放了等於讓機器人改單。
      let adminOk = false;
      if (env.ADMIN_NOTIFY_EMAIL) {
        const hoursLeft = Math.max(1, Math.round(48 - (now - new Date(order.timestamp).getTime()) / 3600000));
        const admin = await sendEmail(env, {
          to: env.ADMIN_NOTIFY_EMAIL,
          subject: `⏳【雫旅】${hoursLeft}h後自動取消｜${order.name}｜${order.checkIn}入住${order.email ? '' : '｜客人無email'}`,
          html: `<div style="font-family:sans-serif;font-size:14px;line-height:1.9;color:#333">
            <p>訂單 <strong>${order.orderID}</strong> 仍為「洽談中」，約 ${hoursLeft} 小時後自動取消並釋放日期。</p>
            <p>入住 ${order.checkIn} → 退房 ${order.checkOut}｜總額 ${Number(order.totalPrice || 0).toLocaleString()}</p>
            ${order.email ? '' : '<p><strong>此客人未留 email，沒有收到警告信</strong>，若要保留請主動聯繫。</p>'}
            <p>已收到訂金 → 到後台改「已付訂」即可；未收到 → 不用處理，時間到自動取消。</p>
          </div>`,
        });
        adminOk = admin.success;
        if (admin.success) {
          console.log('[cron/warning] 已寄老闆提醒:', order.orderID);
        } else {
          console.error('[cron/warning] 老闆提醒寄信失敗:', order.orderID, admin.error);
        }
      }

      // 備註（各寄信 cron 通用）：「先寄信、成功後才寫旗標」非原子。
      // 若寄信成功但緊接的旗標 UPDATE 失敗（如 worker 中途中止），隔天會重寄一次。
      // 屬極低機率、且重寄一封提醒信無害，故不加分散式鎖／交易，保留現狀。
      if (customerOk || (!order.email && adminOk)) {
        await env.DB.prepare(`
          UPDATE orders SET pendingWarningSent = 1, lastUpdated = datetime('now', '+8 hours')
          WHERE orderID = ?
        `).bind(order.orderID).run();
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
        AND (postStayThankYouSent IS NULL OR postStayThankYouSent = 0)
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
        await env.DB.prepare(`
          UPDATE orders SET postStayThankYouSent = 1, lastUpdated = datetime('now', '+8 hours')
          WHERE orderID = ?
        `).bind(order.orderID).run();
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
 * 今天（台灣時間）日期 +1 = 明天；找出 checkIn = 明天 且 checkInReminderSent != 1 的訂單
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
        AND status = '已付訂'
        AND (checkInReminderSent IS NULL OR checkInReminderSent = 0)
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
          UPDATE orders SET checkInReminderSent = 1, lastUpdated = datetime('now', '+8 hours')
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
   每週自動備份資料庫至 R2
   路徑：backups/YYYY/dropinn-backup-YYYY-MM-DD.json
   保留最近 12 週（舊檔不自動刪除，R2 便宜，手動清理即可）
══════════════════════════════════════════════════════════════════ */
async function autoBackupToR2(env) {
  try {
    if (!env.BACKUP_BUCKET) {
      console.warn('[cron/backup] BACKUP_BUCKET 未設定，跳過備份');
      return;
    }
    const dump = await dumpAllTables(env);
    const nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000);
    const dateStr = nowTW.toISOString().slice(0, 10);
    const year = dateStr.slice(0, 4);
    const key = `backups/${year}/dropinn-backup-${dateStr}.json`;
    const payload = JSON.stringify({ exportedAt: nowTW.toISOString(), tables: dump }, null, 2);

    await env.BACKUP_BUCKET.put(key, payload, {
      httpMetadata: { contentType: 'application/json' },
    });
    console.log(`[cron/backup] 備份成功：${key}`);
  } catch (err) {
    console.error('[cron/backup] 備份失敗:', err);
    // 備份是唯一每週跑、失敗又完全無感的 cron——失敗必須通知，否則可能連壞數月才發現
    if (env.ADMIN_NOTIFY_EMAIL) {
      await sendEmail(env, {
        to: env.ADMIN_NOTIFY_EMAIL,
        subject: '⚠️ 雫旅每週資料庫備份失敗',
        html: `<p>本週自動備份到 R2 失敗，請儘快檢查。</p><p>錯誤訊息：<code>${String(err && err.message || err).replace(/[<>]/g, '')}</code></p><p>可先到後台手動下載備份（設定 → 資料備份），並查看 Worker logs。</p>`,
      }).catch((e) => console.error('[cron/backup] 告警信也失敗:', e));
    }
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



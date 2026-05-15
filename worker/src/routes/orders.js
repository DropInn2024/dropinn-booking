/**
 * 後台訂單管理路由
 *
 * 對應的資料表：
 *   orders                 — 訂單主表（0001_init.sql）
 *   cost_rows              — 訂單成本（0001_init.sql；對應 GAS 支出_2026 表）
 *   monthly_expenses       — 月固定支出（0001_init.sql）
 *
 * 所有 handler 都假設外部已通過 owner 角色檢查。
 */

import { json } from '../lib/utils.js';
import { sendEmail } from '../lib/email.js';
import { bookingConfirmHtml, cancellationHtml, thankYouHtml, adminStatusNotifyHtml } from '../lib/emailTemplates.js';

/* ── orders 表允許更新的欄位白名單 ─────────────────────────────────
   不允許動：orderID（主鍵）、timestamp（建立時間）。lastUpdated/updatedBy
   會由 handler 自動寫入。 */
const ORDER_UPDATABLE_FIELDS = [
  'name', 'phone', 'email',
  'checkIn', 'checkOut', 'rooms', 'extraBeds',
  'originalTotal', 'totalPrice', 'paidDeposit', 'remainingBalance',
  'discountCode', 'discountType', 'discountValue', 'discountAmount',
  'isReturningGuest', 'complimentaryNote',
  'sourceType', 'agencyName', 'addonAmount', 'extraIncome',
  'notes', 'internalNotes', 'housekeepingNote', 'hasCarRental',
  'status', 'cancelReason',
  'emailSent', 'reminderSent', 'travelGuideSent', 'travelGuideSentAt',
  'publicCalendarEventID', 'housekeepingCalendarEventID',
  'lastCalendarSync', 'calendarSyncStatus', 'calendarSyncNote',
  'agreementSignedName', 'agreementSignedAt',
];

/* ── 把 LIKE 搜尋字串包成 %xxx% 並 escape 萬用字元 ──────────────── */
function likePattern(s) {
  return '%' + String(s).replace(/[%_]/g, (c) => '\\' + c) + '%';
}

/* ── GET /api/orders ─────────────────────────────────────────────
   query: status, month (YYYY-MM), search */
export async function listOrders(request, env) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || '';
  const month  = url.searchParams.get('month')  || '';
  const search = url.searchParams.get('search') || '';

  const where = [];
  const binds = [];

  if (status) {
    where.push('status = ?');
    binds.push(status);
  }
  if (/^\d{4}-\d{2}$/.test(month)) {
    where.push('substr(checkIn, 1, 7) = ?');
    binds.push(month);
  }
  if (search) {
    where.push("(name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR orderID LIKE ? ESCAPE '\\')");
    const p = likePattern(search);
    binds.push(p, p, p);
  }

  const sql = `
    SELECT * FROM orders
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY checkIn DESC
    LIMIT 200
  `;
  const stmt = env.DB.prepare(sql);
  const rows = await (binds.length ? stmt.bind(...binds) : stmt).all();
  return json({ success: true, orders: rows.results || [] });
}

/* ── GET /api/orders/:orderId ────────────────────────────────── */
export async function getOrder(_request, env, orderId) {
  if (!orderId) return json({ success: false, error: '缺少 orderId' }, 400);

  const order = await env.DB.prepare(
    `SELECT * FROM orders WHERE orderID = ?`
  ).bind(orderId).first();
  if (!order) return json({ success: false, error: '找不到訂單' }, 404);

  const costs = await env.DB.prepare(
    `SELECT * FROM cost_rows WHERE orderID = ? ORDER BY id`
  ).bind(orderId).all();

  return json({ success: true, order, costs: costs.results || [] });
}

/* ── PATCH /api/orders/:orderId ─────────────────────────────────
   只接受白名單欄位的部份更新。 */
export async function updateOrder(request, env, orderId, user) {
  if (!orderId) return json({ success: false, error: '缺少 orderId' }, 400);

  const body = await request.json().catch(() => ({}));

  const sets = [];
  const binds = [];
  for (const field of ORDER_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      sets.push(`${field} = ?`);
      binds.push(body[field]);
    }
  }
  if (!sets.length) return json({ success: false, error: '無可更新欄位' }, 400);

  // 狀態→完成：自動清零尾款（款項已收訖）
  if (body.status === '完成' && !Object.prototype.hasOwnProperty.call(body, 'remainingBalance')) {
    sets.push(`remainingBalance = 0`);
  }

  // 一律更新 lastUpdated / updatedBy
  sets.push(`lastUpdated = datetime('now', '+8 hours')`);
  sets.push(`updatedBy = ?`);
  binds.push(user?.displayName || user?.userId || 'admin');

  // 確認訂單存在
  const exists = await env.DB.prepare(
    `SELECT orderID FROM orders WHERE orderID = ?`
  ).bind(orderId).first();
  if (!exists) return json({ success: false, error: '找不到訂單' }, 404);

  binds.push(orderId);
  await env.DB.prepare(
    `UPDATE orders SET ${sets.join(', ')} WHERE orderID = ?`
  ).bind(...binds).run();

  // ── 狀態變更時寄信 ──────────────────────────────────────────
  const newStatus = body.status;
  if (newStatus === '已付訂' || newStatus === '取消' || newStatus === '完成') {
    const updated = await env.DB.prepare(
      `SELECT * FROM orders WHERE orderID = ?`
    ).bind(orderId).first();

    if (updated) {
      const adminEmail = env.ADMIN_NOTIFY_EMAIL;

      if (newStatus === '已付訂') {
        // 客人：正式確認信
        if (updated.email) {
          sendEmail(env, {
            to: updated.email,
            subject: `【雫旅】Hihi ${updated.name}，訂單成立`,
            html: bookingConfirmHtml(updated),
          }).catch((e) => console.error('[orders/email] 已付訂確認信失敗:', e));
        }
        // 管理員：已付訂通知
        if (adminEmail) {
          sendEmail(env, {
            to: adminEmail,
            subject: `✅ 訂單已付訂 — ${updated.name}（${updated.checkIn}）`,
            html: adminStatusNotifyHtml(updated, '已付訂'),
          }).catch((e) => console.error('[orders/email] 管理員已付訂通知失敗:', e));
        }
      } else if (newStatus === '取消') {
        const hasDeposit = Number(updated.paidDeposit) > 0;
        // 客人：取消通知
        if (updated.email) {
          sendEmail(env, {
            to: updated.email,
            subject: hasDeposit
              ? `【雫旅】${updated.name}，已為您辦理退訂與退款說明`
              : `【雫旅】謝謝您，${updated.name}`,
            html: cancellationHtml(updated),
          }).catch((e) => console.error('[orders/email] 取消通知失敗:', e));
        }
        // 管理員：取消通知
        if (adminEmail) {
          sendEmail(env, {
            to: adminEmail,
            subject: `❌ 訂單已取消 — ${updated.name}（${updated.checkIn}）`,
            html: adminStatusNotifyHtml(updated, '取消'),
          }).catch((e) => console.error('[orders/email] 管理員取消通知失敗:', e));
        }
      } else {
        // 完成 → 退房感謝信（只寄客人，每日 Cron 的批次版本才是主要管道）
        if (updated.email) {
          sendEmail(env, {
            to: updated.email,
            subject: `【雫旅】${updated.name}，島嶼的餘韻`,
            html: thankYouHtml(updated),
          }).catch((e) => console.error('[orders/email] 感謝信失敗:', e));
        }
      }
    }
  }

  return json({ success: true });
}

/* ── DELETE /api/orders/:orderId（軟刪除）──────────────────────── */
export async function deleteOrder(request, env, orderId, user) {
  if (!orderId) return json({ success: false, error: '缺少 orderId' }, 400);

  const body = await request.json().catch(() => ({}));
  const reason = body.reason || '';

  const exists = await env.DB.prepare(
    `SELECT orderID, status, email FROM orders WHERE orderID = ?`
  ).bind(orderId).first();
  if (!exists) return json({ success: false, error: '找不到訂單' }, 404);

  await env.DB.prepare(`
    UPDATE orders
    SET status = '取消',
        cancelReason = ?,
        lastUpdated = datetime('now', '+8 hours'),
        updatedBy = ?
    WHERE orderID = ?
  `).bind(reason, user?.displayName || user?.userId || 'admin', orderId).run();

  // 寄取消通知給客人
  if (exists.email) {
    const cancelled = await env.DB.prepare(
      `SELECT * FROM orders WHERE orderID = ?`
    ).bind(orderId).first();
    if (cancelled) {
      const hasDeposit = Number(cancelled.paidDeposit) > 0;
      const subject = hasDeposit
        ? `【雫旅】${cancelled.name}，已為您辦理退訂與退款說明`
        : `【雫旅】謝謝您，${cancelled.name}`;
      sendEmail(env, {
        to: cancelled.email,
        subject,
        html: cancellationHtml(cancelled),
      }).catch((e) => console.error('[orders/delete/email] 取消通知失敗:', e));

      // 管理員取消通知
      const adminEmail = env.ADMIN_NOTIFY_EMAIL;
      if (adminEmail) {
        sendEmail(env, {
          to: adminEmail,
          subject: `❌ 訂單已取消 — ${cancelled.name}（${cancelled.checkIn}）`,
          html: adminStatusNotifyHtml(cancelled, '取消'),
        }).catch((e) => console.error('[orders/delete/email] 管理員取消通知失敗:', e));
      }
    }
  }

  return json({ success: true });
}

/* ── GET /api/orders/:orderId/costs ─────────────────────────── */
export async function listOrderCosts(_request, env, orderId) {
  if (!orderId) return json({ success: false, error: '缺少 orderId' }, 400);
  const rows = await env.DB.prepare(
    `SELECT * FROM cost_rows WHERE orderID = ? ORDER BY id`
  ).bind(orderId).all();
  return json({ success: true, costs: rows.results || [] });
}

/* ── PUT /api/orders/:orderId/costs ─────────────────────────────
   每張訂單只保留一筆成本列：先刪後 INSERT。 */
export async function upsertOrderCost(request, env, orderId) {
  if (!orderId) return json({ success: false, error: '缺少 orderId' }, 400);

  const body = await request.json().catch(() => ({}));

  const order = await env.DB.prepare(
    `SELECT orderID, name, checkIn FROM orders WHERE orderID = ?`
  ).bind(orderId).first();
  if (!order) return json({ success: false, error: '找不到訂單' }, 404);

  const toInt = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  };

  await env.DB.batch([
    env.DB.prepare(`DELETE FROM cost_rows WHERE orderID = ?`).bind(orderId),
    env.DB.prepare(`
      INSERT INTO cost_rows
        (orderID, name, checkIn, rebateAmount, complimentaryAmount,
         otherCost, addonCost, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      orderId,
      body.name ?? order.name,
      body.checkIn ?? order.checkIn,
      toInt(body.rebateAmount),
      toInt(body.complimentaryAmount),
      toInt(body.otherCost),
      toInt(body.addonCost),
      body.note || ''
    ),
  ]);

  return json({ success: true });
}

/* ── GET /api/stats/month?month=YYYY-MM ──────────────────────── */
export async function monthStats(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 需為 YYYY-MM' }, 400);
  }

  // 收入：依 sourceType 分組
  const incomeRows = await env.DB.prepare(`
    SELECT
      sourceType,
      COUNT(*)            AS orders,
      COALESCE(SUM(totalPrice), 0)   AS totalPrice,
      COALESCE(SUM(addonAmount), 0)  AS addonAmount,
      COALESCE(SUM(extraIncome), 0)  AS extraIncome
    FROM orders
    WHERE substr(checkIn, 1, 7) = ? AND status != '取消'
    GROUP BY sourceType
  `).bind(month).all();

  const incomeBySource = {};
  let incomeTotal = 0;
  for (const r of incomeRows.results || []) {
    const subtotal = (r.totalPrice || 0) + (r.addonAmount || 0) + (r.extraIncome || 0);
    incomeBySource[r.sourceType || '自家'] = {
      orders: r.orders,
      totalPrice: r.totalPrice,
      addonAmount: r.addonAmount,
      extraIncome: r.extraIncome,
      subtotal,
    };
    incomeTotal += subtotal;
  }

  // 訂單相關成本：cost_rows JOIN orders（用入住月份篩選）
  const costRow = await env.DB.prepare(`
    SELECT
      COALESCE(SUM(c.rebateAmount), 0)        AS rebate,
      COALESCE(SUM(c.complimentaryAmount), 0) AS complimentary,
      COALESCE(SUM(c.otherCost), 0)           AS other,
      COALESCE(SUM(c.addonCost), 0)           AS addon
    FROM cost_rows c
    JOIN orders o ON c.orderID = o.orderID
    WHERE substr(o.checkIn, 1, 7) = ? AND o.status != '取消'
  `).bind(month).first();

  // 月固定支出（用 yearMonth 直接對應）
  const monthly = await env.DB.prepare(
    `SELECT * FROM monthly_expenses WHERE yearMonth = ?`
  ).bind(month).first();

  const monthlyTotal = monthly
    ? (monthly.laundry || 0) + (monthly.water || 0) + (monthly.electricity || 0)
      + (monthly.internet || 0) + (monthly.platformFee || 0) + (monthly.landTax || 0)
      + (monthly.insurance || 0) + (monthly.other || 0)
      + (monthly.carRentalRebate || 0)
    : 0;

  const costsByType = {
    rebate:        costRow.rebate || 0,
    complimentary: costRow.complimentary || 0,
    other:         costRow.other || 0,
    addon:         costRow.addon || 0,
    monthly:       monthlyTotal,
  };
  const costsTotal = Object.values(costsByType).reduce((a, b) => a + b, 0);

  return json({
    success: true,
    month,
    income: {
      total: incomeTotal,
      bySource: incomeBySource,
    },
    costs: {
      total: costsTotal,
      byType: costsByType,
      monthlyExpense: monthly || null,
    },
    profit: incomeTotal - costsTotal,
  });
}

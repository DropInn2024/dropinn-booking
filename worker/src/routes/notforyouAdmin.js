/**
 * 後台管理路由（owner 專用）
 * 所有 handler 假設外部已驗證 user.role === 'owner'
 */

import { json, normalizeDate } from '../lib/utils.js';
import { hashPasswordV2 }   from '../lib/hash.js';

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

/* ═══════════════════════════════════════════════════════════
   健康檢查  GET /api/admin/health
═══════════════════════════════════════════════════════════ */
export async function adminHealth(_request, env) {
  try {
    const row = await env.DB.prepare('SELECT COUNT(*) AS c FROM orders').first();
    return json({
      success: true,
      status: 'ok',
      orderCount: row?.c ?? 0,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    return json({ success: false, status: 'error', error: e.message }, 500);
  }
}

/* ═══════════════════════════════════════════════════════════
   財務統計核心（內部使用）
═══════════════════════════════════════════════════════════ */
async function _buildFinanceSummary(env, year, month) {
  let dateCond, dateBinds;
  if (month && month !== 0) {
    const mm = String(month).padStart(2, '0');
    dateCond  = "substr(checkIn,1,7) = ?";
    dateBinds = [`${year}-${mm}`];
  } else {
    dateCond  = "substr(checkIn,1,4) = ?";
    dateBinds = [String(year)];
  }

  const orderRows = await env.DB.prepare(`
    SELECT totalPrice, paidDeposit, remainingBalance, addonAmount, addonCollected, extraIncome,
           discountAmount, isReturningGuest, hasCarRental
    FROM orders WHERE ${dateCond} AND status != '取消'
  `).bind(...dateBinds).all();

  let revenue = 0, addonTotal = 0, addonUncollected = 0, extraIncomeTotal = 0, totalDiscount = 0,
      totalDeposit = 0, totalBalance = 0, orderCount = 0, returningCount = 0;
  for (const o of (orderRows.results || [])) {
    revenue          += toInt(o.totalPrice);
    addonTotal       += toInt(o.addonAmount);
    if (!o.addonCollected) addonUncollected += toInt(o.addonAmount); // 還沒跟客人收的代收行程費
    extraIncomeTotal += toInt(o.extraIncome);
    totalDiscount    += toInt(o.discountAmount);
    totalDeposit     += toInt(o.paidDeposit);
    totalBalance     += toInt(o.remainingBalance);
    orderCount++;
    if (o.isReturningGuest) returningCount++;
  }

  // 注意：dateCond 用 o.checkIn 明確指定避免 ambiguous column（cost_rows 也有 checkIn）
  const costRows = await env.DB.prepare(`
    SELECT c.rebateAmount, c.complimentaryAmount, c.otherCost, c.addonCost
    FROM cost_rows c JOIN orders o ON c.orderID = o.orderID
    WHERE ${dateCond.replace('checkIn', 'o.checkIn')} AND o.status != '取消'
  `).bind(...dateBinds).all();

  let rebateTotal = 0, complimentaryTotal = 0, otherCostTotal = 0, addonCostTotal = 0;
  for (const c of (costRows.results || [])) {
    rebateTotal        += toInt(c.rebateAmount);
    complimentaryTotal += toInt(c.complimentaryAmount);
    otherCostTotal     += toInt(c.otherCost);
    addonCostTotal     += toInt(c.addonCost);
  }
  const costTotal = rebateTotal + complimentaryTotal + otherCostTotal;

  let meRows;
  if (month && month !== 0) {
    const mm = String(month).padStart(2, '0');
    meRows = await env.DB.prepare(
      'SELECT * FROM monthly_expenses WHERE yearMonth = ?'
    ).bind(`${year}-${mm}`).all();
  } else {
    meRows = await env.DB.prepare(
      "SELECT * FROM monthly_expenses WHERE substr(yearMonth,1,4) = ?"
    ).bind(String(year)).all();
  }

  let monthlyExpenseTotal = 0, carRentalRebateTotal = 0;
  for (const me of (meRows.results || [])) {
    monthlyExpenseTotal += (me.laundry || 0) + (me.water || 0) + (me.electricity || 0)
      + (me.internet || 0) + (me.platformFee || 0) + (me.landTax || 0)
      + (me.insurance || 0) + (me.other || 0);
    carRentalRebateTotal += (me.carRentalRebate || 0);
  }

  // ── 房務費用：依 checkOut 月份計算，結算月用 settlements.totalAmount ──
  let housekeepingTotal = 0;
  if (month && month !== 0) {
    const mm = String(month).padStart(2, '0');
    const hkMk = `${year}-${mm}`;
    const settled = await env.DB.prepare(
      'SELECT totalAmount FROM housekeeping_settlements WHERE monthKey = ?'
    ).bind(hkMk).first();
    if (settled) {
      housekeepingTotal = settled.totalAmount || 0;
    } else {
      const [hkCosts, hkExtras] = await Promise.all([
        env.DB.prepare(
          `SELECT COALESCE(SUM(c.amount),0) AS total FROM housekeeping_costs c
           JOIN orders o ON c.orderID = o.orderID
           WHERE substr(o.checkOut,1,7) = ? AND o.status != '取消'`
        ).bind(hkMk).first(),
        env.DB.prepare(
          `SELECT COALESCE(SUM(amount),0) AS total FROM housekeeping_extras WHERE monthKey = ?`
        ).bind(hkMk).first(),
      ]);
      housekeepingTotal = (hkCosts?.total || 0) + (hkExtras?.total || 0);
    }
  } else {
    const [hkSettled, hkCosts, hkExtras] = await Promise.all([
      env.DB.prepare(
        `SELECT monthKey, totalAmount FROM housekeeping_settlements WHERE substr(monthKey,1,4) = ?`
      ).bind(String(year)).all(),
      env.DB.prepare(
        `SELECT substr(o.checkOut,1,7) AS mk, COALESCE(SUM(c.amount),0) AS total
         FROM housekeeping_costs c JOIN orders o ON c.orderID = o.orderID
         WHERE substr(o.checkOut,1,4) = ? AND o.status != '取消'
         GROUP BY substr(o.checkOut,1,7)`
      ).bind(String(year)).all(),
      env.DB.prepare(
        `SELECT monthKey AS mk, COALESCE(SUM(amount),0) AS total
         FROM housekeeping_extras WHERE substr(monthKey,1,4) = ? GROUP BY monthKey`
      ).bind(String(year)).all(),
    ]);
    const settledMks = new Set((hkSettled.results || []).map(r => r.monthKey));
    for (const r of hkSettled.results || []) housekeepingTotal += r.totalAmount || 0;
    const costsByMk = {};
    for (const r of hkCosts.results || []) costsByMk[r.mk] = (costsByMk[r.mk] || 0) + (r.total || 0);
    const extrasByMk = {};
    for (const r of hkExtras.results || []) extrasByMk[r.mk] = (extrasByMk[r.mk] || 0) + (r.total || 0);
    for (const mk of new Set([...Object.keys(costsByMk), ...Object.keys(extrasByMk)])) {
      if (!settledMks.has(mk)) housekeepingTotal += (costsByMk[mk] || 0) + (extrasByMk[mk] || 0);
    }
  }

  const addonCommission = addonTotal - addonCostTotal;
  const netIncome = revenue + addonCommission + extraIncomeTotal + carRentalRebateTotal
    - costTotal - monthlyExpenseTotal - housekeepingTotal;

  return {
    revenue, addonTotal, addonUncollected, addonCommission, addonCostTotal,
    costTotal, rebateTotal, complimentaryTotal, otherCostTotal,
    monthlyExpenseTotal, housekeepingTotal, carRentalRebateTotal, extraIncomeTotal,
    netIncome, orderCount, returningCount,
    totalDeposit, totalBalance, totalDiscount,
  };
}

/* ─── GET /api/admin/finance?year=YYYY&month=M(0=全年) ─────── */
export async function adminFinanceStats(request, env) {
  const url   = new URL(request.url);
  const year  = parseInt(url.searchParams.get('year')  || String(new Date().getFullYear()), 10);
  const month = parseInt(url.searchParams.get('month') || '0', 10);
  const s = await _buildFinanceSummary(env, year, month);
  return json({ success: true, ...s });
}

/* ─── GET /api/admin/finance/detailed?year=YYYY&month=M ────── */
export async function adminFinanceDetailed(request, env) {
  const url   = new URL(request.url);
  const year  = parseInt(url.searchParams.get('year')  || String(new Date().getFullYear()), 10);
  const month = parseInt(url.searchParams.get('month') || '0', 10);
  const summary = await _buildFinanceSummary(env, year, month);

  let monthly = [];
  if (!month || month === 0) {
    for (let m = 1; m <= 12; m++) {
      const ms = await _buildFinanceSummary(env, year, m);
      monthly.push({ month: `${year}-${String(m).padStart(2, '0')}`, ...ms });
    }
  }
  return json({ success: true, year, month: month || null, summary, monthly });
}

/* ═══════════════════════════════════════════════════════════
   月固定支出
   GET /api/admin/monthly-expense?yearMonth=YYYY-MM
   PUT /api/admin/monthly-expense
═══════════════════════════════════════════════════════════ */
export async function getMonthlyExpense(request, env) {
  const url = new URL(request.url);
  const ym  = url.searchParams.get('yearMonth') || '';
  if (!/^\d{4}-\d{2}$/.test(ym)) return json({ success: false, error: '格式錯誤' }, 400);
  const row = await env.DB.prepare(
    'SELECT * FROM monthly_expenses WHERE yearMonth = ?'
  ).bind(ym).first();
  return json({ success: true, expense: row || null });
}

/* GET /api/admin/monthly-expense/recent
   抓最近一筆已存的月固定支出，當作「範本」給 UI prefill 用 */
export async function getMonthlyExpenseRecent(request, env) {
  const row = await env.DB.prepare(
    'SELECT * FROM monthly_expenses ORDER BY yearMonth DESC LIMIT 1'
  ).first();
  return json({ success: true, expense: row || null });
}

export async function saveMonthlyExpense(request, env) {
  const body = await request.json().catch(() => ({}));
  const ym   = body.yearMonth || '';
  if (!/^\d{4}-\d{2}$/.test(ym)) return json({ success: false, error: '格式錯誤' }, 400);

  await env.DB.prepare(`
    INSERT INTO monthly_expenses
      (yearMonth,laundry,water,electricity,internet,platformFee,landTax,insurance,other,carRentalRebate,note)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(yearMonth) DO UPDATE SET
      laundry=excluded.laundry, water=excluded.water, electricity=excluded.electricity,
      internet=excluded.internet, platformFee=excluded.platformFee, landTax=excluded.landTax,
      insurance=excluded.insurance, other=excluded.other,
      carRentalRebate=excluded.carRentalRebate, note=excluded.note
  `).bind(
    ym,
    toInt(body.laundry), toInt(body.water), toInt(body.electricity),
    toInt(body.internet), toInt(body.platformFee), toInt(body.landTax),
    toInt(body.insurance), toInt(body.other), toInt(body.carRentalRebate),
    body.note || ''
  ).run();
  return json({ success: true });
}

/* ═══════════════════════════════════════════════════════════
   後台建立訂單  POST /api/admin/orders
   （admin 手動建立，跳過 recaptcha，直接存 D1）
═══════════════════════════════════════════════════════════ */
export async function adminCreateOrder(request, env) {
  const body = await request.json().catch(() => ({}));

  for (const k of ['name', 'phone', 'checkIn', 'checkOut']) {
    if (!body[k]) return json({ success: false, error: `缺少欄位: ${k}` }, 400);
  }

  const checkIn  = normalizeDate(body.checkIn);
  const checkOut = normalizeDate(body.checkOut);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut))
    return json({ success: false, error: '日期格式錯誤' }, 400);
  if (new Date(checkIn) >= new Date(checkOut))
    return json({ success: false, error: '退房日需晚於入住日' }, 400);

  const datePrefix = checkIn.replace(/-/g, '');
  const counter = await env.DB.prepare(`
    INSERT INTO system_counters (datePrefix, currentCount) VALUES (?,1)
    ON CONFLICT(datePrefix) DO UPDATE SET currentCount = currentCount + 1
    RETURNING currentCount
  `).bind(datePrefix).first();
  const orderID = `DROP-${datePrefix}-${String(counter.currentCount).padStart(3, '0')}`;

  const originalTotal    = toInt(body.originalTotal ?? body.totalPrice ?? 0);
  const totalPrice       = toInt(body.totalPrice ?? originalTotal);
  const paidDeposit      = toInt(body.paidDeposit ?? 0);
  const remainingBalance = Math.max(0, totalPrice - paidDeposit);

  await env.DB.prepare(`
    INSERT INTO orders (
      orderID, name, phone, email,
      checkIn, checkOut, rooms, extraBeds,
      originalTotal, totalPrice, paidDeposit, remainingBalance,
      discountCode, discountType, discountValue, discountAmount,
      isReturningGuest, complimentaryNote,
      sourceType, agencyName, addonAmount, extraIncome,
      notes, internalNotes, housekeepingNote, hasCarRental,
      status, cancelReason,
      agreementSignedName, agreementSignedAt,
      lastUpdated, updatedBy, timestamp
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).bind(
    orderID, body.name, body.phone, body.email || '',
    checkIn, checkOut, toInt(body.rooms ?? 3), toInt(body.extraBeds ?? 0),
    originalTotal, totalPrice, paidDeposit, remainingBalance,
    '', '', '', 0,
    0, '',
    body.sourceType || '自家', body.agencyName || '',
    toInt(body.addonAmount ?? 0), toInt(body.extraIncome ?? 0),
    body.notes || '', body.internalNotes || '', body.housekeepingNote || '',
    body.hasCarRental ? 1 : 0,
    body.status || '洽談中', '',
    '', '',
    new Date().toISOString(), 'admin',
    new Date().toISOString()
  ).run();

  if (toInt(body.complimentaryAmount) > 0 || toInt(body.addonCost) > 0) {
    await env.DB.prepare(`
      INSERT INTO cost_rows (orderID, name, checkIn, rebateAmount, complimentaryAmount, otherCost, addonCost, note)
      VALUES (?,?,?,?,?,?,?,?)
    `).bind(
      orderID, body.name, checkIn,
      0, toInt(body.complimentaryAmount ?? 0), 0,
      toInt(body.addonCost ?? 0), ''
    ).run();
  }

  return json({ success: true, orderID });
}

/* ─── POST /api/admin/orders/mark-completed ─────────────── */
export async function markCompletedOrders(env) {
  const today = new Date().toISOString().slice(0, 10);

  // 找出所有「已付訂且退房日 < 今天」的訂單
  const { results: targets } = await env.DB.prepare(`
    SELECT orderID, totalPrice FROM orders
    WHERE status = '已付訂' AND checkOut < ?
  `).bind(today).all();

  if (!targets || targets.length === 0) {
    return json({ success: true, updated: 0 });
  }

  // 逐筆結清尾款 + 標記完成
  const stmts = targets.flatMap(({ orderID, totalPrice }) => [
    env.DB.prepare(`
      UPDATE orders
      SET status = '完成',
          paidDeposit = ?,
          remainingBalance = 0,
          lastUpdated = datetime('now','+8 hours'),
          updatedBy = 'auto'
      WHERE orderID = ?
    `).bind(totalPrice, orderID),
  ]);

  await env.DB.batch(stmts);
  return json({ success: true, updated: targets.length });
}

/* ─── GET /api/admin/orders/:id/costs ───────────────────── */
export async function adminGetOrderCost(env, orderId) {
  const cost = await env.DB.prepare(
    'SELECT * FROM cost_rows WHERE orderID = ? LIMIT 1'
  ).bind(orderId).first();
  return json({ success: true, cost: cost || null });
}

/* ─── GET /api/admin/addon-report?month=YYYY-MM 或 ?year=YYYY ──
   抓所有 addonAmount>0 的訂單與其 addonCost，給 fast bulk-input UI 用 */
export async function adminAddonReport(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '';
  let dateCond, dateBind;
  if (/^\d{4}-\d{2}$/.test(month)) {
    dateCond = "substr(o.checkIn, 1, 7) = ?";
    dateBind = month;
  } else if (/^\d{4}$/.test(month)) {
    dateCond = "substr(o.checkIn, 1, 4) = ?";
    dateBind = month;
  } else {
    return json({ success: false, error: 'month 需為 YYYY-MM 或 YYYY' }, 400);
  }

  const res = await env.DB.prepare(`
    SELECT
      o.orderID, o.name, o.checkIn, o.checkOut, o.addonAmount, o.addonCollected,
      c.addonCost, c.rebateAmount, c.complimentaryAmount, c.otherCost, c.note
    FROM orders o
    LEFT JOIN cost_rows c ON c.orderID = o.orderID
    WHERE ${dateCond}
      AND o.status != '取消'
      AND COALESCE(o.addonAmount, 0) > 0
    ORDER BY o.checkIn ASC
  `).bind(dateBind).all();

  const orders = (res.results || []).map((o) => ({
    orderID: o.orderID,
    name: o.name,
    checkIn: o.checkIn,
    checkOut: o.checkOut,
    addonAmount: Number(o.addonAmount) || 0,
    addonCollected: o.addonCollected ? 1 : 0,
    addonCost: o.addonCost == null ? null : Number(o.addonCost),
    // 保留其它成本欄位讓前端 upsert 不會洗掉
    rebateAmount:        o.rebateAmount        == null ? 0 : Number(o.rebateAmount),
    complimentaryAmount: o.complimentaryAmount == null ? 0 : Number(o.complimentaryAmount),
    otherCost:           o.otherCost           == null ? 0 : Number(o.otherCost),
    note:                o.note || '',
  }));

  let totalAmount = 0, totalCost = 0, filledCount = 0;
  orders.forEach((o) => {
    totalAmount += o.addonAmount;
    if (o.addonCost != null) {
      totalCost += o.addonCost;
      filledCount++;
    }
  });

  // 單月模式：附上「已付旅行社」狀態（給 modal 顯示結算鈕用）
  let isSettled = false;
  if (/^\d{4}-\d{2}$/.test(month)) {
    const s = await env.DB.prepare(
      `SELECT settledAt FROM addon_settlements WHERE monthKey = ?`
    ).bind(month).first();
    isSettled = !!s?.settledAt;
  }

  return json({
    success: true,
    month,
    isSettled,
    orders,
    summary: {
      totalAmount,
      totalCost,
      commission: totalAmount - totalCost,
      filledCount,
      totalCount: orders.length,
    },
  });
}

/* ─── 代辦行程（旅行社）月結：標記/解除「已付旅行社」───
   POST /api/admin/addon-settle    { month: 'YYYY-MM' }
   POST /api/admin/addon-unsettle  { month: 'YYYY-MM' }   */
export async function adminAddonSettle(request, env) {
  const { month } = await request.json().catch(() => ({}));
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 需為 YYYY-MM' }, 400);
  }
  const existing = await env.DB.prepare(
    `SELECT settledAt FROM addon_settlements WHERE monthKey = ?`
  ).bind(month).first();
  if (existing?.settledAt) return json({ success: false, error: '本月行程已標記已付' }, 409);

  const res = await env.DB.prepare(`
    SELECT SUM(COALESCE(c.addonCost, 0)) AS total
    FROM orders o LEFT JOIN cost_rows c ON c.orderID = o.orderID
    WHERE substr(o.checkIn, 1, 7) = ? AND o.status != '取消' AND COALESCE(o.addonAmount, 0) > 0
  `).bind(month).first();
  const total = Number(res?.total) || 0;
  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO addon_settlements (monthKey, totalAmount, settledAt, settledBy)
    VALUES (?, ?, ?, 'admin')
    ON CONFLICT(monthKey) DO UPDATE SET totalAmount = ?, settledAt = ?, settledBy = 'admin'
  `).bind(month, total, now, total, now).run();
  return json({ success: true, month, totalAmount: total, settledAt: now });
}

export async function adminAddonUnsettle(request, env) {
  const { month } = await request.json().catch(() => ({}));
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 需為 YYYY-MM' }, 400);
  }
  const r = await env.DB.prepare(
    `DELETE FROM addon_settlements WHERE monthKey = ?`
  ).bind(month).run();
  return json({ success: true, deleted: r.meta?.changes || 0 });
}

/* ─── GET /api/admin/addon-summary?year=YYYY ───
   給首頁「待結清款項」用：該年有代辦行程的月份，依月彙總 addonCost + 是否已付 */
export async function adminAddonSummary(request, env) {
  const url = new URL(request.url);
  const year = url.searchParams.get('year') || '';
  if (!/^\d{4}$/.test(year)) return json({ success: false, error: 'year 需為 YYYY' }, 400);

  const res = await env.DB.prepare(`
    SELECT substr(o.checkIn, 1, 7) AS month,
           SUM(COALESCE(c.addonCost, 0)) AS totalCost,
           SUM(COALESCE(o.addonAmount, 0)) AS totalAmount,
           COUNT(*) AS totalCount
    FROM orders o LEFT JOIN cost_rows c ON c.orderID = o.orderID
    WHERE substr(o.checkIn, 1, 4) = ? AND o.status != '取消' AND COALESCE(o.addonAmount, 0) > 0
    GROUP BY substr(o.checkIn, 1, 7)
    ORDER BY month ASC
  `).bind(year).all();

  const settledRows = await env.DB.prepare(
    `SELECT monthKey, settledAt FROM addon_settlements`
  ).all();
  const settledMap = {};
  for (const r of settledRows.results || []) settledMap[r.monthKey] = !!r.settledAt;

  const months = (res.results || []).map((r) => ({
    month: r.month,
    totalCost: Number(r.totalCost) || 0,
    totalAmount: Number(r.totalAmount) || 0,
    totalCount: Number(r.totalCount) || 0,
    isSettled: !!settledMap[r.month],
  }));
  return json({ success: true, year, months });
}

/* ═══════════════════════════════════════════════════════════
   優惠碼
   GET    /api/admin/coupons
   POST   /api/admin/coupons
   DELETE /api/admin/coupons/:code
═══════════════════════════════════════════════════════════ */
export async function listCoupons(env) {
  const rows = await env.DB.prepare('SELECT * FROM coupons ORDER BY code').all();
  return json({ success: true, coupons: rows.results || [] });
}

export async function saveCoupon(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.code || !body.type) return json({ success: false, error: '缺少 code 或 type' }, 400);

  await env.DB.prepare(`
    INSERT INTO coupons (code, type, value, description, useLimit, usedCount, validFrom, validTo, active)
    VALUES (?,?,?,?,?,0,?,?,?)
    ON CONFLICT(code) DO UPDATE SET
      type=excluded.type, value=excluded.value, description=excluded.description,
      useLimit=excluded.useLimit, validFrom=excluded.validFrom,
      validTo=excluded.validTo, active=excluded.active
  `).bind(
    String(body.code).trim(),
    body.type,
    Number(body.value) || 0,
    body.description || '',
    toInt(body.useLimit ?? body.usageLimit ?? 0),
    body.validFrom || '',
    body.validTo   || body.validUntil || '',
    body.active !== false && body.active !== 0 ? 1 : 0
  ).run();
  return json({ success: true });
}

export async function deleteCoupon(env, code) {
  await env.DB.prepare('DELETE FROM coupons WHERE code = ?').bind(code).run();
  return json({ success: true });
}

/* ═══════════════════════════════════════════════════════════
   同業管理（Admin）
═══════════════════════════════════════════════════════════ */
export async function agencyPendingList(env) {
  const rows = await env.DB.prepare(`
    SELECT agencyId, loginId, displayName, createdAt, approvalStatus, adminNote
    FROM agency_accounts
    WHERE approvalStatus = 'pending' OR approvalStatus IS NULL OR approvalStatus = ''
    ORDER BY createdAt DESC
  `).all();
  return json({ success: true, pending: rows.results || [] });
}

export async function agencyApprovedList(env) {
  const rows = await env.DB.prepare(`
    SELECT agencyId, loginId, displayName, createdAt, approvalStatus, isActive, adminNote
    FROM agency_accounts
    WHERE approvalStatus = 'approved' AND agencyId != 'AGY_OWNER'
    ORDER BY displayName
  `).all();
  return json({ success: true, agencies: rows.results || [] });
}

export async function agencyAllData(env) {
  const accounts    = await env.DB.prepare('SELECT * FROM agency_accounts WHERE agencyId != \'AGY_OWNER\' ORDER BY displayName').all();
  const properties  = await env.DB.prepare('SELECT * FROM agency_properties ORDER BY agencyId, sortOrder').all();
  const blocks      = await env.DB.prepare('SELECT propertyId, date FROM agency_blocks ORDER BY date').all();

  const propMap  = {};
  for (const p of (properties.results || [])) {
    if (!propMap[p.agencyId]) propMap[p.agencyId] = [];
    propMap[p.agencyId].push(p);
  }
  const blockMap = {};
  for (const b of (blocks.results || [])) {
    if (!blockMap[b.propertyId]) blockMap[b.propertyId] = [];
    blockMap[b.propertyId].push(b.date);
  }

  const agencies = (accounts.results || []).map(a => ({
    ...a,
    properties: (propMap[a.agencyId] || []).map(p => ({
      ...p,
      blockedDates: blockMap[p.propertyId] || [],
    })),
  }));
  // 前端日曆讀 top-level blocksByProperty（不是 properties[].blockedDates）→ 一定要附上，
  // 否則 renderAgencyCalendar 讀 undefined 會丟錯、被 catch 重設成空 → 誤顯示「尚無同業資料」
  return json({ success: true, agencies, blocksByProperty: blockMap });
}

export async function agencyApprove(env, loginId) {
  // 核准同時重設密碼為 123456，並標記首次登入需更換密碼
  const defaultHash = await hashPasswordV2('123456');

  await env.DB.prepare(`
    UPDATE agency_accounts
    SET approvalStatus = 'approved', isActive = 1,
        passwordHash = ?, mustChangePassword = 1,
        updatedAt = datetime('now','+8 hours')
    WHERE loginId = ?
  `).bind(defaultHash, loginId).run();
  return json({ success: true });
}

export async function agencyReject(env, loginId) {
  await env.DB.prepare(`
    UPDATE agency_accounts
    SET approvalStatus = 'rejected', isActive = 0,
        updatedAt = datetime('now','+8 hours')
    WHERE loginId = ?
  `).bind(loginId).run();
  return json({ success: true });
}

export async function agencyAdminDelete(env, loginId) {
  await env.DB.prepare('DELETE FROM agency_accounts WHERE loginId = ?').bind(loginId).run();
  return json({ success: true });
}

/* ── POST /api/admin/agency/:loginId/reset-password
   body: { password }
   管理員直接重設同業密碼（不強制首次換密碼）                        */
export async function agencyAdminResetPassword(request, env, loginId) {
  const body = await request.json().catch(() => ({}));
  const { password } = body;
  if (!password) return json({ success: false, error: '缺少 password' }, 400);
  const passwordHash = await hashPasswordV2(password);
  const now = new Date().toISOString();
  await env.DB.prepare(
    `UPDATE agency_accounts SET passwordHash=?, mustChangePassword=0, updatedAt=? WHERE LOWER(loginId)=LOWER(?)`
  ).bind(passwordHash, now, loginId).run();
  return json({ success: true });
}

/* ── POST /api/admin/agency/create
   body: { loginId, password, displayName, agencyId?, propertyName? }
   管理員直接建立同業帳號（已核准）                                   */
export async function agencyAdminCreate(request, env) {
  const body = await request.json().catch(() => ({}));
  const { loginId, password, displayName, propertyName } = body;
  if (!loginId || !password || !displayName) {
    return json({ success: false, error: '缺少必填欄位: loginId / password / displayName' }, 400);
  }

  // 確認 loginId 未被使用
  const existing = await env.DB.prepare('SELECT loginId FROM agency_accounts WHERE LOWER(loginId)=LOWER(?)').bind(loginId).first();
  if (existing) return json({ success: false, error: 'loginId 已存在' }, 409);

  const passwordHash = await hashPasswordV2(password);
  const agencyId = body.agencyId || ('AGY_' + loginId.toUpperCase().replace(/[^A-Z0-9]/g, '_'));
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO agency_accounts
      (agencyId, loginId, displayName, passwordHash, approvalStatus, isActive,
       visiblePartners, mustChangePassword, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 'approved', 1, '[]', 0, ?, ?)
  `).bind(agencyId, loginId, displayName, passwordHash, now, now).run();

  // 若提供了 propertyName，建立第一個物件
  if (propertyName) {
    const propertyId = agencyId + '_P1';
    await env.DB.prepare(`
      INSERT OR IGNORE INTO agency_properties (propertyId, agencyId, propertyName, sortOrder)
      VALUES (?, ?, ?, 1)
    `).bind(propertyId, agencyId, propertyName).run();
  }

  return json({ success: true, agencyId, loginId });
}

/* ── PATCH /api/admin/agency/:loginId/visible-partners
   body: { visiblePartners: ["AGY_xxx", ...] }
   設定某一同業可看到哪些夥伴的日曆 */
export async function updateVisiblePartners(request, env, loginId) {
  const body = await request.json().catch(() => ({}));
  const vp = body.visiblePartners;
  if (!Array.isArray(vp)) {
    return json({ success: false, error: 'visiblePartners 需為陣列' }, 400);
  }
  await env.DB.prepare(
    `UPDATE agency_accounts SET visiblePartners = ?, updatedAt = ?
     WHERE loginId = ?`
  ).bind(JSON.stringify(vp), new Date().toISOString(), loginId).run();
  return json({ success: true });
}

/* ═══════════════════════════════════════════════════════════
   同業群組
═══════════════════════════════════════════════════════════ */
export async function listGroups(env) {
  // 取所有群組
  const { results: groupRows } = await env.DB.prepare(
    'SELECT * FROM agency_groups ORDER BY createdAt'
  ).all();

  // 取所有已核准業者（用來解析 memberNames 和回傳下拉選單）
  const { results: agencyRows } = await env.DB.prepare(
    `SELECT agencyId, displayName FROM agency_accounts
     WHERE approvalStatus = 'approved' AND isActive = 1
     ORDER BY displayName`
  ).all();

  // agencyId → displayName lookup map
  const agencyMap = {};
  for (const a of (agencyRows || [])) {
    agencyMap[a.agencyId] = a.displayName;
  }

  // 解析每個群組的 members（JSON string → array），並解析 memberNames
  const groups = (groupRows || []).map(g => {
    let members = [];
    try { members = JSON.parse(g.members || '[]'); } catch {}
    const memberNames = members.map(id => ({
      agencyId: id,
      displayName: agencyMap[id] || id,
    }));
    return { ...g, members, memberNames };
  });

  return json({
    success: true,
    groups,
    approvedAgencies: agencyRows || [],
  });
}

export async function createGroup(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.groupName) return json({ success: false, error: '缺少 groupName' }, 400);
  const groupId = 'GRP-' + Date.now();
  await env.DB.prepare(
    'INSERT INTO agency_groups (groupId, groupName, members) VALUES (?,?,?)'
  ).bind(groupId, body.groupName, '[]').run();
  return json({ success: true, groupId });
}

export async function addGroupMember(request, env, groupId) {
  const body = await request.json().catch(() => ({}));
  if (!body.agencyId) return json({ success: false, error: '缺少 agencyId' }, 400);
  const row = await env.DB.prepare(
    'SELECT members FROM agency_groups WHERE groupId = ?'
  ).bind(groupId).first();
  if (!row) return json({ success: false, error: '群組不存在' }, 404);
  let members = [];
  try { members = JSON.parse(row.members || '[]'); } catch {}
  if (!members.includes(body.agencyId)) members.push(body.agencyId);
  await env.DB.prepare('UPDATE agency_groups SET members = ? WHERE groupId = ?')
    .bind(JSON.stringify(members), groupId).run();
  return json({ success: true });
}

export async function removeGroupMember(env, groupId, agencyId) {
  const row = await env.DB.prepare(
    'SELECT members FROM agency_groups WHERE groupId = ?'
  ).bind(groupId).first();
  if (!row) return json({ success: false, error: '群組不存在' }, 404);
  let members = [];
  try { members = JSON.parse(row.members || '[]'); } catch {}
  members = members.filter(id => id !== agencyId);
  await env.DB.prepare('UPDATE agency_groups SET members = ? WHERE groupId = ?')
    .bind(JSON.stringify(members), groupId).run();
  return json({ success: true });
}

/* ═══════════════════════════════════════════════════════════
   推薦記錄
   GET  /api/admin/referrals
   POST /api/admin/referrals
═══════════════════════════════════════════════════════════ */
export async function listReferrals(env) {
  const rows = await env.DB.prepare(
    'SELECT * FROM referral_records ORDER BY date DESC'
  ).all();
  return json({ success: true, records: rows.results || [] });
}

export async function addReferral(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.agencyName) return json({ success: false, error: '缺少 agencyName' }, 400);
  const recordID = 'REF-' + Date.now();
  await env.DB.prepare(`
    INSERT INTO referral_records (recordID, date, agencyName, rebateAmount, notes)
    VALUES (?,?,?,?,?)
  `).bind(
    recordID,
    body.date || new Date().toISOString().slice(0, 10),
    body.agencyName,
    toInt(body.rebateAmount ?? 0),
    body.notes || ''
  ).run();
  return json({ success: true, recordID });
}

/* ═══════════════════════════════════════════════════════════
   資料庫備份
   GET /api/admin/backup        → 回傳 JSON 讓後台下載
   供 cron 呼叫的共用 dump 函式 → dumpAllTables(env)
═══════════════════════════════════════════════════════════ */

// 所有需要備份的資料表
const BACKUP_TABLES = [
  'orders', 'cost_rows',
  'agency_accounts', 'agency_properties', 'agency_blocks',
  'agency_groups', 'agency_group_members', 'agency_settlements',
  'drift_users', 'drift_reviews',
  'coupons', 'booking_locks',
  'referral_records', 'monthly_expenses', 'system_counters', 'spots',
];

export async function dumpAllTables(env) {
  const dump = {};
  for (const table of BACKUP_TABLES) {
    try {
      const { results } = await env.DB.prepare(`SELECT * FROM ${table}`).all();
      dump[table] = results || [];
    } catch (_) {
      dump[table] = [];   // 表格不存在時安全略過
    }
  }
  return dump;
}

export async function adminBackup(_request, env) {
  const dump = await dumpAllTables(env);
  const nowTW  = new Date(Date.now() + 8 * 60 * 60 * 1000);
  const dateStr = nowTW.toISOString().slice(0, 10);
  const payload = JSON.stringify({ exportedAt: nowTW.toISOString(), tables: dump }, null, 2);

  return new Response(payload, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="dropinn-backup-${dateStr}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}

/**
 * housekeeping.js — 清潔費模組 + 固定費用路由
 *
 * RTB 端（房務，需 rtb token）：
 *   GET  /api/restoretheblank/hk/costs?month=YYYY-MM   本月退房訂單 + 已填費用
 *   POST /api/restoretheblank/hk/costs                 填寫 / 更新清潔費
 *   GET  /api/restoretheblank/hk/extras?month=YYYY-MM  本月其他項目
 *   POST /api/restoretheblank/hk/extras                新增其他項目
 *   DELETE /api/restoretheblank/hk/extras/:id          刪除其他項目
 *
 * Admin 端（owner token）：
 *   GET  /api/hk/report?month=YYYY-MM                  月報（預估 vs 實際）
 *   POST /api/hk/extras                                後台新增其他項目
 *   DELETE /api/hk/extras/:id                          後台刪除其他項目
 *   POST /api/hk/settle                                月結 { month }
 *   GET  /api/hk/expense-templates                     費用模板清單
 *   POST /api/hk/expense-templates                     新增模板
 *   PATCH /api/hk/expense-templates/:id                更新模板
 *   DELETE /api/hk/expense-templates/:id               刪除模板
 *   GET  /api/hk/monthly-expenses?month=YYYY-MM        本月費用
 *   POST /api/hk/monthly-expenses/init?month=YYYY-MM   從模板初始化
 *   POST /api/hk/monthly-expenses                      手動新增
 *   PATCH /api/hk/monthly-expenses/:id                 更新
 *   DELETE /api/hk/monthly-expenses/:id                刪除
 */

import { json } from '../lib/utils.js';

// ── 預估清潔費公式 ───────────────────────────────────────────────────────
// 3間: 400×3 + 1,200 = 2,400
// 4間: 400×4 + 1,200 = 2,800
// 5間: 400×4 + 500 + 1,200 = 3,300
export function estimateCost(rooms) {
  const n = Number(rooms) || 0;
  if (n <= 0) return 0;
  const roomFee = n <= 4 ? n * 400 : 4 * 400 + (n - 4) * 500;
  return roomFee + 1200;
}

// ── RTB：本月退房訂單 + 費用 ────────────────────────────────────────────
export async function rtbHkCosts(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 需為 YYYY-MM' }, 400);
  }

  // 是否已月結
  const settlement = await env.DB.prepare(
    `SELECT settledAt FROM housekeeping_settlements WHERE month = ?`
  ).bind(month).first();
  const isSettled = !!settlement?.settledAt;

  // 本月有退房的訂單（退房日在本月）
  const ordersRes = await env.DB.prepare(`
    SELECT orderID, name, checkIn, checkOut, rooms, status
    FROM orders
    WHERE status != '取消'
      AND substr(checkOut, 1, 7) = ?
    ORDER BY checkOut ASC
  `).bind(month).all();

  const orders = ordersRes.results || [];
  if (!orders.length) {
    return json({ success: true, month, isSettled, orders: [], extras: [] });
  }

  // 取已填清潔費
  const ids = orders.map(o => o.orderID);
  const ph = ids.map(() => '?').join(',');
  const costsRes = await env.DB.prepare(
    `SELECT orderID, amount, note, submittedAt, updatedAt
     FROM housekeeping_costs WHERE orderID IN (${ph})`
  ).bind(...ids).all();
  const costByOrder = {};
  for (const c of costsRes.results || []) costByOrder[c.orderID] = c;

  // 其他項目（僅 rtb 來源）
  const extrasRes = await env.DB.prepare(
    `SELECT id, description, amount, source, createdAt FROM housekeeping_extras
     WHERE month = ? ORDER BY createdAt ASC`
  ).bind(month).all();

  const result = orders.map(o => ({
    ...o,
    estimate: estimateCost(o.rooms),
    cost: costByOrder[o.orderID] || null,
  }));

  return json({
    success: true,
    month,
    isSettled,
    orders: result,
    extras: extrasRes.results || [],
  });
}

// ── RTB：填寫 / 更新清潔費 ──────────────────────────────────────────────
export async function rtbSetHkCost(request, env) {
  const body = await request.json().catch(() => ({}));
  const { orderID, amount, note } = body;
  if (!orderID || amount == null) {
    return json({ success: false, error: '缺少 orderID 或 amount' }, 400);
  }

  // 確認訂單存在且未取消
  const order = await env.DB.prepare(
    `SELECT orderID, checkOut FROM orders WHERE orderID = ? AND status != '取消'`
  ).bind(orderID).first();
  if (!order) return json({ success: false, error: '找不到訂單' }, 404);

  // 檢查是否已月結
  const month = order.checkOut.slice(0, 7);
  const settled = await env.DB.prepare(
    `SELECT settledAt FROM housekeeping_settlements WHERE month = ?`
  ).bind(month).first();
  if (settled?.settledAt) {
    return json({ success: false, error: '本月已結清，不可修改' }, 403);
  }

  const now = new Date().toISOString();
  const existing = await env.DB.prepare(
    `SELECT id FROM housekeeping_costs WHERE orderID = ?`
  ).bind(orderID).first();

  if (existing) {
    await env.DB.prepare(`
      UPDATE housekeeping_costs SET amount = ?, note = ?, updatedAt = ?
      WHERE orderID = ?
    `).bind(Number(amount), note || '', now, orderID).run();
  } else {
    await env.DB.prepare(`
      INSERT INTO housekeeping_costs (orderID, amount, note, submittedAt, updatedAt, submittedBy)
      VALUES (?, ?, ?, ?, ?, 'rtb')
    `).bind(orderID, Number(amount), note || '', now, now).run();
  }

  return json({ success: true });
}

// ── RTB：取其他項目 ─────────────────────────────────────────────────────
export async function rtbHkExtras(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 需為 YYYY-MM' }, 400);
  }
  const settled = await env.DB.prepare(
    `SELECT settledAt FROM housekeeping_settlements WHERE month = ?`
  ).bind(month).first();

  const res = await env.DB.prepare(
    `SELECT id, description, amount, source, createdAt FROM housekeeping_extras
     WHERE month = ? ORDER BY createdAt ASC`
  ).bind(month).all();

  return json({
    success: true,
    month,
    isSettled: !!settled?.settledAt,
    extras: res.results || [],
  });
}

// ── RTB：新增其他項目 ───────────────────────────────────────────────────
export async function rtbAddHkExtra(request, env) {
  const body = await request.json().catch(() => ({}));
  const { month, description, amount } = body;
  if (!month || !description || amount == null) {
    return json({ success: false, error: '缺少必要欄位' }, 400);
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 格式錯誤' }, 400);
  }
  const settled = await env.DB.prepare(
    `SELECT settledAt FROM housekeeping_settlements WHERE month = ?`
  ).bind(month).first();
  if (settled?.settledAt) {
    return json({ success: false, error: '本月已結清' }, 403);
  }
  const now = new Date().toISOString();
  const res = await env.DB.prepare(`
    INSERT INTO housekeeping_extras (month, description, amount, source, createdAt, updatedAt)
    VALUES (?, ?, ?, 'rtb', ?, ?)
  `).bind(month, description.trim(), Number(amount), now, now).run();
  return json({ success: true, id: res.meta?.last_row_id });
}

// ── RTB：刪除其他項目（自己新增的）────────────────────────────────────
export async function rtbDeleteHkExtra(request, env, extraId) {
  const row = await env.DB.prepare(
    `SELECT id, month, source FROM housekeeping_extras WHERE id = ?`
  ).bind(extraId).first();
  if (!row) return json({ success: false, error: '找不到項目' }, 404);
  if (row.source !== 'rtb') {
    return json({ success: false, error: '只能刪除自己新增的項目' }, 403);
  }
  const settled = await env.DB.prepare(
    `SELECT settledAt FROM housekeeping_settlements WHERE month = ?`
  ).bind(row.month).first();
  if (settled?.settledAt) return json({ success: false, error: '本月已結清' }, 403);

  await env.DB.prepare(`DELETE FROM housekeeping_extras WHERE id = ?`).bind(extraId).run();
  return json({ success: true });
}

// ── Admin：月報 ─────────────────────────────────────────────────────────
export async function adminHkReport(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 需為 YYYY-MM' }, 400);
  }

  const settlement = await env.DB.prepare(
    `SELECT settledAt, totalAmount FROM housekeeping_settlements WHERE month = ?`
  ).bind(month).first();

  // 本月退房訂單
  const ordersRes = await env.DB.prepare(`
    SELECT orderID, name, checkIn, checkOut, rooms, status
    FROM orders
    WHERE status != '取消' AND substr(checkOut, 1, 7) = ?
    ORDER BY checkOut ASC
  `).bind(month).all();
  const orders = ordersRes.results || [];

  let estimateTotal = 0;
  let actualTotal = 0;
  let filledCount = 0;

  let orderList = [];
  if (orders.length) {
    const ids = orders.map(o => o.orderID);
    const ph = ids.map(() => '?').join(',');
    const costsRes = await env.DB.prepare(
      `SELECT orderID, amount, note, submittedAt, updatedAt FROM housekeeping_costs
       WHERE orderID IN (${ph})`
    ).bind(...ids).all();
    const costByOrder = {};
    for (const c of costsRes.results || []) costByOrder[c.orderID] = c;

    orderList = orders.map(o => {
      const est = estimateCost(o.rooms);
      const cost = costByOrder[o.orderID] || null;
      estimateTotal += est;
      if (cost?.amount != null) {
        actualTotal += cost.amount;
        filledCount++;
      }
      return { ...o, estimate: est, cost };
    });
  }

  // 其他項目（rtb + admin 都列）
  const extrasRes = await env.DB.prepare(
    `SELECT id, description, amount, source, createdAt FROM housekeeping_extras
     WHERE month = ? ORDER BY source ASC, createdAt ASC`
  ).bind(month).all();
  const extras = extrasRes.results || [];
  const extrasTotal = extras.reduce((s, e) => s + (e.amount || 0), 0);

  return json({
    success: true,
    month,
    isSettled: !!settlement?.settledAt,
    settledAt: settlement?.settledAt || null,
    orders: orderList,
    extras,
    summary: {
      estimateTotal,
      actualTotal: actualTotal + extrasTotal,
      extrasTotal,
      filledCount,
      totalOrders: orders.length,
    },
  });
}

// ── Admin：新增其他項目 ─────────────────────────────────────────────────
export async function adminAddHkExtra(request, env) {
  const body = await request.json().catch(() => ({}));
  const { month, description, amount } = body;
  if (!month || !description || amount == null) {
    return json({ success: false, error: '缺少必要欄位' }, 400);
  }
  const settled = await env.DB.prepare(
    `SELECT settledAt FROM housekeeping_settlements WHERE month = ?`
  ).bind(month).first();
  if (settled?.settledAt) return json({ success: false, error: '本月已結清' }, 403);

  const now = new Date().toISOString();
  const res = await env.DB.prepare(`
    INSERT INTO housekeeping_extras (month, description, amount, source, createdAt, updatedAt)
    VALUES (?, ?, ?, 'admin', ?, ?)
  `).bind(month, description.trim(), Number(amount), now, now).run();
  return json({ success: true, id: res.meta?.last_row_id });
}

// ── Admin：刪除其他項目 ─────────────────────────────────────────────────
export async function adminDeleteHkExtra(request, env, extraId) {
  const row = await env.DB.prepare(
    `SELECT id, month FROM housekeeping_extras WHERE id = ?`
  ).bind(extraId).first();
  if (!row) return json({ success: false, error: '找不到項目' }, 404);
  const settled = await env.DB.prepare(
    `SELECT settledAt FROM housekeeping_settlements WHERE month = ?`
  ).bind(row.month).first();
  if (settled?.settledAt) return json({ success: false, error: '本月已結清' }, 403);

  await env.DB.prepare(`DELETE FROM housekeeping_extras WHERE id = ?`).bind(extraId).run();
  return json({ success: true });
}

// ── Admin：月結 ─────────────────────────────────────────────────────────
export async function adminSettle(request, env) {
  const body = await request.json().catch(() => ({}));
  const { month } = body;
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 需為 YYYY-MM' }, 400);
  }
  const existing = await env.DB.prepare(
    `SELECT settledAt FROM housekeeping_settlements WHERE month = ?`
  ).bind(month).first();
  if (existing?.settledAt) {
    return json({ success: false, error: '本月已結清' }, 409);
  }

  // 計算實際總額
  const costsRes = await env.DB.prepare(`
    SELECT hc.amount FROM housekeeping_costs hc
    JOIN orders o ON o.orderID = hc.orderID
    WHERE substr(o.checkOut, 1, 7) = ? AND hc.amount IS NOT NULL
  `).bind(month).all();
  const extrasRes = await env.DB.prepare(
    `SELECT amount FROM housekeeping_extras WHERE month = ?`
  ).bind(month).all();
  const total =
    (costsRes.results || []).reduce((s, r) => s + (r.amount || 0), 0) +
    (extrasRes.results || []).reduce((s, r) => s + (r.amount || 0), 0);

  const now = new Date().toISOString();
  await env.DB.prepare(`
    INSERT INTO housekeeping_settlements (month, totalAmount, settledAt, settledBy)
    VALUES (?, ?, ?, 'admin')
    ON CONFLICT(month) DO UPDATE SET totalAmount = ?, settledAt = ?, settledBy = 'admin'
  `).bind(month, total, now, total, now).run();

  return json({ success: true, month, totalAmount: total, settledAt: now });
}

// ── Admin：費用模板 CRUD ─────────────────────────────────────────────────
export async function getExpenseTemplates(_request, env) {
  const res = await env.DB.prepare(
    `SELECT id, name, amount, isActive, sortOrder FROM expense_templates
     ORDER BY sortOrder ASC, id ASC`
  ).all();
  return json({ success: true, templates: res.results || [] });
}

export async function addExpenseTemplate(request, env) {
  const body = await request.json().catch(() => ({}));
  const { name, amount, sortOrder } = body;
  if (!name || amount == null) return json({ success: false, error: '缺少必要欄位' }, 400);
  const now = new Date().toISOString();
  const res = await env.DB.prepare(`
    INSERT INTO expense_templates (name, amount, isActive, sortOrder, createdAt)
    VALUES (?, ?, 1, ?, ?)
  `).bind(name.trim(), Number(amount), Number(sortOrder) || 0, now).run();
  return json({ success: true, id: res.meta?.last_row_id });
}

export async function updateExpenseTemplate(request, env, templateId) {
  const body = await request.json().catch(() => ({}));
  const sets = [];
  const binds = [];
  if (body.name != null)      { sets.push('name = ?');      binds.push(String(body.name).trim()); }
  if (body.amount != null)    { sets.push('amount = ?');    binds.push(Number(body.amount)); }
  if (body.isActive != null)  { sets.push('isActive = ?');  binds.push(body.isActive ? 1 : 0); }
  if (body.sortOrder != null) { sets.push('sortOrder = ?'); binds.push(Number(body.sortOrder)); }
  if (!sets.length) return json({ success: false, error: '無可更新欄位' }, 400);
  binds.push(templateId);
  await env.DB.prepare(
    `UPDATE expense_templates SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...binds).run();
  return json({ success: true });
}

export async function deleteExpenseTemplate(request, env, templateId) {
  await env.DB.prepare(`DELETE FROM expense_templates WHERE id = ?`).bind(templateId).run();
  return json({ success: true });
}

// ── Admin：本月費用 ─────────────────────────────────────────────────────
export async function getMonthlyExpenses(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 需為 YYYY-MM' }, 400);
  }
  const res = await env.DB.prepare(
    `SELECT id, name, amount, templateId, isAuto, note, createdAt
     FROM monthly_expenses WHERE month = ? ORDER BY isAuto DESC, id ASC`
  ).bind(month).all();
  const total = (res.results || []).reduce((s, r) => s + (r.amount || 0), 0);
  return json({ success: true, month, expenses: res.results || [], total });
}

// 從模板初始化本月費用（已存在的 isAuto 不重複建立）
export async function initMonthlyExpenses(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 需為 YYYY-MM' }, 400);
  }

  const templates = await env.DB.prepare(
    `SELECT id, name, amount FROM expense_templates WHERE isActive = 1 ORDER BY sortOrder ASC`
  ).all();

  const existing = await env.DB.prepare(
    `SELECT templateId FROM monthly_expenses WHERE month = ? AND isAuto = 1`
  ).bind(month).all();
  const existingIds = new Set((existing.results || []).map(r => r.templateId));

  const now = new Date().toISOString();
  let created = 0;
  for (const t of templates.results || []) {
    if (!existingIds.has(t.id)) {
      await env.DB.prepare(`
        INSERT INTO monthly_expenses (month, name, amount, templateId, isAuto, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, 1, ?, ?)
      `).bind(month, t.name, t.amount, t.id, now, now).run();
      created++;
    }
  }

  return json({ success: true, month, created });
}

export async function addMonthlyExpense(request, env) {
  const body = await request.json().catch(() => ({}));
  const { month, name, amount, note } = body;
  if (!month || !name || amount == null) {
    return json({ success: false, error: '缺少必要欄位' }, 400);
  }
  const now = new Date().toISOString();
  const res = await env.DB.prepare(`
    INSERT INTO monthly_expenses (month, name, amount, templateId, isAuto, note, createdAt, updatedAt)
    VALUES (?, ?, ?, NULL, 0, ?, ?, ?)
  `).bind(month, name.trim(), Number(amount), note || '', now, now).run();
  return json({ success: true, id: res.meta?.last_row_id });
}

export async function updateMonthlyExpense(request, env, expenseId) {
  const body = await request.json().catch(() => ({}));
  const sets = [];
  const binds = [];
  const now = new Date().toISOString();
  if (body.name != null)   { sets.push('name = ?');   binds.push(String(body.name).trim()); }
  if (body.amount != null) { sets.push('amount = ?'); binds.push(Number(body.amount)); }
  if (body.note != null)   { sets.push('note = ?');   binds.push(String(body.note)); }
  if (!sets.length) return json({ success: false, error: '無可更新欄位' }, 400);
  sets.push('updatedAt = ?');
  binds.push(now, expenseId);
  await env.DB.prepare(
    `UPDATE monthly_expenses SET ${sets.join(', ')} WHERE id = ?`
  ).bind(...binds).run();
  return json({ success: true });
}

export async function deleteMonthlyExpense(request, env, expenseId) {
  await env.DB.prepare(`DELETE FROM monthly_expenses WHERE id = ?`).bind(expenseId).run();
  return json({ success: true });
}

// ── Admin：Dashboard 小卡資料 ────────────────────────────────────────────
// 快速回傳當月預估 vs 實填（給 notforyou dashboard 用）
export async function hkDashCard(request, env) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);

  const ordersRes = await env.DB.prepare(`
    SELECT orderID, rooms FROM orders
    WHERE status != '取消' AND substr(checkOut, 1, 7) = ?
  `).bind(month).all();
  const orders = ordersRes.results || [];

  const estimateTotal = orders.reduce((s, o) => s + estimateCost(o.rooms), 0);

  let actualTotal = 0;
  let filledCount = 0;
  if (orders.length) {
    const ids = orders.map(o => o.orderID);
    const ph = ids.map(() => '?').join(',');
    const costsRes = await env.DB.prepare(
      `SELECT amount FROM housekeeping_costs WHERE orderID IN (${ph}) AND amount IS NOT NULL`
    ).bind(...ids).all();
    filledCount = costsRes.results?.length || 0;
    actualTotal = (costsRes.results || []).reduce((s, r) => s + (r.amount || 0), 0);
  }

  const extrasRes = await env.DB.prepare(
    `SELECT amount FROM housekeeping_extras WHERE month = ?`
  ).bind(month).all();
  const extrasTotal = (extrasRes.results || []).reduce((s, r) => s + (r.amount || 0), 0);

  const settlement = await env.DB.prepare(
    `SELECT settledAt FROM housekeeping_settlements WHERE month = ?`
  ).bind(month).first();

  return json({
    success: true,
    month,
    estimateTotal,
    actualTotal: actualTotal + extrasTotal,
    filledCount,
    totalOrders: orders.length,
    isSettled: !!settlement?.settledAt,
  });
}

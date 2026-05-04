/**
 * 後台管理路由（owner 專用）
 * 所有 handler 假設外部已驗證 user.role === 'owner'
 */

import { json } from '../lib/utils.js';

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
    SELECT totalPrice, paidDeposit, remainingBalance, addonAmount, extraIncome,
           discountAmount, isReturningGuest, hasCarRental
    FROM orders WHERE ${dateCond} AND status != '取消'
  `).bind(...dateBinds).all();

  let revenue = 0, addonTotal = 0, extraIncomeTotal = 0, totalDiscount = 0,
      totalDeposit = 0, totalBalance = 0, orderCount = 0, returningCount = 0;
  for (const o of (orderRows.results || [])) {
    revenue          += toInt(o.totalPrice);
    addonTotal       += toInt(o.addonAmount);
    extraIncomeTotal += toInt(o.extraIncome);
    totalDiscount    += toInt(o.discountAmount);
    totalDeposit     += toInt(o.paidDeposit);
    totalBalance     += toInt(o.remainingBalance);
    orderCount++;
    if (o.isReturningGuest) returningCount++;
  }

  const costRows = await env.DB.prepare(`
    SELECT c.rebateAmount, c.complimentaryAmount, c.otherCost, c.addonCost
    FROM cost_rows c JOIN orders o ON c.orderID = o.orderID
    WHERE ${dateCond} AND o.status != '取消'
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

  const addonCommission = addonTotal - addonCostTotal;
  const netIncome = revenue + addonCommission + extraIncomeTotal + carRentalRebateTotal
    - costTotal - monthlyExpenseTotal;

  return {
    revenue, addonTotal, addonCommission, addonCostTotal,
    costTotal, rebateTotal, complimentaryTotal, otherCostTotal,
    monthlyExpenseTotal, carRentalRebateTotal, extraIncomeTotal,
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
function normalizeDate(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (!m) return s;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

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
  const today  = new Date().toISOString().slice(0, 10);
  const result = await env.DB.prepare(`
    UPDATE orders
    SET status = '完成', lastUpdated = datetime('now','+8 hours'), updatedBy = 'auto'
    WHERE status = '洽談中' AND checkOut < ?
  `).bind(today).run();
  return json({ success: true, updated: result.meta?.changes ?? 0 });
}

/* ─── GET /api/admin/orders/:id/costs ───────────────────── */
export async function adminGetOrderCost(env, orderId) {
  const cost = await env.DB.prepare(
    'SELECT * FROM cost_rows WHERE orderID = ? LIMIT 1'
  ).bind(orderId).first();
  return json({ success: true, cost: cost || null });
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
    WHERE approvalStatus = 'approved'
    ORDER BY displayName
  `).all();
  return json({ success: true, agencies: rows.results || [] });
}

export async function agencyAllData(env) {
  const accounts    = await env.DB.prepare('SELECT * FROM agency_accounts ORDER BY displayName').all();
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
  return json({ success: true, agencies });
}

export async function agencyApprove(env, loginId) {
  await env.DB.prepare(`
    UPDATE agency_accounts
    SET approvalStatus = 'approved', isActive = 1,
        updatedAt = datetime('now','+8 hours')
    WHERE loginId = ?
  `).bind(loginId).run();
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

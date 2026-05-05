/**
 * 同業 (Agency) 路由
 *
 * 處理同業帳號驗證、自家民宿關房、互看夥伴日曆。
 *
 * 對應的資料表：
 *   agency_accounts    — 同業帳號
 *   agency_properties  — 同業旗下民宿
 *   agency_blocks      — 同業關房日期
 *
 * Hash 規則：base64(SHA-256(loginId::password::salt))，與 drift 一致。
 *
 * 環境變數：
 *   env.AGENCY_SALT  — 同業密碼 salt（沒設定時 fallback 到 env.SALT，
 *                      和 GAS 既有資料一致）
 *   env.TOKEN_SECRET — 已存在，用來簽 / 驗 JWT-like token
 */

import { hashPassword } from '../lib/hash.js';
import { createToken }  from '../lib/token.js';
import { json }         from '../lib/utils.js';

function getSalt(env) {
  // 既有 GAS 同業帳號是用 env.SALT 雜湊的，AGENCY_SALT 為新部署的別名
  return env.AGENCY_SALT || env.SALT || '';
}

/* ── POST /api/agency/login ─────────────────────────────────────── */
export async function agencyLogin(request, env) {
  const body = await request.json().catch(() => ({}));
  const { loginId, password } = body;
  if (!loginId || !password) {
    return json({ success: false, error: '帳號或密碼錯誤' }, 401);
  }

  const row = await env.DB.prepare(
    `SELECT * FROM agency_accounts WHERE LOWER(loginId) = LOWER(?)`
  ).bind(loginId).first();
  if (!row) {
    return json({ success: false, error: '帳號或密碼錯誤' }, 401);
  }

  if (Number(row.isActive) !== 1) {
    return json({ success: false, error: '帳號未開通' }, 403);
  }
  if (row.approvalStatus === 'pending') {
    return json({ success: false, pending: true, error: '申請審核中' }, 403);
  }
  if (row.approvalStatus === 'rejected') {
    return json({ success: false, rejected: true, error: '申請未通過' }, 403);
  }

  const hash = await hashPassword(row.loginId, password, getSalt(env));
  if (hash !== row.passwordHash) {
    return json({ success: false, error: '帳號或密碼錯誤' }, 401);
  }

  const token = await createToken(
    {
      userId: row.agencyId,
      loginId: row.loginId,
      role: 'agency',
      displayName: row.displayName,
    },
    env.TOKEN_SECRET
  );

  return json({
    success: true,
    token,
    agencyId: row.agencyId,
    displayName: row.displayName,
  });
}

/* ── POST /api/agency/register ─────────────────────────────────── */
export async function agencyRegister(request, env) {
  const body = await request.json().catch(() => ({}));
  const { loginId, password, displayName } = body;
  if (!loginId || !password || !displayName) {
    return json({ success: false, error: '請填寫完整資料' }, 400);
  }

  const taken = await env.DB.prepare(
    `SELECT agencyId FROM agency_accounts WHERE LOWER(loginId) = LOWER(?)`
  ).bind(loginId).first();
  if (taken) {
    return json({ success: false, error: '此登入代碼已被使用' }, 409);
  }

  const passwordHash = await hashPassword(loginId, password, getSalt(env));
  const agencyId = 'AGY_' + Date.now();
  const now = new Date().toISOString();

  await env.DB.prepare(`
    INSERT INTO agency_accounts (
      agencyId, loginId, passwordHash, displayName,
      createdAt, updatedAt,
      isActive, adminNote, approvalStatus, visiblePartners
    ) VALUES (?, ?, ?, ?, ?, ?, 0, '', 'pending', '[]')
  `).bind(agencyId, loginId, passwordHash, displayName, now, now).run();

  return json({ success: true, message: '申請已送出，等待審核' });
}

/* ── GET /api/agency/properties ─────────────────────────────────── */
export async function getAgencyProperties(_request, env, agencyId) {
  const rows = await env.DB.prepare(
    `SELECT * FROM agency_properties
     WHERE agencyId = ?
     ORDER BY sortOrder ASC, propertyName ASC`
  ).bind(agencyId).all();
  return json({ success: true, properties: rows.results || [] });
}

/* ── GET /api/agency/blocks?propertyId=... ──────────────────────── */
export async function getAgencyBlocks(request, env) {
  const url = new URL(request.url);
  const propertyId = url.searchParams.get('propertyId') || '';
  if (!propertyId) {
    return json({ success: false, error: '缺少 propertyId' }, 400);
  }
  const rows = await env.DB.prepare(
    `SELECT date FROM agency_blocks WHERE propertyId = ? ORDER BY date`
  ).bind(propertyId).all();
  const dates = (rows.results || []).map((r) => r.date);
  return json({ success: true, dates });
}

/* ── POST /api/agency/blocks ─ block / unblock 一格 ──────────────── */
export async function setAgencyBlock(request, env, agencyId) {
  const body = await request.json().catch(() => ({}));
  const { propertyId, date, action } = body;
  if (!propertyId || !date || !action) {
    return json({ success: false, error: '參數不完整' }, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return json({ success: false, error: '日期格式錯誤' }, 400);
  }

  // owner 角色可代操作任何 property，agency 只能操作自己的
  const where = ['propertyId = ?'];
  const binds = [propertyId];
  if (agencyId) {
    where.push('agencyId = ?');
    binds.push(agencyId);
  }
  const owns = await env.DB.prepare(
    `SELECT propertyId FROM agency_properties WHERE ${where.join(' AND ')}`
  ).bind(...binds).first();
  if (!owns) {
    return json({ success: false, error: '無權操作' }, 403);
  }

  const now = new Date().toISOString();
  if (action === 'block') {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO agency_blocks
        (propertyId, date, createdAt, updatedAt, source)
      VALUES (?, ?, ?, ?, 'agency')
    `).bind(propertyId, date, now, now).run();
  } else if (action === 'unblock') {
    await env.DB.prepare(
      `DELETE FROM agency_blocks WHERE propertyId = ? AND date = ?`
    ).bind(propertyId, date).run();
  } else {
    return json({ success: false, error: 'action 必須為 block 或 unblock' }, 400);
  }

  return json({ success: true });
}

/* ── GET /api/agency/partner-calendar?month=YYYY-MM ───────────────
   回傳：
   - partners: visiblePartners 名單裡每位夥伴本月各 property 的關房日期
   - dropinnBooked:  雫旅本月「已付訂/完成」佔用的日期 (ME tab)
   - dropinnPending: 雫旅本月「洽談中」佔用的日期 (ME tab)
*/
export async function getPartnerCalendar(request, env, agencyId) {
  const url = new URL(request.url);
  const month = url.searchParams.get('month') || '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return json({ success: false, error: 'month 需為 YYYY-MM' }, 400);
  }

  // ── 雫旅本月訂單（給 ME tab 用）─────────────────────────────
  const dropinnBooked = new Set();
  const dropinnPending = new Set();
  const dropinnOrders = await env.DB.prepare(
    `SELECT checkIn, checkOut, status FROM orders
     WHERE status != '取消'
       AND (substr(checkIn, 1, 7) = ? OR substr(checkOut, 1, 7) = ?)`
  ).bind(month, month).all();

  function expandDates(checkIn, checkOut) {
    const dates = [];
    let cur = new Date(checkIn + 'T00:00:00');
    const end = new Date(checkOut + 'T00:00:00');
    while (cur < end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  }

  for (const b of dropinnOrders.results || []) {
    const dates = expandDates(b.checkIn, b.checkOut).filter(d => d.startsWith(month));
    if (b.status === '已付訂' || b.status === '完成') {
      dates.forEach(d => dropinnBooked.add(d));
    } else if (b.status === '洽談中') {
      dates.forEach(d => dropinnPending.add(d));
    }
  }

  // ── 自己的可見夥伴清單 ────────────────────────────────────────
  const me = await env.DB.prepare(
    `SELECT visiblePartners FROM agency_accounts WHERE agencyId = ?`
  ).bind(agencyId).first();
  if (!me) {
    return json({ success: false, error: '找不到帳號' }, 404);
  }
  let partnerIds = [];
  try {
    const parsed = JSON.parse(me.visiblePartners || '[]');
    if (Array.isArray(parsed)) partnerIds = parsed.filter(Boolean);
  } catch (_) {
    partnerIds = [];
  }

  if (!partnerIds.length) {
    return json({
      success: true,
      month,
      partners: [],
      dropinnBooked: [...dropinnBooked].sort(),
      dropinnPending: [...dropinnPending].sort(),
    });
  }

  const placeholders = partnerIds.map(() => '?').join(', ');

  // 一次拉所有夥伴的帳號名稱
  const accountsRes = await env.DB.prepare(
    `SELECT agencyId, displayName
     FROM agency_accounts
     WHERE agencyId IN (${placeholders})`
  ).bind(...partnerIds).all();
  const nameById = {};
  for (const r of accountsRes.results || []) {
    nameById[r.agencyId] = r.displayName;
  }

  // 一次拉所有夥伴的 active properties
  const propsRes = await env.DB.prepare(
    `SELECT propertyId, agencyId, propertyName, sortOrder, colorKey
     FROM agency_properties
     WHERE agencyId IN (${placeholders}) AND isActive = 1
     ORDER BY agencyId, sortOrder ASC`
  ).bind(...partnerIds).all();

  const propertyIds = (propsRes.results || []).map((p) => p.propertyId);
  const blocksByProperty = {};
  if (propertyIds.length) {
    const propPh = propertyIds.map(() => '?').join(', ');
    const blocksRes = await env.DB.prepare(
      `SELECT propertyId, date
       FROM agency_blocks
       WHERE propertyId IN (${propPh})
         AND substr(date, 1, 7) = ?
       ORDER BY date`
    ).bind(...propertyIds, month).all();
    for (const b of blocksRes.results || []) {
      (blocksByProperty[b.propertyId] ||= []).push(b.date);
    }
  }

  // 組成回傳結構
  const partners = partnerIds.map((pid) => {
    const props = (propsRes.results || [])
      .filter((p) => p.agencyId === pid)
      .map((p) => ({
        propertyId: p.propertyId,
        propertyName: p.propertyName,
        colorKey: p.colorKey,
        blockedDates: blocksByProperty[p.propertyId] || [],
      }));
    return {
      agencyId: pid,
      displayName: nameById[pid] || pid,
      properties: props,
    };
  });

  return json({
    success: true,
    month,
    partners,
    dropinnBooked: [...dropinnBooked].sort(),
    dropinnPending: [...dropinnPending].sort(),
  });
}

/* ── POST /api/agency/properties ─ 新增自家 property ──────────── */
export async function addProperty(request, env, agencyId) {
  const body = await request.json().catch(() => ({}));
  const propertyName = (body.propertyName || '').trim();
  const colorKey = body.colorKey || 'A';
  if (!propertyName) {
    return json({ success: false, error: 'propertyName 必填' }, 400);
  }

  const maxRow = await env.DB.prepare(
    `SELECT COALESCE(MAX(sortOrder), 0) AS maxOrder
     FROM agency_properties WHERE agencyId = ?`
  ).bind(agencyId).first();
  const nextOrder = (maxRow?.maxOrder || 0) + 1;
  const propertyId = 'PROP_' + agencyId + '_' + Date.now();

  await env.DB.prepare(`
    INSERT INTO agency_properties
      (propertyId, agencyId, propertyName, sortOrder, isActive, colorKey)
    VALUES (?, ?, ?, ?, 1, ?)
  `).bind(propertyId, agencyId, propertyName, nextOrder, colorKey).run();

  return json({ success: true, propertyId });
}

/* ── PATCH / DELETE /api/agency/properties/:propertyId ─────────── */
export async function manageProperty(request, env, agencyId, propertyId, method) {
  if (!propertyId) {
    return json({ success: false, error: '缺少 propertyId' }, 400);
  }

  // 一律先驗 ownership
  const owns = await env.DB.prepare(
    `SELECT propertyId FROM agency_properties
     WHERE propertyId = ? AND agencyId = ?`
  ).bind(propertyId, agencyId).first();
  if (!owns) {
    return json({ success: false, error: '無權操作' }, 403);
  }

  if (method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    const sets = [];
    const binds = [];
    if (typeof body.propertyName === 'string' && body.propertyName.trim()) {
      sets.push('propertyName = ?');
      binds.push(body.propertyName.trim());
    }
    if (typeof body.colorKey === 'string' && body.colorKey) {
      sets.push('colorKey = ?');
      binds.push(body.colorKey);
    }
    if (typeof body.sortOrder === 'number') {
      sets.push('sortOrder = ?');
      binds.push(body.sortOrder);
    }
    if (typeof body.isActive === 'number' || typeof body.isActive === 'boolean') {
      sets.push('isActive = ?');
      binds.push(body.isActive ? 1 : 0);
    }
    if (!sets.length) {
      return json({ success: false, error: '無可更新欄位' }, 400);
    }
    binds.push(propertyId);
    await env.DB.prepare(
      `UPDATE agency_properties SET ${sets.join(', ')} WHERE propertyId = ?`
    ).bind(...binds).run();
    return json({ success: true });
  }

  if (method === 'DELETE') {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM agency_blocks WHERE propertyId = ?`).bind(propertyId),
      env.DB.prepare(
        `DELETE FROM agency_properties WHERE propertyId = ? AND agencyId = ?`
      ).bind(propertyId, agencyId),
    ]);
    return json({ success: true });
  }

  return json({ error: 'method not allowed' }, 405);
}

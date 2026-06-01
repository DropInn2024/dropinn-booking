/**
 * Spots 路由
 * GET    /api/drift/spots         — 列出所有 spots（公開）
 * GET    /api/drift/spots/:id     — 取單一 spot（公開）
 * POST   /api/drift/spots         — 新增（雫編 only）
 * PUT    /api/drift/spots/:id     — 更新（雫編 only）
 * DELETE /api/drift/spots/:id     — 刪除（雫編 only）
 *
 * 設計原則：朋友（friend）透過評論+照片貢獻內容，不直接增改 spot 本身。
 * spot 是策展物件，由雫編 curator-style 管理。
 */

import { json } from '../lib/utils.js';

const ROW_TO_OBJ = (row) => ({
  id: row.id,
  type: row.type,
  cat: row.cat || '',
  name: row.name,
  area: row.area || '',
  rating: row.rating ?? 0,
  price: row.price || '',
  note: row.note || '',
  feature: row.feature || '',
  tags: parseTags(row.tags),
  nearby: row.nearby === 1,
  lat: row.lat ?? 0,
  lng: row.lng ?? 0,
  status: row.status || 'open',
  noLoc: row.noLoc === 1,
  // 交通方式：'ferry' 表離島搭船（前台改成導航到港口）；其餘視為開車
  transport: row.transport || 'drive',
  ferry: parseFerry(row.ferry),   // { harborId, minutes, note } 或 null
  displayOrder: row.displayOrder,
  createdBy: row.createdBy || 'owner',
  createdAt: row.createdAt || '',
  updatedAt: row.updatedAt || '',
});

function parseTags(s) {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
}

function parseFerry(s) {
  if (!s) return null;
  try { const o = JSON.parse(s); return (o && o.harborId) ? o : null; } catch { return null; }
}

/**
 * GET /api/drift/spots
 * Query params:
 *   ?type=food|attraction  (optional)
 *   ?area=馬公             (optional)
 *   ?cat=咖啡甜點          (optional)
 *
 * 排序：displayOrder ASC NULLS LAST, id ASC
 */
export async function listSpots(request, env) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type');
  const area = url.searchParams.get('area');
  const cat  = url.searchParams.get('cat');

  const where = [];
  const bind  = [];
  if (type) { where.push('type = ?'); bind.push(type); }
  if (area) { where.push('area = ?'); bind.push(area); }
  if (cat)  { where.push('cat = ?');  bind.push(cat); }

  const sql = `
    SELECT * FROM drift_spots
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY
      CASE WHEN displayOrder IS NULL THEN 1 ELSE 0 END,
      displayOrder ASC,
      type DESC,                -- 'food' (f) 排在 'attraction' (a) 之前
      id ASC
  `;

  const stmt = bind.length ? env.DB.prepare(sql).bind(...bind) : env.DB.prepare(sql);
  const { results = [] } = await stmt.all();
  return json({ success: true, spots: results.map(ROW_TO_OBJ) });
}

/**
 * GET /api/drift/spots/:id
 */
export async function getSpot(env, id) {
  const row = await env.DB.prepare(
    'SELECT * FROM drift_spots WHERE id = ?'
  ).bind(id).first();
  if (!row) return json({ error: '找不到此景點' }, 404);
  return json({ success: true, spot: ROW_TO_OBJ(row) });
}

// ── 可寫欄位白名單（防意外把 id/createdBy/*At 蓋掉）──
const WRITABLE = [
  'type', 'cat', 'name', 'area', 'rating', 'price', 'note',
  'feature', 'tags', 'nearby', 'lat', 'lng', 'status', 'noLoc',
  'displayOrder', 'transport', 'ferry',
];

// 把前端傳來的 JS 物件正規化到 DB 欄位（boolean → 0/1, tags/ferry 物件 → JSON）
function normalize(body, fields = WRITABLE) {
  const out = {};
  for (const k of fields) {
    if (!(k in body)) continue;
    let v = body[k];
    if (k === 'tags' && Array.isArray(v)) v = JSON.stringify(v);
    else if (k === 'ferry') v = (v && typeof v === 'object') ? JSON.stringify(v) : (v || null);
    else if (k === 'nearby' || k === 'noLoc') v = v ? 1 : 0;
    else if (k === 'rating' || k === 'displayOrder') v = (v === null || v === '') ? null : Number(v);
    out[k] = v;
  }
  return out;
}

function genSpotId(type) {
  const prefix = type === 'attraction' ? 'a' : 'f';
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * POST /api/drift/spots
 * Body：可選 id（若不傳則自動產生）、type、cat、name、area、…
 * 必填：type, name
 */
export async function createSpot(request, env, user) {
  // 雫編 與 朋友（已通過審核者）都能新增；朋友僅能編輯自己新增的
  if (user.role !== 'owner' && user.role !== 'friend') {
    return json({ error: '請先登入' }, 403);
  }

  const body = await request.json();
  if (!body.name || !body.name.trim()) return json({ error: '請填寫店名/景點名' }, 400);
  if (!body.type || !['food', 'attraction'].includes(body.type)) {
    return json({ error: 'type 必須是 food 或 attraction' }, 400);
  }

  const id = (body.id && String(body.id).trim()) || genSpotId(body.type);
  const exists = await env.DB.prepare('SELECT id FROM drift_spots WHERE id = ?').bind(id).first();
  if (exists) return json({ error: `id "${id}" 已存在` }, 409);

  const now = new Date().toISOString();
  const data = normalize(body);
  // 預設值
  if (!('cat' in data)) data.cat = '';
  if (!('area' in data)) data.area = '';
  if (!('rating' in data)) data.rating = 0;
  if (!('status' in data)) data.status = 'open';
  if (!('nearby' in data)) data.nearby = 0;
  if (!('noLoc' in data)) data.noLoc = 0;
  if (!('tags' in data)) data.tags = '[]';

  const cols = ['id', ...Object.keys(data), 'createdBy', 'createdAt', 'updatedAt'];
  const vals = [id, ...Object.values(data), user.userId || 'owner', now, now];
  const placeholders = cols.map(() => '?').join(', ');

  await env.DB.prepare(
    `INSERT INTO drift_spots (${cols.join(', ')}) VALUES (${placeholders})`
  ).bind(...vals).run();

  const row = await env.DB.prepare('SELECT * FROM drift_spots WHERE id = ?').bind(id).first();
  return json({ success: true, spot: ROW_TO_OBJ(row) });
}

/**
 * PUT /api/drift/spots/:id
 * Body：partial（只送要更新的欄位）
 */
export async function updateSpot(request, env, user, id) {
  const row0 = await env.DB.prepare('SELECT id, createdBy FROM drift_spots WHERE id = ?').bind(id).first();
  if (!row0) return json({ error: '找不到此景點' }, 404);

  // 雫編可改任何 spot；朋友只能改自己新增的（createdBy === 自己 userId）
  const isOwner  = user.role === 'owner';
  const isAuthor = user.role === 'friend' && row0.createdBy === user.userId;
  if (!isOwner && !isAuthor) {
    return json({ error: '只能編輯自己新增的景點' }, 403);
  }

  const body = await request.json();
  const data = normalize(body);
  if (Object.keys(data).length === 0) return json({ error: '沒有可更新的欄位' }, 400);

  const setClause = Object.keys(data).map((k) => `${k} = ?`).join(', ');
  const now = new Date().toISOString();

  await env.DB.prepare(
    `UPDATE drift_spots SET ${setClause}, updatedAt = ? WHERE id = ?`
  ).bind(...Object.values(data), now, id).run();

  const row = await env.DB.prepare('SELECT * FROM drift_spots WHERE id = ?').bind(id).first();
  return json({ success: true, spot: ROW_TO_OBJ(row) });
}

/**
 * DELETE /api/drift/spots/:id
 * 朋友可刪自己新增的；雫編可刪任何
 */
export async function deleteSpot(env, user, id) {
  const row = await env.DB.prepare('SELECT createdBy FROM drift_spots WHERE id = ?').bind(id).first();
  if (!row) return json({ error: '找不到此景點' }, 404);

  const isOwner  = user.role === 'owner';
  const isAuthor = user.role === 'friend' && row.createdBy === user.userId;
  if (!isOwner && !isAuthor) {
    return json({ error: '只能刪除自己新增的景點' }, 403);
  }

  await env.DB.prepare('DELETE FROM drift_spots WHERE id = ?').bind(id).run();
  return json({ success: true });
}

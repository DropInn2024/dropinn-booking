/**
 * Spots 路由
 * GET    /api/drift/spots         — 列出所有 spots（公開）
 * GET    /api/drift/spots/:id     — 取單一 spot（公開）
 * POST   /api/drift/spots         — 新增（雫編 / 朋友皆可，朋友需審核）
 * PUT    /api/drift/spots/:id     — 更新（雫編 / 該 spot 的 createdBy）
 * DELETE /api/drift/spots/:id     — 刪除（雫編 only）
 *
 * Phase 1：先只開 GET（公開讀取），CUD 之後 Phase 2 配合後台 UI 再開
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
  displayOrder: row.displayOrder,
  createdBy: row.createdBy || 'owner',
  createdAt: row.createdAt || '',
  updatedAt: row.updatedAt || '',
});

function parseTags(s) {
  if (!s) return [];
  try { return JSON.parse(s); } catch { return []; }
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

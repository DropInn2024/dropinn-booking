/**
 * 雫編專用路由
 * GET    /api/drift/admin/users                      — 好友列表（已核准）
 * GET    /api/drift/admin/users?status=pending        — 待審申請
 * PATCH  /api/drift/admin/users/:userId/approve       — 核准
 * PATCH  /api/drift/admin/users/:userId/reject        — 拒絕
 * DELETE /api/drift/admin/users/:userId               — 刪除帳號
 * GET    /api/drift/admin/reviews                    — 所有評論
 */

import { json } from '../lib/utils.js';

export async function handleAdmin(request, env, user, path) {
  const url = new URL(request.url);

  // ── 好友列表（已核准 or 待審）────────────────────────────
  if (path === '/api/drift/admin/users' && request.method === 'GET') {
    const status = url.searchParams.get('status') || 'approved';
    const rows = await env.DB.prepare(
      `SELECT userId, loginId, displayName, persona, approvalStatus, createdAt, lastLogin
       FROM drift_users
       WHERE approvalStatus = ?
       ORDER BY createdAt DESC`
    ).bind(status).all();
    return json({ success: true, users: rows.results || [] });
  }

  // ── 核准 / 拒絕 ──────────────────────────────────────────
  const approveMatch = path.match(/^\/api\/drift\/admin\/users\/([^/]+)\/(approve|reject)$/);
  if (approveMatch && request.method === 'PATCH') {
    const [, targetId, action] = approveMatch;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    await env.DB.prepare(
      'UPDATE drift_users SET approvalStatus = ? WHERE userId = ?'
    ).bind(newStatus, targetId).run();
    return json({ success: true, approvalStatus: newStatus });
  }

  // ── 刪除好友 ──────────────────────────────────────────────
  const delMatch = path.match(/^\/api\/drift\/admin\/users\/(.+)$/);
  if (delMatch && request.method === 'DELETE') {
    const targetId = delMatch[1];
    await env.DB.prepare('DELETE FROM drift_users WHERE userId = ?').bind(targetId).run();
    return json({ success: true });
  }

  // ── 所有評論 ──────────────────────────────────────────────
  if (path === '/api/drift/admin/reviews' && request.method === 'GET') {
    const spotId = url.searchParams.get('spotId') || '';
    let rows;
    if (spotId) {
      rows = await env.DB.prepare(
        `SELECT * FROM drift_reviews WHERE spotId = ? ORDER BY createdAt DESC`
      ).bind(spotId).all();
    } else {
      rows = await env.DB.prepare(
        `SELECT * FROM drift_reviews ORDER BY createdAt DESC LIMIT 500`
      ).all();
    }
    return json({ success: true, reviews: rows.results || [] });
  }

  return json({ error: '找不到路由' }, 404);
}

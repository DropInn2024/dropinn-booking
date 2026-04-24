/**
 * 主理人專用路由
 * GET    /api/drift/admin/users          — 好友列表
 * DELETE /api/drift/admin/users/:userId  — 刪除好友帳號
 * GET    /api/drift/admin/reviews        — 所有評論（可篩選 spotId）
 */

import { json } from '../index.js';

export async function handleAdmin(request, env, user, path) {
  const url = new URL(request.url);

  // ── 好友列表 ──────────────────────────────────────────────
  if (path === '/api/drift/admin/users' && request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT userId, loginId, displayName, persona, createdAt, lastLogin
       FROM drift_users
       ORDER BY createdAt DESC`
    ).all();
    return json({ success: true, users: rows.results || [] });
  }

  // ── 刪除好友 ──────────────────────────────────────────────
  const delMatch = path.match(/^\/api\/drift\/admin\/users\/(.+)$/);
  if (delMatch && request.method === 'DELETE') {
    const targetId = delMatch[1];
    await env.DB.prepare('DELETE FROM drift_users WHERE userId = ?').bind(targetId).run();
    // CASCADE 會自動刪掉該好友的評論
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

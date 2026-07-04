/**
 * Drift 評論路由
 * GET    /api/drift/reviews?spotId=f01      — 公開讀取
 * POST   /api/drift/reviews                 — 新增或更新評論（需登入）
 * DELETE /api/drift/reviews/:reviewId       — 刪除評論（需登入）
 * PATCH  /api/drift/reviews/:reviewId/pin   — 置頂 / 取消置頂（雫編 only）
 *
 * 排序：pinnedOrder ASC NULLS LAST, createdAt DESC
 */

import { json } from '../lib/utils.js';

export async function handleReviews(request, env, user, action, reviewId = null) {
  switch (action) {

    // ── 讀取評論 ────────────────────────────────────────────
    case 'list': {
      const url = new URL(request.url);
      const spotId = url.searchParams.get('spotId') || '';

      // 置頂在前（pinnedOrder 小的先）→ 同 pinned 或都未 pinned，依 createdAt DESC
      const orderClause = `
        ORDER BY
          CASE WHEN r.pinnedOrder IS NULL THEN 1 ELSE 0 END,
          r.pinnedOrder ASC,
          r.createdAt DESC
      `;
      let rows;
      if (spotId) {
        rows = await env.DB.prepare(
          `SELECT r.reviewId, r.spotId, r.author, r.persona, r.note, r.rating, r.createdAt,
                  r.userId, r.pinnedOrder,
                  CASE WHEN r.userId = 'owner' THEN 1 ELSE 0 END as isOwner
           FROM drift_reviews r
           WHERE r.spotId = ?
           ${orderClause}`
        ).bind(spotId).all();
      } else {
        rows = await env.DB.prepare(
          `SELECT r.reviewId, r.spotId, r.author, r.persona, r.note, r.rating, r.createdAt,
                  r.userId, r.pinnedOrder,
                  CASE WHEN r.userId = 'owner' THEN 1 ELSE 0 END as isOwner
           FROM drift_reviews r
           ${orderClause}
           LIMIT 200`
        ).all();
      }

      return json({ success: true, reviews: rows.results || [] });
    }

    // ── 置頂 / 取消置頂 ──────────────────────────────────────
    // PATCH /api/drift/reviews/:reviewId/pin  body: { pinned: true|false }
    case 'pin': {
      if (!reviewId) return json({ error: '請指定評論 ID' }, 400);
      if (!user || user.role !== 'owner') return json({ error: '只有雫編可以置頂評論' }, 403);

      const row = await env.DB.prepare(
        'SELECT spotId, pinnedOrder FROM drift_reviews WHERE reviewId = ?'
      ).bind(reviewId).first();
      if (!row) return json({ error: '找不到評論' }, 404);

      const { pinned } = await request.json();

      if (pinned) {
        // 取此 spot 目前最大的 pinnedOrder + 1，新置頂的排最後（但仍在未置頂前面）
        const maxRow = await env.DB.prepare(
          `SELECT COALESCE(MAX(pinnedOrder), 0) + 1 as next FROM drift_reviews WHERE spotId = ?`
        ).bind(row.spotId).first();
        const nextOrder = (maxRow && maxRow.next) || 1;
        await env.DB.prepare(
          'UPDATE drift_reviews SET pinnedOrder = ? WHERE reviewId = ?'
        ).bind(nextOrder, reviewId).run();
        return json({ success: true, pinned: true, pinnedOrder: nextOrder });
      } else {
        await env.DB.prepare(
          'UPDATE drift_reviews SET pinnedOrder = NULL WHERE reviewId = ?'
        ).bind(reviewId).run();
        return json({ success: true, pinned: false });
      }
    }

    // ── 新增或更新評論 ──────────────────────────────────────
    case 'save': {
      const { spotId, note, rating, persona } = await request.json();

      if (!spotId) return json({ error: '請指定景點' }, 400);
      if (!note || note.trim().length === 0) return json({ error: '請輸入評論內容' }, 400);
      if (note.length > 500) return json({ error: '評論最多 500 字' }, 400);
      if (persona && String(persona).length > 200) return json({ error: '人設最多 200 字' }, 400); // 對齊 updateProfile 的限制
      if (rating !== undefined && (rating < 0 || rating > 3)) return json({ error: '評分超出範圍' }, 400);

      // 驗證景點存在（對齊 setRating；否則會產生指向不存在景點的孤兒評論）
      const spot = await env.DB.prepare('SELECT id FROM drift_spots WHERE id = ?').bind(spotId).first();
      if (!spot) return json({ error: '找不到此景點' }, 404);

      // 查有沒有既有評論（每人每景點只能有一則）
      const existing = await env.DB.prepare(
        'SELECT reviewId FROM drift_reviews WHERE spotId = ? AND userId = ?'
      ).bind(spotId, user.userId).first();

      const now = new Date().toISOString();
      const authorName = user.displayName || (user.role === 'owner' ? '雫編' : '好友');
      const personaText = persona ?? '';

      if (existing) {
        // 更新
        await env.DB.prepare(
          `UPDATE drift_reviews SET note = ?, rating = ?, persona = ?, author = ?
           WHERE reviewId = ?`
        ).bind(note.trim(), rating ?? 0, personaText, authorName, existing.reviewId).run();
        return json({ success: true, reviewId: existing.reviewId, action: 'updated' });
      } else {
        // 新增
        const reviewId = 'R_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        await env.DB.prepare(
          `INSERT INTO drift_reviews (reviewId, spotId, userId, author, persona, note, rating, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(reviewId, spotId, user.userId, authorName, personaText, note.trim(), rating ?? 0, now).run();
        return json({ success: true, reviewId, action: 'created' });
      }
    }

    // ── 刪除評論 ────────────────────────────────────────────
    case 'delete': {
      if (!reviewId) return json({ error: '請指定評論 ID' }, 400);

      const row = await env.DB.prepare(
        'SELECT userId FROM drift_reviews WHERE reviewId = ?'
      ).bind(reviewId).first();

      if (!row) return json({ error: '找不到評論' }, 404);

      // 只有本人或雫編可以刪
      if (row.userId !== user.userId && user.role !== 'owner') {
        return json({ error: '沒有權限刪除此評論' }, 403);
      }

      await env.DB.prepare(
        'DELETE FROM drift_reviews WHERE reviewId = ?'
      ).bind(reviewId).run();

      return json({ success: true });
    }

    default:
      return json({ error: '未知操作' }, 400);
  }
}

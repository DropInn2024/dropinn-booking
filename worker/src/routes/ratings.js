/**
 * drift 旅人評分（跨客人真實彙總）
 *  GET  /api/drift/ratings?spotId=&voterId=   公開：回 { avg, count, mine }
 *  POST /api/drift/ratings { spotId, stars, voterId }  登入者：upsert；stars=0 取消
 *
 * 一台裝置（voterId）對一景點一票。雫編不在此給星（私藏/精選是 spot.rating 策展徽章）。
 */
import { json } from '../lib/utils.js';

async function aggregate(env, spotId, voterId) {
  const agg = await env.DB.prepare(
    `SELECT COUNT(*) AS count, COALESCE(AVG(stars), 0) AS avg FROM drift_ratings WHERE spotId = ?`
  ).bind(spotId).first();
  const count = agg ? agg.count : 0;
  let mine = 0;
  if (voterId) {
    const r = await env.DB.prepare(
      `SELECT stars FROM drift_ratings WHERE spotId = ? AND voterId = ?`
    ).bind(spotId, voterId).first();
    mine = r ? r.stars : 0;
  }
  return { avg: count ? Math.round(agg.avg * 10) / 10 : null, count, mine };
}

export async function getRating(request, env) {
  const url = new URL(request.url);
  const spotId = url.searchParams.get('spotId');
  const voterId = url.searchParams.get('voterId') || '';
  if (!spotId) return json({ error: '缺少 spotId' }, 400);
  return json({ success: true, ...(await aggregate(env, spotId, voterId)) });
}

export async function setRating(request, env, user) {
  if (!user || !['guest', 'friend', 'owner'].includes(user.role)) {
    return json({ error: '請先登入' }, 403);
  }
  const body = await request.json().catch(() => ({}));
  const spotId = body.spotId;
  const voterId = String(body.voterId || '').slice(0, 64);
  const stars = parseInt(body.stars, 10);
  if (!spotId || !voterId) return json({ error: '缺少參數' }, 400);
  if (isNaN(stars) || stars < 0 || stars > 5) return json({ error: '星等須為 0..5' }, 400);

  const spot = await env.DB.prepare('SELECT id FROM drift_spots WHERE id = ?').bind(spotId).first();
  if (!spot) return json({ error: '找不到此景點' }, 404);

  if (stars === 0) {
    await env.DB.prepare(`DELETE FROM drift_ratings WHERE spotId = ? AND voterId = ?`)
      .bind(spotId, voterId).run();
  } else {
    const now = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
    await env.DB.prepare(
      `INSERT INTO drift_ratings (spotId, voterId, stars, updatedAt) VALUES (?, ?, ?, ?)
       ON CONFLICT(spotId, voterId) DO UPDATE SET stars = ?, updatedAt = ?`
    ).bind(spotId, voterId, stars, now, stars, now).run();
  }
  return json({ success: true, ...(await aggregate(env, spotId, voterId)) });
}

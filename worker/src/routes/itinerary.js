/**
 * 付費版雲端遊記保存（綁訂單/代碼，保留 14 天）
 *  POST   /api/itinerary/save            premium：存（照片上 R2、文字進 D1）
 *  GET    /api/itinerary/load            premium：讀回自己的遊記
 *  DELETE /api/itinerary                 premium：刪除自己的雲端遊記
 *  GET    /api/itinerary/photo/:sub/:f   公開串流 R2 照片（不回 json）
 * 身分鍵 user.sub 由 auth.js codeLogin 帶入（'O:'+訂單 或 'C:'+代碼）。
 */
import { json } from '../lib/utils.js';

const DAY = 86400000;
const RETAIN_DAYS = 14;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_DAYS = 60;
const MAX_PHOTOS = 300;
const PHOTO_PREFIX = '/api/itinerary/photo/';

function isPremium(user) { return !!(user && user.tier === 'premium' && user.sub); }
function safeSub(sub) { return String(sub).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 80); }

async function sha256hex(bytes) {
  const h = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function dataUrlToBytes(dataUrl) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl || '');
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { contentType: m[1], bytes };
}
async function purgeOrphans(env, ssub, keep) {
  try {
    const listed = await env.PHOTO_BUCKET.list({ prefix: `itinerary/${ssub}/` });
    for (const o of (listed.objects || [])) {
      if (!keep || !keep.has(o.key)) await env.PHOTO_BUCKET.delete(o.key).catch(() => {});
    }
  } catch (e) { /* 非致命 */ }
}

// POST /api/itinerary/save  body: { title, trip }
export async function saveItinerary(request, env, user) {
  if (!isPremium(user)) return json({ error: '需要付費版（綁訂單）才能雲端保存' }, 403);
  const ssub = safeSub(user.sub);
  const body = await request.json().catch(() => ({}));
  const trip = body.trip;
  if (!trip || !Array.isArray(trip.days)) return json({ error: '資料格式錯誤' }, 400);
  if (trip.days.length > MAX_DAYS) return json({ error: '天數過多' }, 400);

  const keep = new Set();
  let photoCount = 0;
  for (const d of trip.days) {
    if (!Array.isArray(d.photos)) { d.photos = []; continue; }
    const refs = [];
    for (const p of d.photos) {
      if (++photoCount > MAX_PHOTOS) break;
      if (typeof p !== 'string') continue;
      if (p.startsWith(PHOTO_PREFIX)) {                 // 已是雲端參照 → 保留
        const fname = p.slice(PHOTO_PREFIX.length).split('/').pop();
        keep.add(`itinerary/${ssub}/${fname}`); refs.push(PHOTO_PREFIX + ssub + '/' + fname); continue;
      }
      const parsed = dataUrlToBytes(p);                 // 新 base64 → 上 R2（內容雜湊當鍵 → 去重免重傳）
      if (!parsed) continue;
      if (parsed.bytes.length > MAX_PHOTO_BYTES || parsed.bytes.length < 50) continue;
      const ext = parsed.contentType === 'image/png' ? 'png' : parsed.contentType === 'image/webp' ? 'webp' : 'jpg';
      const fname = (await sha256hex(parsed.bytes)) + '.' + ext;
      const key = `itinerary/${ssub}/${fname}`;
      await env.PHOTO_BUCKET.put(key, parsed.bytes, { httpMetadata: { contentType: parsed.contentType } });
      keep.add(key); refs.push(PHOTO_PREFIX + ssub + '/' + fname);
    }
    d.photos = refs;
  }
  await purgeOrphans(env, ssub, keep);                  // 刪掉沒被引用的舊照片

  const now = Date.now();
  const expiresAt = now + RETAIN_DAYS * DAY;
  const title = String(body.title || trip.title || '雫旅遊記').slice(0, 120);
  const data = JSON.stringify(trip);
  if (data.length > 1000000) return json({ error: '資料過大，請減少站點或字數' }, 413);

  await env.DB.prepare(
    `INSERT INTO itineraries (sub, title, data, updatedAt, expiresAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(sub) DO UPDATE SET
       title=excluded.title, data=excluded.data, updatedAt=excluded.updatedAt, expiresAt=excluded.expiresAt`
  ).bind(user.sub, title, data, now, expiresAt).run();

  return json({ success: true, savedAt: now, expiresAt, retainDays: RETAIN_DAYS });
}

// GET /api/itinerary/load
export async function loadItinerary(request, env, user) {
  if (!isPremium(user)) return json({ error: '需要付費版（綁訂單）才能讀取雲端' }, 403);
  const ssub = safeSub(user.sub);
  const row = await env.DB.prepare(
    `SELECT title, data, updatedAt, expiresAt FROM itineraries WHERE sub = ?`
  ).bind(user.sub).first();
  if (!row) return json({ success: true, found: false });
  if (row.expiresAt < Date.now()) {                     // 過期 → 懶刪
    await env.DB.prepare(`DELETE FROM itineraries WHERE sub = ?`).bind(user.sub).run().catch(() => {});
    await purgeOrphans(env, ssub, null);
    return json({ success: true, found: false });
  }
  let trip;
  try { trip = JSON.parse(row.data); } catch (e) { return json({ success: true, found: false }); }
  return json({ success: true, found: true, title: row.title, trip, updatedAt: row.updatedAt, expiresAt: row.expiresAt });
}

// DELETE /api/itinerary
export async function deleteItinerary(request, env, user) {
  if (!isPremium(user)) return json({ error: '權限不足' }, 403);
  await env.DB.prepare(`DELETE FROM itineraries WHERE sub = ?`).bind(user.sub).run().catch(() => {});
  await purgeOrphans(env, safeSub(user.sub), null);
  return json({ success: true });
}

// GET /api/itinerary/photo/:sub/:fname — 公開串流（檔名是內容雜湊，不可枚舉）
export async function serveItineraryPhoto(env, sub, fname) {
  const key = `itinerary/${safeSub(sub)}/${String(fname).replace(/[^A-Za-z0-9_.-]/g, '')}`;
  const obj = await env.PHOTO_BUCKET.get(key);
  if (!obj) return new Response('not found', { status: 404 });
  const ct = (obj.httpMetadata && obj.httpMetadata.contentType) || 'image/jpeg';
  return new Response(obj.body, {
    headers: { 'Content-Type': ct, 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
}

// cron 每日清過期
export async function sweepExpiredItineraries(env) {
  const now = Date.now();
  const rows = await env.DB.prepare(`SELECT sub FROM itineraries WHERE expiresAt < ?`).bind(now).all();
  for (const r of (rows.results || [])) {
    await env.DB.prepare(`DELETE FROM itineraries WHERE sub = ?`).bind(r.sub).run().catch(() => {});
    await purgeOrphans(env, safeSub(r.sub), null);
  }
  return (rows.results || []).length;
}

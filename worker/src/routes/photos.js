/**
 * drift 客人照片
 *  GET    /api/drift/photos?spotId=X      列出某景點「已審核」照片（公開）
 *  GET    /api/drift/photos/:id/img       串流回 R2 圖片（公開）
 *  POST   /api/drift/photos               上傳（登入者；前端已壓縮，傳 base64 dataURL）
 *  GET    /api/drift/photos/pending       列出待審（雫編 only）
 *  POST   /api/drift/photos/:id/approve   核准（雫編 only）
 *  DELETE /api/drift/photos/:id           刪除（雫編 only；同步刪 R2）
 *
 * 設計：客人上傳 → pending → 雫編審核 approve 才公開顯示。永久保留、雫編手動刪。
 */
import { json } from '../lib/utils.js';
import { rateLimitStrong } from '../lib/rateLimit.js';

function genId() {
  return 'ph_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
}
const ROW = (r) => ({
  id: r.id,
  spotId: r.spotId,
  caption: r.caption || '',
  submittedBy: r.submittedBy || '訪客',
  status: r.status,
  createdAt: r.createdAt || '',
  url: '/api/drift/photos/' + r.id + '/img',
});

// GET /api/drift/photos?spotId=X — 公開：已審核照片
export async function listPhotos(request, env) {
  const spotId = new URL(request.url).searchParams.get('spotId');
  if (!spotId) return json({ error: '缺少 spotId' }, 400);
  const { results = [] } = await env.DB.prepare(
    `SELECT * FROM drift_photos WHERE spotId = ? AND status = 'approved'
     ORDER BY approvedAt DESC, createdAt DESC`
  ).bind(spotId).all();
  return json({ success: true, photos: results.map(ROW) });
}

// GET /api/drift/photos/:id/img — 公開：串流 R2 圖片
export async function servePhoto(env, id) {
  const row = await env.DB.prepare(
    'SELECT r2Key, contentType FROM drift_photos WHERE id = ?'
  ).bind(id).first();
  if (!row) return new Response('not found', { status: 404 });
  const obj = await env.PHOTO_BUCKET.get(row.r2Key);
  if (!obj) return new Response('not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': row.contentType || 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

// POST /api/drift/photos — 登入者上傳（body: { spotId, dataUrl, caption }）
export async function createPhoto(request, env, user) {
  if (!user || !['guest', 'friend', 'owner'].includes(user.role)) {
    return json({ error: '請先登入' }, 403);
  }
  // 上傳頻率限制（audit Phase 2）：CF 原生 binding（10 張/分，跨節點）＋記憶體兜底；
  // 身分鍵優先 token 內 sub/userId
  const who = user.sub || user.userId || request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!(await rateLimitStrong(env.CODE_RL, 'photo:' + who, 10))) {
    return json({ error: '上傳太頻繁，請稍後再試' }, 429);
  }
  const body = await request.json().catch(() => ({}));
  const { spotId, dataUrl } = body;
  if (!spotId || !dataUrl) return json({ error: '缺少 spotId 或圖片' }, 400);

  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return json({ error: '圖片格式不支援（限 jpg/png/webp）' }, 400);
  const contentType = m[1];
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  // 前端應壓到 ~300KB；後端保險擋 3MB
  if (bytes.length > 3 * 1024 * 1024) return json({ error: '圖片過大，請壓縮後再上傳' }, 413);
  if (bytes.length < 100) return json({ error: '圖片資料異常' }, 400);

  const spot = await env.DB.prepare('SELECT id FROM drift_spots WHERE id = ?').bind(spotId).first();
  if (!spot) return json({ error: '找不到此景點' }, 404);

  const id = genId();
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const r2Key = `drift/${spotId}/${id}.${ext}`;
  await env.PHOTO_BUCKET.put(r2Key, bytes, { httpMetadata: { contentType } });

  const now = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  await env.DB.prepare(
    `INSERT INTO drift_photos (id, spotId, r2Key, contentType, status, caption, submittedBy, createdAt)
     VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`
  ).bind(id, spotId, r2Key, contentType, (body.caption || '').slice(0, 200),
         (user.displayName || '訪客').slice(0, 40), now).run();
  return json({ success: true, id, status: 'pending' });
}

// GET /api/drift/photos/pending — 雫編：待審清單
export async function listPendingPhotos(env, user) {
  if (!user || user.role !== 'owner') return json({ error: '權限不足' }, 403);
  const { results = [] } = await env.DB.prepare(
    `SELECT * FROM drift_photos WHERE status = 'pending' ORDER BY createdAt ASC`
  ).all();
  return json({ success: true, photos: results.map(ROW) });
}

// POST /api/drift/photos/:id/approve — 雫編：核准
export async function approvePhoto(env, user, id) {
  if (!user || user.role !== 'owner') return json({ error: '權限不足' }, 403);
  const now = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  await env.DB.prepare(
    `UPDATE drift_photos SET status = 'approved', approvedAt = ? WHERE id = ?`
  ).bind(now, id).run();
  return json({ success: true });
}

// DELETE /api/drift/photos/:id — 雫編：刪除（含 R2）
export async function deletePhoto(env, user, id) {
  if (!user || user.role !== 'owner') return json({ error: '權限不足' }, 403);
  const row = await env.DB.prepare('SELECT r2Key FROM drift_photos WHERE id = ?').bind(id).first();
  if (!row) return json({ error: '找不到此照片' }, 404);
  await env.PHOTO_BUCKET.delete(row.r2Key).catch(() => {});
  await env.DB.prepare('DELETE FROM drift_photos WHERE id = ?').bind(id).run();
  return json({ success: true });
}

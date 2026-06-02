-- drift 客人上傳照片：metadata 存 D1，圖片本體存 R2（PHOTO_BUCKET）
-- 流程：客人前端壓縮後上傳 → status='pending' → 雫編審核 approve → 前台才顯示。
-- 永久保留，雫編手動刪除（刪除時同步刪 R2 物件）。
CREATE TABLE IF NOT EXISTS drift_photos (
  id          TEXT PRIMARY KEY,             -- ph_<base36 time>_<rand>
  spotId      TEXT NOT NULL,                -- 對應 drift_spots.id
  r2Key       TEXT NOT NULL,                -- R2 物件 key（drift/<spotId>/<id>.jpg）
  contentType TEXT DEFAULT 'image/jpeg',
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | approved
  caption     TEXT DEFAULT '',
  submittedBy TEXT DEFAULT 'guest',         -- 上傳者顯示名（訪客）
  createdAt   TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  approvedAt  TEXT
);
CREATE INDEX IF NOT EXISTS idx_drift_photos_spot ON drift_photos(spotId, status);

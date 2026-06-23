-- 付費版雲端遊記保存（綁訂單/代碼，保留 14 天自動刪）
-- sub = premium 身分鍵：'O:'+訂單編號 或 'C:'+代碼（見 auth.js codeLogin）
-- data = 行程 JSON（照片以 R2 參照路徑存，非 base64）
CREATE TABLE IF NOT EXISTS itineraries (
  sub        TEXT PRIMARY KEY,
  title      TEXT,
  data       TEXT NOT NULL,
  updatedAt  INTEGER NOT NULL,
  expiresAt  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_itineraries_expires ON itineraries(expiresAt);

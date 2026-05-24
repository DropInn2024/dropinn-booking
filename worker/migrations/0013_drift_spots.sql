-- drift_spots：把原本寫死在 drift/app.js 的 SPOTS 陣列搬進 D1
-- 之後雫編（owner）可以透過後台 CRUD，朋友（friend）也能新增（需審核）
--
-- 欄位對應 app.js 既有 spot 物件：
--   id, type, cat, name, area, rating, price, note, feature, tags,
--   nearby, lat, lng, status, noLoc
-- 額外加：
--   displayOrder  — 雫編可置頂排序（NULL 表預設依 id ASC）
--   createdBy     — userId（'owner' 或 friend 的 userId）
--   createdAt / updatedAt — ISO timestamp

CREATE TABLE IF NOT EXISTS drift_spots (
  id            TEXT PRIMARY KEY,
  type          TEXT NOT NULL,         -- 'food' | 'attraction'
  cat           TEXT,                  -- 早餐/小吃/海鮮餐廳/宵夜/咖啡甜點/景點
  name          TEXT NOT NULL,
  area          TEXT,                  -- 馬公/湖西/白沙/西嶼/七美/待確認
  rating        INTEGER DEFAULT 0,     -- 0-3 內部推薦等級
  price         TEXT,                  -- $/$$/$$$/$$$$/?
  note          TEXT,                  -- 短簡介
  feature       TEXT,                  -- 招牌推薦（頓號分隔）
  tags          TEXT,                  -- JSON array string: ["#早餐","#銅板"]
  nearby        INTEGER DEFAULT 0,     -- 0/1 是否民宿附近
  lat           REAL,
  lng           REAL,
  status        TEXT DEFAULT 'open',   -- open/irregular/tbd
  noLoc         INTEGER DEFAULT 0,     -- 0/1 是否無精確座標
  displayOrder  INTEGER,               -- 置頂排序，NULL 表預設
  createdBy     TEXT DEFAULT 'owner',
  createdAt     TEXT,
  updatedAt     TEXT
);

CREATE INDEX IF NOT EXISTS idx_drift_spots_type   ON drift_spots(type);
CREATE INDEX IF NOT EXISTS idx_drift_spots_area   ON drift_spots(area);
CREATE INDEX IF NOT EXISTS idx_drift_spots_cat    ON drift_spots(cat);
CREATE INDEX IF NOT EXISTS idx_drift_spots_status ON drift_spots(status);

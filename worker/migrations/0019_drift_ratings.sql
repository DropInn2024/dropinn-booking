-- drift 旅人評分：跨客人的真實星等彙總（取代原本只存單機 localStorage 的假平均）
-- 一台裝置（voterId）對一個景點只算一票；重評覆蓋、評 0 取消。
-- 雫編/朋友不在這裡給星（雫編的「私藏/精選」是 spot.rating 的策展徽章，與此分開）。
CREATE TABLE IF NOT EXISTS drift_ratings (
  spotId    TEXT NOT NULL,
  voterId   TEXT NOT NULL,          -- 裝置匿名 ID（localStorage 產生）
  stars     INTEGER NOT NULL,       -- 1..5
  updatedAt TEXT NOT NULL DEFAULT (datetime('now','+8 hours')),
  PRIMARY KEY (spotId, voterId)
);
CREATE INDEX IF NOT EXISTS idx_drift_ratings_spot ON drift_ratings(spotId);

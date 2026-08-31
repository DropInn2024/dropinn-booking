-- 防重複列（2026-08-31）
-- 起因：房務端連點兩下，兩個請求相隔 18 毫秒同時進來，
-- 都在對方寫入前查到「沒有既有資料」，各插一筆 →
-- 王于瑄房務費被算兩次，8 月多付 2,400。
-- 「先查再寫」在資料庫層沒有保護，改用唯一索引 + UPSERT。
CREATE UNIQUE INDEX IF NOT EXISTS idx_hk_costs_orderID_uniq
  ON housekeeping_costs(orderID);

-- 同一種寫法也出現在評論（同一人對同一景點只該有一則），一併補上。
CREATE UNIQUE INDEX IF NOT EXISTS idx_drift_reviews_spot_user_uniq
  ON drift_reviews(spotId, userId);

-- 訂單成本：一張訂單一列（寫入端用 batch(DELETE+INSERT) 已是原子性，
-- 這條索引是第二道保險，避免日後有人改成非原子寫法又踩同一個坑）。
CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_rows_orderID_uniq
  ON cost_rows(orderID);

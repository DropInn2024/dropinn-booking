-- drift_reviews 加上 pinnedOrder 欄位：
--   NULL = 未置頂（依 createdAt DESC 排）
--   非 NULL = 置頂，依該數字升序排（小的先）
-- 雫編可在 /notforyou/home 漂流 tab → 編輯景點 → 評論區塊操作

ALTER TABLE drift_reviews ADD COLUMN pinnedOrder INTEGER;

-- 加 index 加速 sort
CREATE INDEX IF NOT EXISTS idx_drift_reviews_pinned ON drift_reviews(pinnedOrder);

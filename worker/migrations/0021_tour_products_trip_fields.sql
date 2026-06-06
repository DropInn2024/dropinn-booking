-- ============================================================
-- tour_products 擴充：容納「行程」（人頭計價）+ 介紹
-- ------------------------------------------------------------
-- 租車用 price_day/half/hour（不動）；行程用 price/cost adult/child/infant。
-- 其餘（客報原價、時長、集合、取消規定、tags…）放 meta JSON。
-- 本檔只加欄位，無任何成本數字 → 可安全進 repo。
-- ============================================================

ALTER TABLE tour_products ADD COLUMN kind TEXT DEFAULT 'rental';  -- rental（租車）/ tour（行程）
ALTER TABLE tour_products ADD COLUMN description TEXT DEFAULT '';

-- 行程賣價（inn，給客人）
ALTER TABLE tour_products ADD COLUMN price_adult  INTEGER DEFAULT 0;
ALTER TABLE tour_products ADD COLUMN price_child  INTEGER DEFAULT 0;
ALTER TABLE tour_products ADD COLUMN price_infant INTEGER DEFAULT 0;

-- 行程成本（同業價）
ALTER TABLE tour_products ADD COLUMN cost_adult   INTEGER DEFAULT 0;
ALTER TABLE tour_products ADD COLUMN cost_child   INTEGER DEFAULT 0;
ALTER TABLE tour_products ADD COLUMN cost_infant  INTEGER DEFAULT 0;

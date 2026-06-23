-- ============================================================
-- 行程 / 租車 獨立訂單系統（階段 1：租車）
-- ------------------------------------------------------------
-- 設計原則：
--   * 商品成本 (cost_*) 只存 D1 後端，公開頁 API 絕不回傳。
--   * 訂單可選關聯住客訂單 (bookingOrderID)，連動取消 / 完成。
--   * vendor 對齊採購人（萬鈞 / 澎湖之美…），月結按 vendor 分。
--   * 本檔只放「表結構」，無任何成本數字 → 可安全進 repo。
--     成本資料用 gitignore 的 seed（worker/seed/*.local.sql）以 wrangler 灌入。
-- ============================================================

-- ── 商品（車種 ＋ 行程）─────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_products (
  id          TEXT PRIMARY KEY,        -- 'car-wish' / 'scooter' / 'tour-xxx'
  category    TEXT NOT NULL,           -- '汽車' / '機車' / '東海' / '南海'…
  vendor      TEXT NOT NULL,           -- 供應商（萬鈞 / 澎湖之美…）← 對齊採購人
  name        TEXT NOT NULL,
  seats       INTEGER,                 -- 車種座數（行程為 NULL）
  unit        TEXT DEFAULT 'day',      -- 計價單位：day（租車）/ person（行程）
  -- 對客牌價（公開）
  price_day   INTEGER DEFAULT 0,
  price_half  INTEGER DEFAULT 0,
  price_hour  INTEGER DEFAULT 0,
  -- 成本 / 同業價（機密，只後端 / owner）
  cost_day    INTEGER DEFAULT 0,
  cost_half   INTEGER DEFAULT 0,
  cost_hour   INTEGER DEFAULT 0,
  active      INTEGER DEFAULT 1,
  meta        TEXT DEFAULT '',         -- JSON：年份 / 車款清單 / 行程細節…
  sortOrder   INTEGER DEFAULT 0,
  updatedAt   TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- ── 訂單 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tour_orders (
  id              TEXT PRIMARY KEY,        -- 'TR-20260608-xxxx'
  kind            TEXT NOT NULL DEFAULT 'rental',  -- 'rental' / 'tour'
  bookingOrderID  TEXT,                    -- 選填，關聯住客訂單；NULL = 獨立（路人）
  productId       TEXT,                    -- 關聯 tour_products
  vendor          TEXT NOT NULL,           -- 採購對象（月結用）
  contactName     TEXT DEFAULT '',
  contactPhone    TEXT DEFAULT '',
  detail          TEXT DEFAULT '',         -- JSON：車種 / 租期段 / 航班 / 試算明細
  sellAmount      INTEGER DEFAULT 0,       -- 賣價（給客人，牌價）
  costAmount      INTEGER DEFAULT 0,       -- 成本（付供應商，下單時 snapshot 固定）
  status          TEXT DEFAULT '待確認',    -- 待確認 | 訂單成立 | 已取消 | 已完成
  cancelReason    TEXT DEFAULT '',
  createdAt       TEXT DEFAULT (datetime('now', '+8 hours')),
  updatedAt       TEXT DEFAULT (datetime('now', '+8 hours')),
  updatedBy       TEXT DEFAULT '',
  -- 住客訂單刪除時，租車訂單保留變獨立（不連帶刪，避免誤刪收費紀錄）
  FOREIGN KEY (bookingOrderID) REFERENCES orders(orderID) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tour_orders_booking ON tour_orders(bookingOrderID);
CREATE INDEX IF NOT EXISTS idx_tour_orders_vendor_status ON tour_orders(vendor, status);
CREATE INDEX IF NOT EXISTS idx_tour_orders_created ON tour_orders(createdAt);

-- ── 供應商月結（鏡像 addon_settlements，但按 vendor 分）──
-- 首頁「待結清款項」可同時追蹤：房務 + 旅行社 + 萬鈞租車…
CREATE TABLE IF NOT EXISTS tour_settlements (
  monthKey    TEXT NOT NULL,           -- YYYY-MM
  vendor      TEXT NOT NULL,           -- 供應商
  totalCost   INTEGER DEFAULT 0,       -- 當月付該供應商總成本（snapshot）
  settledAt   TEXT,                    -- 已付時間 ISO；NULL = 未付
  settledBy   TEXT DEFAULT 'admin',
  PRIMARY KEY (monthKey, vendor)
);

-- ============================================================
-- 0006: 對齊 Google Sheets 既有資料結構
-- ============================================================

-- ── 移除誤建的 bookings 表 ────────────────────────────────────
-- 真正的訂單表是 orders（在 0001_init.sql 建立），bookings 是 0005 誤建。
-- 確認沒有資料後直接 drop。
DROP TABLE IF EXISTS bookings;
DROP INDEX IF EXISTS idx_bookings_checkIn;
DROP INDEX IF EXISTS idx_bookings_status;

-- ── agency_accounts 補欄位 ───────────────────────────────────
-- Sheets 還有：isActive、adminNote、approvalStatus、visiblePartners
ALTER TABLE agency_accounts ADD COLUMN isActive         INTEGER DEFAULT 1;
ALTER TABLE agency_accounts ADD COLUMN adminNote        TEXT    DEFAULT '';
ALTER TABLE agency_accounts ADD COLUMN approvalStatus   TEXT    DEFAULT 'approved';
ALTER TABLE agency_accounts ADD COLUMN visiblePartners  TEXT    DEFAULT '[]';

-- ── 系統計數器（訂單流水號）──────────────────────────────────
CREATE TABLE IF NOT EXISTS system_counters (
  datePrefix    TEXT PRIMARY KEY,    -- YYYYMMDD（不含分隔線）
  currentCount  INTEGER DEFAULT 0
);

-- ── 同業月度結算（新功能：每月給旅行社的結帳）────────────────
CREATE TABLE IF NOT EXISTS agency_settlements (
  settlementId    TEXT PRIMARY KEY,           -- SET-YYYYMM-AGYxxx
  yearMonth       TEXT NOT NULL,              -- YYYY-MM
  agencyId        TEXT NOT NULL,
  agencyName      TEXT DEFAULT '',
  totalAmount     INTEGER DEFAULT 0,
  status          TEXT DEFAULT '待付',         -- 待付 | 已付
  paidAt          TEXT DEFAULT '',
  relatedOrders   TEXT DEFAULT '[]',          -- JSON array of orderID
  note            TEXT DEFAULT '',
  createdAt       TEXT DEFAULT (datetime('now', '+8 hours')),
  updatedAt       TEXT DEFAULT (datetime('now', '+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_agency_settlements_yearMonth ON agency_settlements(yearMonth);
CREATE INDEX IF NOT EXISTS idx_agency_settlements_agencyId  ON agency_settlements(agencyId);

-- ── 旅遊景點（Drift 用）──────────────────────────────────────
CREATE TABLE IF NOT EXISTS spots (
  id          TEXT PRIMARY KEY,           -- f01 / a01...
  type        TEXT NOT NULL,              -- food | attraction
  cat         TEXT DEFAULT '',
  route       TEXT DEFAULT '',
  name        TEXT NOT NULL,
  area        TEXT DEFAULT '',
  rating      INTEGER DEFAULT 0,
  price       TEXT DEFAULT '',
  note        TEXT DEFAULT '',
  feature     TEXT DEFAULT '',
  tags        TEXT DEFAULT '',
  lat         REAL DEFAULT 0,
  lng         REAL DEFAULT 0,
  nearby      INTEGER DEFAULT 0,          -- 1=民宿附近
  status      TEXT DEFAULT 'open',
  noLoc       INTEGER DEFAULT 0,
  sortOrder   INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_spots_type ON spots(type);
CREATE INDEX IF NOT EXISTS idx_spots_area ON spots(area);

-- ── 推薦記錄 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS referral_records (
  recordID      TEXT PRIMARY KEY,
  date          TEXT DEFAULT '',
  agencyName    TEXT DEFAULT '',
  rebateAmount  INTEGER DEFAULT 0,
  notes         TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_referral_records_date ON referral_records(date);

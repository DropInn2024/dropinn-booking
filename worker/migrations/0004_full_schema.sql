-- ============================================================
-- 補齊所有缺少的表
-- ============================================================

-- ── 修正 coupons 表欄位名稱（對齊 GAS dataStore.js 實際欄位）──
-- 現有欄位名稱跟 GAS 不一致，重建

DROP TABLE IF EXISTS coupons;

CREATE TABLE IF NOT EXISTS coupons (
  code        TEXT PRIMARY KEY,
  type        TEXT NOT NULL DEFAULT 'fixed',  -- fixed | percent | per_night_fixed
  value       REAL DEFAULT 0,
  description TEXT DEFAULT '',
  useLimit    INTEGER DEFAULT 0,              -- 0 = 不限次數
  usedCount   INTEGER DEFAULT 0,
  validFrom   TEXT DEFAULT '',               -- YYYY-MM-DD
  validTo     TEXT DEFAULT '',               -- YYYY-MM-DD
  active      INTEGER DEFAULT 1
);

-- ── 同業帳號 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_accounts (
  agencyId      TEXT PRIMARY KEY,
  loginId       TEXT NOT NULL UNIQUE,
  passwordHash  TEXT NOT NULL,
  displayName   TEXT DEFAULT '',
  createdAt     TEXT DEFAULT (datetime('now', '+8 hours')),
  updatedAt     TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- ── 同業棟別 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_properties (
  propertyId    TEXT PRIMARY KEY,
  agencyId      TEXT NOT NULL,
  propertyName  TEXT NOT NULL,
  sortOrder     INTEGER DEFAULT 1,
  isActive      INTEGER DEFAULT 1,
  colorKey      TEXT DEFAULT 'A',
  FOREIGN KEY (agencyId) REFERENCES agency_accounts(agencyId) ON DELETE CASCADE
);

-- ── 同業封鎖日期 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_blocks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  propertyId  TEXT NOT NULL,
  date        TEXT NOT NULL,             -- YYYY-MM-DD
  createdAt   TEXT DEFAULT (datetime('now', '+8 hours')),
  updatedAt   TEXT DEFAULT (datetime('now', '+8 hours')),
  source      TEXT DEFAULT 'agency',
  UNIQUE(propertyId, date)
);

-- ── 同業群組 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_groups (
  groupId    TEXT PRIMARY KEY,
  groupName  TEXT NOT NULL,
  members    TEXT DEFAULT '[]',          -- JSON array of agencyId
  createdAt  TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- ── 索引 ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agency_properties_agencyId ON agency_properties(agencyId);
CREATE INDEX IF NOT EXISTS idx_agency_blocks_propertyId   ON agency_blocks(propertyId);
CREATE INDEX IF NOT EXISTS idx_agency_blocks_date         ON agency_blocks(date);

-- Migration 0007: 確保所有必要表格存在（冪等，IF NOT EXISTS）
--
-- 原本還有一批 ALTER TABLE ADD COLUMN 當「0004/0006 沒套到」的保險絲，
-- 已移除：那些欄位 0001（orders）與 0006（agency_accounts）都加過了，
-- 而 migration 順序由 d1_migrations 保證，保險絲永遠用不到。留著的唯一
-- 效果是從零重放時整個檔案炸在 duplicate column，schema 建不回來。

-- ── agency_properties（同業物件/房源）──────────────────────────
CREATE TABLE IF NOT EXISTS agency_properties (
  propertyId   TEXT PRIMARY KEY,
  agencyId     TEXT NOT NULL,
  propertyName TEXT NOT NULL DEFAULT '',
  sortOrder    INTEGER DEFAULT 0,
  createdAt    TEXT DEFAULT (datetime('now', '+8 hours')),
  updatedAt    TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- ── agency_blocks（同業封鎖日期）───────────────────────────────
CREATE TABLE IF NOT EXISTS agency_blocks (
  propertyId TEXT NOT NULL,
  date       TEXT NOT NULL,
  PRIMARY KEY (propertyId, date)
);

-- ── agency_groups（同業群組）───────────────────────────────────
CREATE TABLE IF NOT EXISTS agency_groups (
  groupId    TEXT PRIMARY KEY,
  groupName  TEXT NOT NULL DEFAULT '',
  createdAt  TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- ── agency_group_members（同業群組成員）────────────────────────
CREATE TABLE IF NOT EXISTS agency_group_members (
  groupId   TEXT NOT NULL,
  agencyId  TEXT NOT NULL,
  PRIMARY KEY (groupId, agencyId)
);

-- ── monthly_expenses（月固定支出）──────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_expenses (
  yearMonth      TEXT PRIMARY KEY,
  laundry        INTEGER DEFAULT 0,
  water          INTEGER DEFAULT 0,
  electricity    INTEGER DEFAULT 0,
  internet       INTEGER DEFAULT 0,
  platformFee    INTEGER DEFAULT 0,
  landTax        INTEGER DEFAULT 0,
  insurance      INTEGER DEFAULT 0,
  other          INTEGER DEFAULT 0,
  carRentalRebate INTEGER DEFAULT 0,
  note           TEXT DEFAULT ''
);

-- ── cost_rows（訂單成本明細）───────────────────────────────────
CREATE TABLE IF NOT EXISTS cost_rows (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  orderID             TEXT NOT NULL REFERENCES orders(orderID),
  name                TEXT DEFAULT '',
  checkIn             TEXT DEFAULT '',
  rebateAmount        INTEGER DEFAULT 0,
  complimentaryAmount INTEGER DEFAULT 0,
  otherCost           INTEGER DEFAULT 0,
  addonCost           INTEGER DEFAULT 0,
  note                TEXT DEFAULT ''
);

-- ── system_counters（訂單流水號）───────────────────────────────
CREATE TABLE IF NOT EXISTS system_counters (
  datePrefix   TEXT PRIMARY KEY,
  currentCount INTEGER DEFAULT 0
);

-- ── agency_accounts 補欄位（若已存在但缺欄位）──────────────────
-- SQLite 不支援 IF NOT EXISTS on ALTER TABLE，用 IGNORE 方式
-- 若欄位已存在，以下語句會拋錯但不影響整體執行
PRAGMA ignore_check_constraints = ON;

-- ── orders 補欄位（若已存在但缺欄位）──────────────────────────

-- ── 索引 ────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_agency_properties_agencyId ON agency_properties(agencyId);
CREATE INDEX IF NOT EXISTS idx_agency_blocks_propertyId   ON agency_blocks(propertyId);
CREATE INDEX IF NOT EXISTS idx_agency_blocks_date         ON agency_blocks(date);
CREATE INDEX IF NOT EXISTS idx_cost_rows_orderID          ON cost_rows(orderID);

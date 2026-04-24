-- ============================================================
-- Drop Inn 資料庫 Schema
-- 對應 schemaManager.js getSchema()
-- ============================================================

-- ── 訂單主表 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  -- 基本資訊
  orderID               TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  phone                 TEXT NOT NULL,
  email                 TEXT DEFAULT '',

  -- 住宿資訊
  checkIn               TEXT NOT NULL,   -- YYYY-MM-DD
  checkOut              TEXT NOT NULL,   -- YYYY-MM-DD
  rooms                 INTEGER NOT NULL,
  extraBeds             INTEGER DEFAULT 0,

  -- 金額
  originalTotal         INTEGER DEFAULT 0,
  totalPrice            INTEGER DEFAULT 0,
  paidDeposit           INTEGER DEFAULT 0,
  remainingBalance      INTEGER DEFAULT 0,
  discountCode          TEXT DEFAULT '',
  discountType          TEXT DEFAULT '',  -- fixed | percent | free_nights | free_all
  discountValue         TEXT DEFAULT '',
  discountAmount        INTEGER DEFAULT 0,
  isReturningGuest      INTEGER DEFAULT 0,  -- 0=否 1=是
  complimentaryNote     TEXT DEFAULT '',
  sourceType            TEXT DEFAULT '自家',
  agencyName            TEXT DEFAULT '',
  addonAmount           INTEGER DEFAULT 0,
  extraIncome           INTEGER DEFAULT 0,

  -- 備註
  notes                 TEXT DEFAULT '',
  internalNotes         TEXT DEFAULT '',
  housekeepingNote      TEXT DEFAULT '',
  hasCarRental          INTEGER DEFAULT 0,  -- 0=否 1=是

  -- 狀態
  status                TEXT DEFAULT '洽談中',  -- 洽談中|已付訂|取消|完成
  cancelReason          TEXT DEFAULT '',

  -- Email
  emailSent             INTEGER DEFAULT 0,
  reminderSent          INTEGER DEFAULT 0,
  travelGuideSent       INTEGER DEFAULT 0,
  travelGuideSentAt     TEXT DEFAULT '',

  -- 日曆
  publicCalendarEventID         TEXT DEFAULT '',
  housekeepingCalendarEventID   TEXT DEFAULT '',
  lastCalendarSync              TEXT DEFAULT '',
  calendarSyncStatus            TEXT DEFAULT '',
  calendarSyncNote              TEXT DEFAULT '',

  -- 同意條款
  agreementSignedName   TEXT DEFAULT '',
  agreementSignedAt     TEXT DEFAULT '',

  -- 系統欄位
  lastUpdated           TEXT DEFAULT '',
  updatedBy             TEXT DEFAULT '',
  timestamp             TEXT DEFAULT (datetime('now', '+8 hours'))
);

-- ── 訂單成本表（退佣、招待費等）────────────────────────────
CREATE TABLE IF NOT EXISTS cost_rows (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  orderID               TEXT NOT NULL,
  name                  TEXT DEFAULT '',
  checkIn               TEXT DEFAULT '',
  rebateAmount          INTEGER DEFAULT 0,
  complimentaryAmount   INTEGER DEFAULT 0,
  otherCost             INTEGER DEFAULT 0,
  addonCost             INTEGER DEFAULT 0,
  note                  TEXT DEFAULT '',
  FOREIGN KEY (orderID) REFERENCES orders(orderID) ON DELETE CASCADE
);

-- ── 月固定支出表 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS monthly_expenses (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  yearMonth         TEXT NOT NULL UNIQUE,  -- YYYY-MM
  laundry           INTEGER DEFAULT 0,
  water             INTEGER DEFAULT 0,
  electricity       INTEGER DEFAULT 0,
  internet          INTEGER DEFAULT 0,
  platformFee       INTEGER DEFAULT 0,
  landTax           INTEGER DEFAULT 0,
  insurance         INTEGER DEFAULT 0,
  other             INTEGER DEFAULT 0,
  carRentalRebate   INTEGER DEFAULT 0,
  note              TEXT DEFAULT ''
);

-- ── 優惠碼表 ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  code              TEXT PRIMARY KEY,
  type              TEXT NOT NULL,   -- fixed | percent | free_nights | free_all
  value             REAL DEFAULT 0,
  minNights         INTEGER DEFAULT 0,
  validFrom         TEXT DEFAULT '',
  validUntil        TEXT DEFAULT '',
  usageLimit        INTEGER DEFAULT 0,  -- 0 = 無限制
  usageCount        INTEGER DEFAULT 0,
  active            INTEGER DEFAULT 1,
  note              TEXT DEFAULT ''
);

-- ── Drift 好友表 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drift_users (
  userId            TEXT PRIMARY KEY,
  displayName       TEXT NOT NULL,
  persona           TEXT DEFAULT '',
  createdAt         TEXT DEFAULT (datetime('now', '+8 hours')),
  lastLogin         TEXT DEFAULT ''
);

-- ── Drift 評論表 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drift_reviews (
  reviewId          TEXT PRIMARY KEY,
  spotId            TEXT NOT NULL,
  userId            TEXT NOT NULL,
  author            TEXT NOT NULL,
  persona           TEXT DEFAULT '',
  note              TEXT NOT NULL,
  rating            INTEGER DEFAULT 0,
  createdAt         TEXT DEFAULT (datetime('now', '+8 hours')),
  FOREIGN KEY (userId) REFERENCES drift_users(userId) ON DELETE CASCADE
);

-- ── 常用查詢索引 ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_checkIn    ON orders(checkIn);
CREATE INDEX IF NOT EXISTS idx_orders_checkOut   ON orders(checkOut);
CREATE INDEX IF NOT EXISTS idx_orders_status     ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_timestamp  ON orders(timestamp);
CREATE INDEX IF NOT EXISTS idx_orders_phone      ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_cost_rows_orderID ON cost_rows(orderID);
CREATE INDEX IF NOT EXISTS idx_drift_reviews_spotId ON drift_reviews(spotId);

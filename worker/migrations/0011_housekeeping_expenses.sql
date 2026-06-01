-- Migration 0011: 清潔費模組 + 固定費用預載入
-- housekeeping_costs      每筆訂單清潔費（房務 key）
-- housekeeping_extras     其他項目（房務或後台自由輸入，monthKey 為單位）
-- housekeeping_settlements 月結紀錄（monthKey 為單位）
-- expense_templates       固定費用模板（設定一次，每月自動帶入）
-- expense_monthly         每月費用（從模板建立或手動新增，monthKey 為單位）
--
-- 註：月份欄位一律用 monthKey（與 prod 一致）。固定欄位式的 monthly_expenses
--     （yearMonth + laundry/water/... 等欄位）是另一張表，定義在 0001_init.sql。

CREATE TABLE IF NOT EXISTS housekeeping_costs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  orderID     TEXT    NOT NULL,
  amount      INTEGER,                      -- NULL = 尚未填寫
  note        TEXT    DEFAULT '',
  submittedAt TEXT,                         -- 首次送出時間
  updatedAt   TEXT,
  submittedBy TEXT    DEFAULT 'rtb'         -- 來源：rtb = 房務端，admin = 後台
);

CREATE TABLE IF NOT EXISTS housekeeping_extras (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  monthKey    TEXT    NOT NULL,             -- YYYY-MM
  description TEXT    NOT NULL,
  amount      INTEGER NOT NULL DEFAULT 0,
  source      TEXT    DEFAULT 'rtb',        -- rtb | admin
  createdAt   TEXT    DEFAULT (datetime('now', '+8 hours')),
  updatedAt   TEXT
);

CREATE TABLE IF NOT EXISTS housekeeping_settlements (
  monthKey    TEXT    PRIMARY KEY,          -- YYYY-MM
  totalAmount INTEGER,
  settledAt   TEXT,
  settledBy   TEXT    DEFAULT 'admin',
  received    INTEGER DEFAULT 0,            -- 1 = 已付給房務／已收到錢
  receivedAt  TEXT                          -- 標記已收款的時間
);

CREATE TABLE IF NOT EXISTS expense_templates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,             -- 電信費、平台費…
  amount      INTEGER NOT NULL DEFAULT 0,
  isActive    INTEGER DEFAULT 1,
  sortOrder   INTEGER DEFAULT 0,
  createdAt   TEXT    DEFAULT (datetime('now', '+8 hours'))
);

CREATE TABLE IF NOT EXISTS expense_monthly (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  monthKey     TEXT    NOT NULL,            -- YYYY-MM
  name         TEXT    NOT NULL,
  amount       INTEGER NOT NULL DEFAULT 0,
  templateId   INTEGER,                     -- NULL = 手動新增，非 NULL = 從模板建立
  isAuto       INTEGER DEFAULT 0,           -- 1 = 自動從模板帶入
  note         TEXT    DEFAULT '',
  createdAt    TEXT    DEFAULT (datetime('now', '+8 hours')),
  updatedAt    TEXT
);

-- index 加速月份查詢
CREATE INDEX IF NOT EXISTS idx_hk_costs_orderID ON housekeeping_costs(orderID);
CREATE INDEX IF NOT EXISTS idx_hk_extras_month  ON housekeeping_extras(monthKey);
CREATE INDEX IF NOT EXISTS idx_expense_monthly  ON expense_monthly(monthKey);

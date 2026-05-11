-- Migration 0008: 確保 agency_accounts 所有欄位存在 + 首次登入強制換密碼
-- ADD COLUMN IF NOT EXISTS 需 SQLite 3.37+ / libSQL（D1 已支援）

ALTER TABLE agency_accounts ADD COLUMN IF NOT EXISTS isActive          INTEGER DEFAULT 1;
ALTER TABLE agency_accounts ADD COLUMN IF NOT EXISTS adminNote         TEXT    DEFAULT '';
ALTER TABLE agency_accounts ADD COLUMN IF NOT EXISTS approvalStatus    TEXT    DEFAULT 'approved';
ALTER TABLE agency_accounts ADD COLUMN IF NOT EXISTS visiblePartners   TEXT    DEFAULT '[]';
ALTER TABLE agency_accounts ADD COLUMN IF NOT EXISTS mustChangePassword INTEGER DEFAULT 0;

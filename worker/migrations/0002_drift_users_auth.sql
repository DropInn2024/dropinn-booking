-- drift_users 補上登入用欄位
-- （0001 建表時只有 userId / displayName / persona，這次補齊）
ALTER TABLE drift_users ADD COLUMN loginId      TEXT DEFAULT '';
ALTER TABLE drift_users ADD COLUMN passwordHash TEXT DEFAULT '';

-- loginId 要唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_drift_users_loginId ON drift_users(loginId);

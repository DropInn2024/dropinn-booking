-- Migration 0012: Drift 好友帳號審核機制
-- 新增 approvalStatus 欄位，預設 pending（申請後需 admin 審核）

ALTER TABLE drift_users ADD COLUMN approvalStatus TEXT DEFAULT 'pending';

-- 已存在的舊帳號（若有）視為已核准
UPDATE drift_users SET approvalStatus = 'approved' WHERE approvalStatus = '' OR approvalStatus IS NULL;

CREATE INDEX IF NOT EXISTS idx_drift_users_approval ON drift_users(approvalStatus);

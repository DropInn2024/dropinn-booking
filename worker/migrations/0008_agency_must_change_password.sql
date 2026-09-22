-- Migration 0008: 同業帳號首次登入強制換密碼
--
-- 原本五句都寫成 ALTER TABLE ... ADD COLUMN IF NOT EXISTS，並註明
-- 「D1 已支援」—— 實際上 SQLite 沒有這個語法，五句全是語法錯誤，
-- 一句都沒執行過。isActive / adminNote / approvalStatus /
-- visiblePartners 這四個 0006 已經加過，這裡只需要補真正新增的欄位。

ALTER TABLE agency_accounts ADD COLUMN mustChangePassword INTEGER DEFAULT 0;

-- site_config：通用系統設定 key-value 表
-- 用途：儲存管理員密碼 override、未來其他系統設定
CREATE TABLE IF NOT EXISTS site_config (
  key       TEXT PRIMARY KEY,
  value     TEXT NOT NULL,
  updatedAt TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);

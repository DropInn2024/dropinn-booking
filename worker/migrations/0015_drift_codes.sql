-- drift_codes：島嶼漂流「進場代碼」表（取代過去單一的 DRIFT_ACCESS_CODE secret）
-- 兩種來源：
--   1) 固定碼  —— 你私下給熟識的人/好友體驗。label 標示給誰，validUntil = NULL（永久），orderID = NULL
--   2) 隨機專屬碼 —— 綁某張訂單，入住前 3 天 email 自動寄出，validFrom/validUntil = 入住前3天～退房（到期自動失效）
-- tier：'free'（基本）| 'premium'（進階解鎖）。驗證時放進 token，供前端/後端決定可用功能。
CREATE TABLE IF NOT EXISTS drift_codes (
  code       TEXT PRIMARY KEY,              -- 代碼本身（比對時用 COLLATE NOCASE）
  tier       TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'premium'
  label      TEXT,                          -- 備註：給誰 / 用途
  orderID    TEXT,                          -- 綁訂單（隨機碼用）；固定碼為 NULL
  validFrom  TEXT,                          -- 生效日 YYYY-MM-DD；NULL = 無下限
  validUntil TEXT,                          -- 失效日 YYYY-MM-DD（含當日）；NULL = 永久有效
  active     INTEGER NOT NULL DEFAULT 1,    -- 1 啟用 / 0 停用（可個別撤銷某組碼）
  usedCount  INTEGER NOT NULL DEFAULT 0,    -- 進場次數統計
  createdAt  TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_drift_codes_order ON drift_codes(orderID);

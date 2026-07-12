-- 登入嘗試計數（速率限制持久層）
-- 只用於低頻高價值端點（owner/rtb 登入、drift 代碼登入）。
-- 背景：CF ratelimit binding 計數器是每台邊緣伺服器各自記憶（實測 2026-07-12，
-- 同節點 9 連打分散到不同機器全數放行）；登入類需要全域精準 → D1。
-- 寫入有界：每 key 每視窗最多 limit+1 次寫，達上限只讀不寫。
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  windowStart INTEGER NOT NULL
);

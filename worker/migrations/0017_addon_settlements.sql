-- 代辦行程（旅行社）月結：標記某月「已付旅行社」
-- 鏡像 housekeeping_settlements 的設計：以月份為主鍵，記錄已付時間與當下總額。
-- 用途：首頁「待結清款項」提醒要同時追蹤 房務（清潔阿姨）＋ 行程（旅行社）。
CREATE TABLE IF NOT EXISTS addon_settlements (
  monthKey    TEXT PRIMARY KEY,            -- YYYY-MM
  totalAmount INTEGER,                     -- 標記當下的 addonCost 總額（付給旅行社）
  settledAt   TEXT,                        -- 已付時間 ISO；NULL/不存在 = 未付
  settledBy   TEXT DEFAULT 'admin'
);

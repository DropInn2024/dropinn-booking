-- 供應商聯絡方式（2026-08）
-- 車行抵達前一天會打給客人安排接送，但客人不知道那是誰的號碼常常不接。
-- 把電話存起來，寫進客人的確認信，並提醒留意陌生來電。
-- 行程／船票的旅行社同理。
CREATE TABLE IF NOT EXISTS vendor_contacts (
  vendor    TEXT PRIMARY KEY,        -- 對齊 tour_products.vendor / tour_orders.vendor
  phone     TEXT DEFAULT '',
  note      TEXT DEFAULT '',         -- 例如「接送請找小陳」
  updatedAt TEXT DEFAULT (datetime('now', '+8 hours'))
);

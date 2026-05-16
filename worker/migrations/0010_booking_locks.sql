-- 每一個被訂走的夜晚對應一筆 lock，PRIMARY KEY 保證同一天不能重複
-- createBooking 用 batch INSERT OR FAIL 來達到原子性保護
CREATE TABLE IF NOT EXISTS booking_locks (
  date      TEXT PRIMARY KEY,
  orderID   TEXT NOT NULL,
  createdAt TEXT DEFAULT (datetime('now', '+8 hours'))
);

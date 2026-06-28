-- 其他收支：不綁訂單的獨立分錄（年底雜項支出、賠償/雜項收入…）
-- 報表依 date 月份計入收入/支出與淨利。
CREATE TABLE IF NOT EXISTS misc_ledger (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  date      TEXT NOT NULL,                 -- YYYY-MM-DD
  type      TEXT NOT NULL,                 -- 'income' | 'expense'
  amount    INTEGER NOT NULL DEFAULT 0,
  note      TEXT DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (datetime('now','+8 hours'))
);
CREATE INDEX IF NOT EXISTS idx_misc_ledger_date ON misc_ledger(date);

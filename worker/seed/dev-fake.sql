-- ════════════════════════════════════════════════════════════════
-- 本機開發用的假資料
--
-- 只給 `wrangler d1 ... --local` 用，絕對不要對 --remote 執行。
-- 裡面沒有任何真實客人資料：姓名一律「測試」開頭、電話 0900000xxx、
-- 信箱 @example.com（保留網域，不會真的寄出去）。
--
-- 日期全部用 date('now', ...) 相對計算，所以什麼時候灌都會落在
-- 「今年」，財報與日曆才有東西可看。
-- ════════════════════════════════════════════════════════════════

DELETE FROM orders             WHERE orderID LIKE 'DEV-%';
DELETE FROM cost_rows          WHERE orderID LIKE 'DEV-%';
DELETE FROM housekeeping_costs WHERE orderID LIKE 'DEV-%';
DELETE FROM monthly_expenses   WHERE note = 'dev-fake';
DELETE FROM coupons            WHERE code LIKE 'dev%';
DELETE FROM vendor_contacts    WHERE vendor LIKE '測試%';

-- ── 過去的訂單（已完成）──────────────────────────────────────
-- rooms / 價格照正式的 3房10800、4房12800、5房14800 平日價
INSERT INTO orders (orderID, name, phone, email, checkIn, checkOut, rooms, extraBeds,
                    originalTotal, totalPrice, paidDeposit, remainingBalance,
                    sourceType, status, timestamp)
VALUES
 ('DEV-0001','測試一','0900000001','dev1@example.com', date('now','-150 days'), date('now','-148 days'), 4, 0, 25600, 23000, 6900, 0, '自家','完成', datetime('now','-160 days')),
 ('DEV-0002','測試二','0900000002','dev2@example.com', date('now','-120 days'), date('now','-117 days'), 5, 0, 44400, 39000, 11700, 0, '自家','完成', datetime('now','-130 days')),
 ('DEV-0003','測試三','0900000003','dev3@example.com', date('now','-95 days'),  date('now','-93 days'),  3, 0, 21600, 19000, 5700, 0, '自家','完成', datetime('now','-105 days')),
 ('DEV-0004','測試四','0900000004','dev4@example.com', date('now','-70 days'),  date('now','-68 days'),  5, 0, 29600, 26000, 7800, 0, '自家','完成', datetime('now','-80 days')),
 ('DEV-0005','測試五','0900000005','dev5@example.com', date('now','-45 days'),  date('now','-42 days'),  4, 0, 38400, 34000, 10200, 0, '自家','完成', datetime('now','-55 days')),
 ('DEV-0006','測試六','0900000006','dev6@example.com', date('now','-20 days'),  date('now','-18 days'),  3, 0, 21600, 21600, 6480, 0, '自家','完成', datetime('now','-30 days'));

-- ── 未來的訂單（已付訂，尾款未收）──────────────────────────
-- 日曆要看得到：一組連住、一組 back-to-back、一組獨立
INSERT INTO orders (orderID, name, phone, email, checkIn, checkOut, rooms, extraBeds,
                    originalTotal, totalPrice, paidDeposit, remainingBalance,
                    sourceType, status, timestamp)
VALUES
 ('DEV-0007','測試七','0900000007','dev7@example.com', date('now','+8 days'),  date('now','+10 days'), 4, 0, 25600, 23000, 6900, 16100, '自家','已付訂', datetime('now','-6 days')),
 ('DEV-0008','測試八','0900000008','dev8@example.com', date('now','+10 days'), date('now','+12 days'), 5, 0, 29600, 27000, 8100, 18900, '自家','已付訂', datetime('now','-4 days')),
 ('DEV-0009','測試九','0900000009','dev9@example.com', date('now','+25 days'), date('now','+28 days'), 3, 0, 32400, 28500, 8550, 19950, '自家','已付訂', datetime('now','-2 days'));

-- ── 洽談中（48 小時內會被 cron 自動取消）────────────────────
INSERT INTO orders (orderID, name, phone, email, checkIn, checkOut, rooms, extraBeds,
                    originalTotal, totalPrice, paidDeposit, remainingBalance,
                    sourceType, status, timestamp)
VALUES
 ('DEV-0010','測試十','0900000010','dev10@example.com', date('now','+40 days'), date('now','+42 days'), 4, 0, 25600, 25600, 0, 25600, '自家','洽談中', datetime('now','-3 hours'));

-- ── 取消（不該進日曆、不該進營收）──────────────────────────
INSERT INTO orders (orderID, name, phone, email, checkIn, checkOut, rooms, extraBeds,
                    originalTotal, totalPrice, paidDeposit, remainingBalance,
                    sourceType, status, cancelReason, timestamp)
VALUES
 ('DEV-0011','測試十一','0900000011','dev11@example.com', date('now','+15 days'), date('now','+17 days'), 5, 0, 29600, 27000, 0, 0, '自家','取消','客人改期', datetime('now','-10 days'));

-- ── 房務清潔費（隨房數）──────────────────────────────────────
INSERT INTO housekeeping_costs (orderID, amount, note, submittedAt, submittedBy) VALUES
 ('DEV-0001', 2810, 'dev', datetime('now','-147 days'), '測試房務'),
 ('DEV-0002', 3300, 'dev', datetime('now','-116 days'), '測試房務'),
 ('DEV-0003', 2400, 'dev', datetime('now','-92 days'),  '測試房務'),
 ('DEV-0004', 3257, 'dev', datetime('now','-67 days'),  '測試房務'),
 ('DEV-0005', 2810, 'dev', datetime('now','-41 days'),  '測試房務'),
 ('DEV-0006', 2400, 'dev', datetime('now','-17 days'),  '測試房務');

-- ── 每月固定支出（含貸款，兩種檢視才有差別）────────────────
-- 一年 12 個月都填，note 標記 dev-fake 方便清除
INSERT INTO monthly_expenses (yearMonth, internet, platformFee, landTax, insurance,
                              laundry, water, electricity, other, mortgage, creditLoan, note)
VALUES
  (strftime('%Y-','now') || '01', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '02', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '03', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '04', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '05', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '06', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '07', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '08', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '09', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '10', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '11', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake'),
  (strftime('%Y-','now') || '12', 1200, 800, 900, 1000, 2200, 1400, 4800, 600, 36000, 6000, 'dev-fake');

-- ── 優惠碼 ───────────────────────────────────────────────────
INSERT INTO coupons (code, type, value, description, useLimit, usedCount, active) VALUES
 ('devnight', 'per_night_fixed', 800, '本機測試・每晚折 800', 0, 1, 1),
 ('devpct',   'percent',          10, '本機測試・九折',       5, 0, 1);

-- ── 廠商聯絡（正式環境這張是空的，本機放一筆才測得到畫面）──
INSERT INTO vendor_contacts (vendor, phone, note, updatedAt) VALUES
 ('測試租車', '06-9000000', '本機假資料', datetime('now'));

-- ── 年度淨利目標（財報的目標線要用）────────────────────────
INSERT OR REPLACE INTO site_config (key, value, updatedAt)
VALUES ('annual_target', '1000000', datetime('now'));

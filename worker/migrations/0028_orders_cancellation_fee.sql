-- 取消手續費（沒收訂金）：客人取消時依退費政策留下的金額。
-- 取消單原本被財報整筆排除（status != '取消'），這筆真實收入會憑空消失。
-- 只計「房間」的取消手續費為雫旅淨利；行程/船票的手續費是付給旅行社的，不走此欄。
ALTER TABLE orders ADD COLUMN cancellationFee REAL DEFAULT 0;

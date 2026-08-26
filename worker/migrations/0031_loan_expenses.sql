-- 貸款併入月固定支出（2026-08）
-- 老闆拍板的認列口徑：房貸「本金＋利息」都算成本，理由是本金雖然變成淨值，
-- 但那要賣掉房子才變現，對現金流沒有幫助。信貸同理，且只計真正投入房子的部分。
-- 兩欄都歸「固定」（沒有客人也要付），不進變動成本。
ALTER TABLE monthly_expenses ADD COLUMN mortgage   INTEGER DEFAULT 0;  -- 房貸本息
ALTER TABLE monthly_expenses ADD COLUMN creditLoan INTEGER DEFAULT 0;  -- 信貸本息（民宿部分）

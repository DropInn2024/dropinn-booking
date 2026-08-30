-- 存客人 email（2026-08）
-- 原本 email 只在下單當下拿來寄一封信，沒有存下來 ——
-- 所以後台把狀態改成「訂單成立」或「已取消」時，根本無從通知客人
-- （只有綁過 LINE 的推得到，網頁下單的客人完全收不到）。
ALTER TABLE tour_orders ADD COLUMN contactEmail TEXT DEFAULT '';

-- 行程購物車：同次結帳的多筆訂單用 groupId 綁在一起
ALTER TABLE tour_orders ADD COLUMN groupId TEXT;

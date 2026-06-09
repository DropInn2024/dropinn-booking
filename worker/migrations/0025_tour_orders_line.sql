-- 客人 LINE userId（B2 加好友綁定後存入，用於成立/行前自動推播）
ALTER TABLE tour_orders ADD COLUMN lineUserId TEXT;

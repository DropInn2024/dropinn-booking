-- 退款追蹤：取消且有付訂金的單，refundedAt 為 NULL=待退款、有值=已退款（時間）
ALTER TABLE orders ADD COLUMN refundedAt TEXT;

-- 拆分 reminderSent 為兩個獨立 flag
-- 避免「40h 警告」和「入住前一天提醒」互相干擾
ALTER TABLE orders ADD COLUMN pendingWarningSent   INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN checkInReminderSent  INTEGER DEFAULT 0;

-- 感謝信去重：每張訂單只寄一次
ALTER TABLE orders ADD COLUMN postStayThankYouSent INTEGER DEFAULT 0;

-- drift_spots：補上「離島搭船」欄位
-- 背景：離島景點（吉貝/七美/望安/虎井…）要搭船，但原本 0013 建表沒有交通欄位，
--       前台讀 D1 後就把寫死陣列裡的 ferry 修正覆蓋掉，路線圖又變回「開車」。
-- 兩個欄位（沿用 tags 以 JSON 字串存的慣例）：
--   transport — 'ferry' 表離島搭船；NULL / 'drive' 表本島開車（前台 transport !== 'ferry' 即視為開車）
--   ferry     — JSON 字串：{"harborId":"chikan","minutes":20,"note":"赤崁港搭船 20 分鐘"}
--               harborId 對應 app.js HARBORS（chikan 北海 / nanhai 南海 / qitou 東海）
ALTER TABLE drift_spots ADD COLUMN transport TEXT;
ALTER TABLE drift_spots ADD COLUMN ferry TEXT;

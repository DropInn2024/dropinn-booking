-- 離島搭船修正（外科手術式，套用到既有 prod，不整批重灌避免蓋掉 owner 編輯）
-- 背景：0013 建表無交通欄位，ferry 修正只進 app.js 寫死陣列；前台讀 D1 覆蓋後路線又變開車。
--   1) 吉貝(a11)/七美(a12) 已存在 D1 → 只 UPDATE transport/ferry，保留既有 note/rating
--   2) 望安(a14)/虎井(a15) 不在 D1（seed 早於新增）→ 補 INSERT（含 ferry）
-- harborId 對應 app.js HARBORS：chikan 北海 / nanhai 南海 / qitou 東海

UPDATE drift_spots SET transport='ferry',
  ferry='{"harborId":"chikan","minutes":20,"note":"赤崁港搭船 20 分鐘"}'
  WHERE id='a11';

UPDATE drift_spots SET transport='ferry',
  ferry='{"harborId":"nanhai","minutes":90,"note":"南海遊客中心搭船 90 分鐘（或從馬公機場飛機 15 分鐘）"}'
  WHERE id='a12';

INSERT OR IGNORE INTO drift_spots (id, type, cat, name, area, rating, price, note, feature, tags, nearby, lat, lng, status, noLoc, displayOrder, createdBy, createdAt, updatedAt, transport, ferry)
VALUES ('a14', 'attraction', '景點', '望安島', '望安', 2, '', '馬公搭船約50分鐘。傳統古厝保存最完整的澎湖離島，天台山可俯瞰全島。綠蠵龜保育區也在這裡，若有機會更可接著搭短程船去旁邊的將軍澳嶼。', '古厝聚落、天台山、綠蠵龜', '["#離島","#古厝","#生態","#南海"]', 0, 23.3677, 119.5077, 'open', 0, NULL, 'owner', '2026-06-01T15:53:11.509Z', '2026-06-01T15:53:11.509Z', 'ferry', '{"harborId":"nanhai","minutes":50,"note":"南海遊客中心搭船約 50 分鐘"}');

INSERT OR IGNORE INTO drift_spots (id, type, cat, name, area, rating, price, note, feature, tags, nearby, lat, lng, status, noLoc, displayOrder, createdBy, createdAt, updatedAt, transport, ferry)
VALUES ('a15', 'attraction', '景點', '虎井嶼', '馬公', 2, '', '馬公搭船僅20分鐘，卻像走進另一個世界。島上貓咪成群自在漫步，玄武岩石巷靜謐迷人，也是熱門浮潛景點。', '貓島、玄武岩石巷、浮潛', '["#離島","#貓島","#浮潛","#南海"]', 0, 23.5358, 119.5028, 'open', 0, NULL, 'owner', '2026-06-01T15:53:11.509Z', '2026-06-01T15:53:11.509Z', 'ferry', '{"harborId":"nanhai","minutes":20,"note":"南海遊客中心搭船約 20 分鐘"}');

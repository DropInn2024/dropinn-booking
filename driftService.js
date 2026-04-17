/**
 * driftService.js
 * Drift 旅遊規劃頁面的資料 API
 *
 * ── 使用方式 ─────────────────────────────────────────
 * 1. 第一次：在 GAS 編輯器執行 setupDriftSheet() 建立工作表
 * 2. 日常：直接在 Google Sheets「旅遊景點」工作表新增 / 修改列
 * 3. 頁面載入時自動 fetch?action=getDriftSpots 取得最新資料
 *
 * ── 欄位說明 ─────────────────────────────────────────
 * id       唯一代碼（例：f01 / a01）
 * type     food（美食）或 attraction（景點）
 * cat      分類（早餐／小吃／海鮮餐廳／宵夜／咖啡甜點／各鄉鎮名）
 * route    路線（北環／南環，可留空）
 * name     店家 / 景點名稱
 * area     顯示用地區（馬公 / 湖西 / 白沙 etc.）
 * rating   1–3（⭐–⭐⭐⭐），0 = 待評
 * price    $ / $$ / $$$ / $$$$ / ?
 * note     業主推薦理由（顯示在卡片上）
 * feature  招牌 / 特色（路線清單顯示用）
 * tags     標籤，逗號分隔（例：#早餐,#銅板,#限量）
 * lat      緯度
 * lng      經度
 * nearby   是否為民宿附近（TRUE / FALSE）
 * status   open / irregular / tbd
 * noLoc    位置未確認，不計入路線（TRUE / FALSE）
 */

// ─────────────────────────────────────────────────────
// 公開 API：取得所有景點資料
// ─────────────────────────────────────────────────────
function getDriftSpots() {
  try {
    // 5 分鐘快取，避免每次都讀 Sheets
    const cache = CacheService.getScriptCache();
    const cached = cache.get('drift_spots_v1');
    if (cached) {
      return ContentService.createTextOutput(cached)
        .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.openById(Config.SHEET_ID);
    const sheet = ss.getSheetByName('旅遊景點');

    if (!sheet) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: '找不到「旅遊景點」工作表，請先執行 setupDriftSheet()' })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: true, spots: [] })
      ).setMimeType(ContentService.MimeType.JSON);
    }

    const headers = rows[0].map(h => String(h).trim());
    const spots = rows.slice(1)
      .filter(row => row[0] && String(row[0]).trim() !== '')
      .map(row => {
        const o = {};
        headers.forEach((h, i) => { o[h] = row[i]; });
        return {
          id:      String(o.id      || ''),
          type:    String(o.type    || 'food'),
          cat:     String(o.cat     || ''),
          route:   String(o.route   || ''),
          name:    String(o.name    || ''),
          area:    String(o.area    || ''),
          rating:  Number(o.rating) || 0,
          price:   String(o.price   || ''),
          note:    String(o.note    || ''),
          feature: String(o.feature || ''),
          tags:    String(o.tags || '').split(',').map(t => t.trim()).filter(Boolean),
          lat:     Number(o.lat)  || 0,
          lng:     Number(o.lng)  || 0,
          nearby:  o.nearby === true || String(o.nearby).toUpperCase() === 'TRUE',
          status:  String(o.status || 'open'),
          noLoc:   o.noLoc === true  || String(o.noLoc).toUpperCase()  === 'TRUE',
        };
      });

    const result = JSON.stringify({ success: true, spots, updatedAt: new Date().toISOString() });
    cache.put('drift_spots_v1', result, 300); // 快取 5 分鐘

    return ContentService.createTextOutput(result)
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log('❌ getDriftSpots 錯誤: ' + err);
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: err.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─────────────────────────────────────────────────────
// 初始化工作表（第一次執行一次即可）
// ─────────────────────────────────────────────────────
function setupDriftSheet() {
  const ss = SpreadsheetApp.openById(Config.SHEET_ID);
  let sheet = ss.getSheetByName('旅遊景點');

  if (!sheet) {
    sheet = ss.insertSheet('旅遊景點');
    Logger.log('✅ 建立「旅遊景點」工作表');
  }

  // 標題列
  const headers = ['id','type','cat','route','name','area','rating','price','note','feature','tags','lat','lng','nearby','status','noLoc'];
  sheet.clearContents();
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#ece8e1');
  headerRange.setFontColor('#1a1210');

  // 欄寬設定
  sheet.setColumnWidth(1, 60);   // id
  sheet.setColumnWidth(2, 80);   // type
  sheet.setColumnWidth(3, 90);   // cat
  sheet.setColumnWidth(4, 70);   // route
  sheet.setColumnWidth(5, 160);  // name
  sheet.setColumnWidth(6, 80);   // area
  sheet.setColumnWidth(7, 60);   // rating
  sheet.setColumnWidth(8, 50);   // price
  sheet.setColumnWidth(9, 360);  // note
  sheet.setColumnWidth(10, 160); // feature
  sheet.setColumnWidth(11, 200); // tags
  sheet.setColumnWidth(12, 90);  // lat
  sheet.setColumnWidth(13, 90);  // lng
  sheet.setColumnWidth(14, 70);  // nearby
  sheet.setColumnWidth(15, 80);  // status
  sheet.setColumnWidth(16, 70);  // noLoc

  // 凍結標題列
  sheet.setFrozenRows(1);

  // 填入初始資料（從 drift/index.html 的硬編碼資料遷移）
  _seedDriftData(sheet);

  Logger.log('✅ 工作表設定完成，共填入 ' + (sheet.getLastRow() - 1) + ' 筆資料');
  return '設定完成！請到 Google Sheets 查看「旅遊景點」工作表。';
}

// ─────────────────────────────────────────────────────
// 清除快取（修改資料後可手動執行，加速更新）
// ─────────────────────────────────────────────────────
function clearDriftCache() {
  CacheService.getScriptCache().remove('drift_spots_v1');
  Logger.log('✅ Drift 快取已清除');
  return '快取清除完成，下次頁面載入將取得最新資料。';
}

// ─────────────────────────────────────────────────────
// 預填初始資料（內部用）
// ─────────────────────────────────────────────────────
function _seedDriftData(sheet) {
  const data = [
    // id, type, cat, route, name, area, rating, price, note, feature, tags, lat, lng, nearby, status, noLoc
    // ── 美食：早餐 ──
    ['f01','food','早餐','','鼎灣米糕','湖西',3,'$','筒仔米糕配半熟蛋，6點開到中午。在地人私藏，民宿附近，蛋餅也可以嘗試。','筒仔米糕、半熟蛋','#早餐,#在地日常,#銅板',23.5863,119.6489,true,'open',false],
    ['f02','food','早餐','','中美早餐','白沙',3,'$','走北環時推薦一併安排。手作煎餃和潤餅皮蛋餅值得一試。','手作煎餃、潤餅蛋餅','#早餐,#北環,#銅板',23.6354,119.5820,false,'open',false],
    ['f03','food','早餐','','新海濱小吃部','湖西',2,'$','去湖西玩可繞道，在機場附近。韭菜包加自製辣椒醬值得一試，8:30常賣完。','韭菜包、自製辣椒醬','#早餐,#在地日常',23.5700,119.6280,false,'open',false],
    ['f04','food','早餐','','鐘記燒餅','馬公',3,'$','甕烤燒餅皮薄酥脆，干貝蔥蛋是招牌。旺季排隊人潮極多，想吃請設鬧鐘早起！','甕烤燒餅、干貝蔥蛋','#早餐,#排隊,#在地人愛,#銅板',23.5680,119.5835,false,'open',false],
    ['f05','food','早餐','','二信飯糰','馬公',3,'$','紫米白糯米雙色飯糰，5:30開賣。早去才有，賣完收攤。','雙色飯糰','#早餐,#銅板,#限量',23.5668,119.5818,false,'open',false],
    ['f06','food','早餐','','北新橋牛雜湯','馬公',3,'$','50年老店，牛雜湯和包子是招牌。11點前售完，目前僅外帶。','牛雜湯、包子','#早餐,#老店,#銅板,#限量',23.5672,119.5825,false,'open',false],
    ['f07','food','早餐','','蔬脆蛋餅','馬公',3,'$','澎湖在地蛋餅，個人比蔥油餅更推，口味清爽不油膩。','澎湖在地蛋餅','#早餐,#在地日常,#銅板',23.5675,119.5815,false,'open',false],
    ['f08','food','早餐','','小郵局蔥油餅','馬公',2,'$','現炸蔥油餅，知名但個人更推蔬脆蛋餅。','現炸蔥油餅','#早餐,#排隊,#銅板',23.5674,119.5826,false,'open',false],
    // ── 美食：小吃 ──
    ['f09','food','小吃','','外垵刈包','西嶼',2,'$','黑糖饅頭夾爌肉，旁邊有海景加分。開到傍晚。','黑糖饅頭刈包','#小吃,#海景,#銅板',23.5660,119.4520,false,'open',false],
    ['f10','food','小吃','','老李胡椒餅','馬公',2,'$','澎湖唯一炭火胡椒餅，老麵發酵，下午茶才開，觀光客少知道的隱藏版。','炭火胡椒餅','#小吃,#隱藏版,#銅板',23.5675,119.5820,false,'open',false],
    ['f11','food','小吃','','阿豹大腸包小腸','馬公',2,'$','馬公必吃小吃，兩家都推薦，可以都試試。','大腸包小腸','#小吃,#銅板',23.5671,119.5820,false,'open',false],
    ['f12','food','小吃','','花媽大腸包小腸','馬公',2,'$','和阿豹是馬公大腸包小腸雙雄，各有擁護者。','大腸包小腸','#小吃,#銅板',23.5673,119.5822,false,'open',false],
    ['f13','food','小吃','','洪家炸粿','湖西',2,'$','整枝蝦子加蚵仔現炸，真材實料。民宿附近。','蝦子蚵仔炸粿','#小吃,#銅板,#炸粿',23.5840,119.6510,true,'open',false],
    ['f14','food','小吃','','湖西炸粿','湖西',2,'$','湖西在地炸粿，不定時出攤，遇到就是緣分。','炸粿','#小吃,#隱藏版,#銅板',23.5830,119.6520,true,'irregular',false],
    ['f15','food','小吃','','借東風麻辣燙','馬公',3,'$','湯頭是亮點，清爽不油膩，很適合買來當宵夜！','麻辣燙、特色湯頭','#小吃,#宵夜,#麻辣,#銅板',23.5674,119.5828,false,'open',false],
    ['f16','food','小吃','','仁愛路肉圓','馬公',2,'$','清蒸肉圓，在地日常小吃，無店名更有味道。','清蒸肉圓','#小吃,#在地日常,#銅板',23.5678,119.5838,false,'open',false],
    ['f17','food','小吃','','三多路肉圓','馬公',2,'$','另一家清蒸肉圓，可以和仁愛路比較看看。','清蒸肉圓','#小吃,#在地日常,#銅板',23.5668,119.5845,false,'open',false],
    ['f18','food','小吃','','香亭土魠魚羹','馬公',1,'$','一碗就能感受澎湖的海味，在地文化體驗。','土魠魚羹','#小吃,#體驗,#在地特色',23.5669,119.5819,false,'open',false],
    // ── 美食：海鮮餐廳 ──
    ['f19','food','海鮮餐廳','','新村小吃部','湖西',3,'$$','最推的在地海鮮小吃部，雞油飯必點，需要提前預約。民宿附近的私藏。','雞油飯、在地海鮮','#餐廳,#在地人愛,#需預約',23.5880,119.6500,true,'open',false],
    ['f20','food','海鮮餐廳','','潮境 TideLand','馬公',3,'$$$','近年超夯的無菜單料理，用料實在。記得提前訂位，等候時間長。','無菜單料理','#餐廳,#無菜單,#精緻,#需排隊',23.5690,119.5855,false,'open',false],
    ['f21','food','海鮮餐廳','','癮餐廳','馬公',3,'$$$$','澎湖精緻料理首選，每月1號開放訂位。想要最精緻的澎湖海鮮體驗，就是它了。','精緻澎湖海鮮','#餐廳,#精緻,#需預約,#必試',23.5682,119.5842,false,'open',false],
    ['f22','food','海鮮餐廳','','阿華海鮮','馬公',3,'$$','這幾年口碑很好，在地人和觀光客都愛。（確切地址確認中）','在地海鮮','#餐廳,#海鮮,#熱門',23.5678,119.5832,false,'open',true],
    ['f23','food','海鮮餐廳','','龍門海鮮','湖西',1,'$$','湖西在地海鮮，想在民宿附近用餐時的選擇。','海鮮料理','#餐廳,#海鮮',23.5870,119.6510,true,'open',false],
    // ── 美食：宵夜 ──
    ['f24','food','宵夜','','家家碳烤','馬公',2,'$$','宵夜碳烤首選，馬公夜晚的定番。','碳烤','#宵夜,#碳烤',23.5672,119.5825,false,'open',false],
    ['f25','food','宵夜','','阿男牛雜湯','馬公',2,'$$','口味好，料偏少，老饕才懂的宵夜選擇。','牛雜湯','#宵夜,#老饕',23.5668,119.5818,false,'open',false],
    ['f26','food','宵夜','','香格里辣','馬公',2,'$$','現場吃才對味，辣得很過癮。','香辣料理','#宵夜,#辣',23.5671,119.5821,false,'open',false],
    // ── 美食：咖啡甜點 ──
    ['f27','food','咖啡甜點','','880咖啡','馬公',2,'$','老闆 Ted 用熱情將陌生人聚成好友。有機會遇上手作野酵麵包或流心巴斯克蛋糕，請毫不猶豫點起來。','職人自烘咖啡、手作甜點','#咖啡,#銅板,#在地日常,#溫暖',23.5650,119.5930,false,'open',false],
    ['f28','food','咖啡甜點','','逸咖啡','馬公',2,'$$','環境精緻，咖啡水準不錯，適合下午悠閒休息。','精緻咖啡','#咖啡,#精緻',23.5670,119.5834,false,'open',false],
    ['f29','food','咖啡甜點','','及林春咖啡館','湖西',1,'$$','在林投公園旁，景大於咖啡，適合民宿附近散步時順道坐坐。','林投公園景觀咖啡','#咖啡,#海景,#打卡',23.5658,119.6482,true,'open',false],
    ['f30','food','咖啡甜點','','玉冠嫩仙草','馬公',3,'$','在地老字號，觀光客和在地人都愛。仙草嫩滑，加料豐富，來澎湖必吃。','嫩仙草','#甜點,#仙草,#老字號,#銅板',23.5677,119.5822,false,'open',false],
    ['f31','food','咖啡甜點','','易家仙人掌冰','白沙',3,'$','來澎湖不吃不行的體驗。仙人掌天然清甜，一支不夠吃。通樑古榕旁邊。','仙人掌冰','#甜點,#仙人掌,#銅板,#必體驗',23.6393,119.5170,false,'open',false],
    ['f32','food','咖啡甜點','','藍冉 Yukkuri','馬公',3,'$$','澎湖日式刨冰的天花板，連續三年的私藏名單。老闆對味道層次極其精準，布丁也必點。','職人日式刨冰、手作布丁','#甜點,#刨冰,#精緻,#私藏',23.5685,119.5808,false,'open',false],
    ['f33','food','咖啡甜點','','二崁杏仁茶','西嶼',2,'$','在二崁古厝聚落裡，唯一性強。搭配旁邊二馬豆花一起吃是最好的組合。','杏仁茶','#甜點,#古厝,#銅板,#唯一',23.6001,119.4546,false,'open',false],
    ['f34','food','咖啡甜點','','二馬豆花','西嶼',2,'$','在二崁，搭配杏仁茶是最完美的組合。','豆花','#甜點,#古厝,#銅板',23.6003,119.4548,false,'open',false],
    ['f35','food','咖啡甜點','','hikoni甜點','待確認',0,'?','業主私藏，詳細資訊整理中。','甜點','#甜點',0,0,false,'tbd',true],
    ['f36','food','咖啡甜點','','清泉豆花','待確認',0,'?','業主私藏，詳細資訊整理中。','豆花','#甜點',0,0,false,'tbd',true],
    ['f37','food','咖啡甜點','','巴街湯圓','待確認',0,'?','業主私藏，詳細資訊整理中。','湯圓','#甜點',0,0,false,'tbd',true],
    ['f38','food','咖啡甜點','','絇紷仙草','待確認',0,'?','業主私藏，詳細資訊整理中。','仙草','#甜點,#仙草',0,0,false,'tbd',true],
    ['f39','food','咖啡甜點','','藍媽媽','待確認',0,'?','業主私藏，詳細資訊整理中。','甜點','#甜點',0,0,false,'tbd',true],
    // ── 景點 ──
    ['a01','attraction','湖西鄉','','奎壁山摩西分海','湖西',3,'','退潮時海中步道浮現，可步行到對面小島，傍晚光線最美。民宿開車10分鐘。記得先查潮汐時間！','退潮步道、小島','#必去,#潮汐,#打卡',23.5919,119.6725,true,'open',false],
    ['a02','attraction','湖西鄉','','林投海灘','湖西',2,'','距民宿6分鐘，下午夕陽可以去沙灘走走。旁邊就是及林春咖啡館，適合搭配。','沙灘、夕陽','#沙灘,#夕陽',23.5685,119.6472,true,'open',false],
    ['a03','attraction','湖西鄉','','山水沙灘','湖西',2,'','距民宿10分鐘，本島知名沙灘，有許多水上活動業者，可以去體驗看看。','沙灘、水上活動','#沙灘,#水上活動',23.5475,119.6155,false,'open',false],
    ['a04','attraction','白沙鄉','北環','後寮天堂路','白沙',3,'','延伸入海的筆直道路，退潮時海天一色，非常震撼。北環必去。','入海之路、絕景','#北環,#打卡,#必去',23.6354,119.5820,false,'open',false],
    ['a05','attraction','白沙鄉','北環','通梁古榕 / 跨海大橋','白沙',2,'','300年古榕盤根錯節，充滿生命力。跨海大橋連接白沙與西嶼，開車過橋本身也是一種體驗。','古榕樹、跨海大橋','#北環,#文化',23.6398,119.5022,false,'open',false],
    ['a06','attraction','西嶼鄉','北環','二崁聚落','西嶼',2,'','保存完整的咾咕石古厝聚落，搭配二崁杏仁茶和豆花，是北環半日行程的完美組合。','咾咕石古厝','#北環,#古厝,#文化',23.6001,119.4546,false,'open',false],
    ['a07','attraction','西嶼鄉','北環','漁翁島燈塔','西嶼',2,'','台灣最古老的燈塔之一，站在燈塔旁俯瞰整個西嶼海岸，壯觀無比。','百年燈塔','#北環,#燈塔,#打卡',23.5583,119.4191,false,'open',false],
    ['a08','attraction','西嶼鄉','北環','內垵遊憩區','西嶼',2,'','清澈海灣，適合玩水戲沙，北環路線的中繼好去處。','清澈海灣','#北環,#沙灘,#玩水',23.5700,119.4220,false,'open',false],
    ['a09','attraction','馬公市','南環','嵵裡沙灘','馬公',2,'','南環必訪的美麗沙灘，水質清澈，相對安靜少人。','沙灘、清澈海水','#南環,#沙灘',23.5368,119.6020,false,'open',false],
    ['a10','attraction','馬公市','南環','風櫃洞','馬公',2,'','海浪打入天然玄武岩洞穴，聲音猶如天然管風琴。退潮時音效最佳。','天然海蝕洞穴、濤聲','#南環,#自然景觀',23.5280,119.5580,false,'open',false],
    ['a11','attraction','白沙鄉','','吉貝島','白沙',3,'','從赤崁搭船20分鐘，SUP、浮潛、香蕉船一次滿足。澎湖水上活動的天堂。','SUP、浮潛、水上活動','#離島,#水上活動,#必去',23.6916,119.5738,false,'open',false],
    ['a12','attraction','七美鄉','','七美島','七美',3,'','從馬公搭船約2小時，澎湖最南端的小島。雙心石滬、燈塔，值得安排一整天。','雙心石滬、燈塔','#離島,#必去',23.2108,119.4445,false,'open',false],
    ['a13','attraction','馬公市','','澎湖灣花火節','馬公',3,'','每年約5–8月舉辦。夜晚花火倒映在海面上，是澎湖夏天最大盛事。','花火節、夜景','#活動,#季節限定,#必去',23.5642,119.5785,false,'open',false],
  ];

  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
  Logger.log('✅ 預填 ' + data.length + ' 筆資料完成');
}

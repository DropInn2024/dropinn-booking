// ── Drift Auth（代碼登入）──────────────────────────────────────────────────
var DRIFT_AUTH_KEY = 'drift_user_token';
// 閒置自動登出：超過 2 小時沒操作就清 token、跳回輸入碼畫面
var DRIFT_IDLE_MS = 2 * 60 * 60 * 1000;
var DRIFT_LASTACT_KEY = 'drift_last_active';
var driftIdleTimer = null;

// XSS 防護：拼入 innerHTML 前的字串都要過 esc()
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function driftDoCodeLogin() {
  var code = (document.getElementById('driftCodeInput').value || '').trim();
  var errEl = document.getElementById('driftCodeErr');
  if (!code) { errEl.textContent = '請輸入代碼'; errEl.style.display = 'block'; return; }
  try {
    var res  = await fetch('/api/drift/code-login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ code }) });
    var data = await res.json();
    if (!data.success || !data.token) throw new Error(data.error || '代碼不正確');
    localStorage.setItem(DRIFT_AUTH_KEY, data.token);
    var ov = document.getElementById('driftAuthOverlay');
    if (ov) ov.style.display = 'none';
    document.body.style.overflow = '';
    driftShowLogout(true);
    driftStartIdleWatch();
    driftApplyTier();
  } catch(e) {
    errEl.textContent = e.message || '代碼不正確';
    errEl.style.display = 'block';
    document.getElementById('driftCodeInput').select();
  }
}

// 顯示/隱藏右上角登出鈕（登入後才出現）
function driftShowLogout(show) {
  var btn = document.getElementById('driftLogoutBtn');
  if (btn) btn.style.display = show ? '' : 'none';
}

// 解析 token 內 tier（'free' | 'premium'）；解不出就當免費
function driftTier() {
  try {
    var t = localStorage.getItem(DRIFT_AUTH_KEY);
    if (!t) return 'free';
    var p = t.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
    while (p.length % 4) p += '=';
    var obj = JSON.parse(decodeURIComponent(escape(atob(p))));
    if (!obj) return 'free';
    // 雫編/朋友（owner/friend）視為完整權限；訪客看 tier
    if (obj.role === 'owner' || obj.role === 'friend') return 'premium';
    return obj.tier === 'premium' ? 'premium' : 'free';
  } catch (e) { return 'free'; }
}
// 免費版：body 加 .drift-free → CSS 隱藏 Google Maps 連結與導航（OSM 路線圖仍可用）
function driftApplyTier() {
  document.body.classList.toggle('drift-free', driftTier() !== 'premium');
}

// 登出：清掉 token，重新跳出輸入碼遮罩（手動登出 / 閒置逾時都走這裡）
function driftLogout() {
  localStorage.removeItem(DRIFT_AUTH_KEY);
  localStorage.removeItem(DRIFT_LASTACT_KEY);
  driftStopIdleWatch();
  driftShowLogout(false);
  var ov = document.getElementById('driftAuthOverlay');
  if (ov) ov.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  var errEl = document.getElementById('driftCodeErr');
  if (errEl) errEl.style.display = 'none';
  var input = document.getElementById('driftCodeInput');
  if (input) { input.value = ''; input.focus(); }
}

// ── 閒置自動登出 ────────────────────────────────────────────────
// 記錄最後操作時間（節流：最多每 30 秒寫一次 localStorage）
var driftLastWrite = 0;
function driftBumpActivity() {
  var now = Date.now();
  if (now - driftLastWrite < 30000) return;
  driftLastWrite = now;
  localStorage.setItem(DRIFT_LASTACT_KEY, String(now));
}
function driftIsIdleExpired() {
  var last = parseInt(localStorage.getItem(DRIFT_LASTACT_KEY) || '0', 10);
  return last > 0 && (Date.now() - last > DRIFT_IDLE_MS);
}
function driftCheckIdle() {
  if (!localStorage.getItem(DRIFT_AUTH_KEY)) return;   // 沒登入免查
  if (driftIsIdleExpired()) driftLogout();
}
function driftStartIdleWatch() {
  driftBumpActivity();
  driftStopIdleWatch();
  driftIdleTimer = setInterval(driftCheckIdle, 60000); // 每分鐘檢查一次
}
function driftStopIdleWatch() {
  if (driftIdleTimer) { clearInterval(driftIdleTimer); driftIdleTimer = null; }
}
// 使用者一有動作就更新時間戳（被動監聽、已節流）
['click','keydown','touchstart','scroll','mousemove'].forEach(function(ev){
  document.addEventListener(ev, function(){ if (localStorage.getItem(DRIFT_AUTH_KEY)) driftBumpActivity(); }, { passive: true });
});
// 切回分頁時補查一次（背景放久了回來要能即時登出）
document.addEventListener('visibilitychange', function(){ if (!document.hidden) driftCheckIdle(); });

(function initDriftAuth() {
  var overlay = document.getElementById('driftAuthOverlay');
  if (!overlay) return;
  if (localStorage.getItem(DRIFT_AUTH_KEY)) {
    if (driftIsIdleExpired()) { driftLogout(); return; }  // 上次離開已超過 2 小時 → 直接登出
    overlay.style.display = 'none';
    driftShowLogout(true);
    driftStartIdleWatch();
    driftApplyTier();
  } else {
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    var input = document.getElementById('driftCodeInput');
    if (input) input.focus();
  }
})();
// ── Data ──────────────────────────────────────────────────────────────────
const HOME = { lat: 23.572433583184814, lng: 119.61523423792997, name: '雫旅 Drop Inn' };
const DRIFT_TOKEN_KEY = 'drift_user_token';

// ── Harbors（離島渡輪起點）──────────────────────────────────────────────
// 提供給 ferry 景點當作中繼點：開車到港口 → 搭船到島
// 澎湖三大航線：
//   北海 chikan  → 吉貝嶼、目斗嶼（赤崁碼頭 / 北海遊客中心）
//   南海 nanhai  → 七美、望安、虎井嶼、桶盤嶼等南海離島（南海遊客中心）
//   東海 qitou   → 員貝嶼、鳥嶼等東海離島（岐頭遊客中心）
const HARBORS = {
  chikan: { id:'h-chikan', name:'赤崁碼頭（北海）',    area:'白沙', lat:23.6967, lng:119.5081, kind:'harbor' },
  nanhai: { id:'h-nanhai', name:'南海遊客中心',         area:'馬公', lat:23.5662, lng:119.5722, kind:'harbor' },
  qitou:  { id:'h-qitou',  name:'岐頭遊客中心（東海）', area:'白沙', lat:23.6038, lng:119.5986, kind:'harbor' },
};

function driftAuthHeaders() {
  const token = localStorage.getItem(DRIFT_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// SPOTS：初始為硬編 fallback，loadSpots() 會嘗試從 /api/drift/spots 抓真實資料覆蓋
let SPOTS = [
  { id:'f01', type:'food', cat:'早餐', name:'鼎灣米糕', area:'湖西', rating:3, price:'$', note:'筒仔米糕配半熟蛋，6點開到中午。在地人私藏，民宿附近，蛋餅也可以嘗試。', feature:'筒仔米糕、半熟蛋', tags:['#早餐','#在地日常','#銅板'], nearby:true, lat:23.5863, lng:119.6489, status:'open', expertReviews:[] },
  { id:'f02', type:'food', cat:'早餐', name:'中美早餐', area:'白沙', rating:3, price:'$', note:'走北環時推薦一併安排。手作煎餃和潤餅皮蛋餅值得一試。', feature:'手作煎餃、潤餅蛋餅', tags:['#早餐','#北環','#銅板'], lat:23.6354, lng:119.5820, status:'open', expertReviews:[] },
  { id:'f03', type:'food', cat:'早餐', name:'新海濱小吃部', area:'湖西', rating:2, price:'$', note:'去湖西玩可繞道，在機場附近。韭菜包加自製辣椒醬值得一試，8:30常賣完。', feature:'韭菜包、自製辣椒醬', tags:['#早餐','#在地日常'], lat:23.5700, lng:119.6280, status:'open', expertReviews:[] },
  { id:'f04', type:'food', cat:'早餐', name:'鐘記燒餅', area:'馬公', rating:3, price:'$', note:'甕烤燒餅皮薄酥脆，干貝蔥蛋是招牌。旺季排隊人潮極多，想吃請設鬧鐘早起！', feature:'甕烤燒餅、干貝蔥蛋', tags:['#早餐','#排隊','#在地人愛','#銅板'], lat:23.5680, lng:119.5835, status:'open', expertReviews:[{ author:'雫編', note:'澎湖人的靈魂早餐，不誇張。干貝蔥蛋夾油條，配一杯紙豆漿，一早就會很幸福。' }] },
  { id:'f05', type:'food', cat:'早餐', name:'二信飯糰', area:'馬公', rating:3, price:'$', note:'紫米白糯米雙色飯糰，5:30開賣。早去才有，賣完收攤。', feature:'雙色飯糰', tags:['#早餐','#銅板','#限量'], lat:23.5668, lng:119.5818, status:'open', expertReviews:[] },
  { id:'f06', type:'food', cat:'早餐', name:'北新橋牛雜湯', area:'馬公', rating:3, price:'$', note:'50年老店，牛雜湯和包子是招牌。11點前售完，目前僅外帶。', feature:'牛雜湯、包子', tags:['#早餐','#老店','#銅板','#限量'], lat:23.5672, lng:119.5825, status:'open', expertReviews:[] },
  { id:'f07', type:'food', cat:'早餐', name:'蔬脆蛋餅', area:'馬公', rating:3, price:'$', note:'澎湖在地蛋餅，個人比蔥油餅更推，口味清爽不油膩。', feature:'澎湖在地蛋餅', tags:['#早餐','#在地日常','#銅板'], lat:23.5675, lng:119.5815, status:'open', expertReviews:[] },
  { id:'f08', type:'food', cat:'早餐', name:'小郵局蔥油餅', area:'馬公', rating:2, price:'$', note:'現炸蔥油餅，知名但個人更推蔬脆蛋餅。', feature:'現炸蔥油餅', tags:['#早餐','#排隊','#銅板'], lat:23.5674, lng:119.5826, status:'open', expertReviews:[] },
  { id:'f09', type:'food', cat:'小吃', name:'外垵刈包', area:'西嶼', rating:2, price:'$', note:'黑糖饅頭夾爌肉，旁邊有海景加分。開到傍晚。', feature:'黑糖饅頭刈包', tags:['#小吃','#海景','#銅板'], lat:23.5660, lng:119.4520, status:'open', expertReviews:[] },
  { id:'f10', type:'food', cat:'小吃', name:'老李胡椒餅', area:'馬公', rating:2, price:'$', note:'澎湖唯一炭火胡椒餅，老麵發酵，下午茶才開，觀光客少知道的隱藏版。', feature:'炭火胡椒餅', tags:['#小吃','#隱藏版','#銅板'], lat:23.5675, lng:119.5820, status:'open', expertReviews:[] },
  { id:'f11', type:'food', cat:'小吃', name:'阿豹大腸包小腸', area:'馬公', rating:2, price:'$', note:'馬公必吃小吃，兩家都推薦，可以都試試。', feature:'大腸包小腸', tags:['#小吃','#銅板'], lat:23.5671, lng:119.5820, status:'open', expertReviews:[] },
  { id:'f12', type:'food', cat:'小吃', name:'花媽大腸包小腸', area:'馬公', rating:2, price:'$', note:'和阿豹是馬公大腸包小腸雙雄，各有擁護者。', feature:'大腸包小腸', tags:['#小吃','#銅板'], lat:23.5673, lng:119.5822, status:'open', expertReviews:[] },
  { id:'f13', type:'food', cat:'小吃', name:'洪家炸粿', area:'湖西', rating:2, price:'$', note:'整枝蝦子加蚵仔現炸，真材實料。民宿附近。', feature:'蝦子蚵仔炸粿', tags:['#小吃','#銅板','#炸粿'], nearby:true, lat:23.5840, lng:119.6510, status:'open', expertReviews:[] },
  { id:'f14', type:'food', cat:'小吃', name:'湖西炸粿', area:'湖西', rating:2, price:'$', note:'湖西在地炸粿，不定時出攤，遇到就是緣分。', feature:'炸粿', tags:['#小吃','#隱藏版','#銅板'], nearby:true, lat:23.5830, lng:119.6520, status:'irregular', expertReviews:[] },
  { id:'f15', type:'food', cat:'小吃', name:'借東風麻辣燙', area:'馬公', rating:3, price:'$', note:'湯頭是亮點，清爽不油膩，很適合買來當宵夜！', feature:'麻辣燙、特色湯頭', tags:['#小吃','#宵夜','#麻辣','#銅板'], lat:23.5674, lng:119.5828, status:'open', expertReviews:[] },
  { id:'f16', type:'food', cat:'小吃', name:'仁愛路肉圓', area:'馬公', rating:2, price:'$', note:'清蒸肉圓，在地日常小吃，無店名更有味道。', feature:'清蒸肉圓', tags:['#小吃','#在地日常','#銅板'], lat:23.5678, lng:119.5838, status:'open', expertReviews:[] },
  { id:'f17', type:'food', cat:'小吃', name:'三多路肉圓', area:'馬公', rating:2, price:'$', note:'另一家清蒸肉圓，可以和仁愛路比較看看。', feature:'清蒸肉圓', tags:['#小吃','#在地日常','#銅板'], lat:23.5668, lng:119.5845, status:'open', expertReviews:[] },
  { id:'f18', type:'food', cat:'小吃', name:'香亭土魠魚羹', area:'馬公', rating:1, price:'$', note:'一碗就能感受澎湖的海味，在地文化體驗。', feature:'土魠魚羹', tags:['#小吃','#體驗','#在地特色'], lat:23.5669, lng:119.5819, status:'open', expertReviews:[] },
  { id:'f19', type:'food', cat:'海鮮餐廳', name:'新村小吃部', area:'湖西', rating:3, price:'$$', note:'最推的在地海鮮小吃部，雞油飯必點，需要提前預約。民宿附近的私藏。', feature:'雞油飯、在地海鮮', tags:['#餐廳','#在地人愛','#需預約'], nearby:true, lat:23.5880, lng:119.6500, status:'open', expertReviews:[{ author:'雫編', note:'雞油飯是靈魂，建議提前一天電話預約，不然很容易撲空。離民宿只要 5 分鐘車程。' }] },
  { id:'f20', type:'food', cat:'海鮮餐廳', name:'潮境 TideLand', area:'馬公', rating:3, price:'$$$', note:'近年超夯的無菜單料理，用料實在。記得提前訂位，等候時間長。', feature:'無菜單料理', tags:['#餐廳','#無菜單','#精緻','#需排隊'], lat:23.5690, lng:119.5855, status:'open', expertReviews:[] },
  { id:'f21', type:'food', cat:'海鮮餐廳', name:'癮餐廳', area:'馬公', rating:3, price:'$$$$', note:'澎湖精緻料理首選，每月1號開放訂位。想要最精緻的澎湖海鮮體驗，就是它了。', feature:'精緻澎湖海鮮', tags:['#餐廳','#精緻','#需預約','#必試'], lat:23.5682, lng:119.5842, status:'open', expertReviews:[] },
  { id:'f22', type:'food', cat:'海鮮餐廳', name:'阿華海鮮', area:'馬公', rating:3, price:'$$', note:'這幾年口碑很好，在地人和觀光客都愛。（確切地址確認中）', feature:'在地海鮮', tags:['#餐廳','#海鮮','#熱門'], lat:23.5678, lng:119.5832, status:'open', noLoc:true, expertReviews:[] },
  { id:'f23', type:'food', cat:'海鮮餐廳', name:'龍門海鮮', area:'湖西', rating:1, price:'$$', note:'湖西在地海鮮，想在民宿附近用餐時的選擇。', feature:'海鮮料理', tags:['#餐廳','#海鮮'], nearby:true, lat:23.5870, lng:119.6510, status:'open', expertReviews:[] },
  { id:'f24', type:'food', cat:'宵夜', name:'家家碳烤', area:'馬公', rating:2, price:'$$', note:'宵夜碳烤首選，馬公夜晚的定番。', feature:'碳烤', tags:['#宵夜','#碳烤'], lat:23.5672, lng:119.5825, status:'open', expertReviews:[] },
  { id:'f25', type:'food', cat:'宵夜', name:'阿男牛雜湯', area:'馬公', rating:2, price:'$$', note:'口味好，料偏少，老饕才懂的宵夜選擇。', feature:'牛雜湯', tags:['#宵夜','#老饕'], lat:23.5668, lng:119.5818, status:'open', expertReviews:[] },
  { id:'f26', type:'food', cat:'宵夜', name:'香格里辣', area:'馬公', rating:2, price:'$$', note:'現場吃才對味，辣得很過癮。', feature:'香辣料理', tags:['#宵夜','#辣'], lat:23.5671, lng:119.5821, status:'open', expertReviews:[] },
  { id:'f27', type:'food', cat:'咖啡甜點', name:'880咖啡', area:'馬公', rating:2, price:'$', note:'老闆 Ted 用熱情將陌生人聚成好友。有機會遇上手作野酵麵包或流心巴斯克蛋糕，請毫不猶豫點起來。', feature:'職人自烘咖啡、手作甜點', tags:['#咖啡','#銅板','#在地日常','#溫暖'], lat:23.5650, lng:119.5930, status:'open', expertReviews:[{ author:'好友 A', note:'Ted 真的超熱情，他的野酵麵包如果有的話一定要點，跟咖啡一起吃是絕配。' }] },
  { id:'f28', type:'food', cat:'咖啡甜點', name:'逸咖啡', area:'馬公', rating:2, price:'$$', note:'環境精緻，咖啡水準不錯，適合下午悠閒休息。', feature:'精緻咖啡', tags:['#咖啡','#精緻'], lat:23.5670, lng:119.5834, status:'open', expertReviews:[] },
  { id:'f29', type:'food', cat:'咖啡甜點', name:'及林春咖啡館', area:'湖西', rating:1, price:'$$', note:'在林投公園旁，景大於咖啡，適合民宿附近散步時順道坐坐。', feature:'林投公園景觀咖啡', tags:['#咖啡','#海景','#打卡'], nearby:true, lat:23.5658, lng:119.6482, status:'open', expertReviews:[] },
  { id:'f30', type:'food', cat:'咖啡甜點', name:'玉冠嫩仙草', area:'馬公', rating:3, price:'$', note:'在地老字號，觀光客和在地人都愛。仙草嫩滑，加料豐富，來澎湖必吃。', feature:'嫩仙草', tags:['#甜點','#仙草','#老字號','#銅板'], lat:23.5677, lng:119.5822, status:'open', expertReviews:[] },
  { id:'f31', type:'food', cat:'咖啡甜點', name:'易家仙人掌冰', area:'白沙', rating:3, price:'$', note:'來澎湖不吃不行的體驗。仙人掌天然清甜，一支不夠吃。通樑古榕旁邊。', feature:'仙人掌冰', tags:['#甜點','#仙人掌','#銅板','#必體驗'], lat:23.6393, lng:119.5170, status:'open', expertReviews:[] },
  { id:'f32', type:'food', cat:'咖啡甜點', name:'藍冉 Yukkuri', area:'馬公', rating:3, price:'$$', note:'澎湖日式刨冰的天花板，連續三年的私藏名單。老闆對味道層次極其精準，布丁也必點。', feature:'職人日式刨冰、手作布丁', tags:['#甜點','#刨冰','#精緻','#私藏'], lat:23.5685, lng:119.5808, status:'open', expertReviews:[{ author:'雫編', note:'真的是澎湖日式刨冰的天花板，味道極其細膩，甚至能吃出季節感。三年來年年報到。' }, { author:'好友 A', note:'那個布丁口感非常紮實，焦糖的苦甜味平衡得剛好。一個人可以吃兩碗。' }] },
  { id:'f33', type:'food', cat:'咖啡甜點', name:'二崁杏仁茶', area:'西嶼', rating:2, price:'$', note:'在二崁古厝聚落裡，唯一性強。搭配旁邊二馬豆花一起吃是最好的組合。', feature:'杏仁茶', tags:['#甜點','#古厝','#銅板','#唯一'], lat:23.6001, lng:119.4546, status:'open', expertReviews:[] },
  { id:'f34', type:'food', cat:'咖啡甜點', name:'二馬豆花', area:'西嶼', rating:2, price:'$', note:'在二崁，搭配杏仁茶是最完美的組合。', feature:'豆花', tags:['#甜點','#古厝','#銅板'], lat:23.6003, lng:119.4548, status:'open', expertReviews:[] },
  { id:'f35', type:'food', cat:'咖啡甜點', name:'hikoni甜點', area:'待確認', rating:0, price:'?', note:'業主私藏，詳細資訊整理中。', feature:'甜點', tags:['#甜點'], lat:0, lng:0, status:'tbd', noLoc:true, expertReviews:[] },
  { id:'f36', type:'food', cat:'咖啡甜點', name:'清泉豆花', area:'待確認', rating:0, price:'?', note:'業主私藏，詳細資訊整理中。', feature:'豆花', tags:['#甜點'], lat:0, lng:0, status:'tbd', noLoc:true, expertReviews:[] },
  { id:'f37', type:'food', cat:'咖啡甜點', name:'巴街湯圓', area:'待確認', rating:0, price:'?', note:'業主私藏，詳細資訊整理中。', feature:'湯圓', tags:['#甜點'], lat:0, lng:0, status:'tbd', noLoc:true, expertReviews:[] },
  { id:'f38', type:'food', cat:'咖啡甜點', name:'絇紷仙草', area:'待確認', rating:0, price:'?', note:'業主私藏，詳細資訊整理中。', feature:'仙草', tags:['#甜點','#仙草'], lat:0, lng:0, status:'tbd', noLoc:true, expertReviews:[] },
  { id:'f39', type:'food', cat:'咖啡甜點', name:'藍媽媽', area:'待確認', rating:0, price:'?', note:'業主私藏，詳細資訊整理中。', feature:'甜點', tags:['#甜點'], lat:0, lng:0, status:'tbd', noLoc:true, expertReviews:[] },
  { id:'a01', type:'attraction', cat:'景點', name:'奎壁山摩西分海', area:'湖西', rating:3, note:'退潮時海中步道浮現，可步行到對面小島，傍晚光線最美。民宿開車10分鐘。記得先查潮汐時間！', feature:'退潮步道、小島', tags:['#必去','#潮汐','#打卡'], nearby:true, lat:23.5919, lng:119.6725, status:'open', expertReviews:[{ author:'雫編', note:'傍晚退潮時去，光線灑在步道上簡直像走入另一個世界。記得先查潮汐時間！' }] },
  { id:'a02', type:'attraction', cat:'景點', name:'林投海灘', area:'湖西', rating:2, note:'距民宿6分鐘，下午夕陽可以去沙灘走走。旁邊就是及林春咖啡館，適合搭配。', feature:'沙灘、夕陽', tags:['#沙灘','#夕陽'], nearby:true, lat:23.5685, lng:119.6472, status:'open', expertReviews:[] },
  { id:'a03', type:'attraction', cat:'景點', name:'山水沙灘', area:'湖西', rating:2, note:'距民宿10分鐘，本島知名沙灘，有許多水上活動業者，可以去體驗看看。', feature:'沙灘、水上活動', tags:['#沙灘','#水上活動'], lat:23.5475, lng:119.6155, status:'open', expertReviews:[] },
  { id:'a04', type:'attraction', cat:'景點', name:'後寮天堂路', area:'白沙', rating:3, note:'延伸入海的筆直道路，退潮時海天一色，非常震撼。北環必去。', feature:'入海之路、絕景', tags:['#北環','#打卡','#必去'], lat:23.6354, lng:119.5820, status:'open', expertReviews:[] },
  { id:'a05', type:'attraction', cat:'景點', name:'通梁古榕 / 跨海大橋', area:'白沙', rating:2, note:'300年古榕盤根錯節，充滿生命力。跨海大橋連接白沙與西嶼，開車過橋本身也是一種體驗。', feature:'古榕樹、跨海大橋', tags:['#北環','#文化'], lat:23.6398, lng:119.5022, status:'open', expertReviews:[] },
  { id:'a06', type:'attraction', cat:'景點', name:'二崁聚落', area:'西嶼', rating:2, note:'保存完整的咾咕石古厝聚落，搭配二崁杏仁茶和豆花，是北環半日行程的完美組合。', feature:'咾咕石古厝', tags:['#北環','#古厝','#文化'], lat:23.6001, lng:119.4546, status:'open', expertReviews:[] },
  { id:'a07', type:'attraction', cat:'景點', name:'漁翁島燈塔', area:'西嶼', rating:2, note:'台灣最古老的燈塔之一，站在燈塔旁俯瞰整個西嶼海岸，壯觀無比。', feature:'百年燈塔', tags:['#北環','#燈塔','#打卡'], lat:23.5583, lng:119.4191, status:'open', expertReviews:[] },
  { id:'a08', type:'attraction', cat:'景點', name:'內垵遊憩區', area:'西嶼', rating:2, note:'清澈海灣，適合玩水戲沙，北環路線的中繼好去處。', feature:'清澈海灣', tags:['#北環','#沙灘','#玩水'], lat:23.5700, lng:119.4220, status:'open', expertReviews:[] },
  { id:'a09', type:'attraction', cat:'景點', name:'嵵裡沙灘', area:'馬公', rating:2, note:'南環必訪的美麗沙灘，水質清澈，相對安靜少人。', feature:'沙灘、清澈海水', tags:['#南環','#沙灘'], lat:23.5368, lng:119.6020, status:'open', expertReviews:[] },
  { id:'a10', type:'attraction', cat:'景點', name:'風櫃洞', area:'馬公', rating:2, note:'海浪打入天然玄武岩洞穴，聲音猶如天然管風琴。退潮時音效最佳。', feature:'天然海蝕洞穴、濤聲', tags:['#南環','#自然景觀'], lat:23.5280, lng:119.5580, status:'open', expertReviews:[] },
  { id:'a11', type:'attraction', cat:'景點', name:'吉貝島', area:'白沙', rating:3, note:'從赤崁搭船20分鐘，SUP、浮潛、香蕉船一次滿足。澎湖水上活動的天堂。', feature:'SUP、浮潛、水上活動', tags:['#離島','#水上活動','#必去'], lat:23.6916, lng:119.5738, status:'open', expertReviews:[],
    transport:'ferry', ferry:{ harborId:'chikan', minutes:20, note:'赤崁港搭船 20 分鐘' } },
  { id:'a12', type:'attraction', cat:'景點', name:'七美島', area:'七美', rating:3, note:'從馬公搭船約2小時，澎湖最南端的小島。雙心石滬、燈塔，值得安排一整天。', feature:'雙心石滬、燈塔', tags:['#離島','#必去'], lat:23.2108, lng:119.4445, status:'open', expertReviews:[],
    transport:'ferry', ferry:{ harborId:'nanhai', minutes:90, note:'南海遊客中心搭船 90 分鐘（或從馬公機場飛機 15 分鐘）' } },
  { id:'a14', type:'attraction', cat:'景點', name:'望安島', area:'望安', rating:2, note:'馬公搭船約50分鐘。傳統古厝保存最完整的澎湖離島，天台山可俯瞰全島。綠蠵龜保育區也在這裡，若有機會更可接著搭短程船去旁邊的將軍澳嶼。', feature:'古厝聚落、天台山、綠蠵龜', tags:['#離島','#古厝','#生態','#南海'], lat:23.3677, lng:119.5077, status:'open', expertReviews:[],
    transport:'ferry', ferry:{ harborId:'nanhai', minutes:50, note:'南海遊客中心搭船約 50 分鐘' } },
  { id:'a15', type:'attraction', cat:'景點', name:'虎井嶼', area:'馬公', rating:2, note:'馬公搭船僅20分鐘，卻像走進另一個世界。島上貓咪成群自在漫步，玄武岩石巷靜謐迷人，也是熱門浮潛景點。', feature:'貓島、玄武岩石巷、浮潛', tags:['#離島','#貓島','#浮潛','#南海'], lat:23.5358, lng:119.5028, status:'open', expertReviews:[],
    transport:'ferry', ferry:{ harborId:'nanhai', minutes:20, note:'南海遊客中心搭船約 20 分鐘' } },
  { id:'a13', type:'attraction', cat:'景點', name:'澎湖灣花火節', area:'馬公', rating:3, note:'每年約5–8月舉辦。夜晚花火倒映在海面上，是澎湖夏天最大盛事。', feature:'花火節、夜景', tags:['#活動','#季節限定','#必去'], lat:23.5642, lng:119.5785, status:'open', expertReviews:[] },
];

// ── Category icon + gradient mapping ──
// 4 種視覺類別，配雫旅色票：
//   meal    早餐/小吃/宵夜     → 暖橘漸層 + 碗
//   sea     海鮮/餐廳          → 深橘漸層 + 魚
//   cafe    咖啡/甜點          → 米黃漸層 + 杯
//   place   景點                → 海洋藍 + 海浪
const ICON_SVGS = {
  meal:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h18l-1.6 7.5A2.2 2.2 0 0 1 17.2 20H6.8a2.2 2.2 0 0 1-2.2-1.5L3 11Z"/><path d="M8 6.5C8 5.5 8.5 5 9.5 4.5"/><path d="M12 5c0-1 .5-1.7 1.5-2"/><path d="M16 6.5c0-1 .5-1.6 1.5-2"/></svg>',
  sea:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12c3-6 9-7 12-7 4 0 6 3 6 6s-2 6-6 6c-3 0-9-1-12-5Z"/><circle cx="17" cy="10.5" r="0.7" fill="currentColor"/><path d="M3 12l-2-3v6l2-3Z"/></svg>',
  cafe:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9h12v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z"/><path d="M17 11h2.2a2.3 2.3 0 0 1 0 4.6H17"/><path d="M8.5 4.5c0 1 .8 1.4.8 2.4M12 4c0 1 .8 1.4.8 2.5"/></svg>',
  place: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/></svg>',
};
const CAT_LABEL = {
  meal: 'Local Bite', sea: 'From the Sea',
  cafe: 'Coffee & Sweet', place: 'Penghu',
};

function getCategoryStyle(spot) {
  const cat = spot.cat || '';
  if (spot.type === 'attraction') return { kind: 'place', gradClass: 'cat-bg-place' };
  if (cat.includes('海鮮') || cat.includes('餐廳')) return { kind: 'sea',  gradClass: 'cat-bg-sea' };
  if (cat.includes('咖啡') || cat.includes('甜點')) return { kind: 'cafe', gradClass: 'cat-bg-cafe' };
  return { kind: 'meal', gradClass: 'cat-bg-meal' }; // 早餐 / 小吃 / 宵夜 / 預設
}

function assignGradients() {
  SPOTS.forEach((s) => {
    const sty = getCategoryStyle(s);
    s.gradClass = sty.gradClass;
    s.iconKind  = sty.kind;
  });
}
assignGradients();

// Persona data for friend reviewers
const PERSONAS = {
  '雫編': '雫旅 Drop Inn 的雫編，在澎湖生活多年，深諳在地飲食文化，選點嚴格但用心。',
  '好友 A': '常駐澎湖的美食獵人，每年至少造訪三次，口味刁鑽，擅長發掘巷弄私藏。',
};

// ── State ──────────────────────────────────────────────────────────────────
const bag = new Set();
let filteredSpots = [];
let currentFilter = '雫旅推薦';
let currentDetailId = null;
let leafletMap = null;

// ── Star rating (localStorage) ──────────────────────────────────────────────
const RATING_KEY = 'drift_ratings_v1';
function getRatings() { try { return JSON.parse(localStorage.getItem(RATING_KEY) || '{}'); } catch(e) { return {}; } }
function saveRating(spotId, stars) {
  const r = getRatings();
  if (!r[spotId]) r[spotId] = { total: 0, count: 0, mine: 0 };
  if (r[spotId].mine > 0) { r[spotId].total -= r[spotId].mine; r[spotId].count--; }
  if (stars > 0) { r[spotId].total += stars; r[spotId].count++; }
  r[spotId].mine = stars;
  localStorage.setItem(RATING_KEY, JSON.stringify(r));
}
function getAvg(spotId) {
  const r = getRatings()[spotId];
  if (!r || r.count === 0) return null;
  return { avg: Math.round(r.total / r.count * 10) / 10, count: r.count, mine: r.mine };
}

// ── Filter ─────────────────────────────────────────────────────────────────
function applyFilter(val) {
  const areas = ['馬公','湖西','白沙','西嶼','望安','七美'];
  if (val === '雫旅推薦') {
    // Spots that have a 雫編 review OR rating === 3, exclude tbd
    return SPOTS.filter(s => s.status !== 'tbd' && (
      s.rating === 3 ||
      (s.expertReviews && s.expertReviews.some(r => r.author && r.author.includes('雫編')))
    ));
  }
  if (val === '最多星星') {
    return [...SPOTS]
      .filter(s => s.status !== 'tbd' && s.rating > 0)
      .sort((a, b) => b.rating - a.rating);
  }
  if (val === '全部')          return [...SPOTS];
  if (areas.includes(val))    return SPOTS.filter(s => s.area === val);
  if (val === '景點')          return SPOTS.filter(s => s.type === 'attraction');
  return SPOTS.filter(s => s.cat === val);
}

function setFilter(val) {
  currentFilter = val;
  filteredSpots  = applyFilter(val);
  // 重置 pool，讓 assignPool 從頭填滿
  CARD_POOL.forEach(el => { el._spotIdx = null; });
  lastAssignedCentre = null;
  if (currentMode === 'map') {
    updateExploreMarkers();
  } else {
    setCurrentIndex(0);
  }
}

// ── Badge helper ───────────────────────────────────────────────────────────
// 優先看 expertReviews（hardcoded fallback 階段有資料），否則用 rating 推斷
// Phase 2 後台寫評論時，後端會在 spots API 一併回傳 hasOwnerReview，再優化
function getBadge(s) {
  if (s.expertReviews && s.expertReviews.length) {
    return s.expertReviews.some(r => r.author && r.author.includes('雫編'))
      ? '雫編私藏' : '好友推薦';
  }
  if (s.rating === 3) return '雫編私藏';
  if (s.rating === 2) return '雫編精選';
  return '探索';
}

// ── Continuous coverflow carousel ──────────────────────────────────────────
// 音樂遊戲選歌的滑順感：用一個浮點 `position` 表示「視覺中心目前對應第幾張」，
// 卡片視覺 (translate / scale / opacity / rotateY) 都從 (rawIdx - position)
// 連續插值。拖到一半時側邊卡片會「真的」漸漸放大、入框。
// 鬆手用 ease-out quint + 取樣速度推算落點 → 快滑能連跳數張、慢滑剛好一張。
//
// 循環模式：當清單長度 >= CYCLE_MIN，position 可以無限大/小，最後一張右邊
// 接到第一張。每張卡片同時記錄 `_rawIdx`（視覺位置，可為負或超過 N）和
// `_spotIdx`（內容索引，永遠在 [0, N)）— 視覺與內容分離。
const POOL_SIZE = 5;
const CYCLE_MIN = 5;         // 清單長度 >= 5 才啟用循環
const CARD_POOL = [];
let position = 0;            // float — 視覺中心對應的 rawIdx（可為負/可超界）
let velocity = 0;            // spots per ms（正值=往下一張）
let rafId = null;
let snapAnim = null;         // { startT, startPos, target, duration }
let isDragging = false;
let dragStartX = 0;
let dragStartPos = 0;
let dragSamples = [];
let lastAssignedCentre = null;

function isCyclic() {
  return filteredSpots.length >= CYCLE_MIN;
}
function wrapSpotIdx(rawIdx) {
  const N = filteredSpots.length;
  return ((rawIdx % N) + N) % N;
}

function initCardPool() {
  const container = document.getElementById('carousel-container');
  const nextBtn   = document.getElementById('next-btn');
  for (let i = 0; i < POOL_SIZE; i++) {
    const el = document.createElement('div');
    el.className = 'gallery-card';
    el._spotIdx = null;        // 內容索引，wrap 後在 [0, N)
    el._rawIdx  = null;        // 視覺位置，可為負/超界
    container.insertBefore(el, nextBtn);
    CARD_POOL.push(el);
  }
}

// 手指拖曳：移動多少像素 = 一張卡。半個 viewport 約一張，桌機封頂 360px。
function stepPx() {
  return Math.max(180, Math.min(window.innerWidth * 0.55, 360));
}

// delta = spotIdx - position（0=中央，±1=左右第一張）
function visualFor(delta) {
  const a = Math.abs(delta);
  // 水平位移：用 % 是相對卡片自身寬度，桌機手機都協調
  const tx = delta * 58;
  // 大小：柔和衰減曲線，最小 0.55
  const scale = Math.max(0.55, 1 - 0.17 * Math.pow(a, 0.92));
  // 透明度：中央 1，±1 約 0.75，±2 約 0.13，>2.4 完全隱藏
  let opacity;
  if (a < 0.001) opacity = 1;
  else if (a >= 2.4) opacity = 0;
  else opacity = Math.max(0, 1 - Math.pow(a / 2.45, 1.55));
  // 3D 傾斜：旁邊卡片往內傾
  const rotY = -Math.sign(delta) * Math.min(a * 9, 17);
  const z = Math.max(1, Math.round(100 - a * 12));
  return { tx, scale, opacity, rotY, z };
}

function fillCardContent(el, spot) {
  const tbd = spot.status === 'tbd';
  const inBag = bag.has(spot.id);
  const badge = getBadge(spot);
  const kind = spot.iconKind || 'meal';
  el.dataset.id = spot.id;
  el.innerHTML = `
    <div class="card-image">
      <div class="card-image-placeholder ${spot.gradClass || 'cat-bg-meal'}">
        <div class="cat-icon-wrap">${ICON_SVGS[kind]}</div>
        <div class="cat-label">${CAT_LABEL[kind]}</div>
      </div>
      <div class="recommender-badge">${badge}</div>
    </div>
    <div class="added-stamp">✓ 已收入</div>
    <div class="card-content">
      <div class="card-name">${spot.name}</div>
      <div class="card-tags">${spot.area}${spot.cat ? ' · ' + spot.cat : ''}</div>
      ${tbd
        ? '<div class="card-tbd-text">✦ 業主私藏，詳細資訊整理中</div>'
        : `<div class="card-quote">${spot.note}</div>`}
    </div>
    ${!tbd ? `
    <div class="actions">
      <button class="btn-solid"
        data-action="openDetail" data-id="${spot.id}">深度點評</button>
      <button class="btn-outline${inBag ? ' in-bag' : ''}"
        data-action="toggleBag" data-id="${spot.id}">
        ${inBag ? '✓ 已收入' : '＋ 收入行程'}</button>
    </div>` : ''}`;
  el.classList.toggle('in-bag', inBag);
}

// 卡片池循環復用：以 rawIdx 為基準分配，pool[ rawIdx mod POOL_SIZE ] 是該位置的卡片
// 視覺位置用 _rawIdx（可為負），內容索引用 _spotIdx（wrap 後在 [0, N)）
function assignPool() {
  const N = filteredSpots.length;
  if (!N) {
    CARD_POOL.forEach(el => {
      el._spotIdx = null; el._rawIdx = null;
      el.style.visibility = 'hidden';
    });
    lastAssignedCentre = null;
    return;
  }
  const cyclic = isCyclic();
  const centre = cyclic ? Math.round(position)
                        : Math.max(0, Math.min(N - 1, Math.round(position)));
  if (centre === lastAssignedCentre) return;
  lastAssignedCentre = centre;

  const touched = new Set();
  for (let offset = -2; offset <= 2; offset++) {
    const rawIdx = centre + offset;
    let spotIdx;
    if (cyclic) {
      spotIdx = wrapSpotIdx(rawIdx);
    } else {
      if (rawIdx < 0 || rawIdx >= N) continue;
      spotIdx = rawIdx;
    }
    const poolIdx = ((rawIdx % POOL_SIZE) + POOL_SIZE) % POOL_SIZE;
    touched.add(poolIdx);
    const el = CARD_POOL[poolIdx];
    if (el._spotIdx !== spotIdx) {
      fillCardContent(el, filteredSpots[spotIdx]);
      el._spotIdx = spotIdx;
    }
    el._rawIdx = rawIdx;
  }
  // 沒被分配的 pool slot 隱藏（非循環模式邊界）
  for (let i = 0; i < POOL_SIZE; i++) {
    if (!touched.has(i)) {
      const el = CARD_POOL[i];
      el._rawIdx = null;
      el.style.visibility = 'hidden';
    }
  }
}

function applyPool() {
  for (let i = 0; i < POOL_SIZE; i++) {
    const el = CARD_POOL[i];
    const raw = el._rawIdx;
    if (raw == null) {
      el.style.visibility = 'hidden';
      el.classList.remove('is-center');
      continue;
    }
    const delta = raw - position;
    const v = visualFor(delta);
    if (v.opacity <= 0.005) {
      el.style.visibility = 'hidden';
      el.classList.remove('is-center');
      continue;
    }
    el.style.visibility = 'visible';
    el.style.transform =
      `translate3d(${v.tx.toFixed(2)}%, 0, 0) scale(${v.scale.toFixed(3)}) rotateY(${v.rotY.toFixed(2)}deg)`;
    el.style.opacity = v.opacity.toFixed(3);
    el.style.zIndex = v.z;
    el.classList.toggle('is-center', Math.abs(delta) < 0.5);
  }
}

function setCurrentIndex(i) {
  cancelRaf();
  // 重置 pool，避免 lastAssignedCentre 短路導致殘留
  CARD_POOL.forEach(el => { el._spotIdx = null; el._rawIdx = null; });
  lastAssignedCentre = null;
  position = i;
  velocity = 0;
  assignPool();
  applyPool();
  updateNavArrows();
}

function updateNavArrows() {
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');
  if (isCyclic()) {
    // 循環模式：兩端永遠可按
    prevBtn.disabled = false;
    nextBtn.disabled = false;
  } else {
    const ci = Math.round(position);
    prevBtn.disabled = ci <= 0;
    nextBtn.disabled = ci >= filteredSpots.length - 1;
  }
}

// 強制更新所有可見卡片的內容（例如 bag 狀態改變後）
function updateCardPool() {
  const emptyEl = document.getElementById('empty-state');
  const N = filteredSpots.length;
  if (!N) {
    emptyEl.style.display = 'block';
    CARD_POOL.forEach(el => {
      el._spotIdx = null; el._rawIdx = null;
      el.style.visibility = 'hidden';
    });
    return;
  }
  emptyEl.style.display = 'none';
  // 重新填內容到目前已佔用的 slot
  for (let i = 0; i < POOL_SIZE; i++) {
    const el = CARD_POOL[i];
    if (el._spotIdx != null && el._spotIdx >= 0 && el._spotIdx < N) {
      fillCardContent(el, filteredSpots[el._spotIdx]);
    }
  }
  applyPool();
}

// ── 動畫迴圈：吸附 / 慣性 ────────────────────────────────────────────────
function cancelRaf() {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  snapAnim = null;
}

function tickSnap(now) {
  if (!snapAnim) { rafId = null; return; }
  const { startT, startPos, target, duration } = snapAnim;
  const t = Math.min(1, (now - startT) / duration);
  // ease-out quint — 漂亮的減速，沒有彈跳
  const eased = 1 - Math.pow(1 - t, 5);
  position = startPos + (target - startPos) * eased;
  assignPool();
  applyPool();
  if (t < 1) {
    rafId = requestAnimationFrame(tickSnap);
  } else {
    position = target; velocity = 0;
    snapAnim = null; rafId = null;
    assignPool(); applyPool(); updateNavArrows();
  }
}

function startSnap(target, duration) {
  cancelRaf();
  const N = filteredSpots.length;
  if (!N) return;
  // 非循環模式：clamp 到合法範圍；循環模式：target 可為任何整數
  const tgt = isCyclic() ? target : Math.max(0, Math.min(N - 1, target));
  if (Math.abs(tgt - position) < 0.0008) {
    position = tgt; velocity = 0;
    assignPool(); applyPool(); updateNavArrows();
    return;
  }
  snapAnim = { startT: performance.now(), startPos: position, target: tgt, duration };
  rafId = requestAnimationFrame(tickSnap);
}

// 由 velocity + 摩擦推算最終落點
function settle() {
  if (!filteredSpots.length) return;
  const k = 0.0055;
  const carry = velocity / k;
  let target = Math.round(position + carry);
  if (!isCyclic()) {
    target = Math.max(0, Math.min(filteredSpots.length - 1, target));
  }
  const dist = Math.abs(target - position);
  const duration = Math.max(240, Math.min(640, 280 + dist * 90));
  startSnap(target, duration);
}

function goNext() {
  const target = Math.round(position) + 1;
  if (!isCyclic() && target > filteredSpots.length - 1) return;
  startSnap(target, 340);
}
function goPrev() {
  const target = Math.round(position) - 1;
  if (!isCyclic() && target < 0) return;
  startSnap(target, 340);
}

// ── 拖曳處理 ─────────────────────────────────────────────────────────────
function shouldIgnoreDrag(target) {
  if (!target) return false;
  if (target.closest('.bottom-sheet,.map-overlay,#explore-map-wrap')) return true;
  if (target.closest('select,input,textarea,a')) return true;
  return false;
}

function dragStart(clientX, target) {
  if (currentMode === 'map') return false;
  if (shouldIgnoreDrag(target)) return false;
  cancelRaf();
  isDragging = true;
  dragStartX = clientX;
  dragStartPos = position;
  dragSamples.length = 0;
  dragSamples.push({ t: performance.now(), x: clientX });
  return true;
}

function dragMove(clientX) {
  if (!isDragging) return;
  const dx = clientX - dragStartX;
  const step = stepPx();
  let newPos = dragStartPos - dx / step;
  if (!isCyclic()) {
    const maxIdx = filteredSpots.length - 1;
    // 兩端 rubber-band：越拖越重（循環模式不需要）
    if (newPos < 0) newPos = -Math.sqrt(-newPos) * 0.5;
    else if (newPos > maxIdx) newPos = maxIdx + Math.sqrt(newPos - maxIdx) * 0.5;
  }
  position = newPos;
  dragSamples.push({ t: performance.now(), x: clientX });
  if (dragSamples.length > 6) dragSamples.shift();
  assignPool();
  applyPool();
}

function dragEnd() {
  if (!isDragging) return;
  isDragging = false;
  // 取最近 ~130ms 取樣推算速度
  const now = performance.now();
  const recent = dragSamples.filter(s => now - s.t < 130);
  let vel = 0;
  if (recent.length >= 2) {
    const first = recent[0], last = recent[recent.length - 1];
    const dt = last.t - first.t;
    if (dt > 4) {
      const step = stepPx();
      vel = -((last.x - first.x) / dt) / step;
    }
  }
  velocity = vel;
  // 幾乎沒移動 → 視為點擊，不要吸附（讓 click 事件處理）
  const totalDx = recent.length ? recent[recent.length - 1].x - recent[0].x : 0;
  if (Math.abs(totalDx) < 4 && Math.abs(vel) < 0.0006) {
    velocity = 0;
    if (Math.abs(position - Math.round(position)) > 0.001) settle();
    return;
  }
  settle();
}

// Touch
document.addEventListener('touchstart', e => {
  if (e.touches.length !== 1) return;
  dragStart(e.touches[0].clientX, e.target);
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (!isDragging || e.touches.length !== 1) return;
  dragMove(e.touches[0].clientX);
}, { passive: true });
document.addEventListener('touchend',    () => dragEnd(), { passive: true });
document.addEventListener('touchcancel', () => dragEnd(), { passive: true });

// Mouse（桌機）
(function bindMouse() {
  const carouselEl = document.getElementById('carousel-container');
  if (!carouselEl) return;
  carouselEl.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (!dragStart(e.clientX, e.target)) return;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => { if (isDragging) dragMove(e.clientX); });
  document.addEventListener('mouseup',   () => dragEnd());
  window.addEventListener('blur',         () => dragEnd());
})();

// 點旁邊的卡 → 平滑滑到那張；點中央卡 → 開詳細
(function bindClick() {
  const carouselEl = document.getElementById('carousel-container');
  if (!carouselEl) return;
  carouselEl.addEventListener('click', e => {
    if (currentMode === 'map') return;
    const card = e.target.closest('.gallery-card');
    if (!card || card._spotIdx == null) return;
    if (card.classList.contains('is-center')) {
      // 按鈕交給原本的 data-action 委派
      if (e.target.closest('[data-action]')) return;
      const spot = filteredSpots[card._spotIdx];
      if (spot && spot.status !== 'tbd') openDetail(spot.id);
      return;
    }
    // 用 _rawIdx 而非 _spotIdx：循環模式下右邊的卡片 spotIdx 可能小於目前位置，
    // 直接 snap 到 spotIdx 會反向倒帶；要 snap 到視覺位置
    const target = card._rawIdx != null ? card._rawIdx : card._spotIdx;
    startSnap(target, 360);
  });
})();

// 觸控板 / 滑鼠橫向滾輪
(function bindWheel() {
  const carouselEl = document.getElementById('carousel-container');
  if (!carouselEl) return;
  let wheelTimer = null;
  carouselEl.addEventListener('wheel', e => {
    if (currentMode === 'map') return;
    // 主要是垂直滾就讓它過
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY) * 0.5) return;
    e.preventDefault();
    cancelRaf();
    const step = stepPx();
    let newPos = position + e.deltaX / step;
    if (!isCyclic()) {
      const maxIdx = filteredSpots.length - 1;
      newPos = Math.max(0, Math.min(maxIdx, newPos));
    }
    position = newPos;
    assignPool(); applyPool();
    if (wheelTimer) clearTimeout(wheelTimer);
    wheelTimer = setTimeout(() => settle(), 90);
  }, { passive: false });
})();

window.addEventListener('resize', () => { applyPool(); });

// ── Bag (itinerary) ────────────────────────────────────────────────────────
function toggleBag(id) {
  const s = SPOTS.find(x => x.id === id);
  if (!s || s.noLoc || s.status === 'tbd') return;
  if (bag.has(id)) bag.delete(id); else bag.add(id);
  updateBagUI();
  if (currentMode === 'map') {
    updateExploreMarkers();
  } else {
    updateCardPool();
    // Auto-advance after adding
    if (bag.has(id)) {
      setTimeout(() => goNext(), 600);
    }
  }
  if (currentDetailId === id) updateDetailFooter(s);
}

function updateBagUI() {
  const n = bag.size;
  const countEl = document.getElementById('bag-count');
  const btn = document.getElementById('nav-btn');
  const drawer = document.querySelector('.itinerary-drawer');
  countEl.textContent = n;
  btn.disabled = n === 0;
  // 手機：藥丸浮現 / 收起
  if (drawer) drawer.classList.toggle('has-items', n > 0);
  // 手機：藥丸浮現時，carousel 補底部留白，避免蓋到卡片按鈕
  document.body.classList.toggle('drift-has-bag', n > 0);
  // Bump animation
  if (n > 0) {
    countEl.classList.remove('bump');
    void countEl.offsetWidth;
    countEl.classList.add('bump');
    setTimeout(() => countEl.classList.remove('bump'), 300);
  }
  driftSaveRoute();   // 每次行程變動就自動存（免費版：localStorage）
}

// ── 路線儲存（免費版：localStorage 自動存 + 分享連結）─────────────────────────
var DRIFT_ROUTE_KEY = 'drift_saved_route';
function driftSaveRoute() {
  try {
    var notesEl = document.getElementById('planNotes');
    localStorage.setItem(DRIFT_ROUTE_KEY, JSON.stringify({
      ids: [...bag],
      notes: notesEl ? notesEl.value : '',
      savedAt: Date.now()
    }));
  } catch (e) {}
}
// 還原：分享連結 ?route= 優先，否則讀本機；只加回目前仍存在、可收入的點
function driftRestoreRoute() {
  var ids = [], notes = '';
  try {
    var q = new URLSearchParams(location.search).get('route');
    if (q) ids = q.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  } catch (e) {}
  if (!ids.length) {
    try {
      var raw = localStorage.getItem(DRIFT_ROUTE_KEY);
      if (raw) { var o = JSON.parse(raw); ids = o.ids || []; notes = o.notes || ''; }
    } catch (e) {}
  }
  if (!ids.length) return;
  ids.forEach(function (id) {
    var s = SPOTS.find(function (x) { return x.id === id; });
    if (s && !s.noLoc && s.status !== 'tbd') bag.add(id);
  });
  var notesEl = document.getElementById('planNotes');
  if (notesEl && notes) notesEl.value = notes;
  updateBagUI();
  if (currentMode === 'map') updateExploreMarkers(); else updateCardPool();
}
// 分享路線：把收藏的點編成網址，複製給客人加書籤 / 傳給同行夥伴
function driftShareRoute() {
  var ids = [...bag];
  if (!ids.length) { alert('還沒有收入任何地點'); return; }
  var url = location.origin + location.pathname + '?route=' + encodeURIComponent(ids.join(','));
  var flash = function () {
    var b = document.getElementById('shareRouteBtn');
    if (!b) return;
    var t = b.textContent; b.textContent = '已複製連結 ✓';
    setTimeout(function () { b.textContent = t; }, 1800);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(flash, function () { prompt('複製這條路線連結：', url); });
  } else { prompt('複製這條路線連結：', url); }
}

// ── Detail sheet ───────────────────────────────────────────────────────────
function cardClick(id) {
  // center card click — open detail
  openDetail(id);
}

function openDetail(id) {
  const s = SPOTS.find(x => x.id === id);
  if (!s) { console.warn('[drift] openDetail: spot not found', id); return; }
  currentDetailId = id;

  const localReviews = (s.expertReviews || []).map(r => ({
    author: r.author, persona: PERSONAS[r.author] || null, note: r.note,
    isOwner: r.author === '雫編'
  }));

  _renderDetailBody(s, localReviews);
  updateDetailFooter(s);

  const navBtn = document.getElementById('detailNavBtn');
  navBtn.style.display = (s.lat && s.lng && !s.noLoc) ? '' : 'none';

  document.getElementById('detailSheet').classList.add('active');
  document.getElementById('sheetBackdrop').classList.add('active');
  document.body.style.overflow = 'hidden';

  // Async live reviews
  loadReviews(id).then(reviews => {
    if (currentDetailId !== id) return;
    if (reviews.length > 0) _renderDetailBody(s, reviews);
  });
}

function _renderDetailBody(s, reviews) {
  const id = s.id;
  const ratingData = getAvg(id);
  const avgDisplay = ratingData ? `${ratingData.avg}` : '—';
  const countDisplay = ratingData ? `${ratingData.count} 人評分` : '尚無評分';
  const myRating = ratingData ? ratingData.mine : 0;

  const ownerReview = reviews.find(r => r.isOwner);
  const friendReviews = reviews.filter(r => !r.isOwner);
  const ownerNote = ownerReview ? ownerReview.note : s.note;

  const friendHtml = (friendReviews && friendReviews.length) ? `
    <div class="friend-reviews">
      <div class="review-label">好友評論</div>
      ${friendReviews.map(r => `
        <div class="friend-card">
          <span class="friend-author"
            data-action="showPersonaBubble" data-persona="${esc(r.persona||'')}"
          >${esc(r.author)}</span>
          <div class="friend-note">「 ${esc(r.note)} 」</div>
        </div>`).join('')}
    </div>` : '';

  const mapsHtml = (s.lat && s.lng && !s.noLoc)
    ? `<a class="maps-link" href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}" target="_blank" rel="noopener">在 Google Maps 查看 ↗</a>`
    : '';

  const featureHtml = s.feature
    ? `<div class="features-section">
        <div class="review-label">招牌推薦</div>
        <div class="feature-chips">${s.feature.split('、').map(f => `<span class="feature-chip">${f}</span>`).join('')}</div>
      </div>`
    : '';

  // Hero 區：Phase 4 接 R2 後改成 <img src="${s.heroPhoto}">；目前先放佔位
  const heroHtml = s.heroPhoto
    ? `<div class="detail-hero" style="background:#000;padding:0;"><img src="${esc(s.heroPhoto)}" alt="${esc(s.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:14px;"></div>`
    : `<div class="detail-hero">${esc(s.name)} · 照片未來會放這</div>`;

  document.getElementById('detailBody').innerHTML = `
    ${heroHtml}
    <div class="detail-name">${s.name}</div>
    ${s.feature ? `<div class="detail-subtitle">${s.feature}</div>` : ''}
    <div class="detail-meta">
      <span class="d-chip d-area">${s.area}</span>
      <span class="d-chip d-type">${s.cat || s.type}</span>
      ${s.status === 'irregular' ? '<span class="d-chip d-irr">不定時出攤</span>' : ''}
      ${s.nearby ? '<span class="d-chip d-type">民宿附近</span>' : ''}
    </div>`;
  document.getElementById('detailBody').innerHTML += `
    <div class="review-label">雫旅簡評</div>
    <div class="review-rule"></div>
    ${ownerNote && ownerNote.length >= 30
      ? `<div class="owner-text">${ownerNote}</div>`
      : `<div class="owner-tbd"><p>✦ 深度點評撰寫中 ✦<br><span style="font-size:12px">這個地方值得一篇好文，即將完成。</span></p></div>`
    }
    ${friendHtml}
    <div class="stars-section">
      <div class="review-label">旅人評分</div>
      <div class="stars-avg-row">
        <span class="stars-avg-num">${avgDisplay}</span>
        <span class="stars-avg-denom">/ 5</span>
        <span class="stars-count">${countDisplay}</span>
      </div>
      <div class="stars-row" id="starsRow">
        ${[1,2,3,4,5].map(n => `<button class="star-btn${n <= myRating ? ' lit' : ''}" data-action="rateSpot" data-spot-id="${id}" data-stars="${n}">★</button>`).join('')}
      </div>
      <div class="stars-hint" id="starsHint">${myRating > 0 ? `你給了 ${myRating} 星 · 可重新點選` : '點擊星星評分'}</div>
    </div>
    ${featureHtml}
    ${mapsHtml}
  `;
}

function updateDetailFooter(s) {
  const btn = document.getElementById('detailRouteBtn');
  const inBag = bag.has(s.id);
  btn.textContent = inBag ? '✓ 已加入' : '加入行程';
  btn.className = 'btn-route-add' + (inBag ? ' added' : '');
  btn.disabled = !!(s.noLoc || s.status === 'tbd');

  // 導航按鈕（預設目前位置出發）：離島景點 → 改成「導航到 XX 港」
  // 副標顯示「從民宿出發」連結（點擊時改用民宿座標起點）
  const navBtn = document.getElementById('detailNavBtn');
  const subEl  = document.getElementById('detailNavSubtitleText');
  const homeLink = document.getElementById('detailNavFromHomeLink');
  const harbor = ferryHarbor(s);
  if (navBtn) {
    navBtn.textContent = harbor ? `導航到 ${harbor.name}` : '導航前往';
  }
  if (subEl) {
    // 離島景點：副標說明搭船資訊，後面接「從民宿出發」連結
    subEl.textContent = harbor
      ? `開車到港口再搭船約 ${s.ferry.minutes} 分鐘 · `
      : '';
  }
  if (homeLink) {
    homeLink.style.display = '';
  }
}

function toggleFromDetail() {
  if (currentDetailId) toggleBag(currentDetailId);
}

function navigateTo(opts) {
  opts = opts || {};
  const s = SPOTS.find(x => x.id === currentDetailId);
  if (!s || !s.lat || !s.lng) return;
  // 離島景點：實際導航目標改成港口；使用者下船後再走
  const harbor = ferryHarbor(s);
  const dest = harbor || s;
  const params = new URLSearchParams({
    api: '1',
    destination: `${dest.lat},${dest.lng}`,
  });
  if (!opts.useCurrentLocation) {
    params.append('origin', `${HOME.lat},${HOME.lng}`);
  }
  window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank');
}

function closeDetail() {
  document.getElementById('detailSheet').classList.remove('active');
  document.getElementById('sheetBackdrop').classList.remove('active');
  document.body.style.overflow = '';
  currentDetailId = null;
  hidePersonaBubble();
}

// ── Star rating ────────────────────────────────────────────────────────────
function rateSpot(spotId, stars) {
  // 點同顆星 → 取消評分
  const prev = getAvg(spotId);
  const prevMine = prev ? prev.mine : 0;
  const newStars = (prevMine === stars) ? 0 : stars;

  saveRating(spotId, newStars);
  const ratingData = getAvg(spotId);
  const row = document.getElementById('starsRow');
  if (row) row.querySelectorAll('.star-btn').forEach((btn, i) => btn.classList.toggle('lit', i < newStars));
  const avgEl = document.querySelector('.stars-avg-num');
  const countEl = document.querySelector('.stars-count');
  const hintEl = document.getElementById('starsHint');
  if (avgEl) avgEl.textContent = ratingData ? ratingData.avg : '—';
  if (countEl) countEl.textContent = ratingData ? ratingData.count + ' 人評分' : '尚無評分';
  if (hintEl) {
    hintEl.textContent = newStars > 0 ? `你給了 ${newStars} 星 · 可重新點選` : '點擊星星評分';
  }
}

// ── Persona bubble ─────────────────────────────────────────────────────────
let _personaBubble = null;
function showPersonaBubble(el, persona) {
  if (!persona) return;
  hidePersonaBubble();
  const bubble = document.createElement('div');
  bubble.className = 'persona-bubble';
  bubble.textContent = persona;
  document.body.appendChild(bubble);
  _personaBubble = bubble;
  const rect = el.getBoundingClientRect();
  const bw = 240;
  let left = rect.left;
  if (left + bw > window.innerWidth - 12) left = window.innerWidth - bw - 12;
  if (left < 12) left = 12;
  bubble.style.left = left + 'px';
  bubble.style.top = (rect.bottom + 10) + 'px';
  requestAnimationFrame(() => bubble.classList.add('visible'));
  setTimeout(hidePersonaBubble, 3200);
}
function hidePersonaBubble() {
  if (_personaBubble) { _personaBubble.remove(); _personaBubble = null; }
}
document.addEventListener('click', function(e) {
  if (_personaBubble && !e.target.classList.contains('friend-author')) hidePersonaBubble();
});

// ── Worker reviews loader ──────────────────────────────────────────────────
const _reviewsCache = {};
async function loadReviews(spotId) {
  if (_reviewsCache[spotId]) return _reviewsCache[spotId];
  try {
    const res = await fetch('/api/drift/reviews?spotId=' + encodeURIComponent(spotId), {
      headers: driftAuthHeaders()
    });
    const data = await res.json();
    if (data.success && Array.isArray(data.reviews)) {
      _reviewsCache[spotId] = data.reviews;
      return data.reviews;
    }
  } catch(e) { /* fallback to local */ }
  return [];
}

// ── Plan sheet ─────────────────────────────────────────────────────────────
function showPlanSheet() {
  renderPlanList();
  document.getElementById('planSheet').classList.add('active');
  document.getElementById('sheetBackdrop').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function hidePlanSheet() {
  document.getElementById('planSheet').classList.remove('active');
  document.getElementById('sheetBackdrop').classList.remove('active');
  document.body.style.overflow = '';
}

function renderPlanList() {
  const spots = SPOTS.filter(s => bag.has(s.id));
  const el = document.getElementById('planList');
  if (!spots.length) {
    el.innerHTML = '<div class="plan-empty">還沒有收入任何地點</div>';
    return;
  }
  const { route, ferrySpots } = optimize(spots);
  // 離島景點顯示在最上方（特殊卡片），本島景點依路線順序編號
  const ferryHtml = ferrySpots.map(f => `
    <div class="plan-item plan-item-ferry">
      <div class="plan-num" style="background:#486890;display:flex;align-items:center;justify-content:center;"><svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="#f5f1ec" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 5 L2 2 L4 5 L6 2 L8 5 L10 2 L14 5"/><path d="M0 8.5 L2 6 L4 8.5 L6 6 L8 8.5 L10 6 L14 8.5"/></svg></div>
      <div class="plan-info">
        <div class="plan-iname">${esc(f.spot.name)}</div>
        <div class="plan-iarea">全日行程 · ${f.harbor ? f.harbor.name + ' 搭船 ' + f.ferryMin + ' 分鐘' : f.spot.area}</div>
      </div>
      <button class="plan-remove" data-action="removeFromPlan" data-id="${f.spot.id}">×</button>
    </div>`).join('');
  const mainHtml = route.map((r, i) => `
    <div class="plan-item">
      <div class="plan-num">${i + 1}</div>
      <div class="plan-info">
        <div class="plan-iname">${esc(r.spot.name)}</div>
        <div class="plan-iarea">${esc(r.spot.area)}${r.spot.cat ? ' · ' + esc(r.spot.cat) : ''}</div>
      </div>
      <button class="plan-remove" data-action="removeFromPlan" data-id="${r.spot.id}">×</button>
    </div>`).join('');
  el.innerHTML = ferryHtml + mainHtml;
}

function removeFromPlan(id) {
  bag.delete(id);
  updateBagUI();
  updateCardPool();
  renderPlanList();
  if (bag.size === 0) hidePlanSheet();
}

function clearPlan() {
  bag.clear();
  updateBagUI();
  updateCardPool();
  hidePlanSheet();
}

function closeAllSheets() {
  hidePlanSheet();
  closeDetail();
}

// ── Navigation ─────────────────────────────────────────────────────────────
function startNavigation() {
  const spots = SPOTS.filter(s => bag.has(s.id) && s.lat && s.lng);
  if (!spots.length) return;
  const { route } = optimize(spots);
  // 離島景點已從路線排除，只導航本島景點
  if (!route.length) return;
  const wp = route.map(r => `${r.spot.lat},${r.spot.lng}`).join('/');
  window.open(`https://www.google.com/maps/dir/${HOME.lat},${HOME.lng}/${wp}`, '_blank');
}

function showRouteMap() {
  hidePlanSheet();
  const spots = SPOTS.filter(s => bag.has(s.id));
  if (!spots.length) return;
  document.getElementById('mapOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  const { route, ferrySpots } = optimize(spots);
  setTimeout(() => buildMap(route, ferrySpots), 60);
  buildRoutePanel(route, ferrySpots);
  // Google Maps 只含本島景點（離島無法開車導航）
  const wp = route.map(r => `${r.spot.lat},${r.spot.lng}`).join('/');
  const gmLink = document.getElementById('gmapsLink');
  if (route.length) {
    gmLink.href = `https://www.google.com/maps/dir/${HOME.lat},${HOME.lng}/${wp}`;
    gmLink.style.display = '';
  } else {
    gmLink.style.display = 'none';
  }
}

function hideRouteMap() {
  document.getElementById('mapOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ── Route algo ─────────────────────────────────────────────────────────────
function dist(a, b) {
  const R = 6371, dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
// 取得 ferry 景點對應的港口物件
function ferryHarbor(spot) {
  if (!spot || spot.transport !== 'ferry' || !spot.ferry) return null;
  return HARBORS[spot.ferry.harborId] || null;
}
// 駕車分鐘數估算：45 km/h，最少 3 分鐘
function driveMin(km) { return Math.max(3, Math.ceil(km / 0.45)); }

// optimize：把 ferry 離島景點獨立出來（全日行程，不納入路線算法）。
// 本島景點做 nearest-neighbor；ferry 景點只記錄搭船資訊。
// 回傳：{
//   route:      [{ spot, kind:'drive', km, min }]  ← 本島景點路線
//   ferrySpots: [{ spot, harbor, ferryMin, ferryNote, driveKm, driveMin }]  ← 離島
// }
function optimize(spots) {
  const ferrySpots = [];
  const mainlandSpots = [];
  spots.forEach(s => {
    if (s.transport === 'ferry') ferrySpots.push(s);
    else mainlandSpots.push(s);
  });

  // ferry 景點：只算從民宿到港口的開車距離作為參考
  const ferryEntries = ferrySpots.map(s => {
    const harbor = ferryHarbor(s);
    const driveKm = harbor ? dist(HOME, harbor) : 0;
    return {
      spot: s,
      harbor,
      ferryMin: s.ferry.minutes,
      ferryNote: s.ferry.note,
      driveKm,
      driveMin: driveMin(driveKm),
    };
  });

  // 本島景點：nearest-neighbor 排序
  const route = [];
  let cur = HOME;
  let rem = [...mainlandSpots];
  while (rem.length) {
    let pick = null, pickKm = Infinity;
    rem.forEach(s => {
      const km = dist(cur, s);
      if (km < pickKm) { pickKm = km; pick = s; }
    });
    route.push({ spot: pick, kind: 'drive', km: pickKm, min: driveMin(pickKm) });
    cur = pick;
    rem = rem.filter(s => s.id !== pick.id);
  }

  return { route, ferrySpots: ferryEntries };
}

// ── Leaflet map ────────────────────────────────────────────────────────────
function buildMap(route, ferrySpots) {
  ferrySpots = ferrySpots || [];
  if (!leafletMap) {
    leafletMap = L.map('map', { zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OSM</a>'
    }).addTo(leafletMap);
    L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);
  } else {
    leafletMap.eachLayer(l => { if (!(l instanceof L.TileLayer)) leafletMap.removeLayer(l); });
  }
  // 民宿（出發點）
  L.marker([HOME.lat, HOME.lng], { icon: L.divIcon({
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#1a1210;display:flex;align-items:center;justify-content:center;color:#f5f1ec;font-size:11px;box-shadow:0 2px 10px rgba(0,0,0,.3)">雫</div>`,
    className: '', iconSize: [30, 30], iconAnchor: [15, 15]
  }) }).addTo(leafletMap).bindPopup('<strong>雫旅 Drop Inn</strong>');

  // 本島路線：依序連線（drive 虛線）
  let cur = [HOME.lat, HOME.lng];
  const allPts = [cur];

  route.forEach((r, i) => {
    L.polyline([cur, [r.spot.lat, r.spot.lng]], { color: '#8a7868', weight: 2, opacity: 0.65, dashArray: '6 6' }).addTo(leafletMap);
    allPts.push([r.spot.lat, r.spot.lng]);
    cur = [r.spot.lat, r.spot.lng];
    L.marker([r.spot.lat, r.spot.lng], { icon: L.divIcon({
      html: `<div style="width:30px;height:30px;border-radius:50%;background:#8a7868;display:flex;align-items:center;justify-content:center;color:#f5f1ec;font-family:'Cormorant Garamond',serif;font-size:15px;box-shadow:0 2px 10px rgba(0,0,0,.3)">${i + 1}</div>`,
      className: '', iconSize: [30, 30], iconAnchor: [15, 15]
    }) }).addTo(leafletMap).bindPopup(`<strong>${esc(r.spot.name)}</strong><br>${esc(r.spot.area)}`);
  });

  // 離島景點：只顯示港口 ⚓ 和島嶼位置（虛線相連），不納入本島路線
  const seenHarbors = new Set();
  ferrySpots.forEach(f => {
    const h = f.harbor;
    if (h && !seenHarbors.has(h.id)) {
      seenHarbors.add(h.id);
      allPts.push([h.lat, h.lng]);
      L.marker([h.lat, h.lng], { icon: L.divIcon({
        html: `<div style="width:26px;height:26px;border-radius:50%;background:#486890;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.3)"><svg width="11" height="14" viewBox="0 0 11 14" fill="none"><path d="M5.5 1C3.015 1 1 3.015 1 5.5c0 3.375 4.5 7.5 4.5 7.5s4.5-4.125 4.5-7.5C10 3.015 7.985 1 5.5 1z" stroke="#f5f1ec" stroke-width="1.2" fill="rgba(245,241,236,0.15)"/><circle cx="5.5" cy="5.2" r="1.5" fill="#f5f1ec"/></svg></div>`,
        className: '', iconSize: [26, 26], iconAnchor: [13, 13]
      }) }).addTo(leafletMap).bindPopup(`<strong>${esc(h.name)}</strong><br>渡輪搭乘點`);
    }
    // 港口 → 島：淡藍虛線（僅示意，非導航路線）
    if (h && f.spot.lat && f.spot.lng) {
      L.polyline([[h.lat, h.lng], [f.spot.lat, f.spot.lng]], {
        color: '#486890', weight: 2, opacity: 0.45, dashArray: '3 9'
      }).addTo(leafletMap);
      allPts.push([f.spot.lat, f.spot.lng]);
      L.marker([f.spot.lat, f.spot.lng], { icon: L.divIcon({
        html: `<div style="width:26px;height:26px;border-radius:50%;background:#486890;display:flex;align-items:center;justify-content:center;color:#f5f1ec;font-size:11px;letter-spacing:0;box-shadow:0 2px 10px rgba(0,0,0,.25)">島</div>`,
        className: '', iconSize: [26, 26], iconAnchor: [13, 13]
      }) }).addTo(leafletMap).bindPopup(`<strong>${esc(f.spot.name)}</strong><br>搭船約 ${f.ferryMin} 分鐘`);
    }
  });

  leafletMap.fitBounds(L.latLngBounds(allPts), { padding: [36, 36] });
  leafletMap.invalidateSize();
}

function buildRoutePanel(route, ferrySpots) {
  ferrySpots = ferrySpots || [];
  const totalDriveKm = route.reduce((s, r) => s + r.km, 0);
  const summaryParts = route.length ? [`本島 ${route.length} 站`, `開車約 ${totalDriveKm.toFixed(1)} km`] : [];

  // 離島提醒卡（顯示在最上方）
  const ferrySection = ferrySpots.length ? `
    <div style="margin-bottom:14px;background:rgba(72,104,144,0.08);border:1px solid rgba(72,104,144,0.2);border-radius:12px;padding:12px 14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;"><span style="display:inline-flex;align-items:center;gap:5px;background:#486890;color:#f5f1ec;padding:3px 9px;border-radius:20px;font-size:10px;letter-spacing:0.08em;"><svg width="12" height="9" viewBox="0 0 15 11" fill="none" stroke="#f5f1ec" stroke-width="1.8" stroke-linecap="round"><path d="M0 1.5 Q1.9 0 3.75 1.5 Q5.6 3 7.5 1.5 Q9.4 0 11.25 1.5 Q13.1 3 15 1.5"/><path d="M0 5.5 Q1.9 4 3.75 5.5 Q5.6 7 7.5 5.5 Q9.4 4 11.25 5.5 Q13.1 7 15 5.5"/><path d="M0 9.5 Q1.9 8 3.75 9.5 Q5.6 11 7.5 9.5 Q9.4 8 11.25 9.5 Q13.1 11 15 9.5"/></svg>離島行程</span><span style="font-size:10.5px;color:#486890;letter-spacing:0.06em;">— 請獨立安排整天</span></div>
      ${ferrySpots.map(f => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 0;border-top:1px solid rgba(72,104,144,0.12);">
          <div style="width:24px;height:24px;border-radius:50%;background:#486890;flex-shrink:0;display:flex;align-items:center;justify-content:center;"><svg width="10" height="13" viewBox="0 0 11 14" fill="none"><path d="M5.5 1C3.015 1 1 3.015 1 5.5c0 3.375 4.5 7.5 4.5 7.5s4.5-4.125 4.5-7.5C10 3.015 7.985 1 5.5 1z" stroke="#f5f1ec" stroke-width="1.2" fill="rgba(245,241,236,0.15)"/><circle cx="5.5" cy="5.2" r="1.5" fill="#f5f1ec"/></svg></div>
          <div style="flex:1;">
            <div style="font-size:13px;color:#2a3a4a;letter-spacing:0.04em;">${esc(f.spot.name)}</div>
            <div style="font-size:11px;color:#486890;margin-top:2px;">
              從 ${f.harbor ? esc(f.harbor.name) : '碼頭'} 搭船約 ${f.ferryMin} 分鐘
            </div>
            <div style="font-size:10.5px;color:#6b7a8a;margin-top:1px;">船班有限，建議提前查詢時刻表</div>
          </div>
        </div>`).join('')}
    </div>` : '';

  // 本島路線
  const mainRoute = route.length ? `
    <div class="route-item"><div class="route-dot dot-home">雫</div><div class="route-info"><div class="route-name">雫旅 Drop Inn</div><div class="route-sub">出發點 · 湖西鄉成功村</div></div></div>
    ${route.map((r, i) => `
      <div class="drive-line">↓ 開車約 ${r.min} 分鐘（${r.km.toFixed(1)} km）</div>
      <div class="route-item">
        <div class="route-dot dot-stop">${i + 1}</div>
        <div class="route-info">
          <div class="route-name">${esc(r.spot.name)}</div>
          <div class="route-sub">${esc(r.spot.area)}${r.spot.feature ? ' · ' + esc(r.spot.feature) : ''}</div>
        </div>
      </div>`).join('')}
    <div class="route-summary">${summaryParts.join(' · ')}</div>` :
    (ferrySpots.length ? '<div style="font-size:11px;color:var(--muted);text-align:center;padding:8px 0 4px;letter-spacing:0.06em;">行程中無其他本島景點</div>' : '');

  document.getElementById('routePanel').innerHTML = ferrySection + mainRoute;
}

// ── Explore Map Mode ───────────────────────────────────────────────────────
let exploreMap = null;
let exploreMarkersLayer = null;
let gpsMarker = null;
let currentMode = 'card';

function setMode(mode) {
  currentMode = mode;
  var carouselEl = document.getElementById('carousel-container');
  var mapWrap    = document.getElementById('explore-map-wrap');
  document.querySelectorAll('.mode-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  if (mode === 'map') {
    carouselEl.style.display = 'none';
    mapWrap.classList.add('active');
    initExploreMap();
    updateExploreMarkers();
  } else {
    carouselEl.style.display = '';
    mapWrap.classList.remove('active');
    updateCardPool();
    updateNavArrows();
  }
}

function initExploreMap() {
  if (exploreMap) { exploreMap.invalidateSize(); return; }
  exploreMap = L.map('explore-map', { zoomControl: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OSM</a>'
  }).addTo(exploreMap);
  L.control.zoom({ position: 'bottomright' }).addTo(exploreMap);
  exploreMarkersLayer = L.layerGroup().addTo(exploreMap);
  exploreMap.setView([23.565, 119.560], 12);
}

function _spotMarkerIcon(spot) {
  var inBag  = bag.has(spot.id);
  var isFood = spot.type === 'food';
  var bg     = inBag ? '#8a7868'
             : isFood ? 'rgba(245,241,236,0.92)' : 'rgba(245,241,236,0.92)';
  var border = inBag ? '#8a7868'
             : isFood ? 'rgba(184,121,90,0.65)' : 'rgba(107,95,86,0.55)';
  var glyph  = inBag ? '✓'
             : isFood ? '食' : '景';
  var glyphColor = inBag ? '#f5f1ec' : isFood ? '#8a7868' : '#6b5f56';
  return L.divIcon({
    html: '<div style="width:30px;height:30px;border-radius:50%;background:' + bg +
          ';border:1.5px solid ' + border +
          ';display:flex;align-items:center;justify-content:center;' +
          'color:' + glyphColor + ';font-size:11px;font-family:\'Noto Serif TC\',serif;' +
          'box-shadow:0 2px 8px rgba(26,18,16,0.13);letter-spacing:0">' + glyph + '</div>',
    className: '', iconSize: [30, 30], iconAnchor: [15, 15]
  });
}

function updateExploreMarkers() {
  if (!exploreMap || !exploreMarkersLayer) return;
  exploreMarkersLayer.clearLayers();

  // Home marker
  L.marker([HOME.lat, HOME.lng], { icon: L.divIcon({
    html: '<div style="width:32px;height:32px;border-radius:50%;background:#1a1210;display:flex;align-items:center;justify-content:center;color:#f5f1ec;font-family:\'Cormorant Garamond\',serif;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.25)">雫</div>',
    className: '', iconSize: [32, 32], iconAnchor: [16, 16]
  }) }).addTo(exploreMarkersLayer)
    .bindTooltip('雫旅 Drop Inn', { className: 'drift-tip', direction: 'top', offset: [0, -18] });

  filteredSpots.forEach(function(spot) {
    if (!spot.lat || !spot.lng || spot.lat === 0 || spot.noLoc) return;
    L.marker([spot.lat, spot.lng], { icon: _spotMarkerIcon(spot) })
      .addTo(exploreMarkersLayer)
      .bindTooltip(spot.name + '<br><span style="opacity:.65;font-size:10px">' + spot.area + (spot.cat ? ' · ' + spot.cat : '') + '</span>',
        { className: 'drift-tip', direction: 'top', offset: [0, -18] })
      .on('click', (function(id) { return function() { openDetail(id); }; })(spot.id));
  });
}

function locateUser() {
  if (!exploreMap || !navigator.geolocation) return;
  var btn = document.getElementById('gps-btn');
  if (btn) btn.classList.add('locating');
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      if (gpsMarker) exploreMap.removeLayer(gpsMarker);
      gpsMarker = L.marker([lat, lng], { icon: L.divIcon({
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#4a8fe8;border:2px solid #fff;box-shadow:0 0 0 5px rgba(74,143,232,0.2)"></div>',
        className: '', iconSize: [14, 14], iconAnchor: [7, 7]
      }) }).addTo(exploreMap);
      exploreMap.setView([lat, lng], 14);
      if (btn) btn.classList.remove('locating');
    },
    function() { if (btn) btn.classList.remove('locating'); },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ── Spots loader ───────────────────────────────────────────────────────────
async function loadSpots() {
  // 先用既有 SPOTS（硬編 fallback）做首次渲染，畫面立即出現
  filteredSpots = applyFilter(currentFilter);
  setCurrentIndex(0);

  // 背景嘗試從 D1 抓最新資料，若成功則覆蓋並重繪
  try {
    const res = await fetch('/api/drift/spots');
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && Array.isArray(data.spots) && data.spots.length > 0) {
      SPOTS = data.spots;
      assignGradients();
      filteredSpots = applyFilter(currentFilter);
      setCurrentIndex(0);
    }
  } catch (e) {
    // API 不可達 / 離線時靜默使用 fallback
    console.warn('[drift] spots API unreachable, using fallback', e);
  }
  // SPOTS 定版後，還原上次儲存的路線（或分享連結帶進來的路線）
  driftRestoreRoute();
}

// ── Event delegation (CSP-compliant replacement for dynamic onclick) ────────
// Carousel container: deep-review and add-to-bag buttons in center card
document.getElementById('carousel-container').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  var action = btn.dataset.action;
  var id = btn.dataset.id;
  if (action === 'openDetail') {
    e.stopPropagation();
    openDetail(id);
  } else if (action === 'toggleBag') {
    e.stopPropagation();
    toggleBag(id);
  }
});

// Detail sheet: star rating buttons and friend-author persona bubble
document.getElementById('detailBody').addEventListener('click', function(e) {
  var el = e.target.closest('[data-action]');
  if (!el) return;
  var action = el.dataset.action;
  if (action === 'rateSpot') {
    rateSpot(el.dataset.spotId, parseInt(el.dataset.stars, 10));
  } else if (action === 'showPersonaBubble') {
    e.stopPropagation();
    showPersonaBubble(el, el.dataset.persona || '');
  }
});

// Plan sheet: remove-from-plan buttons
document.getElementById('planList').addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action="removeFromPlan"]');
  if (!btn) return;
  removeFromPlan(btn.dataset.id);
});

// ── Init ───────────────────────────────────────────────────────────────────
initCardPool();
loadSpots();

// ── Auth event listeners ───────────────────────────────────────────────────
document.getElementById('driftCodeInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') driftDoCodeLogin(); });
document.getElementById('driftCodeBtn').addEventListener('click', function() { driftDoCodeLogin(); });
(function(){ var lo = document.getElementById('driftLogoutBtn'); if (lo) lo.addEventListener('click', function() { driftLogout(); }); })();
document.getElementById('category-select').addEventListener('change', function() { setFilter(this.value); });
document.getElementById('prev-btn').addEventListener('click', function() { goPrev(); });
document.getElementById('next-btn').addEventListener('click', function() { goNext(); });
document.getElementById('nav-btn').addEventListener('click', function() { showPlanSheet(); });
// 「從民宿出發」副標連結 → 固定以民宿座標為起點
var detailNavHomeLink = document.getElementById('detailNavFromHomeLink');
if (detailNavHomeLink) detailNavHomeLink.addEventListener('click', function(e) {
  e.preventDefault();
  e.stopPropagation();
  navigateTo({ useCurrentLocation: false });
});
document.getElementById('sheetBackdrop').addEventListener('click', function() { closeAllSheets(); });
document.getElementById('detailCloseBtn').addEventListener('click', function() { closeDetail(); });
// 主按鈕「導航前往」→ 預設目前位置出發（更直覺：客人人在路上直接導）
document.getElementById('detailNavBtn').addEventListener('click', function() { navigateTo({ useCurrentLocation: true }); });
document.getElementById('detailRouteBtn').addEventListener('click', function() { toggleFromDetail(); });
document.getElementById('planClearBtn').addEventListener('click', function() { clearPlan(); });
document.getElementById('startNavBtn').addEventListener('click', function() { startNavigation(); });
document.getElementById('showRouteMapBtn').addEventListener('click', function() { showRouteMap(); });
document.getElementById('shareRouteBtn').addEventListener('click', function() { driftShareRoute(); });
(function(){ var n = document.getElementById('planNotes'); if (n) { var t; n.addEventListener('input', function(){ clearTimeout(t); t = setTimeout(driftSaveRoute, 400); }); } })();
document.getElementById('mapBackBtn').addEventListener('click', function() { hideRouteMap(); });
document.querySelectorAll('.mode-btn').forEach(function(btn) {
  btn.addEventListener('click', function() { setMode(btn.dataset.mode); });
});
document.getElementById('gps-btn').addEventListener('click', function() { locateUser(); });

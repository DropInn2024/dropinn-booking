(function() {
  // XSS 防護：API 回傳的評論作者/內容在拼入 innerHTML 前都要過 esc()
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var STORAGE_KEY = 'drift_user_token';
  async function _driftAuth() {
    var loginId = (document.getElementById('driftLoginInput').value || '').trim();
    var password = document.getElementById('driftKeyInput').value || '';
    if (!loginId || !password) return;
    try {
      var res = await fetch('/api/drift/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: loginId, password: password })
      });
      var data = await res.json();
      if (!res.ok || !data.success || !data.token) throw new Error(data.error || 'login failed');
      localStorage.setItem(STORAGE_KEY, data.token);
      document.getElementById('driftAuthOverlay').style.display = 'none';
      document.body.style.overflow = '';
    } catch (e) {
      document.getElementById('driftAuthErr').style.display = 'block';
      document.getElementById('driftKeyInput').value = '';
      document.getElementById('driftLoginInput').focus();
    }
  }
  window._driftAuth = _driftAuth;
  var stored = localStorage.getItem(STORAGE_KEY);
  var overlay = document.getElementById('driftAuthOverlay');
  if (stored) {
    overlay.style.display = 'none';
  } else {
    overlay.style.display = 'flex';
    document.documentElement.style.visibility = 'hidden';
    window.addEventListener('DOMContentLoaded', function() {
      document.documentElement.style.visibility = '';
      if (overlay.style.display !== 'none') document.body.style.overflow = 'hidden';
      document.getElementById('driftLoginInput').focus();
    });
  }
})();
// ── Data ──────────────────────────────────────────────────────────────────
const HOME = { lat: 23.5820, lng: 119.6530, name: '雫旅 Drop Inn' };
const DRIFT_TOKEN_KEY = 'drift_user_token';

function driftAuthHeaders() {
  const token = localStorage.getItem(DRIFT_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const SPOTS = [
  { id:'f01', type:'food', cat:'早餐', name:'鼎灣米糕', area:'湖西', rating:3, price:'$', note:'筒仔米糕配半熟蛋，6點開到中午。在地人私藏，民宿附近，蛋餅也可以嘗試。', feature:'筒仔米糕、半熟蛋', tags:['#早餐','#在地日常','#銅板'], nearby:true, lat:23.5863, lng:119.6489, status:'open', expertReviews:[] },
  { id:'f02', type:'food', cat:'早餐', name:'中美早餐', area:'白沙', rating:3, price:'$', note:'走北環時推薦一併安排。手作煎餃和潤餅皮蛋餅值得一試。', feature:'手作煎餃、潤餅蛋餅', tags:['#早餐','#北環','#銅板'], lat:23.6354, lng:119.5820, status:'open', expertReviews:[] },
  { id:'f03', type:'food', cat:'早餐', name:'新海濱小吃部', area:'湖西', rating:2, price:'$', note:'去湖西玩可繞道，在機場附近。韭菜包加自製辣椒醬值得一試，8:30常賣完。', feature:'韭菜包、自製辣椒醬', tags:['#早餐','#在地日常'], lat:23.5700, lng:119.6280, status:'open', expertReviews:[] },
  { id:'f04', type:'food', cat:'早餐', name:'鐘記燒餅', area:'馬公', rating:3, price:'$', note:'甕烤燒餅皮薄酥脆，干貝蔥蛋是招牌。旺季排隊人潮極多，想吃請設鬧鐘早起！', feature:'甕烤燒餅、干貝蔥蛋', tags:['#早餐','#排隊','#在地人愛','#銅板'], lat:23.5680, lng:119.5835, status:'open', expertReviews:[{ author:'主理人', note:'澎湖人的靈魂早餐，不誇張。干貝蔥蛋夾油條，配一杯紙豆漿，一早就會很幸福。' }] },
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
  { id:'f19', type:'food', cat:'海鮮餐廳', name:'新村小吃部', area:'湖西', rating:3, price:'$$', note:'最推的在地海鮮小吃部，雞油飯必點，需要提前預約。民宿附近的私藏。', feature:'雞油飯、在地海鮮', tags:['#餐廳','#在地人愛','#需預約'], nearby:true, lat:23.5880, lng:119.6500, status:'open', expertReviews:[{ author:'主理人', note:'雞油飯是靈魂，建議提前一天電話預約，不然很容易撲空。離民宿只要 5 分鐘車程。' }] },
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
  { id:'f32', type:'food', cat:'咖啡甜點', name:'藍冉 Yukkuri', area:'馬公', rating:3, price:'$$', note:'澎湖日式刨冰的天花板，連續三年的私藏名單。老闆對味道層次極其精準，布丁也必點。', feature:'職人日式刨冰、手作布丁', tags:['#甜點','#刨冰','#精緻','#私藏'], lat:23.5685, lng:119.5808, status:'open', expertReviews:[{ author:'主理人', note:'真的是澎湖日式刨冰的天花板，味道極其細膩，甚至能吃出季節感。三年來年年報到。' }, { author:'好友 A', note:'那個布丁口感非常紮實，焦糖的苦甜味平衡得剛好。一個人可以吃兩碗。' }] },
  { id:'f33', type:'food', cat:'咖啡甜點', name:'二崁杏仁茶', area:'西嶼', rating:2, price:'$', note:'在二崁古厝聚落裡，唯一性強。搭配旁邊二馬豆花一起吃是最好的組合。', feature:'杏仁茶', tags:['#甜點','#古厝','#銅板','#唯一'], lat:23.6001, lng:119.4546, status:'open', expertReviews:[] },
  { id:'f34', type:'food', cat:'咖啡甜點', name:'二馬豆花', area:'西嶼', rating:2, price:'$', note:'在二崁，搭配杏仁茶是最完美的組合。', feature:'豆花', tags:['#甜點','#古厝','#銅板'], lat:23.6003, lng:119.4548, status:'open', expertReviews:[] },
  { id:'f35', type:'food', cat:'咖啡甜點', name:'hikoni甜點', area:'待確認', rating:0, price:'?', note:'業主私藏，詳細資訊整理中。', feature:'甜點', tags:['#甜點'], lat:0, lng:0, status:'tbd', noLoc:true, expertReviews:[] },
  { id:'f36', type:'food', cat:'咖啡甜點', name:'清泉豆花', area:'待確認', rating:0, price:'?', note:'業主私藏，詳細資訊整理中。', feature:'豆花', tags:['#甜點'], lat:0, lng:0, status:'tbd', noLoc:true, expertReviews:[] },
  { id:'f37', type:'food', cat:'咖啡甜點', name:'巴街湯圓', area:'待確認', rating:0, price:'?', note:'業主私藏，詳細資訊整理中。', feature:'湯圓', tags:['#甜點'], lat:0, lng:0, status:'tbd', noLoc:true, expertReviews:[] },
  { id:'f38', type:'food', cat:'咖啡甜點', name:'絇紷仙草', area:'待確認', rating:0, price:'?', note:'業主私藏，詳細資訊整理中。', feature:'仙草', tags:['#甜點','#仙草'], lat:0, lng:0, status:'tbd', noLoc:true, expertReviews:[] },
  { id:'f39', type:'food', cat:'咖啡甜點', name:'藍媽媽', area:'待確認', rating:0, price:'?', note:'業主私藏，詳細資訊整理中。', feature:'甜點', tags:['#甜點'], lat:0, lng:0, status:'tbd', noLoc:true, expertReviews:[] },
  { id:'a01', type:'attraction', cat:'景點', name:'奎壁山摩西分海', area:'湖西', rating:3, note:'退潮時海中步道浮現，可步行到對面小島，傍晚光線最美。民宿開車10分鐘。記得先查潮汐時間！', feature:'退潮步道、小島', tags:['#必去','#潮汐','#打卡'], nearby:true, lat:23.5919, lng:119.6725, status:'open', expertReviews:[{ author:'主理人', note:'傍晚退潮時去，光線灑在步道上簡直像走入另一個世界。記得先查潮汐時間！' }] },
  { id:'a02', type:'attraction', cat:'景點', name:'林投海灘', area:'湖西', rating:2, note:'距民宿6分鐘，下午夕陽可以去沙灘走走。旁邊就是及林春咖啡館，適合搭配。', feature:'沙灘、夕陽', tags:['#沙灘','#夕陽'], nearby:true, lat:23.5685, lng:119.6472, status:'open', expertReviews:[] },
  { id:'a03', type:'attraction', cat:'景點', name:'山水沙灘', area:'湖西', rating:2, note:'距民宿10分鐘，本島知名沙灘，有許多水上活動業者，可以去體驗看看。', feature:'沙灘、水上活動', tags:['#沙灘','#水上活動'], lat:23.5475, lng:119.6155, status:'open', expertReviews:[] },
  { id:'a04', type:'attraction', cat:'景點', name:'後寮天堂路', area:'白沙', rating:3, note:'延伸入海的筆直道路，退潮時海天一色，非常震撼。北環必去。', feature:'入海之路、絕景', tags:['#北環','#打卡','#必去'], lat:23.6354, lng:119.5820, status:'open', expertReviews:[] },
  { id:'a05', type:'attraction', cat:'景點', name:'通梁古榕 / 跨海大橋', area:'白沙', rating:2, note:'300年古榕盤根錯節，充滿生命力。跨海大橋連接白沙與西嶼，開車過橋本身也是一種體驗。', feature:'古榕樹、跨海大橋', tags:['#北環','#文化'], lat:23.6398, lng:119.5022, status:'open', expertReviews:[] },
  { id:'a06', type:'attraction', cat:'景點', name:'二崁聚落', area:'西嶼', rating:2, note:'保存完整的咾咕石古厝聚落，搭配二崁杏仁茶和豆花，是北環半日行程的完美組合。', feature:'咾咕石古厝', tags:['#北環','#古厝','#文化'], lat:23.6001, lng:119.4546, status:'open', expertReviews:[] },
  { id:'a07', type:'attraction', cat:'景點', name:'漁翁島燈塔', area:'西嶼', rating:2, note:'台灣最古老的燈塔之一，站在燈塔旁俯瞰整個西嶼海岸，壯觀無比。', feature:'百年燈塔', tags:['#北環','#燈塔','#打卡'], lat:23.5583, lng:119.4191, status:'open', expertReviews:[] },
  { id:'a08', type:'attraction', cat:'景點', name:'內垵遊憩區', area:'西嶼', rating:2, note:'清澈海灣，適合玩水戲沙，北環路線的中繼好去處。', feature:'清澈海灣', tags:['#北環','#沙灘','#玩水'], lat:23.5700, lng:119.4220, status:'open', expertReviews:[] },
  { id:'a09', type:'attraction', cat:'景點', name:'嵵裡沙灘', area:'馬公', rating:2, note:'南環必訪的美麗沙灘，水質清澈，相對安靜少人。', feature:'沙灘、清澈海水', tags:['#南環','#沙灘'], lat:23.5368, lng:119.6020, status:'open', expertReviews:[] },
  { id:'a10', type:'attraction', cat:'景點', name:'風櫃洞', area:'馬公', rating:2, note:'海浪打入天然玄武岩洞穴，聲音猶如天然管風琴。退潮時音效最佳。', feature:'天然海蝕洞穴、濤聲', tags:['#南環','#自然景觀'], lat:23.5280, lng:119.5580, status:'open', expertReviews:[] },
  { id:'a11', type:'attraction', cat:'景點', name:'吉貝島', area:'白沙', rating:3, note:'從赤崁搭船20分鐘，SUP、浮潛、香蕉船一次滿足。澎湖水上活動的天堂。', feature:'SUP、浮潛、水上活動', tags:['#離島','#水上活動','#必去'], lat:23.6916, lng:119.5738, status:'open', expertReviews:[] },
  { id:'a12', type:'attraction', cat:'景點', name:'七美島', area:'七美', rating:3, note:'從馬公搭船約2小時，澎湖最南端的小島。雙心石滬、燈塔，值得安排一整天。', feature:'雙心石滬、燈塔', tags:['#離島','#必去'], lat:23.2108, lng:119.4445, status:'open', expertReviews:[] },
  { id:'a13', type:'attraction', cat:'景點', name:'澎湖灣花火節', area:'馬公', rating:3, note:'每年約5–8月舉辦。夜晚花火倒映在海面上，是澎湖夏天最大盛事。', feature:'花火節、夜景', tags:['#活動','#季節限定','#必去'], lat:23.5642, lng:119.5785, status:'open', expertReviews:[] },
];

// Assign gradient classes
const GRAD_FOOD = ['grad-1','grad-4','grad-3','grad-2'];
const GRAD_ATTR = ['grad-2','grad-3','grad-2','grad-1'];
SPOTS.forEach((s, i) => {
  s.gradClass = s.type === 'attraction' ? GRAD_ATTR[i % 4] : GRAD_FOOD[i % 4];
});

// Persona data for friend reviewers
const PERSONAS = {
  '主理人': '雫旅 Drop Inn 的主理人，在澎湖生活多年，深諳在地飲食文化，選點嚴格但用心。',
  '好友 A': '常駐澎湖的美食獵人，每年至少造訪三次，口味刁鑽，擅長發掘巷弄私藏。',
};

// ── State ──────────────────────────────────────────────────────────────────
const bag = new Set();
let filteredSpots = [];
let currentIndex  = 0;
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
  r[spotId].total += stars; r[spotId].count++; r[spotId].mine = stars;
  localStorage.setItem(RATING_KEY, JSON.stringify(r));
}
function getAvg(spotId) {
  const r = getRatings()[spotId];
  if (!r || r.count === 0) return null;
  return { avg: Math.round(r.total / r.count * 10) / 10, count: r.count, mine: r.mine };
}

// ── Filter ─────────────────────────────────────────────────────────────────
function applyFilter(val) {
  const areas = ['馬公','湖西','白沙','西嶼','七美'];
  if (val === '雫旅推薦') {
    // Spots that have a 主理人 review OR rating === 3, exclude tbd
    return SPOTS.filter(s => s.status !== 'tbd' && (
      s.rating === 3 ||
      (s.expertReviews && s.expertReviews.some(r => r.author && r.author.includes('主理人')))
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
  currentIndex   = 0;
  updateCardPool();
  updateNavArrows();
}

// ── Badge helper ───────────────────────────────────────────────────────────
function getBadge(s) {
  if (!s.expertReviews || !s.expertReviews.length) return '探索';
  return s.expertReviews.some(r => r.author && r.author.includes('主理人'))
    ? '主理人私藏' : '好友推薦';
}

// ── Coverflow card pool (5 persistent DOM nodes) ───────────────────────────
// Slot indices: 0=far-left, 1=left, 2=center, 3=right, 4=far-right
const SLOT_CONFIG = [
  { tx: -110, scale: 0.75, opacity: 0.28, z: 4 },
  { tx: -62,  scale: 0.88, opacity: 0.60, z: 7 },
  { tx:   0,  scale: 1.02, opacity: 1,    z: 10 },
  { tx:  62,  scale: 0.88, opacity: 0.60, z: 7 },
  { tx: 110,  scale: 0.75, opacity: 0.28, z: 4 },
];
const CARD_POOL = [];

function initCardPool() {
  const container = document.getElementById('carousel-container');
  const nextBtn   = document.getElementById('next-btn');
  for (let i = 0; i < 5; i++) {
    const el = document.createElement('div');
    el.className = 'gallery-card';
    container.insertBefore(el, nextBtn);
    CARD_POOL.push(el);
  }
}

function fillCardSlot(slotIdx, spot) {
  const el  = CARD_POOL[slotIdx];
  const cfg = SLOT_CONFIG[slotIdx];
  const isCenter = slotIdx === 2;
  const tbd  = spot.status === 'tbd';
  const inBag = bag.has(spot.id);
  const badge = getBadge(spot);

  // Content
  el.className = 'gallery-card' +
    (isCenter ? ' is-center' : '') +
    (inBag ? ' in-bag' : '');
  el.dataset.id = spot.id;
  el.innerHTML = `
    <div class="card-image">
      <div class="card-image-placeholder ${spot.gradClass || 'grad-1'}"></div>
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
    ${isCenter && !tbd ? `
    <div class="actions">
      <button class="btn-solid"
        data-action="openDetail" data-id="${spot.id}">深度點評</button>
      <button class="btn-outline${inBag ? ' in-bag' : ''}"
        data-action="toggleBag" data-id="${spot.id}">
        ${inBag ? '✓ 已收入' : '＋ 收入行程'}</button>
    </div>` : ''}`;

  // Position (applied after innerHTML so browser can batch)
  el.style.cssText += `;transform:translateX(${cfg.tx}%) scale(${cfg.scale});opacity:${cfg.opacity};z-index:${cfg.z};visibility:visible;`;

  // Click handler
  el.onclick = isCenter && !tbd
    ? () => openDetail(spot.id)
    : (slotIdx < 2 ? () => goPrev() : () => goNext());
}

function updateCardPool() {
  const emptyEl = document.getElementById('empty-state');
  if (!filteredSpots.length) {
    emptyEl.style.display = 'block';
    CARD_POOL.forEach(c => { c.style.visibility = 'hidden'; });
    return;
  }
  emptyEl.style.display = 'none';

  for (let slotIdx = 0; slotIdx < 5; slotIdx++) {
    const spotIdx = currentIndex + (slotIdx - 2); // -2…+2 offset
    if (spotIdx < 0 || spotIdx >= filteredSpots.length) {
      CARD_POOL[slotIdx].style.visibility = 'hidden';
    } else {
      fillCardSlot(slotIdx, filteredSpots[spotIdx]);
    }
  }
}

function updateNavArrows() {
  document.getElementById('prev-btn').disabled = currentIndex === 0;
  document.getElementById('next-btn').disabled = currentIndex === filteredSpots.length - 1;
}

function goNext() {
  if (currentIndex >= filteredSpots.length - 1) return;
  currentIndex++;
  updateCardPool();
  updateNavArrows();
}

function goPrev() {
  if (currentIndex <= 0) return;
  currentIndex--;
  updateCardPool();
  updateNavArrows();
}

// ── Touch/swipe — real-time drag ───────────────────────────────────────────
let _tx = null;   // touchstart X
let _dragging = false;

function _setDragging(on) {
  _dragging = on;
  CARD_POOL.forEach(c => c.classList.toggle('dragging', on));
}

document.addEventListener('touchstart', e => {
  if (e.target.closest('.bottom-sheet,.map-overlay')) return;
  _tx = e.touches[0].clientX;
  _setDragging(true);
}, { passive: true });

document.addEventListener('touchmove', e => {
  if (_tx === null || !_dragging) return;
  if (e.target.closest('.bottom-sheet,.map-overlay')) return;
  const dx = e.touches[0].clientX - _tx;
  const pct = (dx / window.innerWidth) * 80; // drag coefficient
  for (let i = 0; i < 5; i++) {
    const cfg = SLOT_CONFIG[i];
    const spotIdx = currentIndex + (i - 2);
    if (spotIdx < 0 || spotIdx >= filteredSpots.length) continue;
    CARD_POOL[i].style.transform =
      `translateX(${cfg.tx + pct}%) scale(${cfg.scale})`;
  }
}, { passive: true });

document.addEventListener('touchend', e => {
  if (_tx === null) return;
  const dx = e.changedTouches[0].clientX - _tx;
  _tx = null;
  _setDragging(false);          // re-enable CSS transition
  if (Math.abs(dx) > 50) {
    if (dx < 0) goNext(); else goPrev();
  } else {
    updateCardPool();            // snap back
  }
}, { passive: true });

// ── Bag (itinerary) ────────────────────────────────────────────────────────
function toggleBag(id) {
  const s = SPOTS.find(x => x.id === id);
  if (!s || s.noLoc || s.status === 'tbd') return;
  if (bag.has(id)) bag.delete(id); else bag.add(id);
  updateBagUI();
  updateCardPool();
  if (currentDetailId === id) updateDetailFooter(s);
  // Auto-advance after adding
  if (bag.has(id)) {
    setTimeout(() => goNext(), 600);
  }
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
  // Bump animation
  if (n > 0) {
    countEl.classList.remove('bump');
    void countEl.offsetWidth;
    countEl.classList.add('bump');
    setTimeout(() => countEl.classList.remove('bump'), 300);
  }
}

// ── Detail sheet ───────────────────────────────────────────────────────────
function cardClick(id) {
  // center card click — open detail
  openDetail(id);
}

function openDetail(id) {
  const s = SPOTS.find(x => x.id === id);
  if (!s) return;
  currentDetailId = id;

  const localReviews = (s.expertReviews || []).map(r => ({
    author: r.author, persona: PERSONAS[r.author] || null, note: r.note,
    isOwner: r.author === '主理人'
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

  document.getElementById('detailBody').innerHTML = `
    <div class="detail-name">${s.name}</div>
    ${s.feature ? `<div class="detail-subtitle">${s.feature}</div>` : ''}
    <div class="detail-meta">
      <span class="d-chip d-area">${s.area}</span>
      <span class="d-chip d-type">${s.cat || s.type}</span>
      ${s.status === 'irregular' ? '<span class="d-chip d-irr">不定時出攤</span>' : ''}
      ${s.nearby ? '<span class="d-chip d-type">民宿附近</span>' : ''}
    </div>
    <div class="review-label">雫旅簡評</div>
    <div class="review-rule"></div>
    ${ownerNote && ownerNote.length > 10
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
      <div class="stars-hint" id="starsHint">${myRating > 0 ? `你給了 ${myRating} 星` : '點擊星星評分'}</div>
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
}

function toggleFromDetail() {
  if (currentDetailId) toggleBag(currentDetailId);
}

function navigateTo() {
  const s = SPOTS.find(x => x.id === currentDetailId);
  if (s && s.lat && s.lng) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`, '_blank');
  }
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
  saveRating(spotId, stars);
  const ratingData = getAvg(spotId);
  const row = document.getElementById('starsRow');
  if (row) row.querySelectorAll('.star-btn').forEach((btn, i) => btn.classList.toggle('lit', i < stars));
  const avgEl = document.querySelector('.stars-avg-num');
  const countEl = document.querySelector('.stars-count');
  const hintEl = document.getElementById('starsHint');
  if (avgEl && ratingData) avgEl.textContent = ratingData.avg;
  if (countEl && ratingData) countEl.textContent = ratingData.count + ' 人評分';
  if (hintEl) hintEl.textContent = `你給了 ${stars} 星`;
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
  const route = optimize(spots);
  el.innerHTML = route.map((r, i) => `
    <div class="plan-item">
      <div class="plan-num">${i + 1}</div>
      <div class="plan-info">
        <div class="plan-iname">${r.spot.name}</div>
        <div class="plan-iarea">${r.spot.area}${r.spot.cat ? ' · ' + r.spot.cat : ''}</div>
      </div>
      <button class="plan-remove" data-action="removeFromPlan" data-id="${r.spot.id}">×</button>
    </div>`).join('');
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
  const route = optimize(spots);
  const wp = route.map(r => `${r.spot.lat},${r.spot.lng}`).join('/');
  window.open(`https://www.google.com/maps/dir/${HOME.lat},${HOME.lng}/${wp}`, '_blank');
}

function showRouteMap() {
  hidePlanSheet();
  const spots = SPOTS.filter(s => bag.has(s.id));
  if (!spots.length) return;
  document.getElementById('mapOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  const route = optimize(spots);
  setTimeout(() => buildMap(route), 60);
  buildRoutePanel(route);
  const wp = route.map(r => `${r.spot.lat},${r.spot.lng}`).join('/');
  document.getElementById('gmapsLink').href = `https://www.google.com/maps/dir/${HOME.lat},${HOME.lng}/${wp}`;
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
function optimize(spots) {
  const route = []; let cur = HOME, rem = [...spots];
  while (rem.length) {
    let nearest, min = Infinity;
    rem.forEach(s => { const d = dist(cur, s); if (d < min) { min = d; nearest = s; } });
    route.push({ spot: nearest, km: min, min: Math.max(3, Math.ceil(min / 0.45)) });
    cur = nearest; rem = rem.filter(s => s.id !== nearest.id);
  }
  return route;
}

// ── Leaflet map ────────────────────────────────────────────────────────────
function buildMap(route) {
  if (!leafletMap) {
    leafletMap = L.map('map', { zoomControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OSM</a>'
    }).addTo(leafletMap);
    L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);
  } else {
    leafletMap.eachLayer(l => { if (!(l instanceof L.TileLayer)) leafletMap.removeLayer(l); });
  }
  L.marker([HOME.lat, HOME.lng], { icon: L.divIcon({
    html: `<div style="width:30px;height:30px;border-radius:50%;background:#1a1210;display:flex;align-items:center;justify-content:center;color:#f5f1ec;font-size:11px;box-shadow:0 2px 10px rgba(0,0,0,.3)">雫</div>`,
    className: '', iconSize: [30, 30], iconAnchor: [15, 15]
  }) }).addTo(leafletMap).bindPopup('<strong>雫旅 Drop Inn</strong>');
  route.forEach((r, i) => {
    L.marker([r.spot.lat, r.spot.lng], { icon: L.divIcon({
      html: `<div style="width:30px;height:30px;border-radius:50%;background:#b8795a;display:flex;align-items:center;justify-content:center;color:#f5f1ec;font-family:'Cormorant Garamond',serif;font-size:15px;box-shadow:0 2px 10px rgba(0,0,0,.3)">${i + 1}</div>`,
      className: '', iconSize: [30, 30], iconAnchor: [15, 15]
    }) }).addTo(leafletMap).bindPopup(`<strong>${r.spot.name}</strong><br>${r.spot.area}`);
  });
  const pts = [[HOME.lat, HOME.lng], ...route.map(r => [r.spot.lat, r.spot.lng])];
  L.polyline(pts, { color: '#b8795a', weight: 2, opacity: 0.65, dashArray: '6 6' }).addTo(leafletMap);
  leafletMap.fitBounds(L.latLngBounds(pts), { padding: [36, 36] });
  leafletMap.invalidateSize();
}

function buildRoutePanel(route) {
  const totalKm = route.reduce((s, r) => s + r.km, 0);
  document.getElementById('routePanel').innerHTML = `
    <div class="route-item"><div class="route-dot dot-home">雫</div><div class="route-info"><div class="route-name">雫旅 Drop Inn</div><div class="route-sub">出發點 · 湖西鄉成功村</div></div></div>
    ${route.map((r, i) => `
      <div class="drive-line">↓ 開車約 ${r.min} 分鐘（${r.km.toFixed(1)} km）</div>
      <div class="route-item"><div class="route-dot dot-stop">${i + 1}</div><div class="route-info"><div class="route-name">${r.spot.name}</div><div class="route-sub">${r.spot.area}${r.spot.feature ? ' · ' + r.spot.feature : ''}</div></div></div>
    `).join('')}
    <div class="route-summary">共 ${route.length} 個地點 · 總移動距離約 ${totalKm.toFixed(1)} km</div>`;
}

// ── Spots loader ───────────────────────────────────────────────────────────
async function loadSpots() {
  filteredSpots = applyFilter(currentFilter);
  updateCardPool();
  updateNavArrows();
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

// Replaced inline event handlers (CSP compliance)
document.getElementById('driftLoginInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') document.getElementById('driftKeyInput').focus(); });
document.getElementById('driftKeyInput').addEventListener('keydown', function(e) { if (e.key === 'Enter') _driftAuth(); });
document.getElementById('driftAuthBtn').addEventListener('click', function() { _driftAuth(); });
document.getElementById('category-select').addEventListener('change', function() { setFilter(this.value); });
document.getElementById('prev-btn').addEventListener('click', function() { goPrev(); });
document.getElementById('next-btn').addEventListener('click', function() { goNext(); });
document.getElementById('nav-btn').addEventListener('click', function() { showPlanSheet(); });
document.getElementById('sheetBackdrop').addEventListener('click', function() { closeAllSheets(); });
document.getElementById('detailCloseBtn').addEventListener('click', function() { closeDetail(); });
document.getElementById('detailNavBtn').addEventListener('click', function() { navigateTo(); });
document.getElementById('detailRouteBtn').addEventListener('click', function() { toggleFromDetail(); });
document.getElementById('planClearBtn').addEventListener('click', function() { clearPlan(); });
document.getElementById('startNavBtn').addEventListener('click', function() { startNavigation(); });
document.getElementById('showRouteMapBtn').addEventListener('click', function() { showRouteMap(); });
document.getElementById('mapBackBtn').addEventListener('click', function() { hideRouteMap(); });

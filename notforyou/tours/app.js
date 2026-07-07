const API = '';  // 同域
function token(){ return localStorage.getItem('nfy_token') || ''; }
async function api(method, path, body){
  const res = await fetch(API + path, {
    method,
    headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer ' + token() },
    body: body ? JSON.stringify(body) : undefined
  });
  if (res.status === 401 || res.status === 403){ showGate(); throw new Error('unauth'); }
  return res.json();
}
function money(n){ if(n==null||isNaN(n))return'—'; return 'NT$ '+Number(n).toLocaleString('en-US'); }
function showGate(){ document.getElementById('gate').style.display='block'; document.getElementById('app').style.display='none'; }
// 站內 toast（對齊 notforyou/home 標準：錯誤提示不用原生 alert；破壞性確認仍用 confirm）
function showToast(msg){
  var t = document.getElementById('nfyToast');
  if(!t){
    t = document.createElement('div'); t.id='nfyToast';
    t.style.cssText='position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#3d3733;color:#f5f1ec;padding:10px 18px;border-radius:10px;font-size:13px;letter-spacing:0.06em;z-index:999;opacity:0;transition:opacity .25s;pointer-events:none;max-width:80vw;';
    document.body.appendChild(t);
  }
  t.textContent = msg; t.style.opacity='1';
  clearTimeout(t._h); t._h = setTimeout(function(){ t.style.opacity='0'; }, 2400);
}

// 年份選單
(function(){
  const y = new Date().getFullYear();
  const sel = document.getElementById('selYear');
  for(let i=y+1;i>=y-2;i--){ const o=document.createElement('option'); o.value=i; o.textContent=i; if(i===y)o.selected=true; sel.appendChild(o); }
  const m = new Date().getMonth()+1;
  document.getElementById('selMonth').value = String(m);
})();

async function loadReport(){
  const year = document.getElementById('selYear').value;
  const month = document.getElementById('selMonth').value;
  // 月結
  const rep = await api('GET', `/api/admin/tours/report?year=${year}&month=${month}`);
  renderReport(rep);
  // 訂單
  const status = document.getElementById('selStatus').value;
  const ord = await api('GET', `/api/admin/tours/orders${status?('?status='+encodeURIComponent(status)):''}`);
  renderOrders(ord.orders || []);
}

function renderReport(rep){
  const t = rep.totals || {revenue:0,cost:0,profit:0,orders:0};
  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><div class="l">訂單數</div><div class="v">${t.orders||0}</div></div>
    <div class="kpi"><div class="l">跟客人收（優惠價）</div><div class="v">${money(t.revenue)}</div></div>
    <div class="kpi"><div class="l">應付旅行社（同業價）</div><div class="v">${money(t.cost)}</div></div>
    <div class="kpi"><div class="l">賺</div><div class="v profit">${money(t.profit)}</div></div>`;

  // 結算列：選了單月才能結（旅行社一張帳單、一鍵結清整月）
  const bar = document.getElementById('settleBar');
  const useMonth = rep.month && rep.month !== 0 && rep.month !== '0';
  if (!useMonth) {
    bar.innerHTML = `<span class="muted" style="font-size:12px;">選擇單月即可結算該月旅行社帳單。</span>`;
  } else {
    const mk = `${rep.year}-${String(rep.month).padStart(2,'0')}`;
    if (rep.monthSettled) {
      const dt = ((rep.settlements||[]).map(s=>s.settledAt).sort().pop()||'').slice(0,10);
      bar.innerHTML = `
        <span class="chip s-已完成">✓ 本月已結清${dt?`（${dt}）`:''}</span>
        <button class="btn btn-sm btn-neutral" id="btnUnsettle" data-mk="${mk}">解除結算</button>`;
    } else if ((rep.byVendor||[]).length) {
      bar.innerHTML = `
        <span class="chip s-待確認">本月未結</span>
        <button class="btn btn-sm btn-primary" id="btnSettle" data-mk="${mk}">已付旅行社，結清此月</button>
        <span class="muted" style="font-size:11px;">結清後鎖定該月訂單，防止事後誤改</span>`;
    } else {
      bar.innerHTML = `<span class="muted" style="font-size:12px;">本月無行程／船票訂單。</span>`;
    }
  }

  const tb = document.querySelector('#vendorTbl tbody');
  const rows = rep.byVendor || [];
  tb.innerHTML = rows.length ? rows.map(v=>`
    <tr><td>${v.vendor}</td>
      <td class="num">${v.orderCount}</td>
      <td class="num">${money(v.revenue)}</td>
      <td class="num">${money(v.cost)}</td>
      <td class="num profit">${money(v.profit)}</td></tr>`).join('')
    : `<tr><td colspan="5" class="muted" style="text-align:center;">此期間無訂單成立／已完成訂單</td></tr>`;

  // 租車＝介紹單：年度送客量（跟車行對量用）
  const r = rep.rental || {count:0, amount:0, year:''};
  document.getElementById('rentalKpis').innerHTML = `
    <div class="kpi"><div class="l">${r.year} 年送客</div><div class="v">${r.count} 筆</div></div>
    <div class="kpi"><div class="l">累計金額（對帳參考）</div><div class="v">${money(r.amount)}</div></div>`;
}

async function settleMonth(mk){
  if(!confirm(`確定 ${mk} 的旅行社帳單已付款？\n結清後該月行程/船票訂單會鎖定。`)) return;
  try{
    const r = await api('POST','/api/admin/tours/settle-month',{ monthKey: mk });
    if(r && r.success){ showToast(`✓ ${mk} 已結清（付旅行社 ${Number(r.totalCost||0).toLocaleString()}）`); loadReport(); }
    else showToast((r&&r.error)||'結算失敗');
  }catch(e){ showToast('結算失敗，請再試一次'); }
}
async function unsettleMonth(mk){
  if(!confirm(`解除 ${mk} 的結算？該月訂單將恢復可修改。`)) return;
  try{
    const r = await api('POST','/api/admin/tours/unsettle-month',{ monthKey: mk });
    if(r && r.success){ showToast(`已解除 ${mk} 結算`); loadReport(); }
    else showToast((r&&r.error)||'解除失敗');
  }catch(e){ showToast('解除失敗，請再試一次'); }
}
document.getElementById('settleBar').addEventListener('click',(e)=>{
  const s = e.target.closest('#btnSettle'); if(s){ settleMonth(s.getAttribute('data-mk')); return; }
  const u = e.target.closest('#btnUnsettle'); if(u) unsettleMonth(u.getAttribute('data-mk'));
});

function renderOrders(orders){
  const tb = document.querySelector('#orderTbl tbody');
  document.getElementById('empty').style.display = orders.length ? 'none' : 'block';
  tb.innerHTML = orders.map(o=>{
    let car = o.productId || '';
    try{ const d=JSON.parse(o.detail||'{}'); if(d.productName) car=d.productName+(d.seats?`（${d.seats}人）`:''); }catch(e){}
    const created = (o.createdAt||'').slice(5,16);
    return `<tr>
      <td><span class="garamond">${o.id}</span><br><span class="muted" style="font-size:11px;">${created}</span></td>
      <td>${car}<br><span class="muted" style="font-size:11px;">${o.vendor}</span></td>
      <td>${o.contactName||''}<br><span class="muted" style="font-size:11px;">${o.contactPhone||''}</span></td>
      <td class="num">${money(o.sellAmount)}</td>
      <td class="num muted">${o.kind==='rental'?'—':money(o.costAmount)}</td>
      <td class="num ${o.kind==='rental'?'muted':'profit'}">${o.kind==='rental'?'介紹單':money(o.profit)}</td>
      <td>${o.bookingOrderID?`<span class="muted" style="font-size:11px;">${o.bookingOrderID}</span>`:'<span class="muted">—</span>'}</td>
      <td><span class="chip s-${o.status}">${o.status}</span></td>
      <td><div class="row-actions">
        ${o.status!=='訂單成立'?`<button class="btn btn-sm btn-go" data-oid="${o.id}" data-status="訂單成立">訂單成立</button>`:''}
        ${o.status!=='已完成'?`<button class="btn btn-sm btn-neutral" data-oid="${o.id}" data-status="已完成">已完成</button>`:''}
        ${o.status!=='已取消'?`<button class="btn btn-sm btn-cancel" data-oid="${o.id}" data-status="已取消">已取消</button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}

async function setStatus(id, status){
  if(status==='已取消' && !confirm('確定取消這筆訂單？\n（取消手續費由客人負擔，記得跟客人／旅行社確認）')) return;
  try{
    await api('POST','/api/admin/tours/order-status',{ id, status });
    loadReport();
  }catch(e){ showToast('更新失敗，請再試一次'); }
}

document.getElementById('btnLoad').addEventListener('click', loadReport);
document.getElementById('selStatus').addEventListener('change', loadReport);
// 年/月改了直接重載（原本只有狀態會自動重載、年月要再按載入，行為不一致）
document.getElementById('selYear').addEventListener('change', loadReport);
document.getElementById('selMonth').addEventListener('change', loadReport);
// 事件委派：改訂單狀態（取代 inline onclick）
document.getElementById('orderTbl').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-status]');
  if (b) setStatus(b.getAttribute('data-oid'), b.getAttribute('data-status'));
});

/* ═══════ 商品管理（區分租車 day 系列 / 行程 人頭系列）═══════ */
let _prodsLoaded = false;
let _allProds = [];
async function loadProductsAdmin(){
  const d = await api('GET', '/api/admin/tours/products-full');
  _allProds = d.products || [];
  // 填類別下拉：租車 + 各行程類別
  const cats = [];
  if (_allProds.some(p=>p.kind==='rental')) cats.push({v:'__rental',t:'租車'});
  const tourCats = [...new Set(_allProds.filter(p=>p.kind!=='rental').map(p=>p.category))];
  tourCats.forEach(c=>cats.push({v:c,t:c}));
  const sel = document.getElementById('prodCat');
  sel.innerHTML = cats.map(c=>`<option value="${c.v}">${c.t}</option>`).join('');
  sel.onchange = ()=>renderProducts(sel.value);
  renderProducts(sel.value);
  _prodsLoaded = true;
}

function renderProducts(cat){
  const area = document.getElementById('prodArea');
  const isRental = cat === '__rental';
  const list = isRental ? _allProds.filter(p=>p.kind==='rental')
                        : _allProds.filter(p=>p.kind!=='rental' && p.category===cat);
  if (isRental) {
    area.innerHTML = `<table id="prodTbl"><thead><tr>
      <th>車種</th><th class="num">牌價/天</th><th class="num">半天</th><th class="num">超時</th>
      <th class="num">成本/天</th><th class="num">半天</th><th class="num">超時</th>
      <th class="num">利潤/天</th><th></th></tr></thead><tbody>${
      list.map(p=>`<tr data-id="${p.id}">
        <td>${p.name}${p.seats?`（${p.seats}人）`:''}<br><span class="muted" style="font-size:11px;">${p.vendor}</span></td>
        <td class="num"><input type="number" min="0" data-f="price_day"  value="${p.price_day||0}"></td>
        <td class="num"><input type="number" min="0" data-f="price_half" value="${p.price_half||0}"></td>
        <td class="num"><input type="number" min="0" data-f="price_hour" value="${p.price_hour||0}"></td>
        <td class="num"><input type="number" min="0" class="cost-in" data-f="cost_day"  value="${p.cost_day||0}"></td>
        <td class="num"><input type="number" min="0" class="cost-in" data-f="cost_half" value="${p.cost_half||0}"></td>
        <td class="num"><input type="number" min="0" class="cost-in" data-f="cost_hour" value="${p.cost_hour||0}"></td>
        <td class="num profit" data-profit>${money((p.price_day||0)-(p.cost_day||0))}</td>
        <td><button class="btn btn-sm btn-primary" data-save="${p.id}">存</button></td></tr>`).join('')
      }</tbody></table>`;
  } else {
    // 行程：人頭價（全/半/嬰）+ 介紹
    area.innerHTML = list.map(p=>`
      <div class="prod-trip" data-id="${p.id}" style="border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:12px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:17px;margin-bottom:2px;">${p.name}</div>
        <div class="muted" style="font-size:11px;margin-bottom:10px;">${p.vendor} · ${p.category}</div>
        <table style="margin-bottom:10px;"><thead><tr>
          <th></th><th class="num">全票</th><th class="num">半票</th><th class="num">嬰幼兒</th><th class="num">利潤(全)</th>
        </tr></thead><tbody><tr>
          <td class="muted" style="font-size:11px;">賣價</td>
          <td class="num"><input type="number" min="0" data-f="price_adult"  value="${p.price_adult||0}"></td>
          <td class="num"><input type="number" min="0" data-f="price_child"  value="${p.price_child||0}"></td>
          <td class="num"><input type="number" min="0" data-f="price_infant" value="${p.price_infant||0}"></td>
          <td class="num profit" data-profit rowspan="2" style="vertical-align:middle;">${money((p.price_adult||0)-(p.cost_adult||0))}</td>
        </tr><tr>
          <td class="muted" style="font-size:11px;">成本</td>
          <td class="num"><input type="number" min="0" class="cost-in" data-f="cost_adult"  value="${p.cost_adult||0}"></td>
          <td class="num"><input type="number" min="0" class="cost-in" data-f="cost_child"  value="${p.cost_child||0}"></td>
          <td class="num"><input type="number" min="0" class="cost-in" data-f="cost_infant" value="${p.cost_infant||0}"></td>
        </tr></tbody></table>
        <label class="muted" style="font-size:11px;display:block;margin-bottom:4px;">介紹</label>
        <textarea data-f="description" style="width:100%;min-height:54px;font-family:'Noto Serif TC',serif;font-size:13px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--bg);">${(p.description||'').replace(/</g,'&lt;')}</textarea>
        <div style="text-align:right;margin-top:8px;"><button class="btn btn-sm btn-primary" data-save="${p.id}">存</button></div>
      </div>`).join('') || '<p class="muted" style="text-align:center;padding:20px;">此類別無商品</p>';
  }
}

async function saveProduct(id){
  const row = document.querySelector(`[data-id="${id}"]`);
  if(!row) return;
  const body = { id };
  row.querySelectorAll('[data-f]').forEach(i=>{ body[i.getAttribute('data-f')] = i.value; });
  const btn = row.querySelector('button[data-save]');
  const orig = btn.textContent; btn.textContent='存…'; btn.disabled=true;
  try{
    await api('POST','/api/admin/tours/product', body);
    const pd = parseInt(body.price_day ?? body.price_adult ?? 0,10);
    const cd = parseInt(body.cost_day ?? body.cost_adult ?? 0,10);
    const pe = row.querySelector('[data-profit]'); if(pe) pe.textContent = money(pd-cd);
    // 同步回 _allProds
    const p = _allProds.find(x=>x.id===id); if(p) Object.assign(p, body);
    btn.textContent='已存 ✓';
  }catch(e){ btn.textContent='失敗'; }
  setTimeout(()=>{ btn.textContent=orig; btn.disabled=false; }, 1400);
}

// 事件委派（prodArea 動態內容）
const prodArea = document.getElementById('prodArea');
prodArea.addEventListener('input', (e)=>{
  const f = e.target.getAttribute('data-f');
  if(f==='price_day'||f==='cost_day'||f==='price_adult'||f==='cost_adult'){
    const row = e.target.closest('[data-id]');
    const pd = parseInt((row.querySelector('[data-f=price_day]')||row.querySelector('[data-f=price_adult]'))?.value||0,10);
    const cd = parseInt((row.querySelector('[data-f=cost_day]') ||row.querySelector('[data-f=cost_adult]'))?.value||0,10);
    const pe = row.querySelector('[data-profit]'); if(pe) pe.textContent = money(pd-cd);
  }
});
prodArea.addEventListener('click', (e)=>{
  const b = e.target.closest('button[data-save]');
  if(b) saveProduct(b.getAttribute('data-save'));
});

/* ═══════ Tab 切換 ═══════ */
document.querySelectorAll('.tabbtn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tabbtn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const t = btn.getAttribute('data-tab');
    document.getElementById('tabFinance').style.display  = t==='finance'  ? 'block':'none';
    document.getElementById('tabProducts').style.display = t==='products' ? 'block':'none';
    if(t==='products' && !_prodsLoaded) loadProductsAdmin().catch(()=>{});
  });
});

// 初始
if(!token()){ showGate(); }
else {
  document.getElementById('app').style.display='block';
  loadReport().catch(()=>{});
}

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
    <div class="kpi"><div class="l">營收</div><div class="v">${money(t.revenue)}</div></div>
    <div class="kpi"><div class="l">付供應商成本</div><div class="v">${money(t.cost)}</div></div>
    <div class="kpi"><div class="l">利潤</div><div class="v profit">${money(t.profit)}</div></div>`;
  const tb = document.querySelector('#vendorTbl tbody');
  const rows = rep.byVendor || [];
  tb.innerHTML = rows.length ? rows.map(v=>`
    <tr><td>${v.vendor}</td>
      <td class="num">${v.orderCount}</td>
      <td class="num">${money(v.revenue)}</td>
      <td class="num">${money(v.cost)}</td>
      <td class="num profit">${money(v.profit)}</td></tr>`).join('')
    : `<tr><td colspan="5" class="muted" style="text-align:center;">此期間無成立/完成訂單</td></tr>`;
}

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
      <td class="num muted">${money(o.costAmount)}</td>
      <td class="num profit">${money(o.profit)}</td>
      <td>${o.bookingOrderID?`<span class="muted" style="font-size:11px;">${o.bookingOrderID}</span>`:'<span class="muted">—</span>'}</td>
      <td><span class="chip s-${o.status}">${o.status}</span></td>
      <td><div class="row-actions">
        ${o.status!=='已成立'?`<button class="btn btn-sm btn-go" data-oid="${o.id}" data-status="已成立">成立</button>`:''}
        ${o.status!=='完成'?`<button class="btn btn-sm btn-neutral" data-oid="${o.id}" data-status="完成">完成</button>`:''}
        ${o.status!=='取消'?`<button class="btn btn-sm btn-cancel" data-oid="${o.id}" data-status="取消">取消</button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}

async function setStatus(id, status){
  if(status==='取消' && !confirm('確定取消這筆訂單？')) return;
  try{
    await api('POST','/api/admin/tours/order-status',{ id, status });
    loadReport();
  }catch(e){ alert('更新失敗'); }
}

document.getElementById('btnLoad').addEventListener('click', loadReport);
document.getElementById('selStatus').addEventListener('change', loadReport);
// 事件委派：改訂單狀態（取代 inline onclick）
document.getElementById('orderTbl').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-status]');
  if (b) setStatus(b.getAttribute('data-oid'), b.getAttribute('data-status'));
});

/* ═══════ 商品管理 ═══════ */
let _prodsLoaded = false;
async function loadProductsAdmin(){
  const d = await api('GET', '/api/admin/tours/products-full');
  renderProducts(d.products || []);
  _prodsLoaded = true;
}
function renderProducts(list){
  const tb = document.querySelector('#prodTbl tbody');
  tb.innerHTML = list.map(p=>{
    const label = p.name + (p.seats?`（${p.seats}人）`:'');
    const profit = (p.price_day||0)-(p.cost_day||0);
    return `<tr data-id="${p.id}">
      <td>${label}<br><span class="muted" style="font-size:11px;">${p.vendor} · ${p.category}</span></td>
      <td class="num"><input type="number" data-f="price_day"  value="${p.price_day||0}"></td>
      <td class="num"><input type="number" data-f="price_half" value="${p.price_half||0}"></td>
      <td class="num"><input type="number" data-f="price_hour" value="${p.price_hour||0}"></td>
      <td class="num"><input type="number" class="cost-in" data-f="cost_day"  value="${p.cost_day||0}"></td>
      <td class="num"><input type="number" class="cost-in" data-f="cost_half" value="${p.cost_half||0}"></td>
      <td class="num"><input type="number" class="cost-in" data-f="cost_hour" value="${p.cost_hour||0}"></td>
      <td class="num profit" data-profit>${money(profit)}</td>
      <td><button class="btn btn-sm btn-primary" data-save="${p.id}">存</button></td>
    </tr>`;
  }).join('');
}
async function saveProduct(id){
  const tr = document.querySelector(`#prodTbl tr[data-id="${id}"]`);
  if(!tr) return;
  const body = { id };
  tr.querySelectorAll('input[data-f]').forEach(i=>{ body[i.getAttribute('data-f')] = i.value; });
  const btn = tr.querySelector('button[data-save]');
  const orig = btn.textContent; btn.textContent='存…'; btn.disabled=true;
  try{
    await api('POST','/api/admin/tours/product', body);
    const pf = (parseInt(body.price_day||0,10))-(parseInt(body.cost_day||0,10));
    tr.querySelector('[data-profit]').textContent = money(pf);
    btn.textContent='已存 ✓';
  }catch(e){ btn.textContent='失敗'; }
  setTimeout(()=>{ btn.textContent=orig; btn.disabled=false; }, 1400);
}
const prodTbl = document.getElementById('prodTbl');
prodTbl.addEventListener('input', (e)=>{
  const f = e.target.getAttribute('data-f');
  if(f==='price_day'||f==='cost_day'){
    const tr = e.target.closest('tr');
    const pd = parseInt(tr.querySelector('[data-f=price_day]').value||0,10);
    const cd = parseInt(tr.querySelector('[data-f=cost_day]').value||0,10);
    tr.querySelector('[data-profit]').textContent = money(pd-cd);
  }
});
prodTbl.addEventListener('click', (e)=>{
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

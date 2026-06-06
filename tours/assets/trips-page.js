/* 行程列表頁：從 /api/tours/products 拿行程（kind=tour），按類別分組展示 */
(function(){
  const API = '/api';
  const CAT_ORDER = ['東海','南海','北海','海洋牧場','夜釣小管','花火船','離島花火','水上活動','潮間帶','特殊行程','BBQ','門票'];
  let _all = [];

  function money(n){ return (n==null||isNaN(n)||n<=0) ? '' : 'NT$ '+Number(n).toLocaleString('en-US'); }
  function meta(p){ try{ return JSON.parse(p.meta||'{}'); }catch(e){ return {}; } }
  function thumbCat(c){ return c; }

  function card(p){
    const m = meta(p);
    const inn = p.price_adult || 0;
    const list = (m.list && m.list.adult) || 0;
    const strike = (list && list > inn) ? `<span class="price-strike garamond">${money(list)}</span>` : '';
    const desc = (p.description||'').slice(0, 48);
    return `
      <div class="tour-card">
        <div class="tour-thumb" data-cat="${p.category}" style="cursor:pointer;" data-open="${p.id}">
          <span class="cat-label">${p.category}</span>
        </div>
        <div class="tour-body">
          <div><h3>${p.name}</h3><div class="vendor-sub">${p.vendor||''}</div></div>
          <div class="short-desc">${desc}${desc.length>=48?'…':''}</div>
          <div class="price-row">
            <span class="price-inn garamond">${money(inn)||'洽詢'}</span>
            ${strike}<span class="price-unit">/ 大人起</span>
          </div>
          <div class="actions">
            <button class="btn btn-neutral btn-sm" data-open="${p.id}">看詳情</button>
          </div>
        </div>
      </div>`;
  }

  function render(cat){
    const grid = document.getElementById('grid');
    const list = cat==='all' ? _all : _all.filter(p=>p.category===cat);
    if (cat==='all'){
      // 按類別分組
      grid.innerHTML = CAT_ORDER.filter(c=>list.some(p=>p.category===c)).map(c=>{
        const items = list.filter(p=>p.category===c);
        return `<div class="cat-head">${c}（${items.length}）</div>
          <div class="tour-grid">${items.map(card).join('')}</div>`;
      }).join('');
    } else {
      grid.innerHTML = `<div class="tour-grid">${list.map(card).join('')}</div>`;
    }
  }

  function openDetail(id){
    const p = _all.find(x=>x.id===id); if(!p) return;
    const m = meta(p);
    const row = (k,v)=> v ? `<div class="t-kv"><div class="k">${k}</div><div>${v}</div></div>` : '';
    const priceRow = (lbl,val)=> (val>0) ? `<div class="t-kv"><div class="k">${lbl}</div><div class="t-price" style="font-size:16px;">${money(val)}</div></div>` : '';
    document.getElementById('ovCard').innerHTML = `
      <div style="text-align:right;margin-bottom:-10px;"><button class="btn btn-neutral btn-sm" data-close>✕</button></div>
      <h2>${p.name}</h2>
      <div class="vd">${p.vendor||''} · ${p.category}</div>
      ${priceRow('大人', p.price_adult)}
      ${priceRow('半票', p.price_child)}
      ${priceRow('嬰幼兒', p.price_infant)}
      ${row(/\d{1,2}:\d{2}/.test(m.duration||'') ? '時間' : '時長', m.duration)}
      ${row('集合', m.meeting_location)}
      ${row('場次', m.schedule)}
      ${p.description ? `<div class="t-desc">${p.description}</div>` : ''}
      ${m.cancel_policy ? `<div class="t-kv"><div class="k">取消</div><div>${m.cancel_policy}</div></div>` : ''}
      <div class="alert alert-info" style="margin-top:16px;font-size:13px;">線上預訂即將開放。想預訂請洽雫旅 LINE，我們幫你代訂。</div>`;
    document.getElementById('ov').classList.add('on');
  }

  async function load(){
    try{
      const res = await fetch(API+'/tours/products');
      const data = await res.json();
      _all = (data.products||[]).filter(p=>p.kind!=='rental');
      _all.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      // 填類別下拉
      const cats = CAT_ORDER.filter(c=>_all.some(p=>p.category===c));
      const sel = document.getElementById('catSelect');
      cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; sel.appendChild(o); });
      sel.addEventListener('change', ()=>render(sel.value));
      document.getElementById('loading').style.display='none';
      render('all');
    }catch(e){
      document.getElementById('loading').textContent='行程載入失敗，請重新整理。';
    }
  }

  // 事件委派
  document.getElementById('grid').addEventListener('click', e=>{
    const b = e.target.closest('[data-open]'); if(b) openDetail(b.getAttribute('data-open'));
  });
  document.getElementById('ov').addEventListener('click', e=>{
    if(e.target.id==='ov' || e.target.closest('[data-close]')) document.getElementById('ov').classList.remove('on');
  });

  load();
})();

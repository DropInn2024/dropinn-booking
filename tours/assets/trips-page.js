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

  let _bookP=null;
  function rulesOf(p){ try{return JSON.parse(p.rules_json||'{}');}catch(e){return{};} }

  function openDetail(id){
    const p = _all.find(x=>x.id===id); if(!p) return;
    _bookP=p;
    const m = meta(p), rules=rulesOf(p);
    const row = (k,v)=> v ? `<div class="t-kv"><div class="k">${k}</div><div>${v}</div></div>` : '';
    const priceRow = (lbl,val)=> (val>0) ? `<div class="t-kv"><div class="k">${lbl}</div><div class="t-price" style="font-size:16px;">${money(val)}</div></div>` : '';
    const addonsHtml = (rules.addons||[]).map((a,i)=>
      `<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0;cursor:pointer;">
        <input type="checkbox" class="b-addon" data-name="${a.name}" data-price="${a.price}"> ${a.name} +${money(a.price)}/人</label>`).join('');
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
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:16px;letter-spacing:.1em;margin-bottom:10px;">立即預訂</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
          <div><div style="font-size:11px;color:var(--muted);margin-bottom:3px;">全票</div><input type="number" min="0" id="bAdult" value="2" style="width:100%;"></div>
          <div><div style="font-size:11px;color:var(--muted);margin-bottom:3px;">半票</div><input type="number" min="0" id="bChild" value="0" style="width:100%;"></div>
          <div><div style="font-size:11px;color:var(--muted);margin-bottom:3px;">嬰幼兒</div><input type="number" min="0" id="bInfant" value="0" style="width:100%;"></div>
        </div>
        ${addonsHtml}
        ${rules.single_scooter ? `<div class="muted" style="font-size:11px;margin:4px 0;">※ 含機車（兩人一台），奇數人落單補 ${money(rules.single_scooter)}</div>` : ''}
        ${rules.min_people ? `<div class="muted" style="font-size:11px;margin:4px 0;">※ 需 ${rules.min_people} 人成團，未滿會再跟你確認</div>` : ''}
        <input type="date" id="bDate" style="width:100%;margin:6px 0;">
        <input type="text" id="bName" placeholder="聯絡人姓名" style="width:100%;margin-bottom:6px;">
        <input type="tel" id="bPhone" placeholder="聯絡人手機" style="width:100%;margin-bottom:8px;">
        <div id="bookCalc" style="background:rgba(106,90,69,.06);padding:10px 12px;border-radius:8px;margin-bottom:10px;font-size:13px;"></div>
        <button class="btn btn-primary btn-block" id="bookSubmit">送出預訂需求</button>
      </div>`;
    document.getElementById('ov').classList.add('on');
    bookCalc();
  }

  function bookCounts(){ return {adult:+($('bAdult')||{}).value||0, child:+($('bChild')||{}).value||0, infant:+($('bInfant')||{}).value||0}; }
  function bookAddons(){ return Array.from(document.querySelectorAll('.b-addon:checked')).map(c=>c.getAttribute('data-name')); }
  function $(id){ return document.getElementById(id); }
  function calcBook(p,counts,addons){
    const rules=rulesOf(p);
    let t=counts.adult*(p.price_adult||0)+counts.child*(p.price_child||0)+counts.infant*(p.price_infant||0);
    let extra=[];
    if(rules.single_scooter && (counts.adult+counts.child)%2===1){ t+=rules.single_scooter; extra.push('逢單補 '+money(rules.single_scooter)); }
    (addons||[]).forEach(name=>{ const a=(rules.addons||[]).find(x=>x.name===name); if(a){ const v=a.price*(counts.adult+counts.child); t+=v; extra.push(name+' '+money(v)); } });
    return {total:t, extra};
  }
  function bookCalc(){
    if(!_bookP) return;
    const c=bookCounts(), r=calcBook(_bookP,c,bookAddons());
    const n=c.adult+c.child+c.infant;
    if(!n){ if($('bookCalc'))$('bookCalc').innerHTML='<span class="muted">請填人數</span>'; return; }
    if($('bookCalc')) $('bookCalc').innerHTML=`預估金額 <strong class="garamond" style="font-size:18px;color:var(--accent);">${money(r.total)}</strong>${r.extra.length?`<br><span class="muted" style="font-size:11px;">含 ${r.extra.join('、')}</span>`:''}`;
  }
  async function bookSubmit(){
    if(!_bookP) return;
    const c=bookCounts(); if(!(c.adult+c.child+c.infant)){ alert('請填人數'); return; }
    if(!$('bName').value.trim()||!$('bPhone').value.trim()){ alert('請填聯絡人姓名與電話'); return; }
    const btn=$('bookSubmit'),o=btn.textContent; btn.disabled=true; btn.textContent='送出中…';
    let orderId=null;
    try{
      const res=await fetch(API+'/tours/tour-order',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({productId:_bookP.id,counts:c,addons:bookAddons(),date:$('bDate').value,
          contactName:$('bName').value,contactPhone:$('bPhone').value,
          bookingOrderID:new URLSearchParams(location.search).get('booking')||undefined})});
      const data=await res.json(); if(data&&data.success)orderId=data.orderId;
    }catch(e){}
    btn.disabled=false; btn.textContent=o;
    const r=calcBook(_bookP,c,bookAddons());
    const ppl=[]; if(c.adult)ppl.push('全票×'+c.adult); if(c.child)ppl.push('半票×'+c.child); if(c.infant)ppl.push('嬰幼兒×'+c.infant);
    const txt=['【雫旅行程預訂】',orderId?'單號：'+orderId:'',`聯絡人：${$('bName').value}　${$('bPhone').value}`,
      `行程：${_bookP.name}`,$('bDate').value?'日期：'+$('bDate').value:'',`人數：${ppl.join('、')}`,
      bookAddons().length?'加購：'+bookAddons().join('、'):'','────────────',`預估金額：${money(r.total)}`,'',
      '※ 名額有限，待我們確認後才成立；含船的行程需身分證，請於確認時提供'].filter(Boolean).join('\n');
    $('ovCard').innerHTML=`<div style="text-align:right;margin-bottom:6px;"><button class="btn btn-neutral btn-sm" data-close>✕</button></div>
      <h2 style="font-size:20px;">預訂需求明細</h2>
      <textarea readonly style="width:100%;min-height:200px;margin-top:12px;font-family:'Noto Serif TC',serif;font-size:13px;line-height:1.7;padding:12px;border:1px solid var(--border-strong);border-radius:10px;background:var(--card);">${txt}</textarea>
      <button class="btn btn-primary btn-block" style="margin-top:12px;" id="bookCopy">複製明細</button>
      <div class="muted" style="font-size:12px;margin-top:10px;">複製後貼到 LINE 傳給雫旅，我們確認名額後回覆。</div>`;
    $('bookCopy').addEventListener('click',async()=>{ const ta=$('ovCard').querySelector('textarea');
      try{await navigator.clipboard.writeText(ta.value);}catch(e){ta.select();document.execCommand('copy');}
      const b=$('bookCopy'),x=b.textContent;b.textContent='已複製 ✓';setTimeout(()=>b.textContent=x,1500); });
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
    if(e.target.id==='bookSubmit'){ bookSubmit(); return; }
    if(e.target.id==='bookCopy') return;
    if(e.target.id==='ov' || e.target.closest('[data-close]')) document.getElementById('ov').classList.remove('on');
  });
  document.getElementById('ov').addEventListener('input', e=>{
    if(['bAdult','bChild','bInfant'].includes(e.target.id)) bookCalc();
  });
  document.getElementById('ov').addEventListener('change', e=>{
    if(e.target.classList && e.target.classList.contains('b-addon')) bookCalc();
  });

  load();
})();

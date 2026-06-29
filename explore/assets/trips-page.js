/* 行程列表頁：從 /api/tours/products 拿行程（kind=tour），按類別分組展示 */
(function(){
  const API = '/api';
  const CAT_ORDER = ['東海','南海','北海','海洋牧場','夜釣小管','花火船','離島花火','水上活動','潮間帶','特殊行程','BBQ','門票'];
  const CAT_DESC = {
    '東海':'岐頭出發・無人島巡航＋海上樂園','南海':'七美・望安・藍洞跳島','北海':'吉貝・險礁・玩水',
    '海洋牧場':'海上平台・釣魚烤蚵吃到飽','夜釣小管':'季節限定・夜釣體驗','花火船':'海上看澎湖花火',
    '離島花火':'跳島＋花火一次玩','水上活動':'SUP・浮潛・獨木舟','潮間帶':'潮間帶導覽・摸蛤仔',
    '特殊行程':'南方四島・大倉等秘境','BBQ':'海鮮 BBQ・聚餐','門票':'景點・展館門票'};
  let _all = [];
  let _cart = [];   // 購物車：每個行程一項，結帳一次送出

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
            ${strike}<span class="price-unit">起</span>
          </div>
          <div class="actions">
            <button class="btn btn-neutral btn-sm" data-open="${p.id}">看詳情</button>
          </div>
        </div>
      </div>`;
  }

  // 浮動返回鈕：只在分類頁、且 modal 未開時顯示（避免擋到填資料 modal）
  let _curCat='all';
  function updateFab(){
    const fab=document.getElementById('tripBack'); if(!fab) return;
    const modalOpen=document.getElementById('ov').classList.contains('on');
    fab.style.display=(_curCat!=='all' && !modalOpen) ? 'inline-flex' : 'none';
  }
  // 預設：只顯示「分類入口磚」，不一次倒出全部行程（避免資訊爆炸）
  function renderLanding(){
    const grid = document.getElementById('grid');
    const cats = CAT_ORDER.filter(c=>_all.some(p=>p.category===c));
    grid.innerHTML = `<div class="cat-tiles">${cats.map(c=>{
      const n = _all.filter(p=>p.category===c).length;
      return `<div class="cat-tile" data-cat="${c}">
        <h3>${c}</h3>
        <div class="cnt">${n} 個行程</div>
        <div class="d">${CAT_DESC[c]||''}</div>
      </div>`;
    }).join('')}</div>`;
    _curCat='all'; updateFab();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function render(cat){
    const grid = document.getElementById('grid');
    if (cat==='all'){ renderLanding(); return; }
    const items = _all.filter(p=>p.category===cat);
    grid.innerHTML = `<div class="cat-head">${cat}（${items.length}）</div>
      <div class="tour-grid">${items.map(card).join('')}</div>`;
    _curCat=cat; updateFab();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  let _bookP=null;
  function rulesOf(p){ try{return JSON.parse(p.rules_json||'{}');}catch(e){return{};} }

  // 場次：只認後台「填過的」結構化 meta.sessions[]。沒填 → 不猜，前台顯示「時間另行通知」。
  // （不再即時解析自由文字 schedule，避免把 報到/結束/返航/條件 誤判成場次）
  function sessionData(m){
    if(Array.isArray(m.sessions) && m.sessions.length) return {fixed:m.sessions.slice(), note:''};
    return {fixed:[], note:''};
  }
  // 通用須知（後台該筆未填 meta.notice 時自動套用）
  const UNIVERSAL_NOTICE =
    '・報到：請於場次前 30 分鐘到集合點（實際時間以業者前一天通知為準）\n'+
    '・攜帶：身分證正本（實名制，含船／登島必備）；兒童、嬰幼兒帶健保卡或生日\n'+
    '・天候：因天氣或船班停航可全額退費或改期\n'+
    '・取消：出發前如需取消，依業者規定可能收取手續費，請儘早告知\n'+
    '・成立：名額有限，送出僅為預訂，待雫旅向業者確認後才正式成立\n'+
    '・聯絡：建議加入雫旅 LINE，確認與後續通知更即時';
  function noticeText(m){ return (m.notice && String(m.notice).trim()) ? String(m.notice) : UNIVERSAL_NOTICE; }
  // 板型每張板人數：兩人/雙人→2、單人/一人→1
  function boardPer(name){ return /兩人|雙人|2\s*人/.test(name||'') ? 2 : 1; }

  function openDetail(id){
    const p = _all.find(x=>x.id===id); if(!p) return;
    _bookP=p;
    const m = meta(p), rules=rulesOf(p);
    const row = (k,v)=> v ? `<div class="t-kv"><div class="k">${k}</div><div>${v}</div></div>` : '';
    const priceRow = (lbl,val)=> (val>0) ? `<div class="t-kv"><div class="k">${lbl}</div><div class="t-price" style="font-size:16px;">${money(val)}</div></div>` : '';
    const addonsHtml = (rules.addons||[]).map((a,i)=>
      `<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0;cursor:pointer;">
        <input type="checkbox" class="b-addon" data-name="${a.name}" data-price="${a.price}"> ${a.name} +${money(a.price)}/人</label>`).join('');
    const variants = Array.isArray(rules.board_variants) ? rules.board_variants : [];
    const boardHtml = variants.length ? `
      <div style="margin-bottom:10px;">
        <div style="font-size:11px;color:var(--muted);margin-bottom:4px;">板型（每人價）</div>
        ${variants.map((v,i)=>`<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:4px 0;cursor:pointer;">
          <input type="radio" name="bBoard" class="b-board" data-name="${v.name}" data-price="${v.price_adult}" ${i===0?'checked':''}> ${v.name}　${money(v.price_adult)}/人</label>`).join('')}
      </div>` : '';
    // 詳情頁頂部價格：有板型就列各板型，否則列大人/半票/嬰
    const priceTop = variants.length
      ? variants.map(v=>priceRow(v.name, v.price_adult)).join('')
      : (priceRow('大人', p.price_adult)+priceRow('半票', p.price_child)+priceRow('嬰幼兒', p.price_infant));

    const sess = sessionData(m);
    const sessionHtml = sess.fixed.length ? `
        <div style="margin-bottom:8px;">
          <div style="font-size:11px;color:var(--muted);margin-bottom:3px;">場次 <span style="color:var(--highlight);">*</span></div>
          <select id="bSession" style="width:100%;">
            <option value="">請選擇場次</option>
            ${sess.fixed.map(t=>`<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>`
      : `<div class="muted" style="font-size:11px;margin:4px 0;">※ 出發時間另行通知，可與客服確認</div>`;

    const bookingBlock = rules.inquiry_only ? `
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
        <div class="alert alert-info" style="font-size:13px;line-height:1.7;">此為包船／整船行程，依人數與場次報價。請洽雫旅 LINE，我們幫你安排並回報價格。</div>
        <button class="btn btn-primary btn-block" style="margin-top:10px;" id="bookInquiry">複製洽詢內容</button>
      </div>` : `
      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:14px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:16px;letter-spacing:.1em;margin-bottom:10px;">立即預訂</div>
        ${boardHtml}
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px;">
          <div><div style="font-size:11px;color:var(--muted);margin-bottom:3px;">全票</div><input type="number" min="0" id="bAdult" value="2" style="width:100%;"></div>
          <div><div style="font-size:11px;color:var(--muted);margin-bottom:3px;">半票</div><input type="number" min="0" id="bChild" value="0" style="width:100%;"></div>
          <div><div style="font-size:11px;color:var(--muted);margin-bottom:3px;">嬰幼兒</div><input type="number" min="0" id="bInfant" value="0" style="width:100%;"></div>
        </div>
        ${addonsHtml}
        ${rules.single_scooter ? `<div class="muted" style="font-size:11px;margin:4px 0;">※ 含機車（兩人一台），奇數人落單補 ${money(rules.single_scooter)}</div>` : ''}
        ${rules.min_people ? `<div class="muted" style="font-size:11px;margin:4px 0;">※ 需 ${rules.min_people} 人成團，未滿會再跟你確認</div>` : ''}
        <div style="font-size:11px;color:var(--muted);margin:6px 0 3px;">出發日期 <span style="color:var(--highlight);">*</span></div>
        <input type="date" id="bDate" style="width:100%;margin-bottom:6px;">
        ${sessionHtml}
        <div id="bookCalc" style="background:rgba(106,90,69,.06);padding:10px 12px;border-radius:8px;margin:6px 0 10px;font-size:13px;"></div>
        <button class="btn btn-primary btn-block" id="bookAdd">加入清單</button>
        <div class="muted" style="font-size:11px;text-align:center;margin-top:6px;">加入後可繼續逛、再一起結帳（聯絡人/實名最後填一次）</div>
      </div>`;

    document.getElementById('ovCard').innerHTML = `
      <div style="text-align:right;margin-bottom:-10px;"><button data-close style="background:none;border:none;font-size:24px;line-height:1;color:var(--muted);cursor:pointer;padding:0;">×</button></div>
      <h2>${p.name}</h2>
      <div class="vd">${p.vendor||''} · ${p.category}</div>
      ${priceTop}
      ${row(/\d{1,2}:\d{2}/.test(m.duration||'') ? '時間' : '時長', m.duration)}
      ${row('集合', m.meeting_location)}
      ${row('場次', sess.fixed.length ? sess.fixed.join('、') : '時間另行通知，可與客服確認')}
      ${p.description ? `<div class="t-desc">${p.description}</div>` : ''}
      <div style="margin-top:14px;background:rgba(106,90,69,.05);border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.9;color:var(--ink);">
        <div style="font-family:'Cormorant Garamond',serif;font-size:13px;letter-spacing:.1em;color:var(--accent);margin-bottom:6px;">須知</div>
        ${noticeText(m).replace(/[<>]/g,'').replace(/\n/g,'<br>')}
      </div>
      ${bookingBlock}`;
    document.getElementById('ov').classList.add('on');
    updateFab();
    if(!rules.inquiry_only) bookCalc();
  }

  function bookCounts(){ return {adult:+($('bAdult')||{}).value||0, child:+($('bChild')||{}).value||0, infant:+($('bInfant')||{}).value||0}; }
  function bookAddons(){ return Array.from(document.querySelectorAll('.b-addon:checked')).map(c=>c.getAttribute('data-name')); }
  function bookBoard(){ const r=document.querySelector('.b-board:checked'); return r?{name:r.getAttribute('data-name'),price:+r.getAttribute('data-price')}:null; }
  function $(id){ return document.getElementById(id); }
  function calcBook(p,counts,addons){
    const rules=rulesOf(p);
    const b=bookBoard();
    const adultUnit = b ? b.price : (p.price_adult||0);
    let t=counts.adult*adultUnit+counts.child*(p.price_child||0)+counts.infant*(p.price_infant||0);
    let extra=[];
    if(rules.single_scooter && (counts.adult+counts.child)%2===1){ t+=rules.single_scooter; extra.push('逢單補 '+money(rules.single_scooter)); }
    (addons||[]).forEach(name=>{ const a=(rules.addons||[]).find(x=>x.name===name); if(a){ const v=a.price*(counts.adult+counts.child); t+=v; extra.push(name+' '+money(v)); } });
    return {total:t, extra};
  }
  // 板數與落單：回 {boards, oddWarn}
  function boardInfo(c){
    const b=bookBoard(); if(!b) return null;
    const riders=c.adult+c.child, per=boardPer(b.name);
    const boards=Math.ceil(riders/per);
    const oddWarn = per===2 && riders%2===1;
    return {name:b.name, per, boards, oddWarn, riders};
  }
  function bookCalc(){
    if(!_bookP) return;
    const c=bookCounts(), r=calcBook(_bookP,c,bookAddons());
    const n=c.adult+c.child+c.infant;
    if(!n){ if($('bookCalc'))$('bookCalc').innerHTML='<span class="muted">請填人數</span>'; return; }
    const bi=boardInfo(c);
    let lines=`預估金額 <strong class="garamond" style="font-size:18px;color:var(--accent);">${money(r.total)}</strong>`;
    if(r.extra.length) lines+=`<br><span class="muted" style="font-size:11px;">含 ${r.extra.join('、')}</span>`;
    if(bi) lines+=`<br><span class="muted" style="font-size:11px;">${bi.name}　${bi.riders} 人 = ${bi.boards} 張板</span>`;
    if(bi&&bi.oddWarn) lines+=`<br><span style="font-size:11px;color:var(--highlight);">⚠ 有 1 位落單，需與他人共板，或改選單人一板</span>`;
    if($('bookCalc')) $('bookCalc').innerHTML=lines;
  }
  // ── 購物車 ──────────────────────────────────────────────
  // 需實名（搭船/活動類）：預設要，BBQ/門票/烤肉不用；meta.realname 可覆寫（與後端一致）
  function needsRealname(p){ const m=meta(p); if(typeof m.realname==='boolean') return m.realname; return !/BBQ|門票|烤肉/i.test(p.category||''); }
  function cartTotal(){ return _cart.reduce((s,i)=>s+(i.sell||0),0); }
  function cartMaxPax(){ return _cart.filter(i=>i.needsRealname).reduce((m,i)=>Math.max(m,i.head),0); }
  function peopleStr(c){ const a=[]; if(c.adult)a.push('全'+c.adult); if(c.child)a.push('半'+c.child); if(c.infant)a.push('嬰'+c.infant); return a.join(' '); }

  function showToast(msg){
    let t=document.getElementById('tripToast');
    if(!t){ t=document.createElement('div'); t.id='tripToast';
      t.style.cssText='position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:130;background:#4a3f35;color:#f8f5ef;padding:9px 18px;border-radius:999px;font-family:\'Noto Serif TC\',serif;font-size:13px;letter-spacing:.05em;box-shadow:0 6px 18px rgba(74,63,53,.3);opacity:0;transition:opacity .2s;pointer-events:none;';
      document.body.appendChild(t); }
    t.textContent=msg; t.style.opacity='1';
    clearTimeout(t._h); t._h=setTimeout(()=>{ t.style.opacity='0'; },1600);
  }
  function renderCartFab(){
    let fab=document.getElementById('cartFab');
    if(!_cart.length){ if(fab) fab.style.display='none'; return; }
    if(!fab){ fab=document.createElement('button'); fab.id='cartFab'; fab.type='button';
      fab.style.cssText='position:fixed;right:16px;bottom:18px;z-index:120;border:1px solid rgba(181,171,160,.55);border-radius:999px;background:#f8f5ef;color:#6a5a45;padding:11px 18px;font-family:\'Noto Serif TC\',serif;font-size:14px;letter-spacing:.04em;box-shadow:0 6px 20px rgba(74,63,53,.18);cursor:pointer;display:inline-flex;align-items:center;gap:8px;';
      fab.addEventListener('click',openCart); document.body.appendChild(fab); }
    fab.style.display='inline-flex';
    fab.innerHTML=`預訂清單 ${_cart.length} · <span style="font-family:'Cormorant Garamond',serif;">${money(cartTotal())}</span>`;
  }

  function addToCart(){
    if(!_bookP) return;
    const c=bookCounts(); if(!(c.adult+c.child+c.infant)){ alert('請填人數'); return; }
    if(!$('bDate')||!$('bDate').value){ alert('請選擇出發日期'); return; }
    const sessEl=$('bSession'); if(sessEl && !sessEl.value){ alert('請選擇場次'); return; }
    const board=bookBoard(), r=calcBook(_bookP,c,bookAddons());
    _cart.push({ key:Date.now()+'-'+Math.random().toString(36).slice(2,5),
      productId:_bookP.id, name:_bookP.name, vendor:_bookP.vendor, category:_bookP.category,
      counts:c, addons:bookAddons(), board:board, date:$('bDate').value, session:sessEl?sessEl.value:'',
      sell:r.total, needsRealname:needsRealname(_bookP), head:c.adult+c.child+c.infant });
    renderCartFab();
    document.getElementById('ov').classList.remove('on'); updateFab();
    showToast('已加入預訂清單（'+_cart.length+'）');
  }

  function openCart(){
    if(!_cart.length) return;
    const rows=_cart.map(it=>`
      <div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px;margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div style="font-size:14px;font-weight:500;">${it.name}${it.needsRealname?'<span style="font-size:10px;color:var(--highlight);margin-left:6px;">需實名</span>':''}</div>
          <button data-cart-del="${it.key}" style="background:none;border:none;font-size:18px;color:var(--muted);cursor:pointer;line-height:1;padding:0;">×</button>
        </div>
        <div class="muted" style="font-size:12px;margin-top:3px;line-height:1.6;">${peopleStr(it.counts)}${it.date?' · '+it.date:''}${it.session?' · '+it.session:''}${it.board?' · '+it.board.name:''}${it.addons.length?' · 加購:'+it.addons.join('、'):''}</div>
        <div style="text-align:right;font-size:14px;color:var(--accent);margin-top:2px;font-family:'Cormorant Garamond',serif;">${money(it.sell)}</div>
      </div>`).join('');
    $('ovCard').innerHTML=`
      <div style="text-align:right;margin-bottom:-6px;"><button data-close style="background:none;border:none;font-size:24px;line-height:1;color:var(--muted);cursor:pointer;padding:0;">×</button></div>
      <h2 style="font-size:20px;">預訂清單</h2>
      <div style="margin-top:12px;">${rows}</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid var(--border-strong);padding-top:10px;margin-top:4px;">
        <span class="muted" style="font-size:13px;">總額</span><strong style="font-size:20px;color:var(--accent);font-family:'Cormorant Garamond',serif;">${money(cartTotal())}</strong></div>
      <button class="btn btn-primary btn-block" style="margin-top:12px;" id="cartCheckout">前往結帳</button>
      <button class="btn btn-neutral btn-block" style="margin-top:8px;" data-close>繼續逛</button>`;
    document.getElementById('ov').classList.add('on'); updateFab();
  }

  function openCheckout(){
    if(!_cart.length) return;
    const maxPax=cartMaxPax();
    const paxBlock = maxPax>0 ? `
      <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:15px;letter-spacing:.08em;margin-bottom:4px;">旅客實名（${maxPax} 位 · 必填）</div>
        <div class="muted" style="font-size:11px;line-height:1.7;margin-bottom:10px;">搭船／活動行程須投保＋實名。此身分證／生日僅供業者安排，<strong style="color:var(--highlight);">行程結束後自動刪除</strong>。</div>
        ${Array.from({length:maxPax},(_,i)=>`
          <div style="border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;">
            <div style="font-size:12px;font-weight:500;margin-bottom:6px;">旅客 ${i+1}</div>
            <input type="text" class="pax-name" placeholder="姓名" style="width:100%;margin-bottom:6px;">
            <input type="text" class="pax-id" placeholder="身分證字號" style="width:100%;margin-bottom:6px;">
            <input type="date" class="pax-birth" style="width:100%;">
          </div>`).join('')}
      </div>` : '';
    $('ovCard').innerHTML=`
      <div style="text-align:right;margin-bottom:-6px;"><button data-close style="background:none;border:none;font-size:24px;line-height:1;color:var(--muted);cursor:pointer;padding:0;">×</button></div>
      <h2 style="font-size:20px;">結帳</h2>
      <div class="muted" style="font-size:12px;margin-top:4px;">${_cart.length} 個行程 · 總額 ${money(cartTotal())}</div>
      <div style="margin-top:12px;">
        <input type="text" id="coName" placeholder="聯絡人姓名" style="width:100%;margin-bottom:6px;">
        <input type="tel" id="coPhone" placeholder="聯絡人手機" style="width:100%;margin-bottom:6px;">
        <input type="email" id="coEmail" placeholder="Email（選填，寄確認信）" style="width:100%;margin-bottom:6px;">
      </div>
      ${paxBlock}
      <button class="btn btn-primary btn-block" style="margin-top:14px;" id="cartSubmit">送出預訂需求</button>
      <button class="btn btn-neutral btn-block" style="margin-top:8px;" id="cartBackToList">返回清單</button>`;
    document.getElementById('ov').classList.add('on');
  }

  async function submitCart(){
    const name=($('coName')||{}).value?.trim()||'', phone=($('coPhone')||{}).value?.trim()||'';
    if(!name||!phone){ alert('請填聯絡人姓名與電話'); return; }
    const maxPax=cartMaxPax();
    const passengers=[];
    if(maxPax>0){
      const ns=document.querySelectorAll('.pax-name'), ids=document.querySelectorAll('.pax-id'), bs=document.querySelectorAll('.pax-birth');
      for(let i=0;i<maxPax;i++){
        const nm=(ns[i]&&ns[i].value.trim())||'', idv=(ids[i]&&ids[i].value.trim())||'', bd=(bs[i]&&bs[i].value)||'';
        if(!nm||!idv){ alert('需實名行程請填滿 '+maxPax+' 位旅客的姓名與身分證'); return; }
        passengers.push({name:nm,id:idv,birth:bd});
      }
    }
    const btn=$('cartSubmit'),o=btn.textContent; btn.disabled=true; btn.textContent='送出中…';
    const body={ contactName:name, contactPhone:phone, email:($('coEmail')?$('coEmail').value:''),
      passengers, bookingOrderID:new URLSearchParams(location.search).get('booking')||undefined,
      items:_cart.map(it=>({ productId:it.productId, counts:it.counts, addons:it.addons, board:it.board?it.board.name:'', date:it.date, session:it.session })) };
    let data=null, st=0;
    try{ const res=await fetch(API+'/tours/cart-order',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}); st=res.status; data=await res.json(); }catch(e){}
    btn.disabled=false; btn.textContent=o;
    if(st===422||(data&&data.needContact)){ alert(data.error||'清單中有行程需專人為您確認，請加 LINE @dropinn 洽詢 🙏'); return; }
    if(!data||!data.success){ alert('送出失敗，請稍後再試，或加 LINE @dropinn 由專人協助。'); return; }
    const gid=data.groupId, n=(data.orders||[]).length||_cart.length;
    _cart=[]; renderCartFab();
    const lineHref='https://line.me/R/oaMessage/%40dropinn/?'+encodeURIComponent('預訂單號 '+gid+'，我要接收進度');
    $('ovCard').innerHTML=`
      <div style="text-align:right;margin-bottom:6px;"><button data-close style="background:none;border:none;font-size:24px;line-height:1;color:var(--muted);cursor:pointer;padding:0;">×</button></div>
      <div style="text-align:center;padding:2px 0;">
        <div style="font-size:38px;line-height:1;">🌊</div>
        <h2 style="font-size:20px;margin-top:10px;">預訂需求已送出</h2>
        <div class="muted" style="font-size:13px;margin-top:8px;line-height:1.7;">${n} 個行程 · 總額 ${money(data.total||0)}<br>名額有限，待雫旅向業者確認後回覆你${(($('coEmail')&&$('coEmail').value)||'')?'，也會寄確認信到信箱':''}。</div>
      </div>
      <a href="${lineHref}" target="_blank" rel="noopener noreferrer" class="btn btn-block" style="margin-top:8px;background:#06C755;color:#fff;border-color:#06C755;">加 LINE 接收成立通知</a>
      <div class="muted" style="font-size:12px;margin:8px 0 0;text-align:center;">加好友後送出已帶好的訊息即完成綁定，成立後直接 LINE 通知你。</div>
      <button class="btn btn-neutral btn-block" data-close style="margin-top:10px;">完成</button>`;
  }
  function delCartItem(key){ _cart=_cart.filter(i=>i.key!==key); renderCartFab(); if(_cart.length) openCart(); else { document.getElementById('ov').classList.remove('on'); updateFab(); } }

  // 包船洽詢：複製洽詢內容給 LINE
  async function bookInquiry(){
    if(!_bookP) return;
    const m=meta(_bookP);
    const txt=['【雫旅包船洽詢】',`行程：${_bookP.name}`,_bookP.vendor?'供應商：'+_bookP.vendor:'',
      m.schedule?'場次：'+m.schedule:'','想詢問日期：','人數：','────────────',
      '※ 包船依人數與場次報價，請填上方資訊，雫旅為您安排並回報價格'].filter(Boolean).join('\n');
    try{await navigator.clipboard.writeText(txt);}catch(e){}
    const b=$('bookInquiry'),x=b.textContent;b.textContent='已複製，請貼到 LINE ✓';setTimeout(()=>{if($('bookInquiry'))$('bookInquiry').textContent=x;},1800);
  }

  async function load(){
    try{
      const res = await fetch(API+'/tours/products');
      const data = await res.json();
      _all = (data.products||[]).filter(p=>p.kind!=='rental' && p.category!=='船票');
      _all.sort((a,b)=>(a.sortOrder||0)-(b.sortOrder||0));
      document.getElementById('loading').style.display='none';
      render('all');
    }catch(e){
      document.getElementById('loading').textContent='行程載入失敗，請重新整理。';
    }
  }

  // 事件委派
  document.getElementById('grid').addEventListener('click', e=>{
    const open = e.target.closest('[data-open]');
    if(open){ openDetail(open.getAttribute('data-open')); return; }
    const cat = e.target.closest('[data-cat]');   // 分類磚
    if(cat){ render(cat.getAttribute('data-cat')); }
  });
  document.getElementById('tripBack').addEventListener('click', ()=>render('all'));
  document.getElementById('ov').addEventListener('click', e=>{
    if(e.target.id==='bookAdd'){ addToCart(); return; }
    if(e.target.id==='bookInquiry'){ bookInquiry(); return; }
    if(e.target.id==='cartCheckout'){ openCheckout(); return; }
    if(e.target.id==='cartSubmit'){ submitCart(); return; }
    if(e.target.id==='cartBackToList'){ openCart(); return; }
    const del=e.target.closest('[data-cart-del]'); if(del){ delCartItem(del.getAttribute('data-cart-del')); return; }
    if(e.target.id==='bookCopy') return;
    if(e.target.id==='ov' || e.target.closest('[data-close]')){ document.getElementById('ov').classList.remove('on'); updateFab(); }
  });
  document.getElementById('ov').addEventListener('input', e=>{
    if(['bAdult','bChild','bInfant'].includes(e.target.id)) bookCalc();
  });
  document.getElementById('ov').addEventListener('change', e=>{
    if(e.target.classList && (e.target.classList.contains('b-addon')||e.target.classList.contains('b-board'))) bookCalc();
  });

  load();
})();

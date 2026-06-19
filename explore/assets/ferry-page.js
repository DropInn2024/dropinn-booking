/* 船票選購頁：用公開 meta 客報價 + 日期引擎試算，送出產生訂位文。
   不碰成本（成本在下單 B3 後端算）。 */
(function(){
  const API='/api';
  let FERRY=null, META=null;
  let tripType='round', shType='round';
  const bookingParam=new URLSearchParams(location.search).get('booking')||'';

  const $=id=>document.getElementById(id);
  const money=n=>(n==null||isNaN(n))?'—':'NT$ '+Number(n).toLocaleString('en-US');

  // ── 日期引擎（前端版，與後端同邏輯）──
  function dateType(dateStr, dir){
    if(!dateStr) return 'weekday';
    if((META.holidays||[]).includes(dateStr)) return 'holiday';
    const wr=META.weekend_rule||{};
    if((wr.extra_holiday||[]).includes(dateStr)) return 'weekend';
    const dow=new Date(dateStr+'T00:00:00').getDay(); // 0日..6六
    const days=dir==='out'?(wr.depart_penghu||[5,6]):(wr.return_penghu||[6,0]);
    return days.includes(dow)?'weekend':'weekday';
  }
  const ORD={weekday:0,weekend:1,holiday:2};
  const DT_LABEL={weekday:'平日',weekend:'假日',holiday:'連假'};

  // ── 計價（客報價，meta.fares）──
  function counts(){ return {adult:+$('cAdult').value||0, child:+$('cChild').value||0, infant:+$('cInfant').value||0}; }
  function calcTicket(){
    const f=META.fares, c=counts(), o=$('outDate').value, b=$('backDate').value;
    if(!f) return null;
    let total=0, lines=[], type, typeLabel;
    if(tripType==='round'){
      if(!o||!b) return {incomplete:true};
      // 來回：去/回各照自己日期票種，每段＝該票種來回價的一半（同票種還原原價、跨票種取中間值）
      const tOut=dateType(o,'out'), tBack=dateType(b,'back');
      type = ORD[tOut]>=ORD[tBack] ? tOut : tBack;            // 徽章/連假提醒取較高那段
      const ad=Math.round((((f.adult[tOut]&&f.adult[tOut].round)||0)+((f.adult[tBack]&&f.adult[tBack].round)||0))/2);
      const hf=f.half.round, inf=f.infant.round;
      if(c.adult){ total+=c.adult*ad; lines.push(['全票來回 ×'+c.adult, c.adult*ad]); }
      if(c.child){ total+=c.child*hf; lines.push(['半票來回 ×'+c.child, c.child*hf]); }
      if(c.infant){ total+=c.infant*inf; lines.push(['嬰兒來回 ×'+c.infant, c.infant*inf]); }
      typeLabel = (tOut===tBack) ? DT_LABEL[type] : `去 ${DT_LABEL[tOut]}・回 ${DT_LABEL[tBack]}`;
    } else {
      if(!o) return {incomplete:true};
      const dir=$('direction').value;
      type=dateType(o,dir);
      const ad=f.adult[type].single, hf=f.half.single, inf=f.infant.single;
      if(c.adult){ total+=c.adult*ad; lines.push(['全票單程 ×'+c.adult, c.adult*ad]); }
      if(c.child){ total+=c.child*hf; lines.push(['半票單程 ×'+c.child, c.child*hf]); }
      if(c.infant){ total+=c.infant*inf; lines.push(['嬰兒單程 ×'+c.infant, c.infant*inf]); }
      typeLabel = DT_LABEL[type];
    }
    return {total, lines, type, typeLabel};
  }
  function calcShuttle(){
    const sv=$('shuttle').value; if(!sv) return null;
    const st=(META.shuttles||[]).find(s=>s.name===sv); if(!st) return null;
    const c=counts(), ac=c.adult+c.child, isR=shType==='round';
    const per=isR?st.round:st.single;
    const inf=META.shuttle_infant||{};
    const perInf=(st.region==='南'&&inf.south_free)?0:(isR?inf.round:inf.single);
    const total=ac*per+c.infant*perInf;
    return {total, station:st.name, type:isR?'來回':'單程', region:st.region};
  }

  function renderCalc(){
    const t=calcTicket();
    if(!t||t.incomplete){ $('calc').innerHTML='<div style="font-size:13px;color:var(--muted);">選日期與人數後即時試算。</div>'; $('submitBtn').disabled=true; window._last=null; return; }
    const sh=calcShuttle();
    const grand=t.total+(sh?sh.total:0);
    if(grand<=0){ $('calc').innerHTML='<div style="font-size:13px;color:var(--muted);">請填人數。</div>'; $('submitBtn').disabled=true; window._last=null; return; }
    $('calc').innerHTML=`
      <div class="dt-line">日期類型<span class="daytype dt-${t.type}">${t.typeLabel}</span></div>
      ${t.lines.map(l=>`<div class="ln"><span>${l[0]}</span><span class="garamond">${money(l[1])}</span></div>`).join('')}
      ${sh?`<div class="ln"><span>接駁 ${sh.station}（${sh.type}）</span><span class="garamond">${money(sh.total)}</span></div>`:''}
      <div class="total-row"><span style="font-family:'Cormorant Garamond',serif;font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:var(--muted);">Total</span><span class="num garamond">${money(grand)}</span></div>
      ${(sh&&sh.region!=='南')?'<div class="muted" style="font-size:11px;margin-top:10px;line-height:1.7;">接駁上車時間，出發前一天由車公司簡訊通知。</div>':''}
      ${(sh&&sh.region==='南')?'<div class="muted" style="font-size:11px;margin-top:10px;line-height:1.7;">南部接駁出發前一天簡訊通知。</div>':''}
      ${t.type==='holiday'?'<div class="alert alert-warn" style="margin-top:10px;font-size:12px;line-height:1.65;">⚠ 連假船班一位難求，請務必及早預訂；正班若客滿需排候補加班船，實際船班時間以船公司通知為準。</div>':''}`;
    $('submitBtn').disabled=false;
    window._last={t,sh,grand};
  }

  // ── 旅客實名卡片 HTML（依全+半人數展開）──
  function paxCardsHtml(n){
    return Array.from({length:n},(_,i)=>`
      <div class="pax-card"><div class="lb">旅客 ${i+1}</div>
        <div class="form-grid-2">
          <div class="form-row"><label>姓名</label><input type="text" data-px="name" data-i="${i}" placeholder="中文姓名"></div>
          <div class="form-row"><label>身分證</label><input type="text" data-px="id" data-i="${i}" placeholder="A123456789"></div>
          <div class="form-row" style="margin-bottom:0;"><label>生日</label><input type="date" data-px="birth" data-i="${i}"></div>
        </div>
      </div>`).join('');
  }

  function buildQuote(){
    const L=window._last; if(!L) return '';
    const c=counts(), o=$('outDate').value, b=$('backDate').value;
    const lines=['【雫旅船票代訂】'];
    if(window._orderId) lines.push(`單號：${window._orderId}`);
    lines.push(`聯絡人：${$('cName').value}　${$('cPhone').value}`);
    if(tripType==='round') lines.push(`航班：聯營來回　去 ${o}　回 ${b}（${L.t.typeLabel}）`);
    else lines.push(`航班：聯營單程　${o}　${$('direction').value==='out'?'布袋→馬公':'馬公→布袋'}（${L.t.typeLabel}）`);
    lines.push(`正班時段：去 10:00或10:30 / 回 16:00或16:30（可備註加班船需求）`);
    const ppl=[]; if(c.adult)ppl.push(`全票×${c.adult}`); if(c.child)ppl.push(`半票×${c.child}`); if(c.infant)ppl.push(`嬰兒×${c.infant}`);
    lines.push(`人數：${ppl.join('、')}`);
    if(L.sh) lines.push(`接駁：${L.sh.station}（${L.sh.type}）`);
    lines.push('────────────');
    document.querySelectorAll('#paxList .pax-card').forEach((card,i)=>{
      const g=k=>card.querySelector(`[data-px="${k}"]`).value;
      lines.push(`旅客${i+1}：${g('name')}　${g('id')}　${g('birth')}`);
    });
    lines.push('────────────');
    lines.push(`預估金額：${money(L.grand)}`);
    lines.push('');
    lines.push('※ 船位有限，待確認後才成立；加班船需排隊');
    lines.push('※ 接駁上車時間地點出發前一天通知');
    return lines.join('\n');
  }

  // ── 事件 ──
  function bindSeg(boxId, set){
    $(boxId).addEventListener('click',e=>{ const b=e.target.closest('button'); if(!b)return;
      $(boxId).querySelectorAll('button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); set(b); });
  }
  bindSeg('tripBtns', b=>{ tripType=b.getAttribute('data-trip');
    $('backWrap').style.display=tripType==='round'?'':'none';
    $('dirWrap').style.display=tripType==='single'?'':'none';
    renderCalc(); });
  bindSeg('shBtns', b=>{ shType=b.getAttribute('data-sh'); renderCalc(); });

  ['outDate','backDate','direction','cAdult','cChild','cInfant'].forEach(id=>{
    document.addEventListener('input',e=>{ if(e.target.id===id){ renderCalc(); } });
  });
  $('shuttle').addEventListener('change',()=>{ $('shTypeWrap').style.display=$('shuttle').value?'':'none'; renderCalc(); });

  // 送出 → 跳出 modal 填資料（選擇/試算留在頁面）
  $('submitBtn').addEventListener('click',()=>{ if(window._last) openForm(); });

  function openForm(){
    const L=window._last, c=counts(), n=c.adult+c.child;
    const o=$('outDate').value, b=$('backDate').value;
    const flight=tripType==='round'
      ? `聯營來回　去 ${o}　回 ${b}（${DT_LABEL[L.t.type]}）`
      : `聯營單程　${o}　${$('direction').value==='out'?'布袋→馬公':'馬公→布袋'}（${DT_LABEL[L.t.type]}）`;
    const ppl=[]; if(c.adult)ppl.push(`全票×${c.adult}`); if(c.child)ppl.push(`半票×${c.child}`); if(c.infant)ppl.push(`嬰兒×${c.infant}`);
    $('ovBody').innerHTML=`
      <div class="ov-head"><div class="ov-title">填寫資料</div><button class="ov-x" data-close>×</button></div>
      <div class="ov-summary"><div>${flight}</div><div class="muted">${ppl.join('、')}${L.sh?'　接駁 '+L.sh.station+'（'+L.sh.type+'）':''}</div><div class="ov-total">預估 ${money(L.grand)}</div></div>
      <div class="form-grid-2">
        <div class="form-row"><label>聯絡人姓名 *</label><input type="text" id="cName" placeholder="例：王小明"></div>
        <div class="form-row"><label>聯絡人手機 *</label><input type="tel" id="cPhone" placeholder="0912-345-678"></div>
      </div>
      <div class="form-row"><label>Email（選填，寄確認信）</label><input type="email" id="cEmail" placeholder="your@email.com"></div>
      <div class="muted" style="font-size:11px;margin:2px 0 12px;">實名制：每位旅客需身分證＋生日（半票/嬰兒可填健保卡號或生日）</div>
      <div id="paxList">${paxCardsHtml(n)}</div>
      <button class="btn btn-primary btn-block" id="confirmBtn">確認送出</button>
      <button class="btn btn-neutral btn-block" data-close style="margin-top:8px;">返回修改</button>`;
    $('ov').classList.add('active');
  }

  async function doSubmit(){
    if(!$('cName').value.trim()||!$('cPhone').value.trim()){ alert('請填聯絡人姓名與電話'); return; }
    const passengers=[];
    document.querySelectorAll('#paxList .pax-card').forEach(card=>{
      const g=k=>card.querySelector(`[data-px="${k}"]`).value;
      passengers.push({name:g('name'),id:g('id'),birth:g('birth')});
    });
    const shuttle=$('shuttle').value?{station:$('shuttle').value,type:shType}:null;
    const btn=$('confirmBtn'),orig=btn.textContent;btn.disabled=true;btn.textContent='送出中…';
    window._orderId=null;
    try{
      const res=await fetch(API+'/tours/ferry-order',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({tripType,outDate:$('outDate').value,backDate:$('backDate').value,direction:$('direction').value,
          counts:counts(),shuttle,contactName:$('cName').value,contactPhone:$('cPhone').value,email:($('cEmail')?$('cEmail').value:''),passengers,
          bookingOrderID:bookingParam||undefined})});
      const data=await res.json();
      if(res.status===422||(data&&data.needContact)){ alert(data.error||'此船票目前需專人為您確認，請加 LINE @dropinn 洽詢 🙏'); btn.disabled=false; btn.textContent=orig; return; }
      if(data&&data.success)window._orderId=data.orderId;
    }catch(e){}
    const txt=buildQuote(); // 趁表單還在 DOM 時組明細（失敗備援用）
    if(window._orderId){
      // 成功：訂單已進後台，客人不用複製，只給確認＋加 LINE
      const lineHref='https://line.me/R/oaMessage/%40dropinn/?'+encodeURIComponent('預訂單號 '+window._orderId+'，我要接收進度');
      $('ovBody').innerHTML=`
        <div class="ov-head"><div class="ov-title">已送出</div><button class="ov-x" data-close>×</button></div>
        <div style="text-align:center;padding:2px 0;">
          <div style="font-size:36px;line-height:1;">🌊</div>
          <div style="font-size:16px;margin-top:8px;">船票需求已送出</div>
          <div class="muted" style="font-size:13px;margin-top:8px;line-height:1.7;">單號 ${window._orderId}<br>船位有限，待雫旅向船公司確認後回覆你。</div>
        </div>
        <a href="${lineHref}" target="_blank" rel="noopener noreferrer" class="btn btn-block" style="margin-top:8px;background:#06C755;color:#fff;border-color:#06C755;">加 LINE 接收確認通知</a>
        <button class="btn btn-neutral btn-block" data-close style="margin-top:10px;">完成</button>`;
    } else {
      // 存檔失敗備援
      $('ovBody').innerHTML=`
        <div class="ov-head"><div class="ov-title">送出未完成</div><button class="ov-x" data-close>×</button></div>
        <div class="muted" style="font-size:12px;line-height:1.6;margin-bottom:8px;">系統暫時無法送出，請複製以下內容貼到 LINE 傳給雫旅。</div>
        <textarea id="quoteText" readonly>${txt}</textarea>
        <div class="quote-actions"><button class="btn btn-primary" id="copyBtn">複製明細</button><button class="btn btn-neutral" data-close>關閉</button></div>`;
    }
  }

  // modal 事件委派
  $('ov').addEventListener('click',e=>{
    if(e.target.id==='ov'||e.target.closest('[data-close]')){ $('ov').classList.remove('active'); return; }
    if(e.target.id==='confirmBtn'){ doSubmit(); return; }
    if(e.target.id==='copyBtn'){ const ta=$('quoteText'); if(!ta) return;
      (async()=>{ try{await navigator.clipboard.writeText(ta.value);}catch(err){ta.select();document.execCommand('copy');}
        const b=$('copyBtn'),o=b.textContent;b.textContent='已複製 ✓';setTimeout(()=>b.textContent=o,1500); })();
    }
  });

  // ── 載入 ──
  (async function(){
    try{
      const res=await fetch(API+'/tours/products');
      const data=await res.json();
      FERRY=(data.products||[]).find(p=>p.id==='ferry-united');
      if(!FERRY){ $('calc').innerHTML='<div class="alert alert-warn">船票暫無資料</div>'; return; }
      META=JSON.parse(FERRY.meta||'{}');
      // 填接駁站下拉（分區）
      const sel=$('shuttle');
      ['北','中','南'].forEach(reg=>{
        const sts=(META.shuttles||[]).filter(s=>s.region===reg); if(!sts.length)return;
        const og=document.createElement('optgroup'); og.label=reg+'部';
        sts.forEach(s=>{ const op=document.createElement('option'); op.value=s.name; op.textContent=`${s.name}（${s.depart}發）${s.round}/來回`; og.appendChild(op); });
        sel.appendChild(og);
      });
      $('paxNote').textContent='半票：滿3-未滿12 / 滿65 / 愛心愛陪　嬰兒：未滿3歲';
      renderCalc();
    }catch(e){ $('calc').innerHTML='<div class="alert alert-warn">載入失敗，請重新整理</div>'; }
  })();
})();

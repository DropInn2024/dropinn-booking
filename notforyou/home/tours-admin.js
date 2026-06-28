/* ============================================================
 * 行程租車 · 財報 + 商品管理（home 後台的一個 tab）
 * ------------------------------------------------------------
 * 自包含模組：注入樣式 + 填充 #toursAdminRoot + 邏輯。
 * 用 home 既有的 _nfyFetch（共用 sessionStorage.admin_key 登入）。
 * 樣式全部 scope 在 #toursAdminRoot，不污染 home。
 * ============================================================ */
(function () {
  const root = document.getElementById('toursAdminRoot');
  if (!root) return;

  // ── 注入 scoped 樣式 ──
  const css = `
  #toursAdminRoot{--ta-accent:#6a5a45;--ta-hi:#a55a4f;--ta-success:#5a7a5a;--ta-info:#2a4258;--ta-muted:#6b5f56;--ta-border:rgba(181,171,160,.3);--ta-bs:rgba(181,171,160,.45);--ta-card:#f8f5ef;--ta-bg:#f5f1ec;font-family:'Noto Serif TC',serif;color:#1a1210}
  #toursAdminRoot .ta-topbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}
  #toursAdminRoot .ta-tabbar{display:flex;gap:8px}
  #toursAdminRoot .ta-period{display:flex;align-items:center;gap:8px;margin-left:auto}
  #toursAdminRoot .ta-tb{background:var(--ta-card);border:1px solid var(--ta-bs);border-radius:99px;padding:6px 16px;font-size:13px;letter-spacing:.1em;color:var(--ta-muted);cursor:pointer}
  #toursAdminRoot .ta-tb.on{background:#8a7868;color:#f8f5ef;border-color:transparent}
  #toursAdminRoot .ta-card{background:var(--ta-card);border:1px solid var(--ta-border);border-radius:16px;padding:20px;margin-bottom:18px}
  #toursAdminRoot .ta-h{font-family:'Cormorant Garamond',serif;font-size:18px;font-weight:300;letter-spacing:.18em;color:#4a3f35;margin-bottom:12px}
  #toursAdminRoot .ta-ctrl{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px}
  #toursAdminRoot select,#toursAdminRoot input,#toursAdminRoot textarea{font-family:'Noto Serif TC',serif;font-size:14px;padding:7px 10px;border:1px solid var(--ta-bs);border-radius:8px;background:var(--ta-bg);color:#1a1210}
  #toursAdminRoot .ta-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:10px}
  #toursAdminRoot .ta-kpi{background:var(--ta-bg);border:1px solid var(--ta-border);border-radius:12px;padding:13px}
  #toursAdminRoot .ta-kpi .l{font-family:'Cormorant Garamond',serif;font-size:10px;letter-spacing:.22em;color:var(--ta-muted);text-transform:uppercase;margin-bottom:5px}
  #toursAdminRoot .ta-kpi .v{font-family:'Cormorant Garamond',serif;font-size:21px;color:var(--ta-accent);font-variant-numeric:tabular-nums}
  #toursAdminRoot .ta-kpi .v.p{color:var(--ta-success)}
  #toursAdminRoot table{width:100%;border-collapse:collapse;font-size:13px}
  #toursAdminRoot th,#toursAdminRoot td{padding:8px 9px;text-align:left;border-bottom:1px solid var(--ta-border);word-break:break-word;overflow-wrap:anywhere}
  #toursAdminRoot th{font-family:'Cormorant Garamond',serif;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ta-muted);font-weight:400;background:rgba(26,18,16,.025)}
  #toursAdminRoot td.n,#toursAdminRoot th.n{text-align:right;font-variant-numeric:tabular-nums}
  #toursAdminRoot .ta-chip{display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px}
  #toursAdminRoot .c1{background:rgba(42,66,88,.1);color:var(--ta-info)}
  #toursAdminRoot .c2{background:rgba(90,122,90,.13);color:var(--ta-success)}
  #toursAdminRoot .c3{background:rgba(106,90,69,.12);color:var(--ta-accent)}
  #toursAdminRoot .c4{background:rgba(165,90,79,.13);color:var(--ta-hi)}
  #toursAdminRoot .p{color:var(--ta-success);font-variant-numeric:tabular-nums}
  #toursAdminRoot .muted{color:var(--ta-muted)}
  #toursAdminRoot .ta-btn{border:none;cursor:pointer;font-family:'Noto Serif TC',serif;border-radius:7px;padding:5px 12px;font-size:12px;letter-spacing:.08em}
  #toursAdminRoot .b-pri{background:#a89684;color:#f8f5ef}
  #toursAdminRoot .b-go{background:var(--ta-success);color:#f8f5ef}
  #toursAdminRoot .b-no{background:var(--ta-hi);color:#f8f5ef}
  #toursAdminRoot .b-nt{background:#f8f5ef;border:1px solid var(--ta-bs);color:#1a1210}
  #toursAdminRoot #taProd input{width:62px;padding:4px 6px;font-family:'Cormorant Garamond',serif;font-size:13px;text-align:right;font-variant-numeric:tabular-nums}
  #toursAdminRoot #taProd .cost{border-color:rgba(165,90,79,.55);background:rgba(165,90,79,.07);color:#8f3f37}
  #toursAdminRoot .ta-sec{font-family:'Cormorant Garamond',serif;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--ta-accent);border-bottom:1px solid var(--ta-border);padding-bottom:5px;margin-bottom:8px}
  #toursAdminRoot .ta-hint{font-size:11px;color:var(--ta-muted);line-height:1.6;margin:0 0 8px}
  #toursAdminRoot .ta-miss{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:99px;font-size:10px;background:rgba(165,90,79,.13);color:var(--ta-hi);letter-spacing:.05em;vertical-align:middle}
  #toursAdminRoot .ta-flag{display:inline-block;margin-left:8px;padding:1px 8px;border-radius:99px;font-size:10px;background:rgba(186,117,23,.14);color:#8a5a0b;letter-spacing:.05em;vertical-align:middle}
  #toursAdminRoot .ta-sess input{width:100%}
  #toursAdminRoot .ta-sess-del{padding:5px 10px}
  #toursAdminRoot .ta-notice,#toursAdminRoot #taProd textarea{font-family:'Noto Serif TC',serif}
  /* 篩選下拉（類別/年/月/狀態）：完全比照財務期間—無框透明、Cormorant、用原生小箭頭 */
  #toursAdminRoot .ta-ctrl select,#toursAdminRoot .ta-period select{border:none!important;border-radius:0;background:transparent!important;box-shadow:none!important;outline:none;
    width:auto;padding:0 2px;color:#5b5247;font-family:'Cormorant Garamond','Noto Serif TC',serif;font-size:15px;letter-spacing:.03em;cursor:pointer}
  #toursAdminRoot .ta-ctrl select:focus,#toursAdminRoot .ta-period select:focus{outline:none}
  #toursAdminRoot .ta-slash{color:#cabfae;font-family:'Cormorant Garamond',serif;font-size:15px}
  @media(max-width:480px){
    #toursAdminRoot .ta-ctrl{gap:6px}
    #toursAdminRoot .ta-h{font-size:16px}
    #toursAdminRoot th,#toursAdminRoot td{padding:7px 6px}
  }
  `;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ── 填充 HTML ──
  root.innerHTML = `
    <div class="ta-topbar">
      <div class="ta-tabbar">
        <button class="ta-tb on" data-sub="fin">財報</button>
        <button class="ta-tb" data-sub="prod">商品管理</button>
      </div>
      <div class="ta-period" id="taPeriod">
        <select id="taYear"></select>
        <span class="ta-slash">/</span>
        <select id="taMonth">
          <option value="0">整年</option><option value="1">一月</option><option value="2">二月</option>
          <option value="3">三月</option><option value="4">四月</option><option value="5">五月</option>
          <option value="6">六月</option><option value="7">七月</option><option value="8">八月</option>
          <option value="9">九月</option><option value="10">十月</option><option value="11">十一月</option><option value="12">十二月</option>
        </select>
        <button class="ta-btn b-pri" id="taLoad">查詢</button>
      </div>
    </div>

    <div id="taFin">
      <div class="ta-card">
        <div class="ta-h">供應商月結</div>
        <div class="ta-kpis" id="taKpis"></div>
        <table id="taVendor" style="margin-top:10px;"><thead><tr>
          <th>供應商</th><th class="n">訂單數</th><th class="n">營收</th><th class="n">付供應商成本</th><th class="n">利潤</th><th>結算</th>
        </tr></thead><tbody></tbody></table>
        <p class="ta-hint" id="taSettleHint" style="margin-top:8px;display:none;">結算＝把當月該供應商成本「鎖成快照、標記已付」。結算後該供應商當月訂單會鎖住不能改，需先解除結算。只有選單月才能結算。</p>
      </div>
      <div class="ta-card">
        <div class="ta-h">訂單</div>
        <div class="ta-ctrl"><span class="muted" style="font-size:12px;">狀態</span>
          <select id="taStatus"><option value="">全部</option><option>待確認</option><option>訂單成立</option><option>已完成</option><option>已取消</option></select>
        </div>
        <div style="overflow-x:auto;"><table id="taOrders"><thead><tr>
          <th>單號/時間</th><th>品項</th><th>聯絡</th><th class="n">賣價</th><th class="n">成本</th><th class="n">利潤</th><th>住客單</th><th>狀態</th><th>操作</th>
        </tr></thead><tbody></tbody></table></div>
        <div id="taEmpty" class="muted" style="text-align:center;padding:16px;display:none;">此期間沒有訂單</div>
        <div id="taPager" style="text-align:center;margin-top:14px;display:none;align-items:center;justify-content:center;gap:6px;"></div>
      </div>
    </div>

    <div id="taProd" style="display:none;">
      <div class="ta-card">
        <div class="ta-h">商品管理</div>
        <div class="ta-ctrl"><span class="muted" style="font-size:12px;">類別</span><select id="taCat"></select></div>
        <p class="muted" style="font-size:12px;margin-bottom:12px;line-height:1.7;">改完按該列「存」。<strong style="color:var(--ta-hi);">成本（茜色框）只有你看得到</strong>。</p>
        <div id="taArea" style="overflow-x:auto;"></div>
      </div>
    </div>
  `;

  // ── helper ──
  const $ = s => root.querySelector(s);
  const money = n => (n==null||isNaN(n)) ? '—' : 'NT$ '+Number(n).toLocaleString('en-US');
  const api = (m,p,b) => _nfyFetch(m,p,b);

  // ── 複製給旅行社：純下單委託訊息（不含任何賣價／成本，純客人需求）──
  function peopleLine(c){ c=c||{}; const a=[]; if(+c.adult)a.push('全票×'+(+c.adult)); if(+c.child)a.push('半票×'+(+c.child)); if(+c.infant)a.push('嬰幼兒×'+(+c.infant)); return a.join('、')||'—'; }
  function paxLines(list){
    if(!Array.isArray(list)||!list.length) return '';
    const rows=list.map((p,i)=>{ const parts=[p.name||'—']; if(p.id)parts.push(p.id); if(p.birth)parts.push(p.birth); return '  '+(i+1)+'. '+parts.join(' / '); }).filter(Boolean);
    return rows.length ? '旅客名單（實名）：\n'+rows.join('\n')+'\n' : '';
  }
  // 行程委託（單筆或整組購物車）：比照客報照片格式，M/D 行程名 / 場次 人數位 + 聯絡人 + 逐位旅客身分證/生日
  function mdOf(s){ const m=String(s||'').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); return m? (+m[2])+'/'+(+m[3]) : (s||''); }
  function headCount(c){ c=c||{}; const a=+c.adult||0,h=+c.child||0,i=+c.infant||0,t=a+h+i; return t+'位'+((h||i)?`（全${a}${h?'半'+h:''}${i?'嬰'+i:''}）`:''); }
  function tourAgentMsg(orders){
    const lines=['【雫旅 行程委託】'+(orders.length>1?`（共 ${orders.length} 項）`:'')];
    let contact=null, pax=[];
    orders.forEach(o=>{
      let d={}; try{ d=JSON.parse(o.detail||'{}'); }catch(e){}
      lines.push((d.date?mdOf(d.date)+' ':'')+(d.productName||o.productId||''));
      lines.push((d.session?d.session+'　':'')+headCount(d.counts)
        +(Array.isArray(d.addons)&&d.addons.length?'　加購:'+d.addons.join('、'):'')+(d.board?'　'+d.board:''));
      if(!contact) contact={name:o.contactName||'',phone:o.contactPhone||''};
      if(!pax.length && Array.isArray(d.passengers)&&d.passengers.length) pax=d.passengers;
    });
    lines.push('聯絡人姓名：'+(contact?contact.name:''));
    lines.push('聯絡人手機：'+(contact?contact.phone:''));
    if(pax.length){
      lines.push('－');
      pax.forEach((p,i)=>{ lines.push('旅客'+(i+1)+'：'+(p.name||'')); lines.push('身分證：'+(p.id||'')); lines.push('生日：'+(p.birth||'')); if(i<pax.length-1)lines.push(''); });
    }
    lines.push(''); lines.push('※ 皆需實名／投保，請協助確認安排，謝謝！');
    return lines.join('\n');
  }
  function agentMsg(o){
    let d={}; try{ d=JSON.parse(o.detail||'{}'); }catch(e){}
    const head=t=>'【雫旅 '+t+'委託】'+o.id+'\n';
    const foot='\n請協助確認名額／有無，謝謝！';
    const contact='聯絡人：'+(o.contactName||'')+'　'+(o.contactPhone||'');
    if(o.kind==='ferry'){
      const round=d.tripType==='round';
      let s=head('船票');
      s+='票種：'+(round?'來回':'單程')+'\n';
      if(round){ s+='去程：'+(d.outDate||'')+'　布袋→馬公\n'; s+='回程：'+(d.backDate||'')+'　馬公→布袋\n'; }
      else { s+='日期：'+(d.outDate||'')+'　'+(d.direction==='back'?'馬公→布袋':'布袋→馬公')+'\n'; }
      s+='人數：'+peopleLine(d.counts)+'\n';
      if(d.shuttle&&d.shuttle.station) s+='接駁：'+d.shuttle.station+'（'+(d.shuttle.type==='single'?'單程':'來回')+'）\n';
      s+=paxLines(d.passengers);
      return s+contact+foot;
    }
    if(o.kind==='rental'){
      let s=head('租車');
      s+='車種：'+(d.productName||o.productId||'')+(d.seats?'（'+d.seats+'人）':'')+'\n';
      if(Array.isArray(d.segments)&&d.segments.length){
        s+='租期：\n'+d.segments.map(g=>'  '+String(g.pickup||'').replace('T',' ')+' → '+String(g.return||'').replace('T',' ')).join('\n')+'\n';
      }
      if(d.depart) s+='去程航班/船班：'+d.depart+'\n';
      if(d.backflight) s+='回程航班/船班：'+d.backflight+'\n';
      if(d.note) s+='備註：'+d.note+'\n';
      return s+contact+foot;
    }
    // tour（單筆）→ 用整組格式（照片格式）
    return tourAgentMsg([o]);
  }
  async function copyAgent(id){
    const o=_ordList.find(x=>x.id===id); if(!o)return;
    let msg;
    if(o.kind==='tour'){
      let orders=[o];
      if(o.groupId){ try{ const g=await api('GET','/api/admin/tours/group?groupId='+encodeURIComponent(o.groupId)); if(g&&Array.isArray(g.orders)&&g.orders.length) orders=g.orders; }catch(e){} }
      msg=tourAgentMsg(orders);
    } else { msg=agentMsg(o); }
    const done=()=>alert('✅ 已複製委託訊息，貼到 LINE 傳給旅行社即可');
    if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(msg).then(done).catch(()=>prompt('請手動複製：',msg)); }
    else prompt('請手動複製：',msg);
  }

  // 年份下拉
  (function(){ const y=new Date().getFullYear(); const s=$('#taYear');
    for(let i=y+1;i>=y-2;i--){ const o=document.createElement('option'); o.value=i;o.textContent=i+'年'; if(i===y)o.selected=true; s.appendChild(o);}
    $('#taMonth').value=String(new Date().getMonth()+1);
  })();

  // ── 財報 ──
  async function loadReport(){
    const y=$('#taYear').value, m=$('#taMonth').value;
    const rep=await api('GET',`/api/admin/tours/report?year=${y}&month=${m}`);
    const t=(rep&&rep.totals)||{revenue:0,cost:0,profit:0,orders:0};
    const pend=(rep&&rep.pending)||{count:0,amount:0};
    $('#taKpis').innerHTML=`
      <div class="ta-kpi"><div class="l">訂單數</div><div class="v">${t.orders||0}</div></div>
      <div class="ta-kpi"><div class="l">營收</div><div class="v">${money(t.revenue)}</div></div>
      <div class="ta-kpi"><div class="l">付供應商成本</div><div class="v">${money(t.cost)}</div></div>
      <div class="ta-kpi"><div class="l">利潤</div><div class="v p">${money(t.profit)}</div></div>`
      // 待確認：不計營收，提醒去確認「訂單成立」。有才顯示
      +(pend.count>0?`<div class="ta-kpi"><div class="l">待確認</div><div class="v" style="color:var(--ta-hi)">${money(pend.amount)}</div><div class="muted" style="font-size:10px;margin-top:3px;">${pend.count} 筆，記得去確認</div></div>`:'');
    const rows=(rep&&rep.byVendor)||[];
    // 結算：只有選單月才能結（tour_settlements 按 vendor+YYYY-MM）。整年模式只顯示，不給按鈕。
    const isMonth = m && m!=='0';
    _settleMonth = isMonth ? `${y}-${String(m).padStart(2,'0')}` : '';
    const settMap={}; ((rep&&rep.settlements)||[]).forEach(s=>{ settMap[s.vendor]=s; });
    $('#taSettleHint').style.display = isMonth ? 'block' : 'none';
    $('#taVendor').querySelector('tbody').innerHTML = rows.length ? rows.map(v=>{
      let cell;
      if(!isMonth){ cell='<span class="muted" style="font-size:11px;">選單月可結算</span>'; }
      else{
        const s=settMap[v.vendor];
        if(s&&s.settledAt){
          const drift=(+s.totalCost!==+v.cost);
          cell=`<span class="ta-chip c2">已結清</span> <span class="muted" style="font-size:11px;">${money(s.totalCost)}</span>`
            +(drift?`<br><span style="color:var(--ta-hi);font-size:10px;">⚠ 成本已變動（現 ${money(v.cost)}），需解除後重結</span>`:'')
            +`<br><button class="ta-btn b-nt" data-unsettle="${esc(v.vendor)}" style="margin-top:3px;">解除結算</button>`;
        }else{
          cell=`<button class="ta-btn b-go" data-settle="${esc(v.vendor)}">結算 ${money(v.cost)}</button>`;
        }
      }
      return `<tr><td>${esc(v.vendor)}</td><td class="n">${v.orderCount}</td><td class="n">${money(v.revenue)}</td><td class="n">${money(v.cost)}</td><td class="n p">${money(v.profit)}</td><td>${cell}</td></tr>`;
    }).join('')
      : `<tr><td colspan="6" class="muted" style="text-align:center;">此期間無訂單成立／已完成訂單</td></tr>`;
    _ordPage=1; await loadOrders();
  }
  let _settleMonth='';
  // 訂單列表：跟著期間（出團/用車日同口徑）+ 狀態過濾，分頁 10 筆/頁
  let _ordPage=1;
  async function loadOrders(){
    const y=$('#taYear').value, m=$('#taMonth').value, status=$('#taStatus').value;
    const qs=`year=${y}&month=${m}&page=${_ordPage}`+(status?('&status='+encodeURIComponent(status)):'');
    const ord=await api('GET','/api/admin/tours/orders?'+qs)||{};
    renderOrders(ord.orders||[]);
    renderPager(ord);
  }
  function renderPager(o){
    const pg=$('#taPager'); if(!pg)return;
    const page=o.page||1, totalPages=o.totalPages||1, total=o.total||0;
    if(total<=0){ pg.style.display='none'; pg.innerHTML=''; return; }
    pg.style.display='flex';
    pg.innerHTML=`<button class="ta-btn b-nt" data-pg="prev" ${page<=1?'disabled style="opacity:.4;cursor:default"':''}>‹ 上一頁</button>`
      +`<span class="muted" style="font-size:12px;">第 ${page} / ${totalPages} 頁 · 共 ${total} 筆</span>`
      +`<button class="ta-btn b-nt" data-pg="next" ${page>=totalPages?'disabled style="opacity:.4;cursor:default"':''}>下一頁 ›</button>`;
  }
  let _ordList=[];
  function renderOrders(list){
    _ordList=list||[];
    $('#taEmpty').style.display = list.length?'none':'block';
    const cls={'待確認':'c1','訂單成立':'c2','已完成':'c3','已取消':'c4'};
    $('#taOrders').querySelector('tbody').innerHTML = list.map(o=>{
      let item=o.productId||''; try{const d=JSON.parse(o.detail||'{}'); if(d.productName)item=d.productName+(d.seats?`（${d.seats}人）`:'');}catch(e){}
      return `<tr>
        <td><span style="font-family:'Cormorant Garamond',serif;">${o.id}</span><br><span class="muted" style="font-size:11px;">${(o.createdAt||'').slice(5,16)}</span></td>
        <td>${item}<br><span class="muted" style="font-size:11px;">${o.vendor}</span></td>
        <td>${o.contactName||''}<br><span class="muted" style="font-size:11px;">${o.contactPhone||''}</span></td>
        <td class="n">${money(o.sellAmount)}</td><td class="n muted">${money(o.costAmount)}</td><td class="n p">${money(o.profit)}</td>
        <td>${o.bookingOrderID?`<span class="muted" style="font-size:11px;">${o.bookingOrderID}</span>`:'<span class="muted">—</span>'}</td>
        <td><span class="ta-chip ${cls[o.status]||'c1'}">${o.status}</span></td>
        <td><div style="display:flex;gap:5px;flex-wrap:wrap;">
          <button class="ta-btn b-nt" data-copy="${o.id}">給旅行社</button>
          ${o.status!=='訂單成立'?`<button class="ta-btn b-go" data-os="${o.id}" data-v="訂單成立">訂單成立</button>`:''}
          ${o.status!=='已完成'?`<button class="ta-btn b-nt" data-os="${o.id}" data-v="已完成">已完成</button>`:''}
          ${o.status!=='已取消'?`<button class="ta-btn b-no" data-os="${o.id}" data-v="已取消">已取消</button>`:''}
        </div></td></tr>`;
    }).join('');
  }
  async function setStatus(id,v){
    if(v==='已取消'&&!confirm('確定取消這筆訂單？\n（取消手續費由客人負擔，記得跟客人／旅行社確認）'))return;
    try{ await api('POST','/api/admin/tours/order-status',{id,status:v}); loadReport(); }catch(e){ alert('更新失敗'); }
  }

  // ── 商品管理 helper：meta / 場次 / 須知 ──
  const esc = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  function metaOf(p){ try{ return JSON.parse(p.meta||'{}'); }catch(e){ return {}; } }
  // 缺成本判定：這種商品下單會被「擋下單→導專人」。rental 看 cost_day、tour 看 cost_adult、ferry 看 cost_json.fares
  function costMissingProd(p){
    if(p.kind==='rental') return (+p.cost_day||0)<=0;
    if(p.kind==='ferry'){ try{ return !(JSON.parse(p.cost_json||'{}').fares); }catch(e){ return true; } }
    return (+p.cost_adult||0)<=0;
  }
  const missBadge = p => costMissingProd(p) ? '<span class="ta-miss">缺成本 · 會導專人</span>' : '';
  // 未設場次：沒存過 meta.sessions[] → 前台顯示「時間另行通知」，提醒你去填（純說明/不固定的可不填）
  const sessFlag = m => !(Array.isArray(m.sessions) && m.sessions.length) ? '<span class="ta-flag">未設場次</span>' : '';
  // 舊 schedule 文字 → 可選場次陣列（與前台 parseSessions 同邏輯，給預填用）
  function parseSched(s){ s=(s||'').trim(); if(!s) return [];
    if(/通知|潮汐|機動|另行|視天候|視天氣|微調|左右|待公佈|\d{1,2}\/\d{1,2}/.test(s)) return [];
    let parts=s.split(/\s*[\/／；;]\s*/).map(x=>x.trim()).filter(p=>p && /\d{1,2}:\d{2}/.test(p));
    if(parts.length<2){ const t=s.match(/\d{1,2}:\d{2}(?:\s*[-~]\s*\d{1,2}:\d{2})?/g); if(t&&t.length>=2)parts=t; }
    return parts;
  }
  function sessionsOf(p,m){ if(Array.isArray(m.sessions)&&m.sessions.length) return m.sessions.slice(); return parseSched(m.schedule); }
  function sessRowHTML(v){ return `<div class="ta-sess-row" style="display:flex;gap:6px;margin-bottom:5px;">`+
    `<input class="ta-sess" value="${esc(v)}" placeholder="例 08:30，或 09:00-14:00" style="flex:1;">`+
    `<button type="button" class="ta-btn b-no ta-sess-del" title="刪除">刪</button></div>`; }
  // 通用須知（留空時前台會自動套，這裡當預填底稿）
  const UNIVERSAL_NOTICE =
    '・報到：請於場次前 30 分鐘到集合點（實際時間以業者前一天通知為準）\n'+
    '・攜帶：身分證正本（實名制，含船／登島必備）；兒童、嬰幼兒帶健保卡或生日\n'+
    '・天候：因天氣或船班停航可全額退費或改期\n'+
    '・取消：出發前如需取消，依業者規定可能收取手續費，請儘早告知\n'+
    '・成立：名額有限，送出僅為預訂，待雫旅向業者確認後才正式成立\n'+
    '・聯絡：建議加入雫旅 LINE，確認與後續通知更即時';
  function noticeDraft(p,m){
    if(m.notice && String(m.notice).trim()) return m.notice;
    // 預填：把原本的取消政策放最前面，再接通用須知
    const cp=(m.cancel_policy||'').trim();
    return (cp ? '・取消：'+cp+'\n' : '') + UNIVERSAL_NOTICE;
  }

  // ── 商品管理 ──
  let _all=[], _loaded=false;
  async function loadProds(){
    const d=await api('GET','/api/admin/tours/products-full'); _all=(d&&d.products)||[];
    const cats=[]; if(_all.some(p=>p.kind==='rental'))cats.push({v:'__r',t:'租車'});
    [...new Set(_all.filter(p=>p.kind!=='rental').map(p=>p.category))].forEach(c=>cats.push({v:c,t:c}));
    const s=$('#taCat'); s.innerHTML=cats.map(c=>`<option value="${c.v}">${c.t}</option>`).join('');
    s.onchange=()=>renderProds(s.value); renderProds(s.value); _loaded=true;
  }
  function renderProds(cat){
    const area=$('#taArea'), rental=cat==='__r';
    const list=rental?_all.filter(p=>p.kind==='rental'):_all.filter(p=>p.kind!=='rental'&&p.category===cat);
    if(rental){
      area.innerHTML=`<table><thead><tr><th>車種</th><th class="n">牌價/天</th><th class="n">半天</th><th class="n">超時</th><th class="n">成本/天</th><th class="n">半天</th><th class="n">超時</th><th class="n">利潤/天</th><th></th></tr></thead><tbody>${
        list.map(p=>`<tr data-id="${p.id}">
          <td>${p.name}${p.seats?`（${p.seats}人）`:''}${missBadge(p)}<br><span class="muted" style="font-size:11px;">${p.vendor}</span></td>
          <td class="n"><input type="number" data-f="price_day" value="${p.price_day||0}"></td>
          <td class="n"><input type="number" data-f="price_half" value="${p.price_half||0}"></td>
          <td class="n"><input type="number" data-f="price_hour" value="${p.price_hour||0}"></td>
          <td class="n"><input type="number" class="cost" data-f="cost_day" value="${p.cost_day||0}"></td>
          <td class="n"><input type="number" class="cost" data-f="cost_half" value="${p.cost_half||0}"></td>
          <td class="n"><input type="number" class="cost" data-f="cost_hour" value="${p.cost_hour||0}"></td>
          <td class="n p" data-pf>${money((p.price_day||0)-(p.cost_day||0))}</td>
          <td><button class="ta-btn b-pri" data-save="${p.id}">存</button></td></tr>`).join('')
        }</tbody></table>`;
    }else{
      const _noSess=list.filter(p=>{const mm=metaOf(p);return !(Array.isArray(mm.sessions)&&mm.sessions.length);}).length;
      const _sessSummary=_noSess?`<div class="ta-hint" style="background:rgba(186,117,23,.08);border-radius:8px;padding:8px 12px;margin-bottom:12px;">本類別 ${list.length} 個，其中 <strong style="color:#8a5a0b;">${_noSess} 個「未設場次」</strong>（前台顯示「時間另行通知」）。固定場次的記得填，不固定的可留空。</div>`:'';
      area.innerHTML=_sessSummary+(list.map((p,_i)=>{
        const m=metaOf(p), sess=sessionsOf(p,m), schedNote=(parseSched(m.schedule).length?'':(m.schedule||'').trim());
        return `
        <div data-id="${p.id}" style="border:1px solid var(--ta-border);border-radius:14px;padding:16px 16px 16px 18px;margin-bottom:16px;background:${_i%2?'#f2ebe0':'#fbf9f4'};border-left:3px solid ${_i%2?'rgba(138,120,104,.4)':'rgba(168,150,132,.55)'};box-shadow:0 2px 9px rgba(26,18,16,.05);">
          <div style="font-family:'Cormorant Garamond',serif;font-size:16px;">${esc(p.name)}${missBadge(p)}${sessFlag(m)}</div>
          <div class="muted" style="font-size:11px;margin-bottom:12px;">${esc(p.vendor)} · ${esc(p.category)}</div>

          <div class="ta-sec">價錢</div>
          <table style="margin-bottom:14px;"><thead><tr><th></th><th class="n">全票</th><th class="n">半票</th><th class="n">嬰幼兒</th><th class="n">利潤(全)</th></tr></thead><tbody>
            <tr><td class="muted" style="font-size:11px;">賣價</td>
              <td class="n"><input type="number" data-f="price_adult" value="${p.price_adult||0}"></td>
              <td class="n"><input type="number" data-f="price_child" value="${p.price_child||0}"></td>
              <td class="n"><input type="number" data-f="price_infant" value="${p.price_infant||0}"></td>
              <td class="n p" data-pf rowspan="2" style="vertical-align:middle;">${money((p.price_adult||0)-(p.cost_adult||0))}</td></tr>
            <tr><td class="muted" style="font-size:11px;">成本</td>
              <td class="n"><input type="number" class="cost" data-f="cost_adult" value="${p.cost_adult||0}"></td>
              <td class="n"><input type="number" class="cost" data-f="cost_child" value="${p.cost_child||0}"></td>
              <td class="n"><input type="number" class="cost" data-f="cost_infant" value="${p.cost_infant||0}"></td></tr>
          </tbody></table>

          <div class="ta-sec">場次</div>
          <p class="ta-hint">每個場次一列，前台會變成下拉讓客人選。不固定（如「前一天通知」）就全部留空，前台會顯示「時間另行通知，可與客服確認」，細節寫在下方須知。</p>
          <div class="ta-sess-list">${sess.map(sessRowHTML).join('')}</div>
          <button type="button" class="ta-btn b-nt ta-sess-add" style="margin:2px 0 14px;">＋ 新增場次</button>
          ${schedNote?`<div class="ta-hint" style="margin:-8px 0 14px;">原排程文字：「${esc(schedNote)}」（不固定場次，未轉成下拉）</div>`:''}

          <div class="ta-sec">介紹</div>
          <textarea data-f="description" style="width:100%;min-height:54px;font-size:13px;margin-bottom:14px;">${esc(p.description||'')}</textarea>

          <div class="ta-sec">須知（含取消說明，會顯示在頁面並隨確認信寄給客人）</div>
          <p class="ta-hint">留空就自動套通用須知。每點一列、開頭用「・」。</p>
          <textarea class="ta-notice" style="width:100%;min-height:128px;font-size:13px;line-height:1.7;">${esc(noticeDraft(p,m))}</textarea>

          <details style="margin-top:6px;"><summary class="muted" style="font-size:11px;cursor:pointer;letter-spacing:.05em;">進階：成本 / 規則（JSON）— 船票票價成本、板型成本、接駁成本、加購</summary>
            <p class="ta-hint" style="margin-top:8px;">這兩格原本只能改資料庫。<strong style="color:var(--ta-hi);">cost_json 是成本（機密，絕不外洩給客人）</strong>；rules_json 是加購／逢單補／板型售價。格式錯會擋下存檔。</p>
            <div class="ta-sec">cost_json（成本）</div>
            <textarea data-f="cost_json" spellcheck="false" style="width:100%;min-height:90px;font-size:11px;font-family:ui-monospace,monospace;line-height:1.5;">${esc(p.cost_json||'')}</textarea>
            <div class="ta-sec" style="margin-top:8px;">rules_json（加購／逢單補／板型）</div>
            <textarea data-f="rules_json" spellcheck="false" style="width:100%;min-height:90px;font-size:11px;font-family:ui-monospace,monospace;line-height:1.5;">${esc(p.rules_json||'')}</textarea>
          </details>

          <div style="text-align:right;margin-top:10px;"><button class="ta-btn b-pri" data-save="${p.id}">儲存</button></div>
        </div>`;}).join('') || '<p class="muted" style="text-align:center;padding:16px;">此類別無商品</p>');
    }
  }
  async function saveProd(id){
    const row=root.querySelector(`#taArea [data-id="${id}"]`); if(!row)return;
    const body={id}; row.querySelectorAll('[data-f]').forEach(i=>body[i.getAttribute('data-f')]=i.value);
    const p=_all.find(x=>x.id===id);
    // 行程才有場次/須知；合併進既有 meta（保留成本備註等內部欄位）
    if(p && p.kind!=='rental'){
      const m=metaOf(p);
      const sessions=Array.from(row.querySelectorAll('.ta-sess')).map(i=>i.value.trim()).filter(Boolean);
      m.sessions=sessions;
      const nt=row.querySelector('.ta-notice'); if(nt) m.notice=nt.value;
      body.meta=JSON.stringify(m);
    }
    const btn=row.querySelector('button[data-save]'); const o=btn.textContent; btn.textContent='存…'; btn.disabled=true;
    try{ const r=await api('POST','/api/admin/tours/product',body);
      if(r&&r.error){ btn.textContent='未存'; alert('儲存失敗：'+r.error); }   // 含 cost_json/rules_json 格式錯
      else{
        const pd=parseInt(body.price_day??body.price_adult??0,10), cd=parseInt(body.cost_day??body.cost_adult??0,10);
        const pe=row.querySelector('[data-pf]'); if(pe)pe.textContent=money(pd-cd);
        if(p)Object.assign(p,body); btn.textContent='已存 ✓';
      }
    }catch(e){ btn.textContent='失敗'; }
    setTimeout(()=>{ btn.textContent=o; btn.disabled=false; },1400);
  }

  // ── 事件 ──
  $('#taLoad').addEventListener('click', loadReport);
  $('#taStatus').addEventListener('change', ()=>{ _ordPage=1; loadOrders(); }); // 換狀態：回第 1 頁，只重載訂單
  $('#taPager').addEventListener('click', e=>{
    const b=e.target.closest('button[data-pg]'); if(!b||b.disabled)return;
    _ordPage=Math.max(1,_ordPage+(b.getAttribute('data-pg')==='next'?1:-1));
    loadOrders();
  });
  $('#taOrders').addEventListener('click', e=>{
    const cp=e.target.closest('button[data-copy]'); if(cp){ copyAgent(cp.getAttribute('data-copy')); return; }
    const b=e.target.closest('button[data-os]'); if(b)setStatus(b.getAttribute('data-os'),b.getAttribute('data-v'));
  });
  // 結算 / 解除結算（按供應商月結）
  $('#taVendor').addEventListener('click', async e=>{
    const sb=e.target.closest('button[data-settle]'), ub=e.target.closest('button[data-unsettle]');
    if(!_settleMonth) return;
    if(sb){ const vendor=sb.getAttribute('data-settle');
      if(!confirm(`確定結算「${vendor}」${_settleMonth}？\n會把當月成本鎖成快照、標記已付，該供應商當月訂單將鎖住（要改需先解除結算）。`))return;
      sb.disabled=true; sb.textContent='結算中…';
      const r=await api('POST','/api/admin/tours/settle',{monthKey:_settleMonth,vendor})||{};
      if(r.error)alert('結算失敗：'+r.error);
      loadReport();
    }else if(ub){ const vendor=ub.getAttribute('data-unsettle');
      if(!confirm(`解除「${vendor}」${_settleMonth} 的結算？解除後該供應商當月訂單可再修改。`))return;
      ub.disabled=true;
      const r=await api('POST','/api/admin/tours/unsettle',{monthKey:_settleMonth,vendor})||{};
      if(r.error)alert('解除失敗：'+r.error);
      loadReport();
    }
  });
  $('#taArea').addEventListener('input', e=>{ const f=e.target.getAttribute('data-f');
    if(['price_day','cost_day','price_adult','cost_adult'].includes(f)){ const row=e.target.closest('[data-id]');
      const pd=parseInt((row.querySelector('[data-f=price_day]')||row.querySelector('[data-f=price_adult]'))?.value||0,10);
      const cd=parseInt((row.querySelector('[data-f=cost_day]')||row.querySelector('[data-f=cost_adult]'))?.value||0,10);
      const pe=row.querySelector('[data-pf]'); if(pe)pe.textContent=money(pd-cd); }});
  $('#taArea').addEventListener('click', e=>{
    const add=e.target.closest('.ta-sess-add');
    if(add){ const card=add.closest('[data-id]'), list=card.querySelector('.ta-sess-list');
      list.insertAdjacentHTML('beforeend', sessRowHTML('')); const ins=list.querySelector('.ta-sess-row:last-child .ta-sess'); if(ins)ins.focus(); return; }
    const del=e.target.closest('.ta-sess-del'); if(del){ const r=del.closest('.ta-sess-row'); if(r)r.remove(); return; }
    const b=e.target.closest('button[data-save]'); if(b)saveProd(b.getAttribute('data-save'));
  });

  // 子 tab
  root.querySelectorAll('.ta-tb').forEach(b=>b.addEventListener('click',()=>{
    root.querySelectorAll('.ta-tb').forEach(x=>x.classList.remove('on')); b.classList.add('on');
    const s=b.getAttribute('data-sub');
    $('#taFin').style.display=s==='fin'?'block':'none';
    $('#taProd').style.display=s==='prod'?'block':'none';
    $('#taPeriod').style.display=s==='fin'?'flex':'none'; // 期間只在財報用
    if(s==='prod'&&!_loaded)loadProds().catch(()=>{});
  }));

  // 首次切到「行程租車」tab 才載入財報
  let _init=false;
  document.querySelectorAll('.admin-tab[data-tab="tours"]').forEach(btn=>{
    btn.addEventListener('click',()=>{ if(!_init){ _init=true; loadReport().catch(()=>{}); } });
  });
})();

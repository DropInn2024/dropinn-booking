/* 雫旅 — 行程編輯器
   純前端：localStorage 暫存文字、照片壓縮成 base64、下載自帶資料的 HTML、可再載入重編。
   無後端、無第三方、符合本站 CSP（外部檔、無 inline）。 */
(function(){
  'use strict';
  var STORE = 'dropinn_itinerary_v1';
  var CN = ['零','一','二','三','四','五','六','七','八','九','十'];
  function cnNum(n){
    if(n<=10) return CN[n]||String(n);
    if(n<20) return '十'+(n%10?CN[n%10]:'');
    var t=Math.floor(n/10);
    return (CN[t]||t)+'十'+(n%10?CN[n%10]:'');
  }
  function esc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ---- 資料 ---- */
  var trip = load() || seed();

  function seed(){
    return { title:'', subtitle:'', days:[ newDay() ] };
  }
  function newDay(){ return { title:'', date:'', lead:'', stops:[ newStop() ], photos:[] }; }
  function newStop(){ return { time:'', name:'', area:'', note:'' }; }

  function normalize(t){
    if(!t || !Array.isArray(t.days)) return seed();
    t.title=t.title||''; t.subtitle=t.subtitle||'';
    t.days = t.days.map(function(d){
      d = d||{}; d.title=d.title||''; d.date=d.date||''; d.lead=d.lead||'';
      d.stops = Array.isArray(d.stops)&&d.stops.length ? d.stops.map(function(s){ s=s||{}; return {time:s.time||'',name:s.name||'',area:s.area||'',note:s.note||''}; }) : [ newStop() ];
      d.photos = Array.isArray(d.photos) ? d.photos.filter(function(p){return typeof p==='string';}) : [];
      return d;
    });
    if(!t.days.length) t.days=[ newDay() ];
    return t;
  }

  function load(){
    try{ var raw=localStorage.getItem(STORE); return raw?normalize(JSON.parse(raw)):null; }catch(e){ return null; }
  }
  function save(){
    // 照片不進 localStorage（避免容量爆）；只暫存文字
    try{
      var slim={ title:trip.title, subtitle:trip.subtitle, days:trip.days.map(function(d){
        return { title:d.title, date:d.date, lead:d.lead, stops:d.stops, photos:[] };
      })};
      localStorage.setItem(STORE, JSON.stringify(slim));
    }catch(e){}
  }

  /* ---- 畫面 ---- */
  var $days = document.getElementById('days');
  var $title = document.getElementById('tTitle');
  var $sub = document.getElementById('tSub');

  function render(){
    $title.value = trip.title;
    $sub.value = trip.subtitle;
    var html='';
    trip.days.forEach(function(d, di){
      html += '<div class="day" data-day="'+di+'">';
      html +=   '<div class="day-top">';
      html +=     '<span class="day-badge">'+(di+1)+'</span>';
      html +=     '<div class="day-fields">';
      html +=       '<input data-k="dtitle" data-day="'+di+'" placeholder="第'+cnNum(di+1)+'天的主題，例：馬公市區・靈魂小吃" value="'+esc(d.title)+'">';
      html +=       '<input class="d" data-k="ddate" data-day="'+di+'" placeholder="日期，例：07 / 01　Wed" value="'+esc(d.date)+'">';
      html +=     '</div>';
      html +=   '</div>';
      html +=   '<div class="lab">今日筆記</div>';
      html +=   '<textarea data-k="dlead" data-day="'+di+'" placeholder="這天的一句話心情（選填）">'+esc(d.lead)+'</textarea>';

      html +=   '<div class="lab">站點</div>';
      d.stops.forEach(function(s, si){
        html += '<div class="stop" data-day="'+di+'" data-stop="'+si+'">';
        html +=   '<div class="time"><input data-k="time" data-day="'+di+'" data-stop="'+si+'" placeholder="時間" value="'+esc(s.time)+'"></div>';
        html +=   '<div class="mid">';
        html +=     '<input class="nm" data-k="name" data-day="'+di+'" data-stop="'+si+'" placeholder="地點名稱" value="'+esc(s.name)+'">';
        html +=     '<input class="ar" data-k="area" data-day="'+di+'" data-stop="'+si+'" placeholder="區域・類型（選填）" value="'+esc(s.area)+'">';
        html +=     '<input class="nt" data-k="note" data-day="'+di+'" data-stop="'+si+'" placeholder="備註（選填）" value="'+esc(s.note)+'">';
        html +=   '</div>';
        html +=   '<div class="stopctl">';
        if(trip.days.length>1){
          var opts=''; for(var k=0;k<trip.days.length;k++){ opts+='<option value="'+k+'"'+(k===di?' selected':'')+'>第'+cnNum(k+1)+'天</option>'; }
          html += '<select class="daysel" data-day="'+di+'" data-stop="'+si+'" title="移到第幾天">'+opts+'</select>';
        }
        html +=     '<button class="x" data-act="rmstop" data-day="'+di+'" data-stop="'+si+'" title="刪除站點">×</button>';
        html +=   '</div>';
        html += '</div>';
      });
      html +=   '<button class="add-stop" data-act="addstop" data-day="'+di+'">＋ 新增站點</button>';

      html +=   '<div class="lab">今日相片</div>';
      html +=   '<div class="photos">';
      d.photos.forEach(function(p, pi){
        html += '<div class="thumb"><img src="'+p+'" alt=""><button class="rm" data-act="rmphoto" data-day="'+di+'" data-photo="'+pi+'">×</button></div>';
      });
      html +=     '<button class="addp" data-act="addphoto" data-day="'+di+'" title="加照片">＋</button>';
      html +=   '</div>';

      html +=   '<div class="day-foot"><button data-act="rmday" data-day="'+di+'">刪除第'+cnNum(di+1)+'天</button></div>';
      html += '</div>';
    });
    $days.innerHTML = html;
  }

  /* ---- 編輯事件 ---- */
  $title.addEventListener('input', function(){ trip.title=this.value; save(); });
  $sub.addEventListener('input', function(){ trip.subtitle=this.value; save(); });

  $days.addEventListener('input', function(e){
    var t=e.target, k=t.getAttribute('data-k'); if(!k) return;
    var di=+t.getAttribute('data-day');
    if(k==='dtitle') trip.days[di].title=t.value;
    else if(k==='ddate') trip.days[di].date=t.value;
    else if(k==='dlead') trip.days[di].lead=t.value;
    else { var si=+t.getAttribute('data-stop'); trip.days[di].stops[si][k]=t.value; }
    save();
  });

  $days.addEventListener('click', function(e){
    var t=e.target, act=t.getAttribute('data-act'); if(!act) return;
    var di=+t.getAttribute('data-day');
    if(act==='addstop'){ trip.days[di].stops.push(newStop()); render(); save(); }
    else if(act==='rmstop'){ var si=+t.getAttribute('data-stop'); trip.days[di].stops.splice(si,1); if(!trip.days[di].stops.length) trip.days[di].stops.push(newStop()); render(); save(); }
    else if(act==='rmday'){ if(trip.days.length>1){ trip.days.splice(di,1); render(); save(); } else toast('至少保留一天'); }
    else if(act==='rmphoto'){ var pi=+t.getAttribute('data-photo'); trip.days[di].photos.splice(pi,1); render(); }
    else if(act==='addphoto'){ pickPhotos(di); }
  });

  $days.addEventListener('change', function(e){
    var t=e.target; if(!t.classList.contains('daysel')) return;
    var from=+t.getAttribute('data-day'), si=+t.getAttribute('data-stop'), to=+t.value;
    if(to===from) return;
    var moved=trip.days[from].stops.splice(si,1)[0];
    if(!trip.days[from].stops.length) trip.days[from].stops.push(newStop());
    trip.days[to].stops.push(moved);
    render(); save(); toast('已移到第'+cnNum(to+1)+'天');
  });

  document.getElementById('btnAddDay').addEventListener('click', function(){
    trip.days.push(newDay()); render(); save();
    window.scrollTo({top:document.body.scrollHeight, behavior:'smooth'});
  });
  document.getElementById('btnClear').addEventListener('click', function(){
    if(confirm('確定清空整本遊記？此動作無法復原。')){ trip=seed(); render(); save(); toast('已清空'); }
  });
  document.getElementById('btnImport').addEventListener('click', importFromDrift);
  document.getElementById('btnCloudSave').addEventListener('click', cloudSave);
  document.getElementById('btnCloudLoad').addEventListener('click', cloudLoad);
  document.getElementById('btnDownload').addEventListener('click', doDownload);
  document.getElementById('btnPreview').addEventListener('click', doPreview);
  document.getElementById('btnLoad').addEventListener('click', function(){ document.getElementById('fileInput').click(); });
  document.getElementById('fileInput').addEventListener('change', function(){ if(this.files[0]) loadFile(this.files[0]); this.value=''; });

  /* ---- 從 drift 收藏匯入（同源讀 localStorage 的 ids，再向公開 API 取點資料）---- */
  function tripIsEmpty(){
    if(trip.title||trip.subtitle) return false;
    return trip.days.every(function(d){
      return !d.title && !d.date && !d.lead && !d.photos.length &&
        d.stops.every(function(s){ return !(s.time||s.name||s.area||s.note); });
    });
  }
  function importFromDrift(){
    var ids=[], notes='';
    try{ var raw=localStorage.getItem('drift_saved_route'); if(raw){ var o=JSON.parse(raw); ids=o.ids||[]; notes=o.notes||''; } }catch(e){}
    if(!ids.length){ toast('這台裝置的 drift 還沒收藏任何地點'); return; }
    toast('讀取 drift 收藏…');
    fetch('/api/drift/spots').then(function(r){ return r.json(); }).then(function(d){
      var spots=(d&&d.spots)||[], byId={};
      spots.forEach(function(s){ byId[s.id]=s; });
      var stops=ids.map(function(id){ return byId[id]; }).filter(Boolean).map(function(s){
        return { time:'', name:s.name||'', area:[s.area, s.feature||s.cat].filter(Boolean).join(' · '), note:'' };
      });
      if(!stops.length){ toast('找不到對應的地點資料'); return; }
      if(tripIsEmpty()){
        trip.days=[{ title:'', date:'', lead:notes||'', stops:stops, photos:[] }];
      }else{
        trip.days.push({ title:'drift 收藏', date:'', lead:notes||'', stops:stops, photos:[] });
      }
      render(); save();
      toast('已匯入 '+stops.length+' 個收藏，用每個站點右邊的「天」分配日期');
    }).catch(function(){ toast('讀取地點資料失敗，請稍後再試'); });
  }

  /* ---- 照片 ---- */
  var photoDay = -1, $pInput;
  function pickPhotos(di){
    if(!$pInput){
      $pInput=document.createElement('input');
      $pInput.type='file'; $pInput.accept='image/*'; $pInput.multiple=true; $pInput.hidden=true;
      document.body.appendChild($pInput);
      $pInput.addEventListener('change', function(){
        var files=Array.prototype.slice.call(this.files); this.value='';
        if(!files.length||photoDay<0) return;
        toast('壓縮中…');
        Promise.all(files.map(function(f){ return compressImage(f).catch(function(){return null;}); }))
          .then(function(urls){
            urls.forEach(function(u){ if(u) trip.days[photoDay].photos.push(u); });
            render(); toast('已加入 '+urls.filter(Boolean).length+' 張');
          });
      });
    }
    photoDay=di; $pInput.click();
  }
  function compressImage(file, maxW, q){
    maxW=maxW||1280; q=q||0.78;
    return new Promise(function(res, rej){
      var url=URL.createObjectURL(file), img=new Image();
      img.onload=function(){
        var w=img.width, h=img.height;
        if(w>maxW){ h=Math.round(h*maxW/w); w=maxW; }
        var c=document.createElement('canvas'); c.width=w; c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        URL.revokeObjectURL(url);
        try{ res(c.toDataURL('image/jpeg', q)); }catch(e){ rej(e); }
      };
      img.onerror=function(){ URL.revokeObjectURL(url); rej(); };
      img.src=url;
    });
  }

  /* ---- 產生自帶資料的 HTML ---- */
  function generateHTML(){
    var t=trip;
    var coverTitle = t.title || 'A Drop, A Draft, A Drift';
    var coverSub = t.subtitle || '雫　旅　漂　流　手　記';
    var body='';
    t.days.forEach(function(d, di){
      var hasStops = d.stops.some(function(s){ return s.time||s.name||s.area||s.note; });
      body += '<div class="day">';
      body +=   '<div class="day-hero">';
      body +=     '<div class="day-no"><span class="big">'+(di+1)+'</span>第'+cnNum(di+1)+'天'+(d.title?'':'')+'</div>';
      if(d.title) body += '<div class="day-title">'+esc(d.title)+'</div>';
      if(d.date)  body += '<div class="day-date">'+esc(d.date)+'</div>';
      if(d.lead)  body += '<div class="day-lead">'+esc(d.lead)+'</div>';
      body +=   '</div>';
      if(hasStops){
        body += '<div class="stops">';
        d.stops.forEach(function(s){
          if(!(s.time||s.name||s.area||s.note)) return;
          body += '<div class="srow">';
          body +=   '<div class="t">'+esc(s.time)+'</div>';
          body +=   '<div><div class="n">'+esc(s.name)+'</div>'+(s.area?'<div class="a">'+esc(s.area)+'</div>':'')+(s.note?'<div class="note">'+esc(s.note)+'</div>':'')+'</div>';
          body += '</div>';
        });
        body += '</div>';
      }
      if(d.photos.length){
        body += '<div class="photos-label">今日相片 ・ '+d.photos.length+' 張</div><div class="grid">';
        d.photos.forEach(function(p){ body += '<img src="'+p+'" alt="">'; });
        body += '</div>';
      }
      body += '</div>';
      if(di < t.days.length-1) body += '<div class="rule"></div>';
    });

    var dataJSON = JSON.stringify(t).replace(/</g,'\\u003c');
    return '<!doctype html>\n<html lang="zh-TW">\n<head>\n<meta charset="UTF-8">\n'
      + '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
      + '<title>'+esc(coverTitle)+' — 雫旅</title>\n'
      + '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
      + '<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Noto+Serif+TC:wght@200;300;400&display=swap" rel="stylesheet">\n'
      + '<style>'+OUT_CSS+'</style>\n</head>\n<body>\n'
      + '<div class="sheet">\n'
      + '<div class="cover"><h1>'+esc(coverTitle)+'</h1><div class="zh">'+esc(coverSub)+'</div></div>\n'
      + body
      + '\n<div class="foot">願你在澎湖，慢慢地迷路。</div>\n</div>\n'
      + '<script type="application/json" id="trip-data">'+dataJSON+'<\/script>\n'
      + '</body>\n</html>';
  }

  var OUT_CSS = ":root{--bg:#ece8e1;--paper:#f8f5ef;--ink:#2c2620;--muted:#8a7a6a;--line:rgba(181,171,160,.5);--gold:#b8915a}"
    + "*{box-sizing:border-box;margin:0;padding:0}"
    + "body{background:var(--bg);color:var(--ink);font-family:'Noto Serif TC',serif;font-weight:300;padding:0 0 50px;-webkit-font-smoothing:antialiased}"
    + ".sheet{max-width:620px;margin:0 auto;background:var(--paper)}"
    + ".cover{padding:64px 36px 40px;text-align:center}"
    + ".cover h1{font-family:'Cormorant Garamond','Noto Serif TC',serif;font-weight:300;font-style:italic;font-size:32px;letter-spacing:.05em}"
    + ".cover .zh{font-size:13px;letter-spacing:.3em;color:var(--muted);margin-top:14px}"
    + ".day{padding:14px 0 28px}"
    + ".day-hero{padding:30px 36px 10px}"
    + ".day-no{display:flex;align-items:baseline;gap:12px;font-size:14px;letter-spacing:.24em;color:var(--muted)}"
    + ".day-no .big{font-family:'Cormorant Garamond',serif;font-style:italic;font-size:54px;line-height:.8;color:var(--gold);letter-spacing:0}"
    + ".day-title{font-family:'Cormorant Garamond','Noto Serif TC',serif;font-size:32px;font-weight:300;margin:8px 0 2px}"
    + ".day-date{font-size:12px;letter-spacing:.16em;color:var(--muted);text-transform:uppercase}"
    + ".day-lead{font-size:13px;color:var(--muted);font-style:italic;line-height:1.9;margin-top:12px;max-width:82%}"
    + ".stops{padding:10px 36px 0}"
    + ".srow{display:flex;gap:16px;padding:13px 0;border-bottom:1px solid var(--line);align-items:baseline}"
    + ".srow:last-child{border-bottom:0}"
    + ".srow .t{font-family:'Cormorant Garamond',serif;font-size:15px;color:var(--gold);letter-spacing:.08em;flex:0 0 50px}"
    + ".srow .n{font-size:17px}"
    + ".srow .a{font-size:11.5px;color:var(--muted);margin-top:2px}"
    + ".srow .note{font-size:12px;color:#6a5a45;font-style:italic;margin-top:5px}"
    + ".photos-label{font-size:9px;letter-spacing:.25em;color:var(--gold);margin:18px 36px 8px}"
    + ".grid{display:flex;flex-wrap:wrap;gap:6px;padding:0 36px}"
    + ".grid img{width:88px;height:88px;object-fit:cover;border-radius:8px;display:block}"
    + ".rule{height:1px;background:var(--ink);opacity:.12;margin:0 36px}"
    + ".foot{text-align:center;padding:38px 36px;font-size:12px;color:var(--muted);font-style:italic;letter-spacing:.1em}"
    + "@media print{.day{break-inside:avoid}.cover{padding-top:30px}}";

  function fileName(){
    var base=(trip.title||'雫旅遊記').replace(/[\\/:*?"<>|]/g,'').slice(0,40).trim()||'雫旅遊記';
    return base+'.html';
  }
  function doDownload(){
    var html=generateHTML();
    var blob=new Blob([html],{type:'text/html;charset=utf-8'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob); a.download=fileName();
    document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1000);
    toast('已下載遊記');
  }
  function doPreview(){
    var html=generateHTML();
    var blob=new Blob([html],{type:'text/html;charset=utf-8'});
    window.open(URL.createObjectURL(blob), '_blank');
  }
  function loadFile(file){
    var r=new FileReader();
    r.onload=function(){
      try{
        var doc=new DOMParser().parseFromString(r.result,'text/html');
        var tag=doc.getElementById('trip-data');
        if(!tag) throw 0;
        trip=normalize(JSON.parse(tag.textContent));
        render(); save(); toast('已載入遊記（含照片）');
      }catch(e){ toast('讀不到這個檔案的遊記資料'); }
    };
    r.readAsText(file);
  }

  /* ---- 付費版雲端保存（沿用 drift 同源 token）---- */
  function driftToken(){ try{ return localStorage.getItem('drift_user_token')||''; }catch(e){ return ''; } }
  function tokenPayload(){
    var t=driftToken(); if(!t) return null;
    var parts=t.split('.'); if(parts.length!==2) return null;
    try{
      var b64=parts[0].replace(/-/g,'+').replace(/_/g,'/');
      var pad=b64.length%4 ? '='.repeat(4-b64.length%4) : '';
      return JSON.parse(decodeURIComponent(escape(atob(b64+pad))));
    }catch(e){ return null; }
  }
  function isPremium(){ var p=tokenPayload(); return !!(p && p.tier==='premium' && p.sub && (!p.exp || p.exp>Date.now()/1000)); }

  function fmtDate(ms){ try{ return new Date(ms+8*3600000).toISOString().slice(0,10); }catch(e){ return ''; } }
  var $cloudNote=document.getElementById('cloudNote');
  function setCloudNote(msg){ if(!$cloudNote) return; $cloudNote.innerHTML=msg; $cloudNote.hidden=!msg; }

  function cloudSave(){
    if(!isPremium()){ toast('請先用付費版（訂單編號）登入 drift'); return; }
    toast('上傳到雲端…');
    fetch('/api/itinerary/save', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':'Bearer '+driftToken() },
      body: JSON.stringify({ title: trip.title, trip: trip })
    }).then(function(r){ return r.json(); }).then(function(d){
      if(d && d.success){ setCloudNote('☁ 已存到雲端 · 保留至 <b>'+fmtDate(d.expiresAt)+'</b>（每次保存自動延長 '+(d.retainDays||14)+' 天）'); toast('已存到雲端'); }
      else toast(d && d.error ? d.error : '雲端保存失敗');
    }).catch(function(){ toast('雲端保存失敗，請稍後再試'); });
  }
  function cloudLoad(){
    if(!isPremium()){ toast('請先用付費版（訂單編號）登入 drift'); return; }
    toast('讀取雲端…');
    fetch('/api/itinerary/load', { headers:{ 'Authorization':'Bearer '+driftToken() } })
      .then(function(r){ return r.json(); }).then(function(d){
        if(!d || !d.success){ toast(d && d.error ? d.error : '讀取失敗'); return; }
        if(!d.found){ toast('雲端還沒有你的遊記，先「存到雲端」吧'); return; }
        var t=normalize(d.trip);
        refsToBase64(t).then(function(){
          trip=t; render(); save();
          setCloudNote('☁ 已從雲端讀取 · 保留至 <b>'+fmtDate(d.expiresAt)+'</b>');
          toast('已從雲端讀取');
        });
      }).catch(function(){ toast('讀取失敗，請稍後再試'); });
  }
  // 雲端照片是 R2 參照網址 → 轉回 base64，讓「下載遊記」仍自帶資料
  function refsToBase64(t){
    var jobs=[];
    t.days.forEach(function(d){
      d.photos=d.photos||[];
      d.photos.forEach(function(p, i){
        if(typeof p==='string' && p.indexOf('/api/itinerary/photo/')===0){
          jobs.push(fetch(p).then(function(r){ return r.blob(); }).then(function(b){
            return new Promise(function(res){ var fr=new FileReader(); fr.onload=function(){ d.photos[i]=fr.result; res(); }; fr.onerror=function(){ res(); }; fr.readAsDataURL(b); });
          }).catch(function(){}));
        }
      });
    });
    return Promise.all(jobs);
  }
  function initCloud(){
    if(isPremium()){
      document.getElementById('btnCloudSave').hidden=false;
      document.getElementById('btnCloudLoad').hidden=false;
      setCloudNote('☁ 付費版雲端保存已啟用（綁你的訂單，保留 14 天）');
    }
  }

  /* ---- 小提示 ---- */
  var $toast=document.getElementById('toast'), toastT;
  function toast(msg){
    $toast.textContent=msg; $toast.classList.add('show');
    clearTimeout(toastT); toastT=setTimeout(function(){ $toast.classList.remove('show'); }, 1800);
  }

  render();
  initCloud();
})();

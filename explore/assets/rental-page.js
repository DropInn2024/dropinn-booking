const API = '/api';  // 相對路徑，same-origin，CSP connect-src 'self' 允許
window.RENTAL_HOURS = { open: 8, close: 21 };
window.CAR_TIERS = ['經濟 5 人座','舒適 5 人座','休旅 5 人座','7 人座','升級 5/7 人座','8-9 人座','9 人座 頂級'];
window.CARS = [];
let SCOOTER = null;
const bookingParam = new URLSearchParams(location.search).get('booking') || ''; // 住客加購連結帶的訂單號

const STORE_MAPS = {
  '本店':   'https://maps.app.goo.gl/iyyzwgZinUwdxyFSA',
  '機場店': 'https://maps.app.goo.gl/2wYt8m3ELwsgpUjB7',
  '碼頭店': 'https://maps.app.goo.gl/aUYgpubcDugESHaS7'
};

const _a = new Date(); _a.setDate(_a.getDate()+1); _a.setHours(14,0,0,0);
const _b = new Date(); _b.setDate(_b.getDate()+2); _b.setHours(14,0,0,0);
// 每段各自的車：carId 一段一台，可換車
let segments = [{ id:'s1', carId:'', pickup: isoLocal(_a), return: isoLocal(_b), store:'機場店' }];

const segmentsEl = document.getElementById('segments');
const calcEl = document.getElementById('calcResult');
const submitBtn = document.getElementById('submitBtn');

function isScooter(c) { return c && c.id === 'scooter'; }
function carById(id) { return id === 'scooter' ? SCOOTER : (window.CARS.find(c => c.id === id) || window.CARS[0]); }
function carPricingOf(car) { return { day_rate: car.day, half_day_rate: car.half, hourly_overtime: car.hourly }; }
function carLabelOf(car) { return isScooter(car) ? '機車（不挑款）' : `${car.name}（${car.seats}人座 ${car.year}）`; }
function defaultCarId() { const w = window.CARS.find(c => c.id === 'car-wish'); return w ? w.id : ((window.CARS[0] && window.CARS[0].id) || ''); }
function carOptionsHtml(selId) {
  let html = '';
  window.CAR_TIERS.forEach(tier => {
    const list = window.CARS.filter(c => c.tier === tier);
    if (!list.length) return;
    html += `<optgroup label="${tier}">`;
    list.forEach(c => { html += `<option value="${c.id}" ${c.id === selId ? 'selected' : ''}>${c.name}（${c.seats}人）NT$ ${c.day.toLocaleString('en-US')}/天</option>`; });
    html += `</optgroup>`;
  });
  if (SCOOTER) html += `<optgroup label="機車"><option value="scooter" ${selId === 'scooter' ? 'selected' : ''}>機車（不挑款）NT$ ${SCOOTER.day}/天</option></optgroup>`;
  return html;
}

function renderSegments() {
  segmentsEl.innerHTML = segments.map((s, i) => {
    const car = carById(s.carId);
    const [pd, pt] = splitISO(s.pickup);
    const [rd, rt] = splitISO(s.return);
    const opt = (v, label) => `<option value="${v}" ${s.store === v ? 'selected' : ''}>${label}</option>`;
    // 第一段（抵達）強制 機場店/碼頭店；中途換車才可選本店
    const storeOptions = (i === 0)
      ? opt('機場店', '機場店（搭飛機）') + opt('碼頭店', '碼頭店（搭船）')
      : opt('本店', '本店') + opt('機場店', '機場店') + opt('碼頭店', '碼頭店');
    const storeLabel = (i === 0) ? '抵達方式 → 取 / 還車地點' : '換車地點（取 / 還同一店）';
    const storeHint = (i === 0)
      ? '搭飛機取機場店、搭船取碼頭店，依抵達方式自動帶入。'
      : '中途換車地點，多在本店，依實際安排為準。';
    return `
    <div class="segment" data-seg-id="${s.id}">
      <div class="segment-head">
        <span class="label">租期段 ${i + 1}</span>
        ${segments.length > 1 ? `<button class="del" data-del="${s.id}">刪除</button>` : ''}
      </div>
      <div class="form-row" style="margin-bottom:10px;">
        <label>車種</label>
        <select class="car-select" data-field="car" data-seg="${s.id}">${carOptionsHtml(s.carId)}</select>
        <div style="font-size:11px;color:var(--muted);margin-top:5px;">一天 ${fmtMoney(car.day)}　半天 ${fmtMoney(car.half)}　超時 ${fmtMoney(car.hourly)}/時</div>
      </div>
      <div class="form-grid-2">
        <div class="form-row">
          <label>取車時間</label>
          <div class="dt-pair">
            <input type="date" data-field="pickup-date" data-seg="${s.id}" value="${pd}">
            <select class="dt-time" data-field="pickup-time" data-seg="${s.id}">${timeOptionsHtml(pt)}</select>
          </div>
        </div>
        <div class="form-row">
          <label>還車時間</label>
          <div class="dt-pair">
            <input type="date" data-field="return-date" data-seg="${s.id}" value="${rd}">
            <select class="dt-time" data-field="return-time" data-seg="${s.id}">${timeOptionsHtml(rt)}</select>
          </div>
        </div>
        <div class="form-row" style="grid-column:1/-1;">
          <label>${storeLabel}</label>
          <div style="display:flex;gap:10px;align-items:center;">
            <select data-field="store" data-seg="${s.id}" style="flex:1;">${storeOptions}</select>
            <a class="store-map" data-seg="${s.id}" href="${STORE_MAPS[s.store]}" target="_blank" rel="noopener"
               style="font-size:12px;letter-spacing:0.08em;color:var(--accent);white-space:nowrap;">📍 看地圖</a>
          </div>
          <div style="font-size:11px;color:var(--muted);line-height:1.6;margin-top:6px;">${storeHint}</div>
        </div>
      </div>
      <div class="seg-warn" style="font-size:12px;line-height:1.7;color:var(--highlight);margin-top:8px;"></div>
    </div>`;
  }).join('');

  segmentsEl.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', (e) => {
      const id = e.target.dataset.seg, f = e.target.dataset.field;
      const seg = segments.find(x => x.id === id);
      if (!seg) return;
      if (f === 'car') {
        seg.carId = e.target.value;
        renderSegments();   // 更新該段牌價提示
        renderCalc();
        return;
      } else if (f === 'store') {
        seg.store = e.target.value;
        const link = segmentsEl.querySelector(`.store-map[data-seg="${id}"]`);
        if (link) link.href = STORE_MAPS[seg.store] || '#';
      } else if (f.startsWith('pickup')) {
        const [d, t] = splitISO(seg.pickup);
        seg.pickup = joinDT(f === 'pickup-date' ? e.target.value : d, f === 'pickup-time' ? e.target.value : t);
      } else if (f.startsWith('return')) {
        const [d, t] = splitISO(seg.return);
        seg.return = joinDT(f === 'return-date' ? e.target.value : d, f === 'return-time' ? e.target.value : t);
      }
      renderCalc();
    });
  });
}

function delSeg(id) { segments = segments.filter(s => s.id !== id); renderSegments(); renderCalc(); }
function addSeg() {
  const last = segments[segments.length - 1];
  segments.push({ id: 's' + (segments.length + 1), carId: last ? last.carId : defaultCarId(), pickup: last?.return || '', return: '', store: '本店' });
  renderSegments(); renderCalc();
}

let lastCalc = null;
function renderCalc() {
  let total = 0, parts = [], hasError = false, allFilled = true;
  segments.forEach((s) => {
    const segEl = segmentsEl.querySelector(`[data-seg-id="${s.id}"] .seg-warn`);
    if (segEl) segEl.textContent = '';
    if (!s.pickup || !s.return) { allFilled = false; return; }
    if (!isTimeAllowed(s.return)) { if (segEl) segEl.textContent = '還車時間落在 21:00-08:00（已打烊），請改 21:00 前或隔天 08:00 後'; hasError = true; return; }
    const car = carById(s.carId);
    const res = calcRentalFee(s.pickup, s.return, carPricingOf(car));
    if (!res) { if (segEl) segEl.textContent = '還車時間需晚於取車時間'; hasError = true; return; }
    total += res.total; parts.push({ res, seg: s, car });
  });

  if (!allFilled) { calcEl.innerHTML = '<div style="font-size:13px;color:var(--muted);line-height:1.8;">選車並填時間後即時試算。</div>'; submitBtn.disabled = true; lastCalc = null; return; }
  if (hasError) { calcEl.innerHTML = '<div class="alert alert-warn">時間有誤，請依提醒修正</div>'; submitBtn.disabled = true; lastCalc = null; return; }

  const fmtT = iso => iso.replace('T', ' ').slice(5);
  calcEl.innerHTML = `
    ${parts.map((p, i) => `
      <div style="border-bottom:1px dotted var(--border);padding:8px 0;font-size:13px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:11px;letter-spacing:0.16em;color:var(--accent);">租期段 ${i+1}　<span style="font-family:'Noto Serif TC',serif;letter-spacing:0;color:var(--ink);">${carLabelOf(p.car)}</span></div>
        <div style="font-size:12px;color:var(--muted);line-height:1.7;">${fmtT(p.seg.pickup)} → ${fmtT(p.seg.return)} · ${p.seg.store}</div>
        <div style="line-height:1.7;margin-top:2px;">計費：<strong>${p.res.label}</strong></div>
        <div style="text-align:right;margin-top:4px;"><span class="garamond" style="font-size:16px;color:var(--accent);">${fmtMoney(p.res.total)}</span></div>
      </div>`).join('')}
    <div class="total-row"><div class="label">Total</div><div class="num">${fmtMoney(total)}</div></div>
    <div style="margin-top:10px;font-size:11px;color:var(--muted);line-height:1.7;">・完成租車手續約 30 分鐘<br>・租車行 21:00 休息，請留意還車時間<br>・<span style="color:var(--highlight);">建議取車時加保保險</span></div>`;

  lastCalc = { total, parts };
  submitBtn.disabled = false;
}

// 送出 → 跳出 modal 填資料（選車/試算留在頁面）
function openRentalForm() {
  if (!lastCalc) return;
  const segLines = lastCalc.parts.map(p => `${carLabelOf(p.car)}｜${String(p.seg.pickup).replace('T', ' ')} → ${String(p.seg.return).replace('T', ' ')}　${p.res.label}　${fmtMoney(p.res.total)}`).join('<br>');
  document.getElementById('ovBody').innerHTML = `
    <div class="ov-head"><div class="ov-title">填寫資料</div><button class="ov-x" data-close>×</button></div>
    <div class="ov-summary"><div class="muted">${segLines}</div><div class="ov-total">預估 NT$ ${Number(lastCalc.total).toLocaleString('en-US')}</div></div>
    <div class="form-grid-2">
      <div class="form-row"><label>聯絡人姓名 *</label><input type="text" id="cName" placeholder="例：王小明"></div>
      <div class="form-row"><label>聯絡人手機 *</label><input type="tel" id="cPhone" placeholder="0912-345-678"></div>
    </div>
    <div class="form-row"><label>Email（選填，寄確認信）</label><input type="email" id="cEmail" placeholder="your@email.com"></div>
    <div class="form-grid-2">
      <div class="form-row"><label>去程航班/船班（選填）</label><input type="text" id="cDepFlight" placeholder="例：B7-8763"></div>
      <div class="form-row"><label>抵達時間（取車參考）</label><input type="datetime-local" id="cDepTime"></div>
      <div class="form-row" style="margin-bottom:0;"><label>回程航班/船班（選填）</label><input type="text" id="cRetFlight" placeholder="例：B7-8772"></div>
      <div class="form-row" style="margin-bottom:0;"><label>回程時間（還車參考）</label><input type="datetime-local" id="cRetTime"></div>
    </div>
    <button class="btn btn-primary btn-block" id="confirmBtn" style="margin-top:14px;">確認送出</button>
    <button class="btn btn-neutral btn-block" data-close style="margin-top:8px;">返回修改</button>`;
  document.getElementById('quoteOverlay').classList.add('active');
}

async function submitRequest() {
  if (!lastCalc) return;
  const name = document.getElementById('cName').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  const email = (document.getElementById('cEmail') || {}).value || '';
  if (!name || !phone) { alert('請填聯絡人姓名與電話'); return; }
  const depFlight = document.getElementById('cDepFlight').value.trim();
  const depTime = document.getElementById('cDepTime').value;
  const retFlight = document.getElementById('cRetFlight').value.trim();
  const retTime = document.getElementById('cRetTime').value;
  const depart = depTime ? ((depFlight ? depFlight + ' · ' : '') + depTime.replace('T', ' ')) : (depFlight || '');
  const backflight = retTime ? ((retFlight ? retFlight + ' · ' : '') + retTime.replace('T', ' ')) : (retFlight || '');

  const o = {
    contact_name: name, contact_phone: phone, depart, backflight,
    segments: lastCalc.parts.map(p => ({ pickup: p.seg.pickup, return: p.seg.return, store: p.seg.store, carLabel: carLabelOf(p.car), label: p.res.label })),
    total: lastCalc.total
  };

  // 送進 D1（成本由後端算，前端只送各段車種+租期）
  const cbtn = document.getElementById('confirmBtn');
  if (cbtn) { cbtn.disabled = true; cbtn.textContent = '送出中…'; }
  try {
    const res = await fetch(API + '/tours/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: lastCalc.parts[0].seg.carId,   // 頂層＝第一段車（代表車）
        kind: 'rental',
        contactName: name,
        contactPhone: phone,
        email,
        depart, backflight,
        bookingOrderID: bookingParam || undefined,
        segments: lastCalc.parts.map(p => ({ productId: p.seg.carId, pickup: p.seg.pickup, return: p.seg.return, store: p.seg.store }))
      })
    });
    const data = await res.json();
    if (res.status === 422 || (data && data.needContact)) {
      alert(data.error || '此車種目前需專人為您確認，請加 LINE @dropinn 洽詢 🙏');
      if (cbtn) { cbtn.disabled = false; cbtn.textContent = '確認送出'; }
      return;
    }
    if (data && data.success) o.orderId = data.orderId;
  } catch (e) {
    // 即使存 D1 失敗，仍讓客人複製貼 LINE（不擋流程）
  }
  if (o.orderId) {
    // 成功：訂單已進後台，客人不用複製，只給確認＋加 LINE
    const lineHref = 'https://line.me/R/oaMessage/%40dropinn/?' + encodeURIComponent('預訂單號 ' + o.orderId + '，我要接收進度');
    document.getElementById('ovBody').innerHTML =
      '<div class="ov-head"><div class="ov-title">已送出</div><button class="ov-x" data-close>×</button></div>' +
      '<div style="text-align:center;padding:2px 0;"><div style="font-size:36px;line-height:1;">🚗</div>' +
      '<div style="font-size:16px;margin-top:8px;">租車需求已送出</div>' +
      '<div class="muted" style="font-size:13px;margin-top:8px;line-height:1.7;">單號 ' + o.orderId + '<br>車輛有限，待雫旅向車行確認有車後回覆你。</div></div>' +
      '<a href="' + lineHref + '" target="_blank" rel="noopener noreferrer" class="btn btn-block" style="margin-top:8px;background:#06C755;color:#fff;border-color:#06C755;">加 LINE 接收確認通知</a>' +
      '<button class="btn btn-neutral btn-block" data-close style="margin-top:10px;">完成</button>';
  } else {
    // 存檔失敗備援
    const txt = buildQuoteText(o);
    document.getElementById('ovBody').innerHTML =
      '<div class="ov-head"><div class="ov-title">送出未完成</div><button class="ov-x" data-close>×</button></div>' +
      '<div class="quote-hint" style="margin-bottom:8px;">系統暫時無法送出，請複製以下內容貼到 LINE 傳給雫旅。</div>' +
      '<textarea id="quoteText" readonly>' + txt + '</textarea>' +
      '<div class="quote-actions"><button class="btn btn-primary" id="copyBtn">複製明細</button><button class="btn btn-neutral" data-close>關閉</button></div>';
  }
}

document.getElementById('addSegBtn').addEventListener('click', addSeg);
// 事件委派：刪除租期段（取代 inline onclick，CSP 擋 inline）
segmentsEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-del]');
  if (b) delSeg(b.getAttribute('data-del'));
});
submitBtn.addEventListener('click', openRentalForm);
// modal 事件委派：關閉 / 確認送出 / 複製
document.getElementById('quoteOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'quoteOverlay' || e.target.closest('[data-close]')) { document.getElementById('quoteOverlay').classList.remove('active'); return; }
  if (e.target.id === 'confirmBtn') { submitRequest(); return; }
  if (e.target.id === 'copyBtn') {
    const ta = document.getElementById('quoteText'); if (!ta) return;
    (async () => {
      try { await navigator.clipboard.writeText(ta.value); } catch (err) { ta.select(); document.execCommand('copy'); }
      const b = document.getElementById('copyBtn'), o = b.textContent; b.textContent = '已複製 ✓'; setTimeout(() => b.textContent = o, 1600);
    })();
  }
});

// 從 API 載入車種（單一資料源 = D1，改價只改 D1）
async function loadProducts() {
  try {
    const res = await fetch(API + '/tours/products');
    const data = await res.json();
    const products = data.products || [];
    window.CARS = products.filter(p => p.category === '汽車').map(p => {
      const m = (() => { try { return JSON.parse(p.meta || '{}'); } catch { return {}; } })();
      return { id: p.id, name: p.name, seats: p.seats, year: m.year || '', tier: m.tier || '其他',
               day: p.price_day, half: p.price_half, hourly: p.price_hour };
    });
    const sc = products.find(p => p.category === '機車');
    const scm = (() => { try { return JSON.parse(sc?.meta || '{}'); } catch { return {}; } })();
    SCOOTER = sc ? { id: sc.id, name: sc.name, seats: sc.seats || 2, year: scm.year || '', day: sc.price_day, half: sc.price_half, hourly: sc.price_hour,
                     models: scm.models || [], note: scm.note || '依現場調度' } : null;
    window.SCOOTER = SCOOTER;
    if (!window.CARS.length) throw new Error('no cars');
    const def = defaultCarId();
    segments.forEach(s => { if (!s.carId) s.carId = def; });
    renderSegments();
    renderCalc();
  } catch (e) {
    document.getElementById('segments').innerHTML =
      '<div class="alert alert-warn">車種載入失敗，請重新整理頁面再試。</div>';
  }
}
loadProducts();

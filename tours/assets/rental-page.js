const API = '/api';  // 相對路徑，same-origin，CSP connect-src 'self' 允許
window.RENTAL_HOURS = { open: 8, close: 21 };
window.CAR_TIERS = ['經濟 5 人座','舒適 5 人座','休旅 5 人座','7 人座','升級 5/7 人座','8-9 人座','9 人座 頂級'];
window.CARS = [];
let SCOOTER = null;
let selectedCar = null;
const bookingParam = new URLSearchParams(location.search).get('booking') || ''; // 住客加購連結帶的訂單號

const STORE_MAPS = {
  '本店':   'https://maps.app.goo.gl/iyyzwgZinUwdxyFSA',
  '機場店': 'https://maps.app.goo.gl/2wYt8m3ELwsgpUjB7',
  '碼頭店': 'https://maps.app.goo.gl/aUYgpubcDugESHaS7'
};

const _a = new Date(); _a.setDate(_a.getDate()+1); _a.setHours(14,0,0,0);
const _b = new Date(); _b.setDate(_b.getDate()+2); _b.setHours(14,0,0,0);
let segments = [{ id:'s1', pickup: isoLocal(_a), return: isoLocal(_b), store:'本店' }];

const carSelectEl = document.getElementById('carSelect');
const carDetailEl = document.getElementById('carDetail');
const segmentsEl = document.getElementById('segments');
const calcEl = document.getElementById('calcResult');
const submitBtn = document.getElementById('submitBtn');

function isScooter(c) { return c && c.id === 'scooter'; }

function renderCarOptions() {
  let html = '';
  window.CAR_TIERS.forEach(tier => {
    const list = window.CARS.filter(c => c.tier === tier);
    if (!list.length) return;
    html += `<optgroup label="${tier}">`;
    list.forEach(c => { html += `<option value="${c.id}" ${c.id === selectedCar.id ? 'selected' : ''}>${c.name}（${c.seats}人）NT$ ${c.day.toLocaleString('en-US')}/天</option>`; });
    html += `</optgroup>`;
  });
  html += `<optgroup label="機車"><option value="scooter" ${isScooter(selectedCar) ? 'selected' : ''}>機車（不挑款）NT$ ${SCOOTER.day}/天</option></optgroup>`;
  carSelectEl.innerHTML = html;
}

function renderCarDetail() {
  const c = selectedCar;
  if (isScooter(c)) {
    carDetailEl.innerHTML = `
      <div class="car-detail">
        <div class="cd-name">機車（不挑款）</div>
        <div class="cd-price"><span>一天 <b>${fmtMoney(SCOOTER.day)}</b></span><span>半天 <b>${fmtMoney(SCOOTER.half)}</b></span><span>超時 <b>${SCOOTER.hourly}</b>/時</span></div>
        <div class="cd-models">${SCOOTER.note}<br>車款：${SCOOTER.models.join('、')}</div>
      </div>`;
  } else {
    carDetailEl.innerHTML = `
      <div class="car-detail">
        <div class="cd-name">${c.name} <span class="yr">${c.seats} 人座 · ${c.year}</span></div>
        <div class="cd-price"><span>一天 <b>${fmtMoney(c.day)}</b></span><span>半天 <b>${fmtMoney(c.half)}</b></span><span>超時 <b>${c.hourly}</b>/時</span></div>
      </div>`;
  }
}

function renderCars() {
  renderCarOptions();
  renderCarDetail();
  carSelectEl.addEventListener('change', () => {
    const id = carSelectEl.value;
    selectedCar = (id === 'scooter') ? SCOOTER : window.CARS.find(c => c.id === id);
    renderCarDetail(); renderCalc();
  });
}

function renderSegments() {
  segmentsEl.innerHTML = segments.map((s, i) => {
    const [pd, pt] = splitISO(s.pickup);
    const [rd, rt] = splitISO(s.return);
    return `
    <div class="segment" data-seg-id="${s.id}">
      <div class="segment-head">
        <span class="label">租期段 ${i + 1}</span>
        ${segments.length > 1 ? `<button class="del" data-del="${s.id}">刪除</button>` : ''}
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
          <label>取 / 還車店別（必須同一店）</label>
          <div style="display:flex;gap:10px;align-items:center;">
            <select data-field="store" data-seg="${s.id}" style="flex:1;">
              <option ${s.store === '本店' ? 'selected' : ''}>本店</option>
              <option ${s.store === '機場店' ? 'selected' : ''}>機場店</option>
              <option ${s.store === '碼頭店' ? 'selected' : ''}>碼頭店</option>
            </select>
            <a class="store-map" data-seg="${s.id}" href="${STORE_MAPS[s.store]}" target="_blank" rel="noopener"
               style="font-size:12px;letter-spacing:0.08em;color:var(--accent);white-space:nowrap;">📍 看地圖</a>
          </div>
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
      if (f === 'store') {
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
  segments.push({ id: 's' + (segments.length + 1), pickup: last?.return || '', return: '', store: last?.store || '本店' });
  renderSegments(); renderCalc();
}

function carPricing() { return { day_rate: selectedCar.day, half_day_rate: selectedCar.half, hourly_overtime: selectedCar.hourly }; }

let lastCalc = null;
function renderCalc() {
  let total = 0, parts = [], hasError = false, allFilled = true;
  segments.forEach((s) => {
    const segEl = segmentsEl.querySelector(`[data-seg-id="${s.id}"] .seg-warn`);
    if (segEl) segEl.textContent = '';
    if (!s.pickup || !s.return) { allFilled = false; return; }
    if (!isTimeAllowed(s.return)) { if (segEl) segEl.textContent = '還車時間落在 21:00-08:00（已打烊），請改 21:00 前或隔天 08:00 後'; hasError = true; return; }
    const res = calcRentalFee(s.pickup, s.return, carPricing());
    if (!res) { if (segEl) segEl.textContent = '還車時間需晚於取車時間'; hasError = true; return; }
    total += res.total; parts.push({ res, seg: s });
  });

  if (!allFilled) { calcEl.innerHTML = '<div style="font-size:13px;color:var(--muted);line-height:1.8;">選車並填時間後即時試算。</div>'; submitBtn.disabled = true; lastCalc = null; return; }
  if (hasError) { calcEl.innerHTML = '<div class="alert alert-warn">時間有誤，請依提醒修正</div>'; submitBtn.disabled = true; lastCalc = null; return; }

  const carLabel = isScooter(selectedCar) ? '機車（不挑款）' : `${selectedCar.name}（${selectedCar.seats} 人座）`;
  const fmtT = iso => iso.replace('T', ' ').slice(5);
  calcEl.innerHTML = `
    <div style="font-family:'Cormorant Garamond',serif;font-size:13px;letter-spacing:0.1em;color:var(--ink);margin-bottom:8px;">${carLabel}</div>
    ${parts.map((p, i) => `
      <div style="border-bottom:1px dotted var(--border);padding:8px 0;font-size:13px;">
        <div style="font-family:'Cormorant Garamond',serif;font-size:11px;letter-spacing:0.18em;color:var(--accent);">租期段 ${i+1}</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.7;">${fmtT(p.seg.pickup)} → ${fmtT(p.seg.return)} · ${p.seg.store}</div>
        <div style="line-height:1.7;margin-top:2px;">計費：<strong>${p.res.label}</strong></div>
        <div style="text-align:right;margin-top:4px;"><span class="garamond" style="font-size:16px;color:var(--accent);">${fmtMoney(p.res.total)}</span></div>
      </div>`).join('')}
    <div class="total-row"><div class="label">Total</div><div class="num">${fmtMoney(total)}</div></div>
    <div style="margin-top:10px;font-size:11px;color:var(--muted);line-height:1.7;">・完成租車手續約 30 分鐘<br>・租車行 21:00 休息，請留意還車時間<br>・<span style="color:var(--highlight);">建議取車時加保保險</span></div>`;

  lastCalc = { total, parts };
  submitBtn.disabled = false;
}

async function submitRequest() {
  if (!lastCalc) return;
  const name = document.getElementById('cName').value.trim();
  const phone = document.getElementById('cPhone').value.trim();
  if (!name || !phone) { alert('請填聯絡人姓名與電話'); return; }
  const depFlight = document.getElementById('cDepFlight').value.trim();
  const depTime = document.getElementById('cDepTime').value;
  const retFlight = document.getElementById('cRetFlight').value.trim();
  const retTime = document.getElementById('cRetTime').value;
  const depart = depTime ? ((depFlight ? depFlight + ' · ' : '') + depTime.replace('T', ' ')) : (depFlight || '');
  const backflight = retTime ? ((retFlight ? retFlight + ' · ' : '') + retTime.replace('T', ' ')) : (retFlight || '');

  const o = {
    carLabel: isScooter(selectedCar) ? '機車（不挑款）' : `${selectedCar.name}（${selectedCar.seats}人座 ${selectedCar.year}）`,
    contact_name: name, contact_phone: phone, depart, backflight,
    segments: lastCalc.parts.map(p => ({ pickup: p.seg.pickup, return: p.seg.return, store: p.seg.store, label: p.res.label })),
    total: lastCalc.total
  };

  // 送進 D1（成本由後端算，前端只送車種+租期）
  submitBtn.disabled = true;
  const origText = submitBtn.textContent;
  submitBtn.textContent = '送出中…';
  try {
    const res = await fetch(API + '/tours/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: selectedCar.id,
        kind: 'rental',
        contactName: name,
        contactPhone: phone,
        depart, backflight,
        bookingOrderID: bookingParam || undefined,
        segments: lastCalc.parts.map(p => ({ pickup: p.seg.pickup, return: p.seg.return, store: p.seg.store }))
      })
    });
    const data = await res.json();
    if (data && data.success) o.orderId = data.orderId;
  } catch (e) {
    // 即使存 D1 失敗，仍讓客人複製貼 LINE（不擋流程）
  }
  submitBtn.disabled = false;
  submitBtn.textContent = origText;

  document.getElementById('quoteText').value = buildQuoteText(o);
  document.getElementById('quoteOverlay').classList.add('active');
}

document.getElementById('addSegBtn').addEventListener('click', addSeg);
// 事件委派：刪除租期段（取代 inline onclick，CSP 擋 inline）
segmentsEl.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-del]');
  if (b) delSeg(b.getAttribute('data-del'));
});
submitBtn.addEventListener('click', submitRequest);
document.getElementById('closeQuote').addEventListener('click', () => document.getElementById('quoteOverlay').classList.remove('active'));
document.getElementById('quoteOverlay').addEventListener('click', (e) => { if (e.target.id === 'quoteOverlay') e.currentTarget.classList.remove('active'); });
document.getElementById('copyBtn').addEventListener('click', async () => {
  const ta = document.getElementById('quoteText');
  try { await navigator.clipboard.writeText(ta.value); }
  catch (e) { ta.select(); document.execCommand('copy'); }
  const btn = document.getElementById('copyBtn');
  const orig = btn.textContent; btn.textContent = '已複製 ✓';
  setTimeout(() => btn.textContent = orig, 1600);
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
               day: p.price_day, half: p.price_half, hour: p.price_hour };
    });
    const sc = products.find(p => p.category === '機車');
    const scm = (() => { try { return JSON.parse(sc?.meta || '{}'); } catch { return {}; } })();
    SCOOTER = sc ? { id: sc.id, name: sc.name, day: sc.price_day, half: sc.price_half, hour: sc.price_hour,
                     models: scm.models || [], note: scm.note || '依現場調度' } : null;
    window.SCOOTER = SCOOTER;
    selectedCar = window.CARS.find(c => c.id === 'car-wish') || window.CARS[0];
    if (!selectedCar) throw new Error('no cars');
    renderCars();
    renderSegments();
    renderCalc();
  } catch (e) {
    document.getElementById('carDetail').innerHTML =
      '<div class="alert alert-warn">車種載入失敗，請重新整理頁面再試。</div>';
  }
}
loadProducts();

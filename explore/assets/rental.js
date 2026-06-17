/* ============================================================
 * 雫旅 Tours · 租車邏輯（上線版 · A 方案）
 * ------------------------------------------------------------
 * 自包含：計費 + 時間 helper + 產生需求明細文字。
 * 僅用對客公開牌價，不依賴購物車。
 * ============================================================ */

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '—';
  return 'NT$ ' + Number(n).toLocaleString('en-US');
}

/* ── 時間 helper ── */
function isoLocal(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function splitISO(iso) {
  if (!iso) return ['', ''];
  const [d, t] = iso.split('T');
  return [d || '', (t || '').slice(0, 5)];
}
function joinDT(date, time) { return (date && time) ? date + 'T' + time : ''; }
function timeOptionsHtml(sel, step = 30) {
  const sH = (window.RENTAL_HOURS && window.RENTAL_HOURS.open)  || 8;
  const eH = (window.RENTAL_HOURS && window.RENTAL_HOURS.close) || 21;
  let html = '';
  for (let h = sH; h <= eH; h++) for (let m = 0; m < 60; m += step) {
    if (h === eH && m > 0) break;
    const t = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
    html += `<option value="${t}" ${t===sel?'selected':''}>${t}</option>`;
  }
  return html;
}

/* ── 計費（客報 PDF 規則）──
 *   用車 ≤5h 半天；5h+~24h 一天
 *   超時 ≤4h 按小時；逾 4h(至 5h) 半天；超過 5h +1 天
 *   21:00 後不能還（前端擋）
 */
function calcRentalFee(pickupISO, returnISO, pricing) {
  if (!pickupISO || !returnISO) return null;
  const start = new Date(pickupISO), end = new Date(returnISO);
  if (isNaN(start) || isNaN(end) || end <= start) return null;

  const hours = (end - start) / 3600000;
  const { day_rate, half_day_rate, hourly_overtime } = pricing;

  if (hours <= 5) return { used_hours: hours, total: half_day_rate, label: '半天' };
  if (hours <= 24) return { used_hours: hours, total: day_rate, label: '1 天' };

  const full_days = Math.floor(hours / 24);
  const remainder = hours - full_days * 24;
  let ot_fee = 0, extra_full = 0, extra_half = 0, label = `${full_days} 天`;

  if (remainder <= 0.001) {
    // 整數天
  } else if (remainder <= 4 + 0.001) {
    const ot_h = Math.round(remainder * 10) / 10;
    ot_fee = Math.round(remainder * hourly_overtime);
    label = `${full_days} 天 + 超時 ${ot_h} 小時`;
  } else if (remainder <= 5 + 0.001) {
    extra_half = 1; ot_fee = half_day_rate;
    label = `${full_days} 天 + 半天 (超時逾 4 小時)`;
  } else {
    extra_full = 1; label = `${full_days + 1} 天`;
  }

  const total = (full_days + extra_full) * day_rate + extra_half * half_day_rate + (extra_half ? 0 : ot_fee);
  return { used_hours: hours, total, label };
}

/* 還車 / 取車時間需落在營業時間內 */
function isTimeAllowed(iso) {
  if (!iso) return true;
  const d = new Date(iso);
  if (isNaN(d)) return true;
  const h = d.getHours() + d.getMinutes() / 60;
  const open  = (window.RENTAL_HOURS && window.RENTAL_HOURS.open)  || 8;
  const close = (window.RENTAL_HOURS && window.RENTAL_HOURS.close) || 21;
  return !(h >= close || h < open);
}

/* ── 產生需求明細文字（貼 LINE 用）── */
function buildQuoteText(o) {
  const fmtT = iso => iso.replace('T', ' ').slice(5);
  const lines = [];
  lines.push('【雫旅租車需求】');
  if (o.orderId) lines.push(`單號：${o.orderId}`);
  if (o.contact_name) lines.push(`聯絡人：${o.contact_name}`);
  if (o.contact_phone) lines.push(`電話：${o.contact_phone}`);
  if (o.depart) lines.push(`去程起飛：${o.depart}`);
  if (o.backflight) lines.push(`回程起飛：${o.backflight}`);
  lines.push('────────────');
  o.segments.forEach((s, i) => {
    if (o.segments.length > 1) lines.push(`〔租期段 ${i + 1}〕`);
    if (s.carLabel) lines.push(`車種：${s.carLabel}`);
    lines.push(`取車：${fmtT(s.pickup)} · ${s.store}`);
    lines.push(`還車：${fmtT(s.return)} · ${s.store}`);
    lines.push(`計費：${s.label}`);
  });
  lines.push('────────────');
  lines.push(`預估金額：${fmtMoney(o.total)}`);
  lines.push('');
  lines.push('※ 現場車輛有限，待車行確認有車回覆後才正式成立');
  lines.push('※ 建議取車時加保保險');
  return lines.join('\n');
}

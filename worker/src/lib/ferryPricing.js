/**
 * 船票計價（後端權威版，與前端 ferry-page.js 同邏輯）
 * sell 用 meta.fares（客報）；cost 用 cost_json.fares（成本估算，月結對帳修正）。
 * 不信任前端金額。
 */

function dateType(dateStr, dir, meta) {
  if (!dateStr) return 'weekday';
  if ((meta.holidays || []).includes(dateStr)) return 'holiday';
  const wr = meta.weekend_rule || {};
  if ((wr.extra_holiday || []).includes(dateStr)) return 'weekend';
  const dow = new Date(dateStr + 'T00:00:00').getDay(); // 0=日..6=六
  const days = dir === 'out' ? (wr.depart_penghu || [5, 6]) : (wr.return_penghu || [6, 0]);
  return days.includes(dow) ? 'weekend' : 'weekday';
}
const ORD = { weekday: 0, weekend: 1, holiday: 2 };
function roundType(o, b, meta) {
  const a = dateType(o, 'out', meta), c = dateType(b, 'back', meta);
  return ORD[a] >= ORD[c] ? a : c;
}

function calcShuttle(meta, product, p, useCost) {
  const st = (meta.shuttles || []).find(s => s.name === p.shuttle.station);
  if (!st) return 0;
  const c = p.counts || {}, ac = (c.adult || 0) + (c.child || 0), isR = p.shuttle.type === 'round';
  let per, perInf;
  if (useCost) {
    let cs = {};
    try { cs = (JSON.parse(product.cost_json || '{}').shuttles) || {}; } catch (e) {}
    const reg = cs[st.region];
    per = (!reg || typeof reg === 'string') ? (isR ? st.round : st.single) : (isR ? reg.round : reg.single);
    perInf = isR ? (meta.shuttle_infant && meta.shuttle_infant.round || 0) : (meta.shuttle_infant && meta.shuttle_infant.single || 0);
  } else {
    per = isR ? st.round : st.single;
    const inf = meta.shuttle_infant || {};
    perInf = (st.region === '南' && inf.south_free) ? 0 : (isR ? inf.round : inf.single);
  }
  return ac * per + (c.infant || 0) * perInf;
}

/**
 * 算整筆船票金額。
 * product: ferry tour_products row（meta + cost_json）
 * p: { tripType:'round'/'single', outDate, backDate, direction, counts:{adult,child,infant}, shuttle:{station,type}|null }
 * useCost: true→成本估算；false→客報售價
 */
export function calcFerry(product, p, useCost) {
  let meta = {};
  try { meta = JSON.parse(product.meta || '{}'); } catch (e) { return null; }
  let fares = meta.fares;
  if (useCost) {
    try { fares = JSON.parse(product.cost_json || '{}').fares; } catch (e) { fares = null; }
  }
  if (!fares) return null;

  const c = p.counts || {};
  let total = 0;

  if (p.tripType === 'round') {
    if (!p.outDate || !p.backDate) return null;
    const t = roundType(p.outDate, p.backDate, meta);
    total += (c.adult || 0) * ((fares.adult[t] && fares.adult[t].round) || 0);
    total += (c.child || 0) * ((fares.half && fares.half.round) || 0);
    total += (c.infant || 0) * ((fares.infant && fares.infant.round) || 0);
  } else {
    if (!p.outDate) return null;
    const t = dateType(p.outDate, p.direction || 'out', meta);
    total += (c.adult || 0) * ((fares.adult[t] && fares.adult[t].single) || 0);
    total += (c.child || 0) * ((fares.half && fares.half.single) || 0);
    total += (c.infant || 0) * ((fares.infant && fares.infant.single) || 0);
  }

  if (p.shuttle && p.shuttle.station) total += calcShuttle(meta, product, p, useCost);
  return total;
}

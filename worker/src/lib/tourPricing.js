/**
 * 租車計費（後端權威版，與前端 tours/assets/rental.js 同邏輯）
 * ------------------------------------------------------------
 * 規則（依客報 PDF）：
 *   用車 ≤5h 半天；5h+~24h 一天
 *   超時 ≤4h 按小時；逾 4h(至 5h) 半天；超過 5h +1 天
 * 後端用同一函數，分別代入「牌價」與「成本」算出 sellAmount / costAmount，
 * 不信任前端傳來的金額（避免被竄改）。
 */

/** 單段計費。pricing = { day, half, hour } */
export function calcSegmentFee(pricing, pickupISO, returnISO) {
  const start = new Date(pickupISO), end = new Date(returnISO);
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  const hours = (end - start) / 3600000;
  const day = +pricing.day || 0, half = +pricing.half || 0, hour = +pricing.hour || 0;

  if (hours <= 5) return half;
  if (hours <= 24) return day;

  const full = Math.floor(hours / 24);
  const rem = hours - full * 24;
  if (rem <= 0.001)        return full * day;
  if (rem <= 4 + 0.001)    return full * day + Math.round(rem * hour);
  if (rem <= 5 + 0.001)    return full * day + half;
  return (full + 1) * day;
}

/**
 * 整筆訂單（同一車種、可多段）總額。
 * product: tour_products row（含 price 與 cost 欄位）
 * segments: [{ pickup, return }, ...]
 * useCost: true → 用成本算；false → 用牌價算
 * 回 null 表示有段無效。
 */
export function calcOrderTotal(product, segments, useCost) {
  if (!Array.isArray(segments) || !segments.length) return null;
  const pricing = useCost
    ? { day: product.cost_day,  half: product.cost_half,  hour: product.cost_hour }
    : { day: product.price_day, half: product.price_half, hour: product.price_hour };
  let total = 0;
  for (const s of segments) {
    const fee = calcSegmentFee(pricing, s.pickup, s.return);
    if (fee == null) return null;
    total += fee;
  }
  return total;
}

/**
 * 行程下單計價（人頭價 + 規則：逢單補、加購）。
 * product: tour_products row（price/cost adult/child/infant + rules_json）
 * params: { counts:{adult,child,infant}, addons:[name,...] }
 * useCost: true→成本估算；false→客報售價
 * 逢單補/加購成本簡化＝客報（月結對帳修正）。
 */
export function calcTourBooking(product, params, useCost) {
  const c = params.counts || {};
  const ad = +c.adult || 0, ch = +c.child || 0, inf = +c.infant || 0;

  let rules = {};
  try { rules = JSON.parse(product.rules_json || '{}'); } catch (e) {}

  // 全票每人單價：預設用 price_adult / cost_adult；
  // 若有板型變體(board_variants)且前端有選板型 → 用該板型每人價覆蓋。
  // 售價來自 rules_json.board_variants（公開）；成本來自 cost_json.board_cost（機密）。
  let adultUnit = useCost ? (product.cost_adult || 0) : (product.price_adult || 0);
  if (params.board && Array.isArray(rules.board_variants)) {
    const v = rules.board_variants.find(x => x.name === params.board);
    if (v) {
      if (useCost) {
        let bc = {};
        try { bc = (JSON.parse(product.cost_json || '{}').board_cost) || {}; } catch (e) {}
        if (bc[params.board] != null) adultUnit = bc[params.board];
      } else if (v.price_adult != null) {
        adultUnit = v.price_adult;
      }
    }
  }

  let total;
  if (useCost) {
    total = ad * adultUnit + ch * (product.cost_child || 0) + inf * (product.cost_infant || 0);
  } else {
    total = ad * adultUnit + ch * (product.price_child || 0) + inf * (product.price_infant || 0);
  }

  // 機車逢單補：騎乘人數(大人+小孩)為奇數時 +補價（成本估算＝客報）
  if (rules.single_scooter && (ad + ch) % 2 === 1) {
    total += rules.single_scooter;
  }

  // 加購：選的 addon × 人數(大人+小孩)（成本估算＝客報）
  if (Array.isArray(params.addons) && Array.isArray(rules.addons)) {
    for (const name of params.addons) {
      const a = rules.addons.find(x => x.name === name);
      if (a) total += (a.price || 0) * (ad + ch);
    }
  }
  return total;
}

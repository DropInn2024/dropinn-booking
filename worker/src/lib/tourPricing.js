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

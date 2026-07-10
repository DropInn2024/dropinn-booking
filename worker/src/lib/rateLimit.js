/* 零基建速率限制（isolate 記憶體版）— audit Phase 2 選型結論：
   - 不用 D1（每次登入寫一筆太重，明確否決）
   - CF 原生 Rate Limiting binding 需另開付費功能，這個規模不值得
   → per-isolate best-effort：同一節點上能確實擋住暴力嘗試；isolate 回收即歸零，
     分散式攻擊靠 Turnstile（下單）與密碼強度兜底。對單棟民宿的威脅模型足夠。 */
const buckets = new Map();

/** 回傳 true=放行、false=超限。key 建議帶用途前綴（如 'login:1.2.3.4'）。 */
export function rateLimit(key, limit = 8, windowMs = 10 * 60 * 1000) {
  const now = Date.now();
  // 防 Map 無限長大：超過 2000 筆時清掉過期桶
  if (buckets.size > 2000) {
    for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (b.n >= limit) return false;
  b.n += 1;
  return true;
}

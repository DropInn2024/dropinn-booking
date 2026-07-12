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

/** 洪水緩衝：CF ratelimit binding＋記憶體版。
    ⚠ 實測（2026-07-12）：binding 計數器是「每台邊緣伺服器」各自記憶——同節點連打
    會分散到不同機器而全數放行，只擋得住單機爆量。精準限流靠 rateLimitDurable。 */
export async function rateLimitStrong(binding, key, memLimit = 8, memWindowMs = 10 * 60 * 1000) {
  if (binding) {
    try {
      const { success } = await binding.limit({ key });
      if (!success) return false;
    } catch (e) { console.error('[rateLimit] binding 呼叫失敗（fail-open）:', e?.message || e); }
  }
  return rateLimit(key, memLimit, memWindowMs);
}

/** 精準層（D1 持久計數，全域一致）：只給低頻高價值端點（登入類）用。
    寫入量有界：每 key 每視窗最多 limit+1 次寫；已達上限「只讀不寫」，
    攻擊者刷不出 D1 寫入量。D1 故障 fail-open 退回記憶體版。 */
export async function rateLimitDurable(env, key, limit = 8, windowSec = 600) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const row = await env.DB.prepare(
      'SELECT count, windowStart FROM login_attempts WHERE key = ?'
    ).bind(key).first();
    if (!row || now - row.windowStart >= windowSec) {
      await env.DB.prepare(`
        INSERT INTO login_attempts (key, count, windowStart) VALUES (?, 1, ?)
        ON CONFLICT(key) DO UPDATE SET count = 1, windowStart = ?
      `).bind(key, now, now).run();
      return true;
    }
    if (row.count >= limit) return false;
    await env.DB.prepare('UPDATE login_attempts SET count = count + 1 WHERE key = ?').bind(key).run();
    return true;
  } catch (e) {
    console.error('[rateLimit] durable 失敗（fail-open）:', e?.message || e);
    return rateLimit(key, limit);
  }
}

/** 登入端點組合拳：洪水緩衝（binding＋記憶體）先擋爆量，D1 精準層守底線。 */
export async function rateLimitAuth(env, binding, key, limit = 8) {
  if (!(await rateLimitStrong(binding, key, limit))) return false;
  return rateLimitDurable(env, key, limit, 600);
}

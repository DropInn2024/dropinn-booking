/* Cloudflare Turnstile 驗證（防機器人灌單／佔位攻擊）——住宿與行程下單共用零件。
   - 未設定 env.TURNSTILE_SECRET → 視為「尚未啟用」直接放行（安全預設，可分階段上線、不影響現狀）。
   - 已啟用但 token 缺/驗不過 → 擋下。
   - siteverify 服務本身出錯 → 保守「放行」(fail-open)，避免 CF 端故障時全站訂不了房；靠 48h 自動取消等其他防線。 */
export async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true;     // 尚未啟用
  if (!token) return false;
  try {
    const form = new URLSearchParams();
    form.set('secret', env.TURNSTILE_SECRET);
    form.set('response', token);
    if (ip) form.set('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: form,
    });
    const data = await res.json().catch(() => ({}));
    return data.success === true;
  } catch (e) {
    console.error('[turnstile] verify error (fail-open):', e);
    return true;
  }
}

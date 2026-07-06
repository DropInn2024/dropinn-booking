/* Cloudflare Turnstile — explore 行程/租車/船票共用（外部檔，符合站點 CSP）。
   與主站 js/turnstile-init.js 的差異：這三頁的下單表單是 JS 動態生成的彈窗，
   無法在頁面載入時渲染，改由各頁在「彈窗內容塞好之後」呼叫 ensureTurnstile('cfTurnstile')。
   api.js 以 ?render=explicit 載入（不自動掃描）。
   未設定 TURNSTILE_SITE_KEY（或容器不存在）時不渲染、完全不影響下單。 */
window.__cfTurnstileToken = '';
window.ensureTurnstile = function (containerId) {
  var k = (window.FRONTEND_CONFIG && window.FRONTEND_CONFIG.TURNSTILE_SITE_KEY) || '';
  var el = document.getElementById(containerId || 'cfTurnstile');
  if (!k || !window.turnstile || !el) return;
  window.__cfTurnstileToken = '';
  try {
    window.turnstile.render(el, {
      sitekey: k,
      callback: function (t) { window.__cfTurnstileToken = t || ''; },
      'expired-callback': function () { window.__cfTurnstileToken = ''; },
      'error-callback': function () { window.__cfTurnstileToken = ''; }
    });
  } catch (e) { /* 渲染失敗不擋下單 */ }
};

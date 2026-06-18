/* Cloudflare Turnstile 初始化（外部檔，符合站點 CSP——不可用 inline script）。
   定義 onload callback，供 api.js?onload=onloadTurnstileCallback 載入完成後呼叫。
   以 defer 載入、且排在 Turnstile api.js 之前，確保 callback 先就緒、#cfTurnstile 已存在。
   未設定 TURNSTILE_SITE_KEY（或頁面無 #cfTurnstile）時不渲染、完全不影響下單。 */
window.__cfTurnstileToken = '';
window.onloadTurnstileCallback = function () {
  function render() {
    var k = (window.FRONTEND_CONFIG && window.FRONTEND_CONFIG.TURNSTILE_SITE_KEY) || '';
    var el = document.getElementById('cfTurnstile');
    if (!k || !window.turnstile || !el) return;
    try {
      window.__cfWidgetId = window.turnstile.render(el, {
        sitekey: k,
        callback: function (t) { window.__cfTurnstileToken = t || ''; },
        'expired-callback': function () { window.__cfTurnstileToken = ''; },
        'error-callback': function () { window.__cfTurnstileToken = ''; }
      });
    } catch (e) { /* 渲染失敗不擋下單 */ }
  }
  // 保險：若 onload 在 DOM 尚未就緒時就觸發，等 DOMContentLoaded 再渲染
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
};

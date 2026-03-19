/**
 * 雫旅 Drop Inn — 共用 API Helper
 * dropinn-api-helper.js
 *
 * ⚠️  這是官方共用 helper。
 *     凡是需要打 Admin API 的新頁面，一律載入這個檔案，
 *     禁止直接在頁面內自己組 fetch 或重寫 google.script.run。
 *
 * 使用方式：
 *   <script src="config.public.js"></script>
 *   <script src="dropinn-api-helper.js"></script>
 *
 *   window.onload = function () {
 *     dropinnEnsureRuntime();
 *     // 之後正常使用 google.script.run.adminGetAllOrders() 等
 *   };
 *
 * 提供：
 *   - window.DROPINN_API_URL        : Admin API 網址
 *   - window.DROPINN_ADMIN_KEY      : Admin API 金鑰
 *   - window.DROPINN_API_READY      : Boolean，API URL 是否有效
 *   - window.dropinnEnsureRuntime() : 初始化 google.script.run fallback
 *   - window.dropinnCallAdmin(action, payload) : Promise 版 API 呼叫
 */

// 若在 GAS server 端執行（沒有 window），直接略過本檔內容，避免 ReferenceError。
if (typeof window === 'undefined') {
  // noop for server-side Apps Script
} else (function () {

  // ==========================================
  // 1. 統一設定來源
  // ==========================================
  window.FRONTEND_CONFIG =
    window.FRONTEND_CONFIG ||
    (typeof FRONTEND_CONFIG !== 'undefined' ? FRONTEND_CONFIG : {});

  window.DROPINN_API_URL =
    (window.FRONTEND_CONFIG.API_URL_ADMIN || window.FRONTEND_CONFIG.API_URL) ||
    window.location.href.split('?')[0];

  window.DROPINN_ADMIN_KEY = window.FRONTEND_CONFIG.ADMIN_API_KEY || '';

  // ==========================================
  // 2. 安全判斷：API URL 是否有效
  // ==========================================
  window.DROPINN_API_READY = (
    typeof window.DROPINN_API_URL === 'string' &&
    window.DROPINN_API_URL.length > 20 &&
    window.DROPINN_API_URL.startsWith('https://')
  );

  if (!window.DROPINN_API_READY) {
    console.warn('[dropinn] API_URL 未正確設定:', window.DROPINN_API_URL);
  }

  // ==========================================
  // 3. JSON 解析共用函式（含保護）
  // ==========================================
  // 遇到 GAS 錯誤包裝頁（回傳 HTML）時，丟出明確錯誤
  async function _safeJson(res) {
    var text = '';
    try {
      text = await res.text();
      return JSON.parse(text);
    } catch (e) {
      var isHtml = text.trim().startsWith('<');
      throw new Error(
        isHtml
          ? '後端回傳 HTML（可能是 GAS 錯誤頁或登入頁），請確認部署是否正常'
          : '回傳格式錯誤（非 JSON）：' + text.slice(0, 80)
      );
    }
  }

  // ==========================================
  // 4. google.script.run fallback（與 admin.html 相同邏輯）
  // ==========================================
  window.dropinnEnsureRuntime = function () {
    var hasNative =
      typeof google !== 'undefined' &&
      google && google.script && google.script.run;
    if (hasNative) return;

    window.google = window.google || {};
    google.script = google.script || {};

    var _makeRunner = function () {
      return {
        _success: null,
        _failure: null,
        withSuccessHandler: function (fn) { this._success = fn; return this; },
        withFailureHandler: function (fn) { this._failure = fn; return this; },
        _post: async function (action, payload) {
          if (!window.DROPINN_API_READY) {
            throw new Error('API_URL 未設定，請檢查 config.public.js 或從後台連結開啟');
          }
          var body = Object.assign(
            { action: action, adminKey: window.DROPINN_ADMIN_KEY },
            payload || {}
          );
          var res = await fetch(window.DROPINN_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(body),
          });
          var data = await _safeJson(res);
          if (data && data.success === false) {
            throw new Error(data.error || '後端回傳錯誤');
          }
          return data;
        },
        _run: function (action, payload) {
          var self = this;
          self._post(action, payload)
            .then(function (d) { if (self._success) self._success(d); })
            .catch(function (e) { if (self._failure) self._failure(e); else console.error('[dropinn]', e); });
          return self;
        },
        adminGetAllOrders:             function () { return this._run('getAllOrders', {}); },
        adminUpdateOrderAndSync:       function (orderID, updates) { return this._run('updateOrderAndSync', { orderID: orderID, updates: updates }); },
        adminCreateBooking:            function (data) { return this._run('createBooking', data); },
        adminMarkCompletedOrders:      function () { return this._run('markCompletedOrders', {}); },
        adminGetFinanceStats:          function (year, month) { return this._run('getFinanceStats', { year: year, month: month }); },
        adminGetDetailedFinanceReport: function (year, month) { return this._run('getDetailedFinanceReport', { year: year, month: month }); },
        adminGetCostForOrder:          function (orderID, year) { return this._run('getCostForOrder', { orderID: orderID, year: year }); },
        adminRebuildCalendars:         function () { return this._run('rebuildCalendars', {}); },
        adminClearCalendars:           function () { return this._run('clearCalendars', {}); },
        adminCleanupOldYear:           function () { return this._run('cleanupOldYear', {}); },
        adminGetCalendarStats:         function () { return this._run('getCalendarStats', {}); },
        adminSendNotificationEmail:    function (orderID) { return this._run('sendNotificationEmail', { orderID: orderID }); },
        adminGenerateNotification:     function (orderID, changeType) { return this._run('generateNotification', { orderID: orderID, changeType: changeType }); },
        adminRunSetupSystem:           function () { return this._run('adminRunSetupSystem', {}); },
        adminInitializeYearSheet:      function (year) { return this._run('adminInitializeYearSheet', { year: year }); },
        adminQuickCheck:               function () { return this._run('adminQuickCheck', {}); },
        adminGetSettings:              function () { return this._run('adminGetSettings', {}); },
        adminSetSettings:              function (updates) { return this._run('adminSetSettings', { updates: updates }); },
        getRecommendationRecords:      function () { return this._run('getRecommendationRecords', {}); },
        addRecommendationRecord:       function (record) { return this._run('addRecommendationRecord', { record: record }); },
      };
    };

    google.script.run = new Proxy({}, {
      get: function (_, prop) {
        var runner = _makeRunner();
        if (typeof runner[prop] === 'function') return runner[prop].bind(runner);
        return undefined;
      }
    });
  };

  // ==========================================
  // 5. Promise 版直接呼叫
  // ==========================================
  window.dropinnCallAdmin = async function (action, payload) {
    if (!window.DROPINN_API_READY) {
      throw new Error('API_URL 未設定，請檢查 config.public.js 或從後台連結開啟');
    }
    var body = Object.assign(
      { action: action, adminKey: window.DROPINN_ADMIN_KEY },
      payload || {}
    );
    var res = await fetch(window.DROPINN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body),
    });
    var data = await _safeJson(res);
    if (data && data.success === false) {
      throw new Error(data.error || '後端回傳錯誤');
    }
    return data;
  };

})();

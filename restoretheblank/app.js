window.FRONTEND_CONFIG =
  window.FRONTEND_CONFIG || (typeof FRONTEND_CONFIG !== 'undefined' ? FRONTEND_CONFIG : {});
(function () {
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var WEEKDAYS = ['日','一','二','三','四','五','六'];

  /* ── 登入邏輯 ────────────────────────────────────────────── */
  var HK_TOKEN_KEY = 'hk_token';
  var hkToken = sessionStorage.getItem(HK_TOKEN_KEY) || '';

  var loginScreen = document.getElementById('loginScreen');
  var appEl       = document.getElementById('app');

  function showApp()   { loginScreen.classList.add('hidden'); appEl.classList.add('show'); initCalendar(); }
  function showLogin() { loginScreen.classList.remove('hidden'); appEl.classList.remove('show'); }

  if (hkToken) {
    fetch('/api/restoretheblank/orders', {
      headers: { 'Authorization': 'Bearer ' + hkToken },
    }).then(function (r) {
      if (r.ok) showApp();
      else { sessionStorage.removeItem(HK_TOKEN_KEY); hkToken = ''; showLogin(); }
    }).catch(function () { showLogin(); });
  } else {
    showLogin();
  }

  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('loginPwd').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doLogin();
  });

  function doLogin() {
    var pwd = document.getElementById('loginPwd').value;
    if (!pwd) return;
    var errEl = document.getElementById('loginErr');
    errEl.textContent = '';
    fetch('/api/restoretheblank/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success && data.token) {
          hkToken = data.token;
          sessionStorage.setItem(HK_TOKEN_KEY, hkToken);
          showApp();
        } else {
          errEl.textContent = '密碼錯誤';
        }
      })
      .catch(function () { errEl.textContent = '連線失敗'; });
  }

  document.getElementById('logoutBtn').addEventListener('click', function () {
    sessionStorage.removeItem(HK_TOKEN_KEY);
    hkToken = '';
    showLogin();
  });

  /* ── 日曆邏輯 ────────────────────────────────────────────── */
  var currentYear  = new Date().getFullYear();
  var currentMonth = new Date().getMonth();
  var ordersCache  = {};
  var currentOrders = [];   // 當月訂單快取，供彈出卡片用

  function _hkFetch(path) {
    return fetch(path, {
      headers: { 'Authorization': 'Bearer ' + hkToken },
    }).then(function (r) {
      if (r.status === 401) { showLogin(); throw new Error('unauth'); }
      return r.json();
    });
  }

  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function dateStr(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function monthStr() {
    return currentYear + '-' + String(currentMonth + 1).padStart(2, '0');
  }
  function updateTitles() {
    document.getElementById('monthMain').textContent = MONTHS[currentMonth];
    document.getElementById('monthYear').textContent = String(currentYear);
  }

  function buildHeader() {
    var h = document.getElementById('calHeader');
    var html = '';
    WEEKDAYS.forEach(function (d) { html += '<div class="cal-header-cell">' + d + '</div>'; });
    h.innerHTML = html;
  }

  /* ── 渲染日曆（只顯示確認訂單：已付訂 / 完成）── */
  function renderCal(orders) {
    currentOrders = orders;
    var y = currentYear, m = currentMonth;
    var firstDay    = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var todayD = todayStr();

    // 只處理「已付訂」與「完成」（不顯示洽談中）
    var confirmed = orders.filter(function (o) {
      return o.status === '已付訂' || o.status === '完成';
    });

    // day → { checkouts: [order,...], checkins: [order,...] }
    var dayMap = {};
    function ensureDay(ds) {
      if (!dayMap[ds]) dayMap[ds] = { checkouts: [], checkins: [], notes: [] };
      return dayMap[ds];
    }

    confirmed.forEach(function (o) {
      var mk = monthStr();
      if (o.checkOut && o.checkOut.startsWith(mk)) {
        var d = ensureDay(o.checkOut);
        d.checkouts.push(o);
        if (o.housekeepingNote) d.notes.push(o.housekeepingNote);
      }
      if (o.checkIn && o.checkIn.startsWith(mk)) {
        var d2 = ensureDay(o.checkIn);
        d2.checkins.push(o);
      }
    });

    var grid = document.getElementById('calGrid');
    var html = '';
    for (var i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

    for (var day = 1; day <= daysInMonth; day++) {
      var ds = dateStr(y, m, day);
      var dateObj = new Date(y, m, day);
      var dow = dateObj.getDay();
      var isWe  = dow === 0 || dow === 6;
      var isPast = ds < todayD;
      var data = dayMap[ds];
      var hasOut  = data && data.checkouts.length > 0;
      var hasIn   = data && data.checkins.length > 0;
      var hasNote = data && data.notes.length > 0;

      var cls = 'cal-cell';
      if (isWe)  cls += ' weekend';
      if (isPast) cls += ' past';
      if (hasOut && hasIn) cls += ' has-both';
      else if (hasOut)     cls += ' has-checkout';
      else if (hasIn)      cls += ' has-checkin';
      if (hasNote)         cls += ' has-note';

      // 有進退房的日子才可點擊
      var clickable = hasOut || hasIn;

      html += '<div class="' + cls + '"' + (clickable ? ' data-date="' + ds + '" data-action="showDayDetail"' : '') + '>';
      html += '<span class="cal-day-num">' + day + '</span>';

      if (data) {
        // 退房：顯示間數
        data.checkouts.forEach(function (o) {
          var rooms = o.rooms ? o.rooms + '間' : '';
          html += '<div class="cal-event ev-checkout">↑' + (rooms ? ' ' + rooms : '') + '</div>';
        });
        // 入住：顯示間數
        data.checkins.forEach(function (o) {
          var rooms = o.rooms ? o.rooms + '間' : '';
          html += '<div class="cal-event ev-checkin">↓' + (rooms ? ' ' + rooms : '') + '</div>';
        });
        // 房務備注
        if (data.notes.length) {
          html += '<span class="ev-note">' + data.notes.join(' / ') + '</span>';
        }
      }

      html += '</div>';
    }
    grid.innerHTML = html;
  }

  /* ── 今日摘要（只顯示確認訂單，不顯示姓名）── */
  function renderToday(orders) {
    var td = todayStr();
    var titleEl   = document.getElementById('todayTitle');
    var contentEl = document.getElementById('todayContent');
    titleEl.textContent = '今日 ' + td;

    var confirmed = orders.filter(function (o) {
      return (o.status === '已付訂' || o.status === '完成') &&
             (o.checkOut === td || o.checkIn === td);
    });

    if (!confirmed.length) {
      contentEl.innerHTML = '<div class="order-card-detail" style="padding:8px 0">今日無入退房</div>';
      return;
    }

    var html = '';
    confirmed.forEach(function (o) {
      var rooms = o.rooms ? o.rooms + ' 間' : '—';
      html += '<div class="order-card">';
      html += '<div class="order-card-title">';
      if (o.checkOut === td) html += '<span class="tag tag-checkout">退房</span>';
      if (o.checkIn  === td) html += '<span class="tag tag-checkin">入住</span>';
      html += '　' + rooms + '</div>';
      html += '<div class="order-card-detail">';
      html += '入住 ' + o.checkIn + '　退房 ' + o.checkOut + '<br>';
      if (o.housekeepingNote) html += '備注：' + o.housekeepingNote + '<br>';
      html += '</div></div>';
    });
    contentEl.innerHTML = html;
  }

  /* ── 點擊日期：彈出卡片詳情 ─────────────────────────────── */
  var dayDetailEl = document.getElementById('dayDetail');
  var dayDetailDateEl = document.getElementById('dayDetailDate');
  var dayDetailBodyEl = document.getElementById('dayDetailBody');
  var dayDetailCloseEl = document.getElementById('dayDetailClose');

  if (dayDetailCloseEl) {
    dayDetailCloseEl.addEventListener('click', function () {
      dayDetailEl.classList.remove('show');
    });
  }
  if (dayDetailEl) {
    dayDetailEl.addEventListener('click', function (e) {
      if (e.target === dayDetailEl) dayDetailEl.classList.remove('show');
    });
  }

  function showDayDetail(ds) {
    var confirmed = currentOrders.filter(function (o) {
      return (o.status === '已付訂' || o.status === '完成') &&
             (o.checkOut === ds || o.checkIn === ds);
    });
    if (!confirmed.length || !dayDetailEl) return;

    var parts = ds.split('-');
    dayDetailDateEl.textContent = parts[1] + '/' + parts[2];

    var html = '';
    confirmed.forEach(function (o) {
      var rooms = o.rooms ? o.rooms + ' 間' : '—';
      html += '<div class="order-card">';
      html += '<div class="order-card-title">';
      if (o.checkOut === ds) html += '<span class="tag tag-checkout">退房</span>';
      if (o.checkIn  === ds) html += '<span class="tag tag-checkin">入住</span>';
      html += '　' + rooms + '</div>';
      html += '<div class="order-card-detail">';
      html += '入住 ' + o.checkIn + '　退房 ' + o.checkOut + '<br>';
      if (o.housekeepingNote) html += '備注：' + o.housekeepingNote + '<br>';
      html += '</div></div>';
    });
    dayDetailBodyEl.innerHTML = html;
    dayDetailEl.classList.add('show');
  }

  /* ── 事件委派：日曆格點擊 ─────────────────────────────── */
  document.getElementById('calGrid').addEventListener('click', function (e) {
    var cell = e.target.closest('[data-action="showDayDetail"]');
    if (cell) showDayDetail(cell.dataset.date);
  });

  /* ── 月份切換 ────────────────────────────────────────── */
  document.getElementById('prevBtn').addEventListener('click', function () {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    updateTitles();
    loadAndRender();
  });
  document.getElementById('nextBtn').addEventListener('click', function () {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    updateTitles();
    loadAndRender();
  });

  function loadAndRender() {
    var mk = monthStr();
    var grid    = document.getElementById('calGrid');
    var loading = document.getElementById('calLoading');
    grid.style.display = 'none';
    loading.style.display = 'flex';

    function doRender(orders) {
      ordersCache[mk] = orders;
      loading.style.display = 'none';
      grid.style.display = 'grid';
      renderCal(orders);
    }

    if (ordersCache[mk]) { doRender(ordersCache[mk]); return; }

    _hkFetch('/api/restoretheblank/orders?month=' + mk)
      .then(function (data) {
        if (!data.success) { loading.style.display = 'none'; return; }
        doRender(data.orders || []);
      })
      .catch(function () { loading.style.display = 'none'; });
  }

  function initCalendar() {
    buildHeader();
    updateTitles();
    _hkFetch('/api/restoretheblank/orders?month=' + monthStr())
      .then(function (data) {
        var orders = (data.success ? data.orders : []) || [];
        ordersCache[monthStr()] = orders;
        renderToday(orders);
        document.getElementById('calLoading').style.display = 'none';
        document.getElementById('calGrid').style.display = 'grid';
        renderCal(orders);
      })
      .catch(function () {
        document.getElementById('calLoading').style.display = 'none';
      });
  }
})();

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
  var currentOrders = [];

  function _hkFetch(path) {
    return fetch(path, {
      headers: { 'Authorization': 'Bearer ' + hkToken },
    }).then(function (r) {
      if (r.status === 401) { showLogin(); throw new Error('unauth'); }
      return r.json();
    });
  }

  function todayStr() {
    var now = new Date();
    return now.getFullYear() + '-'
      + String(now.getMonth() + 1).padStart(2, '0') + '-'
      + String(now.getDate()).padStart(2, '0');
  }
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

  /* ── 今日摘要貼心提示 ─────────────────────────────────────── */
  function todayMsg(checkoutRooms, checkinRooms) {
    var hasBoth = checkoutRooms > 0 && checkinRooms > 0;
    if (hasBoth) {
      return '加油！今天退房又入住，時間有點趕～麻煩你們了 💪';
    }
    if (checkoutRooms === 0 && checkinRooms === 0) {
      return '今天沒有工作，老闆要努力一點 😌';
    }
    if (checkoutRooms === 0) {
      return '今天只有入住，辛苦了 ✨';
    }
    if (checkoutRooms >= 4) {
      return '今天有 ' + checkoutRooms + ' 間需要整理，辛苦了！記得先吃飯再打掃 🍚';
    }
    if (checkoutRooms === 3) {
      return '今天三間房，時間充裕，麻煩多清潔平時打掃不到的角落 ✨';
    }
    /* 1–2 間 */
    return '今天輕鬆，把每個角落都照顧好 ☀️';
  }

  /* ── 渲染日曆（只顯示確認訂單：已付訂 / 完成）── */
  function renderCal(orders) {
    currentOrders = orders;
    var y = currentYear, m = currentMonth;
    var firstDay    = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var todayD = todayStr();
    var mk = monthStr();

    var confirmed = orders.filter(function (o) {
      return o.status === '已付訂' || o.status === '完成';
    });

    // day → { checkouts:[], checkins:[], hasNote: bool }
    var dayMap = {};
    function ensureDay(ds) {
      if (!dayMap[ds]) dayMap[ds] = { checkouts: [], checkins: [], hasNote: false };
      return dayMap[ds];
    }

    confirmed.forEach(function (o) {
      if (o.checkOut && o.checkOut.startsWith(mk)) {
        var d = ensureDay(o.checkOut);
        d.checkouts.push(o);
        if (o.housekeepingNote && o.housekeepingNote.trim()) d.hasNote = true;
      }
      if (o.checkIn && o.checkIn.startsWith(mk)) {
        ensureDay(o.checkIn).checkins.push(o);
      }
    });

    var grid = document.getElementById('calGrid');
    var html = '';
    for (var i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

    for (var day = 1; day <= daysInMonth; day++) {
      var ds = dateStr(y, m, day);
      var dow = new Date(y, m, day).getDay();
      var isWe   = dow === 0 || dow === 6;
      var isPast = ds < todayD;
      var data   = dayMap[ds];
      var hasOut  = data && data.checkouts.length > 0;
      var hasIn   = data && data.checkins.length > 0;
      var hasNote = data && data.hasNote;

      var cls = 'cal-cell';
      if (isWe)   cls += ' weekend';
      if (isPast) cls += ' past';
      if (hasOut && hasIn) cls += ' has-both';
      else if (hasOut)     cls += ' has-checkout';
      else if (hasIn)      cls += ' has-checkin';

      var clickable = hasOut || hasIn;
      html += '<div class="' + cls + '"'
            + (clickable ? ' data-date="' + ds + '" data-action="showDayDetail"' : '')
            + '>';
      html += '<span class="cal-day-num">' + day + '</span>';

      if (data) {
        // 退房行（含星號備注提示）
        data.checkouts.forEach(function (o) {
          var rooms = o.rooms ? o.rooms + '間' : '';
          var star  = (o.housekeepingNote && o.housekeepingNote.trim()) ? '<span class="ev-star">★</span>' : '';
          html += '<div class="cal-event ev-checkout">↑' + (rooms ? ' ' + rooms : '') + star + '</div>';
        });
        // 入住行
        data.checkins.forEach(function (o) {
          var rooms = o.rooms ? o.rooms + '間' : '';
          html += '<div class="cal-event ev-checkin">↓' + (rooms ? ' ' + rooms : '') + '</div>';
        });
      }

      html += '</div>';
    }
    grid.innerHTML = html;
  }

  /* ── 今日摘要 ── */
  function renderToday(orders) {
    var td = todayStr();
    var titleEl   = document.getElementById('todayTitle');
    var contentEl = document.getElementById('todayContent');
    titleEl.textContent = '今日 ' + td;

    var confirmed = orders.filter(function (o) {
      return (o.status === '已付訂' || o.status === '完成') &&
             (o.checkOut === td || o.checkIn === td);
    });

    // 計算今日退房間數 / 入住間數
    var checkoutRooms = 0, checkinRooms = 0;
    confirmed.forEach(function (o) {
      if (o.checkOut === td) checkoutRooms += (Number(o.rooms) || 1);
      if (o.checkIn  === td) checkinRooms  += (Number(o.rooms) || 1);
    });

    var msgText = todayMsg(checkoutRooms, checkinRooms);
    var html = '<div class="today-msg">' + msgText + '</div>';

    if (confirmed.length) {
      confirmed.forEach(function (o) {
        var rooms = o.rooms ? o.rooms + ' 間' : '—';
        html += '<div class="order-card">';
        html += '<div class="order-card-title">';
        if (o.checkOut === td) html += '<span class="tag tag-checkout">退房</span>';
        if (o.checkIn  === td) html += '<span class="tag tag-checkin">入住</span>';
        html += '　' + rooms + '</div>';
        html += '<div class="order-card-detail">';
        html += '入住 ' + o.checkIn + '　退房 ' + o.checkOut;
        if (o.housekeepingNote) html += '<br>備注：' + o.housekeepingNote;
        html += '</div></div>';
      });
    }

    contentEl.innerHTML = html;
  }

  /* ── 點擊日期：彈出卡片詳情 ─────────────────────────────── */
  var dayDetailEl      = document.getElementById('dayDetail');
  var dayDetailDateEl  = document.getElementById('dayDetailDate');
  var dayDetailBodyEl  = document.getElementById('dayDetailBody');
  var dayDetailCloseEl = document.getElementById('dayDetailClose');

  dayDetailCloseEl.addEventListener('click', function () {
    dayDetailEl.classList.remove('show');
  });
  dayDetailEl.addEventListener('click', function (e) {
    if (e.target === dayDetailEl) dayDetailEl.classList.remove('show');
  });

  function showDayDetail(ds) {
    var confirmed = currentOrders.filter(function (o) {
      return (o.status === '已付訂' || o.status === '完成') &&
             (o.checkOut === ds || o.checkIn === ds);
    });
    if (!confirmed.length) return;

    var parts = ds.split('-');
    dayDetailDateEl.textContent = parts[1] + ' / ' + parts[2];

    var html = '';
    confirmed.forEach(function (o) {
      var rooms = o.rooms ? o.rooms + ' 間' : '—';
      html += '<div class="order-card">';
      html += '<div class="order-card-title">';
      if (o.checkOut === ds) html += '<span class="tag tag-checkout">退房</span>';
      if (o.checkIn  === ds) html += '<span class="tag tag-checkin">入住</span>';
      html += '　' + rooms + '</div>';
      html += '<div class="order-card-detail">';
      html += '入住 ' + o.checkIn + '　退房 ' + o.checkOut;
      if (o.housekeepingNote) html += '<br>備注：' + o.housekeepingNote;
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

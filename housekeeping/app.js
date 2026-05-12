window.FRONTEND_CONFIG =
  window.FRONTEND_CONFIG || (typeof FRONTEND_CONFIG !== 'undefined' ? FRONTEND_CONFIG : {});
(function () {
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var WEEKDAYS = ['日','一','二','三','四','五','六'];

  /* ── 登入邏輯 ────────────────────────────────────────────── */
  // 房務密碼：直接跟 Worker 拿（POST /api/housekeeping/auth）
  // 或在 sessionStorage 存 token
  var HK_TOKEN_KEY = 'hk_token';
  var hkToken = sessionStorage.getItem(HK_TOKEN_KEY) || '';

  var loginScreen = document.getElementById('loginScreen');
  var appEl = document.getElementById('app');

  function showApp() {
    loginScreen.classList.add('hidden');
    appEl.classList.add('show');
    initCalendar();
  }
  function showLogin() {
    loginScreen.classList.remove('hidden');
    appEl.classList.remove('show');
  }

  // 驗證 token（嘗試呼叫 API）
  if (hkToken) {
    fetch('/api/housekeeping/orders', {
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
    fetch('/api/housekeeping/login', {
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
  var ordersCache  = {}; // 'YYYY-MM' → orders array

  function _hkFetch(path) {
    return fetch(path, {
      headers: { 'Authorization': 'Bearer ' + hkToken },
    }).then(function (r) {
      if (r.status === 401) { showLogin(); throw new Error('unauth'); }
      return r.json();
    });
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
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

  /* 建立日曆表頭 */
  function buildHeader() {
    var h = document.getElementById('calHeader');
    var html = '';
    WEEKDAYS.forEach(function (d) {
      html += '<div class="cal-header-cell">' + d + '</div>';
    });
    h.innerHTML = html;
  }

  /* 載入訂單並渲染 */
  function loadAndRender() {
    var mk = monthStr();
    var grid = document.getElementById('calGrid');
    var loading = document.getElementById('calLoading');
    grid.style.display = 'none';
    loading.style.display = 'flex';

    function doRender(orders) {
      ordersCache[mk] = orders;
      loading.style.display = 'none';
      grid.style.display = 'grid';
      renderCal(orders);
    }

    if (ordersCache[mk]) {
      doRender(ordersCache[mk]);
      return;
    }

    // 拉本月 + 下月（確保退房日在下月的訂單也顯示）
    _hkFetch('/api/housekeeping/orders?month=' + mk)
      .then(function (data) {
        if (!data.success) { loading.style.display = 'none'; return; }
        doRender(data.orders || []);
      })
      .catch(function () { loading.style.display = 'none'; });
  }

  function renderCal(orders) {
    var y = currentYear, m = currentMonth;
    var firstDay = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var todayD = todayStr();

    // 建立 day → { checkouts, checkins, pendings, notes }
    var dayMap = {};
    function ensureDay(ds) {
      if (!dayMap[ds]) dayMap[ds] = { checkouts: [], checkins: [], pendings: [], notes: [] };
      return dayMap[ds];
    }

    orders.forEach(function (o) {
      var checkOut = o.checkOut || '';
      var checkIn  = o.checkIn  || '';
      var name = o.name || '—';
      var note = o.housekeepingNote || '';
      var isPending = o.status === '洽談中';

      // 退房日
      if (checkOut && checkOut.startsWith(monthStr())) {
        var day = ensureDay(checkOut);
        if (isPending) day.pendings.push(name + '（退・洽談中）');
        else day.checkouts.push(name);
        if (note) day.notes.push(note);
      }
      // 入住日
      if (checkIn && checkIn.startsWith(monthStr())) {
        var day2 = ensureDay(checkIn);
        if (isPending) day2.pendings.push(name + '（入・洽談中）');
        else day2.checkins.push(name);
      }
    });

    var grid = document.getElementById('calGrid');
    var html = '';
    for (var i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

    for (var d = 1; d <= daysInMonth; d++) {
      var ds = dateStr(y, m, d);
      var dateObj = new Date(y, m, d);
      var dow = dateObj.getDay();
      var isWe = dow === 0 || dow === 6;
      var isPast = ds < todayD;
      var dayData = dayMap[ds];
      var hasOut  = dayData && dayData.checkouts.length > 0;
      var hasIn   = dayData && dayData.checkins.length > 0;
      var hasPend = dayData && dayData.pendings.length > 0;
      var hasNote = dayData && dayData.notes.length > 0;

      var cls = 'cal-cell';
      if (isWe) cls += ' weekend';
      if (isPast) cls += ' past';
      if (hasOut && hasIn) cls += ' has-both';
      else if (hasOut) cls += ' has-checkout';
      else if (hasIn) cls += ' has-checkin';
      if (hasPend) cls += ' has-pending';
      if (hasNote) cls += ' has-note';

      html += '<div class="' + cls + '">';
      html += '<span class="cal-day-num">' + d + '</span>';

      if (dayData) {
        dayData.checkouts.forEach(function (n) {
          html += '<div class="cal-event ev-checkout">↑ ' + n + '</div>';
        });
        dayData.checkins.forEach(function (n) {
          html += '<div class="cal-event ev-checkin">↓ ' + n + '</div>';
        });
        dayData.pendings.forEach(function (n) {
          html += '<div class="cal-event ev-pending">' + n + '</div>';
        });
        if (dayData.notes.length) {
          html += '<span class="ev-note">' + dayData.notes.join(' / ') + '</span>';
        }
      }

      html += '</div>';
    }
    grid.innerHTML = html;
  }

  /* 今日摘要 */
  function renderToday(orders) {
    var td = todayStr();
    var titleEl = document.getElementById('todayTitle');
    var contentEl = document.getElementById('todayContent');
    titleEl.textContent = '今日 ' + td;

    var relevant = orders.filter(function (o) {
      return o.checkOut === td || o.checkIn === td;
    });
    if (!relevant.length) {
      contentEl.innerHTML = '<div class="order-card-detail" style="padding:8px 0">今日無入退房</div>';
      return;
    }
    var html = '';
    relevant.forEach(function (o) {
      html += '<div class="order-card">';
      html += '<div class="order-card-title">' + (o.name || '—');
      if (o.checkOut === td) html += '<span class="tag tag-checkout">退房</span>';
      if (o.checkIn  === td) html += '<span class="tag tag-checkin">入住</span>';
      if (o.status === '洽談中') html += '<span class="tag tag-pending">洽談中</span>';
      html += '</div>';
      html += '<div class="order-card-detail">';
      html += '入住 ' + o.checkIn + '　退房 ' + o.checkOut + '<br>';
      if (o.rooms)     html += '棟別：' + o.rooms + ' 棟<br>';
      if (o.phone)     html += '電話：' + o.phone + '<br>';
      if (o.housekeepingNote) html += '房務備注：' + o.housekeepingNote + '<br>';
      html += '</div></div>';
    });
    contentEl.innerHTML = html;
  }

  function initCalendar() {
    buildHeader();
    updateTitles();

    // 先拉今日所在月份
    _hkFetch('/api/housekeeping/orders?month=' + monthStr())
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
})();

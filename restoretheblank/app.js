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

  function showApp()   { loginScreen.classList.add('hidden'); appEl.classList.add('show'); initCalendar(); initHkTabs(); }
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
    if (checkoutRooms === 0 && checkinRooms === 0) {
      return '今天沒有工作，老闆要努力一點 😌';
    }
    if (hasBoth) {
      return '加油！今天退房又入住，時間有點趕～麻煩你們了 💪';
    }
    if (checkoutRooms === 0) {
      return '今天只有入住，辛苦了 ✨';
    }
    if (checkoutRooms >= 4) {
      return '今天有 ' + checkoutRooms + ' 間要整理，辛苦了！記得先吃飯再打掃 🍚';
    }
    /* 3 間（包棟標準） */
    return '今天三間房，時間充裕，麻煩多清潔平時打掃不到的角落 ✨';
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

  /* ════════════════════════════════════════════════════════════
     清潔費分頁
  ════════════════════════════════════════════════════════════ */
  var HK_MONTHS = ['January','February','March','April','May','June',
                   'July','August','September','October','November','December'];
  var hkYear  = new Date().getFullYear();
  var hkMonth = new Date().getMonth();
  var hkCache = {};

  function hkMonthStr() {
    return hkYear + '-' + String(hkMonth + 1).padStart(2, '0');
  }
  function hkUpdateTitle() {
    document.getElementById('hkMonthMain').textContent = HK_MONTHS[hkMonth];
    document.getElementById('hkMonthYear').textContent = String(hkYear);
  }

  function initHkTabs() {
    // 分頁切換
    document.getElementById('tabBtnCal').addEventListener('click', function () {
      switchTab('cal');
    });
    document.getElementById('tabBtnHk').addEventListener('click', function () {
      switchTab('hk');
      hkLoadAndRender();
    });

    // 清潔費月份導航
    document.getElementById('hkPrevBtn').addEventListener('click', function () {
      hkMonth--;
      if (hkMonth < 0) { hkMonth = 11; hkYear--; }
      hkUpdateTitle();
      hkLoadAndRender();
    });
    document.getElementById('hkNextBtn').addEventListener('click', function () {
      hkMonth++;
      if (hkMonth > 11) { hkMonth = 0; hkYear++; }
      hkUpdateTitle();
      hkLoadAndRender();
    });

    hkUpdateTitle();

    // 事件委派（動態元素）
    document.getElementById('hkContent').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-hk-action]');
      if (!btn) return;
      var action = btn.dataset.hkAction;
      var orderId = btn.dataset.orderId;

      if (action === 'submit') {
        var amountEl = document.getElementById('hkAmt_' + orderId);
        var noteEl   = document.getElementById('hkNote_' + orderId);
        var amount   = parseFloat(amountEl ? amountEl.value : '');
        if (isNaN(amount) || amount < 0) {
          amountEl && amountEl.focus();
          return;
        }
        hkSubmitCost(orderId, amount, noteEl ? noteEl.value : '');
      }
      if (action === 'edit') {
        hkEnterEditMode(orderId);
      }
      if (action === 'del-extra') {
        var extraId = Number(btn.dataset.extraId);
        hkDeleteExtra(extraId);
      }
      if (action === 'add-extra') {
        var descEl  = document.getElementById('hkExtraDesc');
        var amtEl   = document.getElementById('hkExtraAmt');
        var desc    = descEl ? descEl.value.trim() : '';
        var amt     = parseFloat(amtEl ? amtEl.value : '');
        if (!desc || isNaN(amt) || amt < 0) return;
        hkAddExtra(desc, amt);
      }
    });
  }

  function switchTab(tab) {
    document.getElementById('tabBtnCal').classList.toggle('active', tab === 'cal');
    document.getElementById('tabBtnHk').classList.toggle('active', tab === 'hk');
    document.getElementById('tabCal').classList.toggle('active', tab === 'cal');
    document.getElementById('tabHk').classList.toggle('active', tab === 'hk');
  }

  function hkLoadAndRender() {
    var mk = hkMonthStr();
    var contentEl = document.getElementById('hkContent');
    contentEl.innerHTML = '<div class="loading-wrap">載入中…</div>';

    if (hkCache[mk]) { hkRender(hkCache[mk]); return; }

    _hkFetch('/api/restoretheblank/hk/costs?month=' + mk)
      .then(function (data) {
        if (!data.success) { contentEl.innerHTML = '<div class="loading-wrap">載入失敗</div>'; return; }
        hkCache[mk] = data;
        hkRender(data);
      })
      .catch(function () {
        contentEl.innerHTML = '<div class="loading-wrap">連線失敗</div>';
      });
  }

  function hkRender(data) {
    var orders    = data.orders    || [];
    var extras    = data.extras    || [];
    var isSettled = data.isSettled || false;
    var mk        = hkMonthStr();

    var statusText = isSettled ? '已結清'
      : (orders.every(function (o) { return o.cost && o.cost.amount != null; }) && orders.length > 0 ? '已填完' : '待填');
    var statusCls  = isSettled ? 'settled' : (statusText === '已填完' ? 'partial' : 'pending');

    var filledTotal = 0;
    var filledCount = 0;
    orders.forEach(function (o) {
      if (o.cost && o.cost.amount != null) {
        filledTotal += o.cost.amount;
        filledCount++;
      }
    });
    var extrasTotal = extras.reduce(function (s, e) { return s + (e.amount || 0); }, 0);

    var html = '';

    // 已結算大 banner — 跳出來醒目，避免使用者沒注意到
    if (isSettled) {
      var settledDate = (data.settledAt || '').slice(0, 10);
      html += '<div style="background:rgba(130,160,130,0.14);border-left:4px solid #5a7a5a;border-radius:8px;padding:14px 18px;margin-bottom:18px;display:flex;align-items:center;gap:12px;">';
      html += '<span style="font-size:20px;">🔒</span>';
      html += '<div>';
      html += '<div style="font-size:14px;font-weight:500;color:#3a5a3a;letter-spacing:0.08em;margin-bottom:2px;">';
      html += hkYear + ' 年 ' + (hkMonth + 1) + ' 月已結算';
      html += '</div>';
      html += '<div style="font-size:12px;color:#5a7a5a;letter-spacing:0.06em;">';
      html += '於 ' + (settledDate || '—') + ' 月結 · 本月所有項目不可編輯';
      html += '</div>';
      html += '</div>';
      html += '</div>';
    }

    // 月份狀態
    html += '<div style="display:flex;align-items:center;margin-bottom:16px;">';
    html += '<span style="font-size:13px;color:var(--muted);letter-spacing:0.1em;">';
    html += '本月打掃：' + orders.length + ' 次</span>';
    html += '<span class="hk-status ' + statusCls + '">' + statusText + '</span>';
    html += '</div>';

    if (!orders.length) {
      html += '<div style="text-align:center;color:var(--muted);font-size:13px;padding:32px 0;letter-spacing:0.1em;">本月無退房訂單</div>';
    }

    // 訂單清單
    orders.forEach(function (o) {
      var cost      = o.cost;
      var hasCost   = cost && cost.amount != null;
      var settled   = isSettled;
      var dateParts = (o.checkOut || '').split('-');
      var dateLabel = dateParts.length === 3
        ? dateParts[1] + '/' + dateParts[2]
        : (o.checkOut || '—');
      var DOW = ['日','一','二','三','四','五','六'];
      var dow = o.checkOut ? DOW[new Date(o.checkOut + 'T00:00:00').getDay()] : '';

      var cardCls = 'hk-card' + (settled ? ' settled' : hasCost ? ' done' : '');
      html += '<div class="' + cardCls + '" id="hkCard_' + o.orderID + '">';
      html += '<div class="hk-card-header">';
      html += '<span class="hk-card-date">' + dateLabel + (dow ? '（' + dow + '）' : '') + '</span>';
      html += '<span class="hk-card-rooms">' + (o.rooms || '—') + ' 間</span>';
      html += '</div>';

      if (settled && hasCost) {
        // 已結清：只顯示金額
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<span class="hk-saved-amount">$' + cost.amount.toLocaleString() + '</span>';
        if (cost.note) html += '<span class="hk-saved-note">' + esc(cost.note) + '</span>';
        html += '</div>';
      } else if (hasCost) {
        // 已填，可編輯
        html += '<div id="hkView_' + o.orderID + '" style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div><span class="hk-saved-amount">$' + cost.amount.toLocaleString() + '</span>';
        if (cost.note) html += '<div class="hk-saved-note">' + esc(cost.note) + '</div>';
        html += '</div>';
        html += '<button class="hk-edit-btn" data-hk-action="edit" data-order-id="' + o.orderID + '">修改</button>';
        html += '</div>';
        // 隱藏的編輯 form
        html += '<div id="hkForm_' + o.orderID + '" style="display:none;">';
        html += hkInputRow(o.orderID, cost.amount, cost.note || '');
        html += '</div>';
      } else {
        // 未填：直接顯示輸入框
        html += hkInputRow(o.orderID, '', '');
      }

      html += '</div>';
    });

    // 其他項目
    html += '<div class="hk-section-label">其他項目</div>';
    if (!isSettled) {
      html += '<div class="hk-extra-row">';
      html += '<input class="hk-extra-desc" id="hkExtraDesc" type="text" placeholder="說明（如：備品添購）" />';
      html += '<div class="hk-amount-wrap" style="flex:0 0 96px;">';
      html += '<span class="hk-amount-prefix">$</span>';
      html += '<input class="hk-amount" id="hkExtraAmt" type="number" inputmode="numeric" placeholder="0" style="padding-left:20px;" />';
      html += '</div>';
      html += '<button class="hk-submit" data-hk-action="add-extra" title="新增">＋</button>';
      html += '</div>';
    }
    if (extras.length) {
      extras.forEach(function (e) {
        html += '<div class="hk-extra-item">';
        html += '<span style="font-size:12px;color:var(--ink);">' + esc(e.description) + '</span>';
        html += '<div style="display:flex;align-items:center;gap:10px;">';
        html += '<span style="font-family:\'Cormorant Garamond\',serif;font-size:16px;">$' + (e.amount || 0).toLocaleString() + '</span>';
        if (!isSettled && e.source === 'rtb') {
          html += '<button class="hk-extra-del" data-hk-action="del-extra" data-extra-id="' + e.id + '" title="刪除">✕</button>';
        }
        html += '</div></div>';
      });
    } else if (isSettled) {
      html += '<div style="color:var(--muted);font-size:12px;padding:8px 0;">無</div>';
    }

    // 月底合計
    html += '<div class="hk-summary">';
    html += '<div style="display:flex;justify-content:space-between;color:var(--muted);font-size:12px;">';
    html += '<span>已填 ' + filledCount + ' 筆 / 共 ' + orders.length + ' 筆</span>';
    html += '<span>其他 $' + extrasTotal.toLocaleString() + '</span>';
    html += '</div>';
    html += '<div class="hk-summary-total">';
    html += '<span style="font-size:13px;color:var(--muted);letter-spacing:0.15em;">已填合計</span>';
    html += '<span>$' + (filledTotal + extrasTotal).toLocaleString() + '</span>';
    html += '</div></div>';

    document.getElementById('hkContent').innerHTML = html;
  }

  function hkInputRow(orderId, defaultAmount, defaultNote) {
    var html = '<div class="hk-input-row">';
    html += '<div class="hk-amount-wrap">';
    html += '<span class="hk-amount-prefix">$</span>';
    html += '<input class="hk-amount" id="hkAmt_' + orderId + '" type="number" inputmode="numeric"'
         + ' placeholder="金額" value="' + (defaultAmount !== '' ? defaultAmount : '') + '" />';
    html += '</div>';
    html += '<input class="hk-note" id="hkNote_' + orderId + '" type="text"'
         + ' placeholder="備注（選填）" value="' + esc(defaultNote) + '" />';
    html += '<button class="hk-submit" data-hk-action="submit" data-order-id="' + orderId + '" title="確認">✓</button>';
    html += '</div>';
    return html;
  }

  function hkEnterEditMode(orderId) {
    var viewEl = document.getElementById('hkView_' + orderId);
    var formEl = document.getElementById('hkForm_' + orderId);
    if (viewEl) viewEl.style.display = 'none';
    if (formEl) formEl.style.display = 'block';
    var amtInput = document.getElementById('hkAmt_' + orderId);
    if (amtInput) amtInput.focus();
  }

  function hkSubmitCost(orderId, amount, note) {
    fetch('/api/restoretheblank/hk/costs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + hkToken,
      },
      body: JSON.stringify({ orderID: orderId, amount: amount, note: note }),
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          delete hkCache[hkMonthStr()];
          hkLoadAndRender();
        }
      });
  }

  function hkAddExtra(description, amount) {
    var mk = hkMonthStr();
    fetch('/api/restoretheblank/hk/extras', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + hkToken,
      },
      body: JSON.stringify({ month: mk, description: description, amount: amount }),
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          delete hkCache[mk];
          hkLoadAndRender();
        }
      });
  }

  function hkDeleteExtra(extraId) {
    fetch('/api/restoretheblank/hk/extras/' + extraId, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + hkToken },
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.success) {
          delete hkCache[hkMonthStr()];
          hkLoadAndRender();
        }
      });
  }

  function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
})();

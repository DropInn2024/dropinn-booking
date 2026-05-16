(function () {
  var MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  var agencyId = '';
  var calData = null; // { displayName, properties: [{propertyId, propertyName, blockedDates}] }
  var propStates = {}; // propertyId → { year, month }

  // --- 讀取 URL 參數 ---
  var params = new URLSearchParams(window.location.search);
  agencyId = params.get('id') || '';
  if (!agencyId) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('errorState').style.display = 'block';
    return;
  }

  // --- 工具 ---
  function today0() {
    var t = new Date(); t.setHours(0, 0, 0, 0); return t;
  }
  function dateStr(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  // --- 渲染單棟日曆 ---
  function renderPropCalendar(prop, container) {
    var state = propStates[prop.propertyId];
    var y = state.year, m = state.month;
    var blockedSet = new Set(prop.blockedDates);
    var todayObj = today0();
    var firstDay = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();

    var grid = container.querySelector('.cal-grid');
    var html = '';

    // 星期標題
    for (var h = 0; h < 7; h++) {
      var we = (h === 0 || h === 6) ? ' weekend' : '';
      html += '<div class="cal-cell header' + we + '"></div>';
    }

    // 空白格
    for (var i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

    // 日期格
    for (var d = 1; d <= daysInMonth; d++) {
      var dateObj = new Date(y, m, d);
      var ds = dateStr(y, m, d);
      var we2 = (dateObj.getDay() === 0 || dateObj.getDay() === 6) ? ' weekend' : '';
      var cls = 'cal-cell' + we2;
      if (dateObj < todayObj) {
        cls += ' past';
      } else if (blockedSet.has(ds)) {
        cls += ' blocked';
      }
      html += '<div class="' + cls + '">' + d + '</div>';
    }
    grid.innerHTML = html;

    // 更新月份顯示
    var mainEl = container.querySelector('.month-main');
    var yearEl = container.querySelector('.month-year');
    if (mainEl) mainEl.textContent = MONTHS[m];
    if (yearEl) yearEl.textContent = String(y);
  }

  // --- 建立棟別卡片 ---
  function buildPropCard(prop) {
    var now = new Date();
    propStates[prop.propertyId] = { year: now.getFullYear(), month: now.getMonth() };

    var card = document.createElement('div');
    card.className = 'prop-card';
    card.innerHTML = [
      '<div class="prop-name">' + prop.propertyName + '</div>',
      '<div class="cal-nav">',
        '<button class="cal-nav-btn" data-prop="' + prop.propertyId + '" data-dir="-1">←</button>',
        '<div class="month-label">',
          '<span class="month-main">—</span>',
          '<span class="month-year">—</span>',
        '</div>',
        '<button class="cal-nav-btn" data-prop="' + prop.propertyId + '" data-dir="1">→</button>',
      '</div>',
      '<div class="cal-grid"></div>',
      '<div class="legend">',
        '<div class="legend-item"><div class="legend-dot"></div>可提供</div>',
        '<div class="legend-item"><div class="legend-cross"></div>無法提供</div>',
      '</div>',
    ].join('');

    // 月份切換
    card.querySelectorAll('.cal-nav-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pid = btn.dataset.prop;
        var dir = parseInt(btn.dataset.dir, 10);
        var s = propStates[pid];
        s.month += dir;
        if (s.month > 11) { s.month = 0; s.year++; }
        if (s.month < 0)  { s.month = 11; s.year--; }
        var p = calData.properties.find(function (x) { return x.propertyId === pid; });
        if (p) renderPropCalendar(p, card);
      });
    });

    renderPropCalendar(prop, card);
    return card;
  }

  // --- 初始渲染 ---
  function render() {
    var wrap = document.getElementById('calendarWrap');
    wrap.innerHTML = '';
    calData.properties.forEach(function (prop) {
      wrap.appendChild(buildPropCard(prop));
    });
    wrap.style.display = 'flex';
    document.getElementById('noticeBox').style.display = 'block';
  }

  // --- 載入資料 ---
  fetch('/api/agency/public-cal?id=' + encodeURIComponent(agencyId))
    .then(function (r) { return r.json(); })
    .then(function (data) {
      document.getElementById('loadingState').style.display = 'none';
      if (!data.success) {
        document.getElementById('errorState').style.display = 'block';
        return;
      }
      calData = data;
      document.getElementById('agencyTitle').textContent = data.displayName || '—';
      document.getElementById('agencySubtitle').textContent =
        data.properties.length > 1
          ? '共 ' + data.properties.length + ' 棟，各棟獨立顯示'
          : '點擊左右箭頭切換月份';
      if (!data.properties.length) {
        document.getElementById('errorState').textContent = '尚無棟別資訊，請聯繫洽詢。';
        document.getElementById('errorState').style.display = 'block';
        return;
      }
      render();
    })
    .catch(function () {
      document.getElementById('loadingState').style.display = 'none';
      document.getElementById('errorState').style.display = 'block';
    });
})();

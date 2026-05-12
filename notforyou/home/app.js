window.FRONTEND_CONFIG =
  window.FRONTEND_CONFIG || (typeof FRONTEND_CONFIG !== 'undefined' ? FRONTEND_CONFIG : {});
// Top bar settings toggle
function toggleTopSettings() {
  var menu = document.getElementById('topSettingsMenu');
  if (menu) menu.classList.toggle('show');
}
// ── 設定區塊：scroll + 展開（取代舊的 modal）─────────────
function scrollToSection(id) {
  var menu = document.getElementById('topSettingsMenu');
  if (menu) menu.classList.remove('show');
  var sections = document.querySelectorAll('.settings-section');
  sections.forEach(function (s) {
    s.classList.toggle('open', s.dataset.section === id);
  });
  var el = document.querySelector('.settings-section[data-section="' + id + '"]');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // 對應的 lazy-load
  if (id === 'recommend') loadRecommendationRecords();
  if (id === 'agencyReview') {
    loadAgencyPendingList();
    loadAgencyApprovedList();
    loadAgencyGroups();
  }
  if (id === 'coupon') loadCouponList();
}
// 點 header 自行展開/收合（不影響其他區塊）
function toggleSection(id) {
  var el = document.querySelector('.settings-section[data-section="' + id + '"]');
  if (!el) return;
  var willOpen = !el.classList.contains('open');
  el.classList.toggle('open', willOpen);
  if (willOpen) {
    if (id === 'recommend') loadRecommendationRecords();
    if (id === 'agencyReview') {
      loadAgencyPendingList();
      loadAgencyApprovedList();
      loadAgencyGroups();
    }
    if (id === 'coupon') loadCouponList();
  }
}
// 向後相容：舊 onclick 仍可呼叫
function jumpToPanel(id) { scrollToSection(id); }
// ── 手機捲動鎖定（用於其他 modal）─────────────
var _scrollLockY = 0;
function _lockScroll() {
  _scrollLockY = window.scrollY || window.pageYOffset || 0;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = '-' + _scrollLockY + 'px';
  document.body.style.width = '100%';
}
function _unlockScroll() {
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  window.scrollTo(0, _scrollLockY);
}

function _copyLineAgreementMsg(orderID, name, checkIn, checkOut) {
  var msg = '✅ 您的訂房已確認！\n\n' +
    '訂單編號：' + orderID + '\n' +
    '旅客姓名：' + name + '\n' +
    '入住日期：' + checkIn + '\n' +
    '退房日期：' + checkOut + '\n\n' +
    '完整住宿規約（請務必閱讀）：\nhttps://dropinn.tw/ourpinkypromise\n\n' +
    '匯款訂金即代表您已閱讀並同意雫旅全部住宿規範。\n如有疑問請隨時告知，期待與您相遇 🌊';
  navigator.clipboard.writeText(msg).then(function() {
    alert('✅ LINE 確認訊息已複製，請貼到 LINE 傳給客人');
  }).catch(function() {
    prompt('請手動複製以下訊息：', msg);
  });
}

document.addEventListener('click', function (e) {
  var wrap = document.getElementById('topSettingsWrap');
  if (wrap && !wrap.contains(e.target)) {
    var menu = document.getElementById('topSettingsMenu');
    if (menu) menu.classList.remove('show');
  }
});

// ── Tab 切換 ──────────────────────────────────────────
var _currentTab = 'overview';
function switchTab(id) {
  _currentTab = id;
  document.querySelectorAll('.admin-tab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.tab === id);
  });
  document.querySelectorAll('[data-tabgroup]').forEach(function (p) {
    p.classList.toggle('tab-visible', p.dataset.tabgroup === id);
  });
  // 切換到財務 tab 時自動載入
  if (id === 'finance') {
    if (typeof loadFinanceStats === 'function') loadFinanceStats();
  }
  // 切換到同業 tab 時補載資料
  if (id === 'agency') {
    if (typeof loadAllAgencyData === 'function') loadAllAgencyData();
  }
  // 切換到房務 tab 時初始化
  if (id === 'housekeeping') {
    hkInit();
  }
  // 切換到工具 tab 時載入折扣碼 & 推薦記錄
  if (id === 'tools') {
    if (typeof loadCouponList === 'function') loadCouponList();
    if (typeof loadRecommendationRecords === 'function') loadRecommendationRecords();
    if (typeof loadAgencyPendingList === 'function') {
      loadAgencyPendingList();
      loadAgencyApprovedList();
      loadAgencyGroups();
    }
  }
}

/* ══════════════════════════════════════════════════════════════
   房務日曆（Admin 版）
   使用 owner token（已登入）→ 直接讀 /api/orders
══════════════════════════════════════════════════════════════ */
var hkYear  = new Date().getFullYear();
var hkMonth = new Date().getMonth();
var hkCache = {};
var _hkInited = false;
var MONTHS_HK = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];

function hkMonthStr() {
  return hkYear + '-' + String(hkMonth + 1).padStart(2, '0');
}

function hkInit() {
  if (!_hkInited) {
    _hkInited = true;
    // 建日曆表頭
    var h = document.getElementById('hkCalHeader');
    if (h) {
      h.innerHTML = ['日','一','二','三','四','五','六'].map(function(d) {
        return '<div style="text-align:center;font-size:10px;letter-spacing:0.1em;color:#8a7a6a;padding:4px 0;">' + d + '</div>';
      }).join('');
    }
  }
  document.getElementById('hkMonthMain').textContent = MONTHS_HK[hkMonth];
  document.getElementById('hkMonthYear').textContent = String(hkYear);
  hkLoadAndRender();
}

function hkPrevMonth() {
  hkMonth--;
  if (hkMonth < 0) { hkMonth = 11; hkYear--; }
  document.getElementById('hkMonthMain').textContent = MONTHS_HK[hkMonth];
  document.getElementById('hkMonthYear').textContent = String(hkYear);
  hkLoadAndRender();
}

function hkNextMonth() {
  hkMonth++;
  if (hkMonth > 11) { hkMonth = 0; hkYear++; }
  document.getElementById('hkMonthMain').textContent = MONTHS_HK[hkMonth];
  document.getElementById('hkMonthYear').textContent = String(hkYear);
  hkLoadAndRender();
}

function hkLoadAndRender() {
  var mk = hkMonthStr();
  var grid = document.getElementById('hkCalGrid');
  if (!grid) return;
  if (hkCache[mk]) { hkRenderCal(hkCache[mk]); return; }
  grid.innerHTML = '<div style="grid-column:span 7;text-align:center;padding:32px;color:#8a7a6a;font-size:12px;letter-spacing:0.15em;">載入中…</div>';
  _nfyFetch('GET', '/api/orders?month=' + mk + '&status=')
    .then(function(data) {
      var orders = (data.orders || []).filter(function(o) { return o.status !== '取消'; });
      hkCache[mk] = orders;
      hkRenderCal(orders);
      // 今日摘要只在當月更新
      var now = new Date();
      if (hkYear === now.getFullYear() && hkMonth === now.getMonth()) {
        hkRenderToday(orders);
      }
    })
    .catch(function() {
      grid.innerHTML = '<div style="grid-column:span 7;text-align:center;padding:32px;color:#b8795a;font-size:12px;">載入失敗</div>';
    });
}

function hkRenderToday(orders) {
  var td = new Date().toISOString().slice(0, 10);
  var titleEl = document.getElementById('hkTodayTitle');
  var contentEl = document.getElementById('hkTodayContent');
  if (!titleEl || !contentEl) return;
  titleEl.textContent = '今日 ' + td;
  var relevant = orders.filter(function(o) { return o.checkOut === td || o.checkIn === td; });
  if (!relevant.length) {
    contentEl.innerHTML = '<span style="color:#8a7a6a;">今日無入退房</span>';
    return;
  }
  var html = '';
  relevant.forEach(function(o) {
    html += '<div style="margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(181,171,160,0.2);">';
    html += '<span style="font-weight:500;color:#1a1210;">' + (o.name || '—') + '</span>';
    if (o.checkOut === td) html += ' <span style="font-size:10px;padding:1px 7px;border-radius:99px;background:rgba(184,121,90,0.15);color:#b8795a;">退房</span>';
    if (o.checkIn  === td) html += ' <span style="font-size:10px;padding:1px 7px;border-radius:99px;background:rgba(90,150,184,0.12);color:#3a7a9a;">入住</span>';
    if (o.status === '洽談中') html += ' <span style="font-size:10px;padding:1px 7px;border-radius:99px;background:rgba(181,171,160,0.15);color:#8a7a6a;">洽談中</span>';
    html += '<div style="font-size:12px;color:#8a7a6a;margin-top:3px;">';
    html += '入住 ' + o.checkIn + '　退房 ' + o.checkOut;
    if (o.phone) html += '　' + o.phone;
    if (o.housekeepingNote) html += '<br><span style="color:#5b5247;">📝 ' + o.housekeepingNote + '</span>';
    html += '</div></div>';
  });
  contentEl.innerHTML = html;
}

function hkRenderCal(orders) {
  var y = hkYear, m = hkMonth;
  var firstDay = new Date(y, m, 1).getDay();
  var daysInMonth = new Date(y, m + 1, 0).getDate();
  var todayD = new Date().toISOString().slice(0, 10);
  var mk = hkMonthStr();

  // day → { checkouts, checkins, pendings, notes }
  var dayMap = {};
  function ensure(ds) {
    if (!dayMap[ds]) dayMap[ds] = { checkouts:[], checkins:[], pendings:[], notes:[] };
    return dayMap[ds];
  }
  orders.forEach(function(o) {
    var name = o.name || '—';
    var note = o.housekeepingNote || '';
    var isPend = o.status === '洽談中';
    if (o.checkOut && o.checkOut.startsWith(mk)) {
      var d = ensure(o.checkOut);
      if (isPend) d.pendings.push(name + '（退・洽談中）');
      else d.checkouts.push(name);
      if (note) d.notes.push(note);
    }
    if (o.checkIn && o.checkIn.startsWith(mk)) {
      var d2 = ensure(o.checkIn);
      if (isPend) d2.pendings.push(name + '（入・洽談中）');
      else d2.checkins.push(name);
    }
  });

  var html = '';
  for (var i = 0; i < firstDay; i++) html += '<div style="border-radius:4px;"></div>';
  for (var d = 1; d <= daysInMonth; d++) {
    var ds = y + '-' + String(m+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var dow = new Date(y, m, d).getDay();
    var isWe = dow === 0 || dow === 6;
    var isPast = ds < todayD;
    var dayData = dayMap[ds];
    var hasOut = dayData && dayData.checkouts.length > 0;
    var hasIn  = dayData && dayData.checkins.length > 0;
    var hasPend = dayData && dayData.pendings.length > 0;

    var bg = 'rgba(255,255,255,0.4)';
    var border = 'transparent';
    if (hasOut && hasIn) { bg = 'rgba(145,100,60,0.18)'; border = 'rgba(145,100,60,0.35)'; }
    else if (hasOut)     { bg = 'rgba(184,121,90,0.15)'; border = 'rgba(184,121,90,0.3)'; }
    else if (hasIn)      { bg = 'rgba(90,150,184,0.1)';  border = 'rgba(90,150,184,0.25)'; }

    var borderLeft = hasPend ? '3px solid rgba(181,171,160,0.6)' : '1px solid ' + border;
    var opacity = isPast ? '0.45' : '1';
    var dayColor = isWe ? '#b8795a' : '#1a1210';

    html += '<div style="border-radius:5px;padding:6px 5px;min-height:56px;background:' + bg + ';border:1px solid ' + border + ';border-left:' + borderLeft + ';opacity:' + opacity + ';position:relative;">';
    html += '<span style="font-family:\'Cormorant Garamond\',serif;font-size:16px;font-weight:300;color:' + dayColor + ';display:block;margin-bottom:3px;">' + d + '</span>';
    if (dayData) {
      dayData.checkouts.forEach(function(n) {
        html += '<div style="font-size:9px;color:#b8795a;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">↑ ' + n + '</div>';
      });
      dayData.checkins.forEach(function(n) {
        html += '<div style="font-size:9px;color:#3a7a9a;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">↓ ' + n + '</div>';
      });
      dayData.pendings.forEach(function(n) {
        html += '<div style="font-size:9px;color:#8a7a6a;line-height:1.5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + n + '</div>';
      });
      if (dayData.notes.length) {
        html += '<div style="font-size:8px;color:#8a7a6a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">📝 ' + dayData.notes.join(' / ') + '</div>';
      }
    }
    html += '</div>';
  }
  var grid = document.getElementById('hkCalGrid');
  if (grid) grid.innerHTML = html;
}

// ── 總覽 Dashboard ────────────────────────────────────
function renderOverviewDashboard() {
  var todayStr = new Date().toISOString().split('T')[0];
  var plusStr = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  var now = new Date();
  var monthStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  // 更新日期標籤
  var dateLabel = document.getElementById('overviewDateLabel');
  if (dateLabel) {
    var days = ['日','一','二','三','四','五','六'];
    dateLabel.textContent = now.getFullYear() + ' / ' +
      String(now.getMonth() + 1).padStart(2, '0') + ' / ' +
      String(now.getDate()).padStart(2, '0') + '  星期' + days[now.getDay()];
  }

  var active = allOrders.filter(function (o) { return o.status !== '取消'; });

  // 本月訂單
  var monthOrders = active.filter(function (o) { return (o.checkIn || '').startsWith(monthStr); });
  var el = document.getElementById('ovMonthOrders');
  if (el) el.textContent = monthOrders.length + ' 組';

  // 7 天內入住
  var upcoming7 = active.filter(function (o) {
    return (o.checkIn || '') >= todayStr && (o.checkIn || '') <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  });
  el = document.getElementById('ovUpcomingCount');
  if (el) el.textContent = upcoming7.length + ' 組';

  // 待收尾款
  var pendingBal = active.reduce(function (sum, o) {
    return sum + (parseInt(o.remainingBalance) || 0);
  }, 0);
  el = document.getElementById('ovPendingBalance');
  if (el) el.textContent = 'NT$ ' + pendingBal.toLocaleString();

  // 洽談中
  var negotiating = active.filter(function (o) { return o.status === '洽談中'; });
  el = document.getElementById('ovNegotiating');
  if (el) el.textContent = negotiating.length + ' 組';

  // 即將入住 14 天
  var upcomingList = active.filter(function (o) {
    return (o.checkIn || '') >= todayStr && (o.checkIn || '') <= plusStr;
  }).sort(function (a, b) { return (a.checkIn || '') < (b.checkIn || '') ? -1 : 1; });

  var wrap = document.getElementById('overviewUpcoming');
  if (!wrap) return;
  if (!upcomingList.length) {
    wrap.innerHTML = '<p class="text-sm text-stone-400 py-4">未來 14 天尚無訂單。</p>';
    return;
  }
  var statusColor = { '洽談中': 'dot-pending', '已付訂': 'dot-confirmed', '完成': 'dot-done', '取消': 'dot-cancel' };
  wrap.innerHTML = upcomingList.map(function (o) {
    var ci = o.checkIn || '';
    var d = ci.slice(8, 10);
    var m = ci.slice(5, 7);
    var dot = statusColor[o.status] || 'dot-pending';
    var rooms = o.rooms ? o.rooms + '間' : '';
    var balance = parseInt(o.remainingBalance) || 0;
    var balText = balance > 0 ? '尾款 NT$ ' + balance.toLocaleString() : '已結清';
    return '<div class="overview-upcoming-item" onclick="viewOrder(\'' + (o.orderID || '') + '\')">' +
      '<div><div class="overview-upcoming-date">' + d + '</div><div class="overview-upcoming-date-sub">' + m + ' 月</div></div>' +
      '<div class="overview-status-dot ' + dot + '"></div>' +
      '<div class="overview-upcoming-name">' + (o.name || '—') +
        '<div class="overview-upcoming-detail">' + ci + ' → ' + (o.checkOut || '') + (rooms ? '  ' + rooms : '') + '</div>' +
      '</div>' +
      '<div class="overview-upcoming-detail" style="text-align:right">' + (o.status || '') + '<br>' + balText + '</div>' +
    '</div>';
  }).join('');
}

// ── 資料工具：匯出 CSV ────────────────────────────────
function exportOrdersCsv() {
  if (!allOrders.length) { alert('請先載入訂單再匯出'); return; }
  var fields = ['orderID','name','phone','email','checkIn','checkOut','rooms','extraBeds',
                'originalTotal','totalPrice','paidDeposit','remainingBalance','discountCode',
                'discountAmount','addonAmount','hasCarRental','status','sourceType','agencyName',
                'notes','internalNotes','housekeepingNote','timestamp'];
  var header = fields.join(',');
  var rows = allOrders.map(function (o) {
    return fields.map(function (f) {
      var v = o[f] == null ? '' : String(o[f]);
      return '"' + v.replace(/"/g, '""') + '"';
    }).join(',');
  });
  var csv = '﻿' + header + '\n' + rows.join('\n'); // BOM for Excel
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'dropinn-orders-' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 資料工具：手動標記完成 ────────────────────────────
function manualMarkCompleted() {
  var resultEl = document.getElementById('toolsResult');
  if (resultEl) { resultEl.classList.remove('hidden'); resultEl.textContent = '處理中…'; }
  _nfyFetch('POST', '/api/admin/orders/mark-completed')
    .then(function (res) {
      var msg = (res && res.success)
        ? '✅ 已標記 ' + (res.updated || 0) + ' 筆訂單為「完成」'
        : '❌ 標記失敗：' + ((res && res.error) || '未知錯誤');
      if (resultEl) resultEl.textContent = msg;
      if (res && res.success && (res.updated || 0) > 0) loadOrders(null);
    })
    .catch(function (e) {
      if (resultEl) resultEl.textContent = '連線失敗：' + ((e && e.message) || '');
    });
}

// stub 保留（保證舊呼叫不會 crash）
function loadSettings() {
  var p = document.getElementById('settingsPlaceholder');
  if (p) p.textContent = '系統環境變數請至 Cloudflare Dashboard 管理。';
}
function saveSettings() {}
function runSetupSystem() {}
function runInitializeYearSheet() {}

// ── 折扣碼管理 ──────────────────────────────────────
function loadCouponList() {
  var wrap = document.getElementById('couponListWrap');
  if (wrap) wrap.innerHTML = '<p class="text-sm text-stone-400">載入中…</p>';
  _nfyFetch('GET', '/api/admin/coupons')
    .then(function (res) {
      if (!res || !res.success) {
        if (wrap) wrap.innerHTML = '<p class="text-sm text-red-500">載入失敗</p>';
        return;
      }
      var list = res.coupons || [];
      if (!list.length) {
        if (wrap) wrap.innerHTML = '<p class="text-sm text-stone-400">尚無折扣碼。</p>';
        return;
      }
      var today = new Date().toISOString().split('T')[0];
      var html = '<div class="space-y-2">';
      list.forEach(function (c) {
        if (!c.code || String(c.code).startsWith('code：')) return; // 略過說明列
        var expired = c.validTo && String(c.validTo) < today;
        var pctVal = Number(c.value || 0);
        var typeLabel = c.type === 'percent'
          ? '折抵 ' + pctVal + '%（打 ' + (10 - pctVal / 10).toFixed(1).replace(/\.0$/, '') + ' 折）'
          : 'NT$ ' + Number(c.value || 0).toLocaleString() + ' 折抵';
        var limitLabel = Number(c.useLimit) === 0 ? '不限次數' : '上限 ' + c.useLimit + ' 次（已用 ' + (c.usedCount || 0) + '）';
        var dateLabel = '';
        if (c.validFrom || c.validTo) dateLabel = (c.validFrom || '—') + ' ～ ' + (c.validTo || '—');
        html += '<div class="bg-stone-50 rounded-xl p-3 flex items-start justify-between gap-3' + (expired ? ' opacity-50' : '') + '">' +
          '<div style="min-width:0">' +
          '<div class="flex items-center gap-2 mb-1">' +
          '<span class="font-mono text-sm font-medium text-stone-700">' + escapeHtml(String(c.code)) + '</span>' +
          (expired ? '<span class="text-[10px] text-red-400 tracking-wider">已過期</span>' : '') +
          '</div>' +
          '<div class="text-xs text-stone-500">' + typeLabel + '　' + limitLabel + '</div>' +
          (dateLabel ? '<div class="text-[10px] text-stone-400 mt-0.5">' + escapeHtml(dateLabel) + '</div>' : '') +
          (c.description ? '<div class="text-[10px] text-stone-400 mt-0.5">' + escapeHtml(String(c.description)) + '</div>' : '') +
          '</div>' +
          '<button onclick="editCoupon(' + JSON.stringify(c).replace(/</g, '\\u003c').replace(/"/g, '&quot;') + ')" class="btn-outline !py-1 !px-2.5 !text-xs flex-shrink-0">編輯</button>' +
          '</div>';
      });
      html += '</div>';
      if (wrap) wrap.innerHTML = html;
    })
    .catch(function () {
      if (wrap) wrap.innerHTML = '<p class="text-sm text-red-500">連線失敗</p>';
    });
}

function editCoupon(c) {
  document.getElementById('couponCode').value = c.code || '';
  document.getElementById('couponType').value = c.type || 'fixed';
  document.getElementById('couponValue').value = c.value != null ? c.value : '';
  document.getElementById('couponUseLimit').value = c.useLimit != null ? c.useLimit : 0;
  document.getElementById('couponValidFrom').value = c.validFrom || '';
  document.getElementById('couponValidTo').value = c.validTo || '';
  document.getElementById('couponDescription').value = c.description || '';
  updateCouponValueHint();
  document.getElementById('couponCode').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function updateCouponValueHint() {
  var type = document.getElementById('couponType').value;
  var label = document.getElementById('couponValueLabel');
  var input = document.getElementById('couponValue');
  if (type === 'percent') {
    label.textContent = '折扣百分比（填折扣數，10 = 打9折，20 = 打8折）';
    input.placeholder = '例：10（代表折抵10%，客人付90%）';
    input.max = '100';
  } else {
    label.textContent = '折抵金額（元）';
    input.placeholder = '例：500';
    input.removeAttribute('max');
  }
}

function clearCouponForm() {
  ['couponCode','couponValue','couponValidFrom','couponValidTo','couponDescription'].forEach(function(id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('couponType').value = 'fixed';
  document.getElementById('couponUseLimit').value = '0';
  updateCouponValueHint();
}

function saveCoupon() {
  var code = (document.getElementById('couponCode').value || '').trim().toUpperCase();
  var value = parseFloat(document.getElementById('couponValue').value);
  if (!code) { alert('請輸入折扣碼代碼'); return; }
  if (isNaN(value) || value <= 0) { alert('請輸入有效的折抵金額或百分比'); return; }
  var coupon = {
    code: code,
    type: document.getElementById('couponType').value,
    value: value,
    description: document.getElementById('couponDescription').value.trim(),
    useLimit: parseInt(document.getElementById('couponUseLimit').value, 10) || 0,
    validFrom: document.getElementById('couponValidFrom').value || '',
    validTo: document.getElementById('couponValidTo').value || '',
  };
  _nfyFetch('POST', '/api/admin/coupons', coupon)
    .then(function (res) {
      if (res && res.success) {
        clearCouponForm();
        loadCouponList();
      } else {
        alert('儲存失敗：' + ((res && res.error) || '未知錯誤'));
      }
    })
    .catch(function (e) {
      alert('連線失敗：' + ((e && e.message) || ''));
    });
}
// ────────────────────────────────────────────────────

function _setAgencyBadge(id, count) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = count > 0 ? count : '';
}

function loadAgencyPendingList() {
  var wrap = document.getElementById('agencyPendingListWrap');
  if (wrap) wrap.innerHTML = '<p class="text-sm text-stone-400 px-1 py-2">載入中…</p>';
  _nfyFetch('GET', '/api/admin/agency/pending')
    .then(function (data) {
      if (!data || !data.success) {
        if (wrap) wrap.innerHTML = '<p class="text-sm text-red-500 px-1 py-2">' + (data && data.message ? data.message : '載入失敗') + '</p>';
        _setAgencyBadge('agencyPendingBadge', 0);
        return;
      }
      var list = data.pending || [];
      _setAgencyBadge('agencyPendingBadge', list.length);
      if (!list.length) {
        if (wrap) wrap.innerHTML = '<p class="text-sm text-stone-400 px-1 py-2">目前沒有待審申請。</p>';
        return;
      }
      if (wrap)
        wrap.innerHTML = list
          .map(function (row) {
            var lid = row.loginId != null ? String(row.loginId) : '';
            var eid = 'agency-row-' + lid.replace(/[^a-z0-9]/gi, '_');
            return (
              '<div id="' + eid + '" class="ars-item">' +
              '<div style="min-width:0">' +
              '<span class="ars-item-name">' + escapeHtml(row.displayName || '') + '</span>' +
              '<span class="ars-item-id">' + escapeHtml(lid) + '</span>' +
              (row.createdAt ? '<div class="ars-item-time">' + escapeHtml(String(row.createdAt)) + '</div>' : '') +
              '</div>' +
              '<div class="flex gap-2 flex-shrink-0">' +
              '<button type="button" onclick=\'agencyApproveOne(' +
              JSON.stringify(lid) +
              ',' +
              JSON.stringify(eid) +
              ')\' class="btn-primary !py-1.5 !px-3 !text-sm">核准</button>' +
              '<button type="button" onclick=\'agencyRejectOne(' +
              JSON.stringify(lid) +
              ',' +
              JSON.stringify(eid) +
              ')\' class="btn-outline !py-1.5 !px-3 !text-sm" style="border-color:rgba(184,64,64,0.35);color:#b84040">拒絕</button>' +
              '<button type="button" onclick=\'agencyDeleteOne(' +
              JSON.stringify(lid) +
              ',' +
              JSON.stringify(eid) +
              ')\' class="btn-outline !py-1.5 !px-2.5 !text-sm" style="border-color:rgba(140,32,32,0.2);color:#9c6060;" title="刪除申請">✕</button>' +
              '</div></div>'
            );
          })
          .join('');
    })
    .catch(function () {
      if (wrap) wrap.innerHTML = '<p class="text-sm text-red-500 px-1 py-2">連線失敗</p>';
    });
}

function _agencyRowFeedback(eid, msg, isOk) {
  var row = document.getElementById(eid);
  if (!row) return;
  row.innerHTML =
    '<div style="font-size:12px;padding:8px 0;color:' +
    (isOk ? '#1a5c34' : '#b84040') + ';letter-spacing:0.05em;">' +
    escapeHtml(msg) +
    '</div>';
}

function _removeAgencyRowEl(eid) {
  var row = eid && document.getElementById(eid);
  if (row && row.parentNode) row.parentNode.removeChild(row);
}

// 全域快取：已核准的同業清單（含 visiblePartners 資料）
var _approvedAgencyList = [];

function loadAgencyApprovedList() {
  var wrap = document.getElementById('agencyApprovedListWrap');
  if (!wrap) return;
  wrap.innerHTML = '<p class="text-sm text-stone-400 px-1 py-2">載入中…</p>';
  _nfyFetch('GET', '/api/admin/agency/all')
    .then(function (data) {
      if (!data || !data.success) {
        wrap.innerHTML = '<p class="text-sm text-red-500 px-1 py-2">' + ((data && data.message) || '載入失敗') + '</p>';
        _setAgencyBadge('agencyApprovedBadge', 0);
        return;
      }
      // all 回傳 all agencies；過濾出已核准的
      _approvedAgencyList = (data.agencies || []).filter(function (a) {
        return a && a.approvalStatus === 'approved' && String(a.agencyId || '') !== 'AGY_DROPINN';
      });
      _setAgencyBadge('agencyApprovedBadge', _approvedAgencyList.length);
      if (!_approvedAgencyList.length) {
        wrap.innerHTML = '<p class="text-sm text-stone-400 px-1 py-2">尚無已開通同業帳號。</p>';
        return;
      }
      wrap.innerHTML = _approvedAgencyList
        .map(function (row) {
          var lid = row.loginId != null ? String(row.loginId) : '';
          var eid = 'agency-approved-' + lid.replace(/[^a-z0-9]/gi, '_');
          var vpCount = 0;
          try { vpCount = JSON.parse(row.visiblePartners || '[]').length; } catch {}
          return (
            '<div id="' + eid + '" class="ars-item">' +
            '<div style="min-width:0"><span class="ars-item-name">' +
            escapeHtml(row.displayName || '') +
            '</span><span class="ars-item-id">' +
            escapeHtml(lid) +
            '</span><span style="font-size:10px;color:#8a7a6a;margin-left:8px;">可見夥伴 ' + vpCount + '</span></div>' +
            '<div style="display:flex;gap:6px;flex-shrink:0;">' +
            '<button type="button" onclick=\'openVpModal(' + JSON.stringify(lid) + ')\' class="btn-outline !py-1.5 !px-3 !text-xs" style="font-size:10px;">可見夥伴</button>' +
            '<button type="button" onclick=\'agencyDeleteApprovedRow(' +
            JSON.stringify(lid) + ',' + JSON.stringify(eid) +
            ')\' class="btn-outline !py-1.5 !px-3 !text-sm flex-shrink-0" style="border-color:rgba(140,32,32,0.22);color:#9c6060;">刪除</button>' +
            '</div></div>'
          );
        })
        .join('');
    })
    .catch(function () {
      wrap.innerHTML = '<p class="text-sm text-red-500 px-1 py-2">連線失敗</p>';
    });
}

/* ── 可見夥伴 Modal ──────────────────────────────────────── */
var _vpTargetLoginId = '';

function openVpModal(loginId) {
  _vpTargetLoginId = loginId;
  var target = _approvedAgencyList.find(function(a) { return a.loginId === loginId; });
  if (!target) return;
  var currentVp = [];
  try { currentVp = JSON.parse(target.visiblePartners || '[]'); } catch {}

  // 其他同業（排除自己）
  var others = _approvedAgencyList.filter(function(a) { return a.loginId !== loginId; });

  var checkboxHtml = others.length
    ? others.map(function(a) {
        var checked = currentVp.indexOf(a.agencyId) !== -1 ? ' checked' : '';
        return '<label style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid rgba(181,171,160,0.15);cursor:pointer;">' +
          '<input type="checkbox" data-agency-id="' + escapeHtml(a.agencyId) + '" data-login-id="' + escapeHtml(a.loginId) + '"' + checked + ' style="width:14px;height:14px;">' +
          '<span style="font-size:13px;color:#1a1210;">' + escapeHtml(a.displayName) + '</span>' +
          '<span style="font-size:11px;color:#8a7a6a;margin-left:4px;">(' + escapeHtml(a.loginId) + ')</span>' +
          '</label>';
      }).join('')
    : '<p style="font-size:13px;color:#8a7a6a;padding:8px 0;">無其他已核准同業</p>';

  var modal = document.getElementById('vpModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'vpModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(249,248,246,0.95);backdrop-filter:blur(5px);z-index:2000;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(modal);
  }
  modal.innerHTML = '<div style="background:#f8f5ef;border:1px solid rgba(181,171,160,0.3);border-radius:16px;padding:32px 28px;width:90%;max-width:420px;max-height:80vh;display:flex;flex-direction:column;">' +
    '<div style="font-family:\'Cormorant Garamond\',serif;font-size:18px;font-weight:300;letter-spacing:0.15em;color:#1a1210;margin-bottom:6px;">設定可見夥伴</div>' +
    '<div style="font-size:12px;color:#8a7a6a;letter-spacing:0.05em;margin-bottom:20px;">' + escapeHtml(target.displayName) + '（' + escapeHtml(loginId) + '）可在 & tab 看到哪些同業的日曆</div>' +
    '<div id="vpCheckboxWrap" style="flex:1;overflow-y:auto;margin-bottom:20px;">' + checkboxHtml + '</div>' +
    '<div style="display:flex;gap:10px;justify-content:flex-end;">' +
    '<button onclick="closeVpModal()" style="all:unset;box-sizing:border-box;padding:10px 20px;border:1px solid rgba(181,171,160,0.4);border-radius:10px;font-family:inherit;font-size:12px;letter-spacing:0.15em;color:#8a7a6a;cursor:pointer;">取消</button>' +
    '<button onclick="saveVpModal()" style="all:unset;box-sizing:border-box;padding:10px 24px;background:#1a1210;border-radius:10px;font-family:inherit;font-size:12px;letter-spacing:0.15em;color:#f8f5ef;cursor:pointer;" id="vpSaveBtn">儲存</button>' +
    '</div></div>';
  modal.style.display = 'flex';
}

function closeVpModal() {
  var modal = document.getElementById('vpModal');
  if (modal) modal.style.display = 'none';
}

function saveVpModal() {
  var modal = document.getElementById('vpModal');
  var saveBtn = document.getElementById('vpSaveBtn');
  if (!modal || !_vpTargetLoginId) return;
  var checkboxes = modal.querySelectorAll('input[type=checkbox]:checked');
  var selected = [];
  checkboxes.forEach(function(cb) { selected.push(cb.dataset.agencyId); });
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '儲存中…'; }
  _nfyFetch('PATCH', '/api/admin/agency/' + encodeURIComponent(_vpTargetLoginId) + '/visible-partners', { visiblePartners: selected })
    .then(function(data) {
      if (data && data.success) {
        // 更新本地快取
        var target = _approvedAgencyList.find(function(a) { return a.loginId === _vpTargetLoginId; });
        if (target) target.visiblePartners = JSON.stringify(selected);
        closeVpModal();
        loadAgencyApprovedList(); // 重新渲染
      } else {
        alert('儲存失敗');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '儲存'; }
      }
    })
    .catch(function() {
      alert('連線失敗');
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '儲存'; }
    });
}

function agencyDeleteApprovedRow(loginId, eid) {
  agencyDeleteOne(loginId, eid, true);
}

function _agencyRowSetBusy(row, busy) {
  if (!row) return;
  var btns = row.querySelectorAll('button');
  btns.forEach(function (b) {
    b.disabled = busy;
    b.style.opacity = busy ? '0.4' : '1';
  });
}

function agencyApproveOne(loginId, eid) {
  loginId = String(loginId || '').trim();
  if (!loginId || !confirm('確定核准「' + loginId + '」？')) return;
  var row = eid && document.getElementById(eid);
  _agencyRowSetBusy(row, true);
  _nfyFetch('PATCH', '/api/admin/agency/' + encodeURIComponent(loginId) + '/approve')
    .then(function (data) {
      if (data && data.success) {
        _removeAgencyRowEl(eid);
        loadAgencyPendingList();
        loadAgencyApprovedList();
        _allAgencyData = null;
      } else {
        _agencyRowSetBusy(row, false);
        alert('核准失敗：' + ((data && data.error) || '未知錯誤'));
      }
    })
    .catch(function (e) {
      _agencyRowSetBusy(row, false);
      alert('連線失敗：' + ((e && e.message) || ''));
    });
}

function agencyRejectOne(loginId, eid) {
  loginId = String(loginId || '').trim();
  if (!loginId || !confirm('確定拒絕「' + loginId + '」？拒絕後對方無法登入。')) return;
  var row = eid && document.getElementById(eid);
  _agencyRowSetBusy(row, true);
  _nfyFetch('PATCH', '/api/admin/agency/' + encodeURIComponent(loginId) + '/reject')
    .then(function (data) {
      if (data && data.success) {
        _removeAgencyRowEl(eid);
        loadAgencyPendingList();
      } else {
        _agencyRowSetBusy(row, false);
        alert('拒絕失敗：' + ((data && data.error) || '未知錯誤'));
      }
    })
    .catch(function (e) {
      _agencyRowSetBusy(row, false);
      alert('連線失敗：' + ((e && e.message) || ''));
    });
}

function agencyDeleteOne(loginId, eid, fromApprovedList) {
  loginId = String(loginId || '').trim();
  if (!loginId || !confirm('確定永久刪除帳號「' + loginId + '」？此操作無法復原。')) return;
  var row = eid && document.getElementById(eid);
  _agencyRowSetBusy(row, true);
  _nfyFetch('DELETE', '/api/admin/agency/' + encodeURIComponent(loginId))
    .then(function (data) {
      if (data && data.success) {
        _removeAgencyRowEl(eid);
        loadAgencyPendingList();
        loadAgencyApprovedList();
        _allAgencyData = null;
      } else {
        _agencyRowSetBusy(row, false);
        alert('刪除失敗：' + ((data && data.error) || '未知錯誤'));
      }
    })
    .catch(function (e) {
      _agencyRowSetBusy(row, false);
      alert('連線失敗：' + ((e && e.message) || ''));
    });
}

// ── 合作群組 ──────────────────────────────────────────
var _agencyGroupData = null;

function loadAgencyGroups() {
  var wrap = document.getElementById('agencyGroupListWrap');
  if (wrap) wrap.innerHTML = '<p class="text-sm text-stone-400">載入中…</p>';
  _nfyFetch('GET', '/api/admin/agency/groups')
    .then(function (data) {
      _agencyGroupData = data;
      if (!data || !data.success) {
        if (wrap) wrap.innerHTML = '<p class="text-sm text-red-500">載入失敗</p>';
        return;
      }
      renderAgencyGroups(data);
    })
    .catch(function () {
      if (wrap) wrap.innerHTML = '<p class="text-sm text-red-500">連線失敗</p>';
    });
}

function renderAgencyGroups(data) {
  var wrap = document.getElementById('agencyGroupListWrap');
  if (!wrap) return;
  var groups = data.groups || [];
  var allAgencies = data.approvedAgencies || [];

  if (!groups.length) {
    wrap.innerHTML = '<p class="text-sm text-stone-400 py-3">尚無群組，請先建立。</p>';
    return;
  }

  wrap.innerHTML = groups
    .map(function (g) {
      var memberNames = (g.memberNames || [])
        .map(function (m) {
          return (
            '<span class="inline-block bg-stone-100 text-stone-600 text-sm px-2.5 py-1 rounded-full mr-1 mb-1">' +
            escapeHtml(m.displayName) +
            ' <button onclick="removeGroupMember(\'' +
            g.groupId +
            "','" +
            m.agencyId +
            '\')" class="text-stone-400 hover:text-red-500 ml-1">×</button>' +
            '</span>'
          );
        })
        .join('');

      // 未在此群組的業者
      var inGroup = g.members || [];
      var notInGroup = allAgencies.filter(function (a) {
        return inGroup.indexOf(a.agencyId) === -1;
      });
      var addOptions = notInGroup
        .map(function (a) {
          return (
            '<option value="' + a.agencyId + '">' + escapeHtml(a.displayName) + '</option>'
          );
        })
        .join('');

      return (
        '<div class="border border-stone-100 rounded-xl p-4 mb-3">' +
        '<div class="flex justify-between items-center mb-3">' +
        '<span class="text-base font-medium text-stone-800">' +
        escapeHtml(g.groupName) +
        '</span>' +
        '<span class="text-sm text-stone-500">' +
        (g.members || []).length +
        ' 位成員</span>' +
        '</div>' +
        '<div class="mb-3 flex flex-wrap">' +
        (memberNames || '<span class="text-sm text-stone-400">尚無成員</span>') +
        '</div>' +
        (addOptions
          ? '<div class="flex gap-2">' +
            '<select id="addMember_' +
            g.groupId +
            '" class="!border !rounded-lg !px-3 !py-2.5 !bg-white text-base flex-1">' +
            '<option value="">— 選擇要加入的業者 —</option>' +
            addOptions +
            '</select>' +
            '<button onclick="addGroupMember(\'' +
            g.groupId +
            '\')" class="btn-outline !py-2 !px-3 !text-sm">加入</button>' +
            '</div>'
          : '') +
        '</div>'
      );
    })
    .join('');
}

function createAgencyGroup() {
  var name = document.getElementById('newGroupName').value.trim();
  if (!name) {
    alert('請輸入群組名稱');
    return;
  }
  _nfyFetch('POST', '/api/admin/agency/groups', { groupName: name })
    .then(function (data) {
      if (data && data.success) {
        document.getElementById('newGroupName').value = '';
        loadAgencyGroups();
      } else alert((data && data.error) || '建立失敗');
    })
    .catch(function () { alert('連線失敗'); });
}

function addGroupMember(groupId) {
  var sel = document.getElementById('addMember_' + groupId);
  if (!sel || !sel.value) {
    alert('請選擇業者');
    return;
  }
  _nfyFetch('PATCH', '/api/admin/agency/groups/' + encodeURIComponent(groupId), { agencyId: sel.value })
    .then(function (data) {
      if (data && data.success) loadAgencyGroups();
      else alert((data && data.error) || '加入失敗');
    })
    .catch(function () { alert('連線失敗'); });
}

function removeGroupMember(groupId, agencyId) {
  if (!confirm('確定要移除這位成員？')) return;
  _nfyFetch('DELETE', '/api/admin/agency/groups/' + encodeURIComponent(groupId) + '/members/' + encodeURIComponent(agencyId))
    .then(function (data) {
      if (data && data.success) loadAgencyGroups();
      else alert((data && data.error) || '移除失敗');
    })
    .catch(function () { alert('連線失敗'); });
}

var _allAgencyData = null,
  _agencyCalYear = new Date().getFullYear(),
  _agencyCalMonth = new Date().getMonth();
function loadAllAgencyData() {
  var wrap = document.getElementById('agencyCalendarWrap');
  if (wrap) wrap.innerHTML = '<p class="text-xs text-stone-400">載入中…</p>';
  _nfyFetch('GET', '/api/admin/agency/all')
    .then(function (data) {
      if (!data || !data.success) {
        if (wrap) wrap.innerHTML = '<p class="text-xs text-red-500">載入失敗</p>';
        return;
      }
      _allAgencyData = data;
      var qSel = document.getElementById('agencyQueryAgency');
      if (qSel) {
        qSel.innerHTML = '<option value="">全部夥伴</option>';
        (data.agencies || []).forEach(function (a) {
          var o = document.createElement('option');
          o.value = a.agencyId;
          o.textContent = a.displayName;
          qSel.appendChild(o);
        });
      }
      renderAgencyCalendar();
    })
    .catch(function () {
      if (wrap) wrap.innerHTML = '<p class="text-xs text-red-500">連線失敗</p>';
    });
}
function renderAgencyCalendar() {
  if (!_allAgencyData) {
    loadAllAgencyData();
    return;
  }
  var wrap = document.getElementById('agencyCalendarWrap');
  var selectedAgencyId = document.getElementById('agencyQueryAgency')
    ? document.getElementById('agencyQueryAgency').value
    : '';
  var propList = [];
  var agencies = _allAgencyData.agencies || [];
  agencies.forEach(function (a) {
    if (selectedAgencyId && String(a.agencyId) !== String(selectedAgencyId)) return;
    ((a.properties || []) || []).forEach(function (p) {
      propList.push({
        agencyName: a.displayName,
        loginId: a.loginId,
        propertyId: p.propertyId,
        propertyName: p.propertyName,
      });
    });
  });
  var y = _agencyCalYear,
    m = _agencyCalMonth,
    dim = new Date(y, m + 1, 0).getDate(),
    fd = new Date(y, m, 1).getDay();
  var ml = y + ' 年 ' + (m + 1) + ' 月';
  var html = '<div class="agency-cal-nav">';
  html += '<div class="agency-nav-empty"></div>';
  html +=
    '<button type="button" onclick="_agencyCalMonth--;if(_agencyCalMonth<0){_agencyCalMonth=11;_agencyCalYear--;}renderAgencyCalendar();" class="agency-nav-btn" aria-label="上個月">←</button>';
  html += '<span class="agency-cal-title">' + ml + '</span>';
  html +=
    '<button type="button" onclick="_agencyCalMonth++;if(_agencyCalMonth>11){_agencyCalMonth=0;_agencyCalYear++;}renderAgencyCalendar();" class="agency-nav-btn" aria-label="下個月">→</button>';
  html += '<div class="agency-nav-empty"></div></div>';
  html += '<div class="agency-cal-grid">';
  ['日', '一', '二', '三', '四', '五', '六'].forEach(function (d) {
    html += '<div class="agency-weekday">' + d + '</div>';
  });
  for (var i = 0; i < fd; i++) html += '<div></div>';
  for (var d = 1; d <= dim; d++) {
    var ds = y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var available = [],
      blocked = [];
    propList.forEach(function (p) {
      var arr = _allAgencyData.blocksByProperty[p.propertyId] || [];
      if (arr.indexOf(ds) !== -1) blocked.push(p.agencyName + '·' + p.propertyName);
      else available.push(p.agencyName + '·' + p.propertyName);
    });
    var totalCount = propList.length;
    var availableCount = available.length;
    var dayClass = 'agency-day agency-day-open';
    if (totalCount > 0 && availableCount === 0) dayClass = 'agency-day agency-day-closed';
    else if (totalCount > 0 && availableCount < totalCount)
      dayClass = 'agency-day agency-day-partial';
    var title = available.length ? '可聯絡：' + available.join('、') : '全部關閉';
    html +=
      '<div class="' +
      dayClass +
      '" title="' +
      title.replace(/"/g, '&quot;') +
      '" onclick="showAgencyDayDetail(\'' +
      ds +
      '\')">' +
      d +
      '</div>';
  }
  html += '</div>';
  if (!propList.length)
    html += '<p class="text-xs text-stone-400 agency-empty-note">尚無同業資料。</p>';
  html += '<div class="agency-legend">' +
    '<div style="display:flex;align-items:center;gap:6px;"><span class="agency-legend-dot" style="background:transparent;"></span><span>空房</span></div>' +
    '<div style="display:flex;align-items:center;gap:6px;"><span class="agency-legend-dot" style="background:var(--pending);"></span><span>部分可訂</span></div>' +
    '<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:12px;height:12px;position:relative;flex-shrink:0;"><span style="position:absolute;left:50%;top:50%;width:9px;height:1.5px;background:var(--cross);transform:translate(-50%,-50%) rotate(45deg);"></span><span style="position:absolute;left:50%;top:50%;width:9px;height:1.5px;background:var(--cross);transform:translate(-50%,-50%) rotate(-45deg);"></span></span><span>全滿</span></div>' +
    '</div>';
  if (wrap) wrap.innerHTML = html;
}

function queryAgencyByDate() {
  if (!_allAgencyData) {
    loadAllAgencyData();
    return;
  }
  var ds = document.getElementById('agencyQueryDate').value;
  if (!ds) return;
  var selectedAgencyId = document.getElementById('agencyQueryAgency')
    ? document.getElementById('agencyQueryAgency').value
    : '';
  var resultDiv = document.getElementById('agencyQueryResult');
  var titleDiv = document.getElementById('agencyQueryTitle');
  var listDiv = document.getElementById('agencyQueryList');
  if (!resultDiv || !titleDiv || !listDiv) return;

  var available = [],
    blocked = [];
  (_allAgencyData.agencies || []).forEach(function (a) {
    if (selectedAgencyId && String(a.agencyId) !== String(selectedAgencyId)) return;
    ((a.properties || []) || []).forEach(function (p) {
      var arr = _allAgencyData.blocksByProperty[p.propertyId] || [];
      var info = { agency: a.displayName, loginId: a.loginId, property: p.propertyName };
      if (arr.indexOf(ds) !== -1) blocked.push(info);
      else available.push(info);
    });
  });

  titleDiv.textContent = '';
  var html = '';
  html += '<div class="agency-query-result-card">';
  html += '<div class="agency-query-date">' + ds + '</div>';
  if (available.length) {
    html +=
      '<div class="agency-query-section-title">可提供（' +
      available.length +
      ' 棟）</div>';
    available.forEach(function (i) {
      html +=
        '<div class="agency-query-item"><span>' +
        i.property +
        '</span></div>';
    });
  }
  if (blocked.length) {
    html +=
      '<div class="agency-query-section-title">已關閉（' +
      blocked.length +
      ' 棟）</div>';
    blocked.forEach(function (i) {
      html +=
        '<div class="agency-query-item" style="color:var(--muted);">' +
        i.property +
        '</div>';
    });
  }
  if (!available.length && !blocked.length)
    html += '<p class="text-base text-stone-400">尚無同業資料</p>';
  html += '</div>';
  listDiv.innerHTML = html;
  resultDiv.classList.remove('hidden');
}

function clearAgencyQuery() {
  var d = document.getElementById('agencyQueryDate');
  var r = document.getElementById('agencyQueryResult');
  if (d) d.value = '';
  if (r) r.classList.add('hidden');
}

function onAgencyFilterChange() {
  renderAgencyCalendar();
  var d = document.getElementById('agencyQueryDate');
  if (d && d.value) queryAgencyByDate();
}

function showAgencyDayDetail(ds) {
  if (!_allAgencyData) return;
  var selectedAgencyId = document.getElementById('agencyQueryAgency')
    ? document.getElementById('agencyQueryAgency').value
    : '';
  var propList = [];
  var agencies = _allAgencyData.agencies || [];
  agencies.forEach(function (a) {
    if (selectedAgencyId && String(a.agencyId) !== String(selectedAgencyId)) return;
    ((a.properties || []) || []).forEach(function (p) {
      propList.push({
        agencyName: a.displayName,
        loginId: a.loginId,
        propertyId: p.propertyId,
        propertyName: p.propertyName,
      });
    });
  });
  var available = [], blocked = [];
  propList.forEach(function (p) {
    var arr = _allAgencyData.blocksByProperty[p.propertyId] || [];
    if (arr.indexOf(ds) !== -1) blocked.push({ name: p.agencyName, prop: p.propertyName });
    else available.push({ name: p.agencyName, prop: p.propertyName, id: p.loginId });
  });

  // Show white popup
  var pop = document.getElementById('agencyDayPopover');
  var parts = ds.split('-');
  var dateLabel = parts[1] + ' / ' + parts[2];
  document.getElementById('agencyDayPopoverTitle').textContent = dateLabel + '　同業狀況';
  var listEl = document.getElementById('agencyDayPopoverList');
  var html = '';
  if (!propList.length) {
    html = '<div style="font-size:12px;color:var(--muted);padding:6px 0;">尚無同業資料</div>';
  } else {
    if (available.length) {
      html += '<div style="font-size:10px;letter-spacing:0.15em;color:var(--muted);text-transform:uppercase;margin-bottom:6px;">可聯絡</div>';
      html += available.map(function(p) {
        return '<div style="font-size:12px;color:var(--ink);padding:4px 0;border-bottom:1px solid rgba(181,171,160,0.1);">' +
          escapeHtml(p.name) + '　<span style="color:var(--muted);font-size:11px;">' + escapeHtml(p.prop) + '</span></div>';
      }).join('');
    }
    if (blocked.length) {
      html += '<div style="font-size:10px;letter-spacing:0.15em;color:var(--muted);text-transform:uppercase;margin:' + (available.length ? '12px' : '0') + ' 0 6px;">已關閉</div>';
      html += blocked.map(function(p) {
        return '<div style="font-size:12px;color:var(--muted);padding:4px 0;border-bottom:1px solid rgba(181,171,160,0.1);">' +
          escapeHtml(p.name) + '　<span style="color:var(--muted);font-size:11px;">' + escapeHtml(p.prop) + '</span></div>';
      }).join('');
    }
  }
  listEl.innerHTML = html;
  pop.classList.add('show');
}

function closeAgencyDayPopover() {
  var pop = document.getElementById('agencyDayPopover');
  if (pop) pop.classList.remove('show');
}
// ==========================================
// 全域變數與核心邏輯
// ==========================================
let allOrders = [];
let currentOrder = null;
let _filteredOrders = [];
let _currentPage = 1;
const PAGE_SIZE = 10;
let _loadOrdersAttempts = 0;
let ADMIN_API_KEY = sessionStorage.getItem('admin_key');

async function _nfyFetch(method, path, body) {
  const token = ADMIN_API_KEY || sessionStorage.getItem('admin_key');
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token,
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res  = await fetch(path, opts);
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error('非 JSON 回應：' + text.slice(0, 80)); }
}

let bookingCalCurrentMonth = (function () {
  var d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
})();

function goAdminLogin_() {
  sessionStorage.removeItem('admin_key');
  window.location.replace('/notforyou');
}

function adminLogout() {
  if (confirm('確定要登出後台嗎？')) {
    goAdminLogin_();
  }
}

function bootstrapAdminHome_() {
  if (window.__adminHomeBootstrapped) return;
  window.__adminHomeBootstrapped = true;
  document.title = '雫旅｜notforyou';
  var adminToken = sessionStorage.getItem('admin_key');
  if (!adminToken) {
    goAdminLogin_();
    return;
  }
  ADMIN_API_KEY = adminToken;

  fetchBookingCalendarAndRender();

  // 同業日曆延後載入，不阻塞主流程
  setTimeout(function () {
    try {
      loadAllAgencyData();
    } catch (e) {
      console.error(e);
    }
  }, 2000);

  var loadingTimeout = setTimeout(function () {
    var loading = document.getElementById('loading');
    var content = document.getElementById('content');
    if (loading && loading.style.display !== 'none') {
      loading.style.display = 'none';
      if (content) content.style.display = 'block';
      renderBookingCalendar();
    }
  }, 30000);

  // 直接呼叫，不延遲
  loadOrders(loadingTimeout);
}

// 正常情況：等 load 後啟動
window.addEventListener('load', bootstrapAdminHome_);
// 保險：若正式站 load 時機異常，也在 DOM ready 後嘗試啟動一次
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  setTimeout(bootstrapAdminHome_, 0);
} else {
  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(bootstrapAdminHome_, 0);
  });
}

function loadOrders(timeoutId) {
  _loadOrdersAttempts += 1;
  document.getElementById('loading').style.display = 'flex';
  document.getElementById('content').style.display = 'none';
  _nfyFetch('GET', '/api/orders')
    .then(function (data) {
      if (timeoutId) clearTimeout(timeoutId);
      var list = Array.isArray(data) ? data : (data && data.orders ? data.orders : []);
      function fmt(d) {
        if (!d) return '';
        if (typeof d === 'string') return d.slice(0, 10);
        if (d instanceof Date && !isNaN(d.getTime())) {
          var y = d.getFullYear();
          var m = String(d.getMonth() + 1).padStart(2, '0');
          var dd = String(d.getDate()).padStart(2, '0');
          return y + '-' + m + '-' + dd;
        }
        return String(d).slice(0, 10);
      }
      allOrders = list.map(function (o) {
        if (!o) return o;
        o.checkIn  = fmt(o.checkIn);
        o.checkOut = fmt(o.checkOut);
        return o;
      });
      window.__adminOrdersLoadedOnce = true;
      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';
      filterOrders();
      renderBookingCalendar();
      loadFinanceStats();
      loadRecommendationRecords();
      renderOverviewDashboard();
      _nfyFetch('POST', '/api/admin/orders/mark-completed').catch(function () {});
    })
    .catch(function () {
      if (timeoutId) clearTimeout(timeoutId);
      document.getElementById('loading').style.display = 'none';
      document.getElementById('content').style.display = 'block';
      renderBookingCalendar();
      if (_loadOrdersAttempts < 3) {
        setTimeout(function () { loadOrders(null); }, 1200);
      }
    });
}

// 最後保險：若初始化競態導致沒載到資料，5 秒後自動補跑一次
setTimeout(function () {
  if (!window.__adminOrdersLoadedOnce && typeof loadOrders === 'function') {
    loadOrders(null);
  }
}, 5000);

// 再保險：正式站若首輪初始化被中斷，20 秒內每 3 秒自動補跑一次
(function watchAdminOrdersBootstrap_() {
  var maxTicks = 7; // 約 21 秒
  var tick = 0;
  var timer = setInterval(function () {
    tick += 1;
    if (window.__adminOrdersLoadedOnce) {
      clearInterval(timer);
      return;
    }
    var token = sessionStorage.getItem('admin_key');
    if (!token) return;
    try {
      ADMIN_API_KEY = token;
      loadOrders(null);
    } catch (e) {
      console.error(e);
    }
    if (tick >= maxTicks) clearInterval(timer);
  }, 3000);
})();

function loadRecommendationRecords() {
  var tbody = document.getElementById('recommendationRecordsList');
  var emptyEl = document.getElementById('recommendationRecordsEmpty');
  var wrap = document.getElementById('recommendationRecordsWrap');
  if (!tbody) return;
  _nfyFetch('GET', '/api/admin/referrals')
    .then(function (res) {
      var list = res && res.success && Array.isArray(res.records) ? res.records : [];
      if (!list.length) {
        tbody.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (wrap) wrap.classList.add('hidden');
        return;
      }
      if (emptyEl) emptyEl.classList.add('hidden');
      if (wrap) wrap.classList.remove('hidden');
      tbody.innerHTML = list
        .map(function (r) {
          var rebate =
            r.rebateAmount != null && r.rebateAmount !== ''
              ? Number(r.rebateAmount).toLocaleString()
              : '—';
          return (
            '<tr class="border-b border-stone-100"><td class="p-3 font-mono text-xs text-stone-400">' +
            (r.recordID || '') +
            '</td><td class="p-3 text-sm">' +
            (r.date || '') +
            '</td><td class="p-3 text-sm">' +
            (r.agencyName || '') +
            '</td><td class="p-3 text-right text-sm">' +
            rebate +
            '</td><td class="p-3 text-sm text-stone-400">' +
            (r.notes || '') +
            '</td></tr>'
          );
        })
        .join('');
    })
    .catch(function () {
      if (emptyEl) emptyEl.classList.remove('hidden');
      if (wrap) wrap.classList.add('hidden');
    });
}
function submitRecommendationRecord() {
  var agencyName = document.getElementById('recAgencyName').value.trim();
  if (!agencyName) {
    alert('請填寫被推薦同業名稱');
    return;
  }
  var record = {
    date: document.getElementById('recDate').value,
    agencyName,
    rebateAmount: document.getElementById('recRebateAmount').value,
    notes: document.getElementById('recNotes').value.trim(),
  };
  _nfyFetch('POST', '/api/admin/referrals', record)
    .then(function (res) {
      if (res && res.success) {
        alert('已新增推薦記錄');
        ['recDate', 'recAgencyName', 'recRebateAmount', 'recNotes'].forEach(function (id) {
          document.getElementById(id).value = '';
        });
        loadRecommendationRecords();
      } else alert(res && res.error ? res.error : '新增失敗');
    })
    .catch(function () { alert('新增失敗'); });
}

function loadSettings() {
  var placeholder = document.getElementById('settingsPlaceholder');
  var wrap = document.getElementById('settingsTableWrap');
  var saveBtn = document.getElementById('saveSettingsBtn');
  if (wrap) wrap.classList.add('hidden');
  if (saveBtn) saveBtn.classList.add('hidden');
  if (placeholder) placeholder.textContent = '系統設定已移至 Cloudflare Workers 環境變數，請至 Cloudflare Dashboard 管理。';
}
function saveSettings() {
  alert('系統設定請至 Cloudflare Dashboard 的 Workers & Pages 管理環境變數。');
}
function runSetupSystem() {
  var el = document.getElementById('systemCheckResult');
  var content = document.getElementById('systemCheckContent');
  if (el) el.classList.remove('hidden');
  if (content) content.innerHTML = '<span class="text-stone-500">此功能已移至 Cloudflare Workers，請至 Dashboard 確認 Worker 部署狀態。</span>';
}
function runInitializeYearSheet() {
  var el = document.getElementById('systemCheckResult');
  var content = document.getElementById('systemCheckContent');
  if (el) el.classList.remove('hidden');
  if (content) content.innerHTML = '<span class="text-stone-500">Google Sheets 功能已停用。</span>';
}
function loadQuickCheck() {
  var el = document.getElementById('systemCheckResult');
  var content = document.getElementById('systemCheckContent');
  if (el) el.classList.remove('hidden');
  if (content) content.innerHTML = '<span class="text-stone-400">檢查中…</span>';
  _nfyFetch('GET', '/api/admin/health')
    .then(function (result) {
      if (!content) return;
      content.innerHTML = result && result.status === 'ok'
        ? '<span class="text-green-700">✅ Worker 正常｜訂單數：' + (result.orderCount || 0) + '｜' + (result.ts || '') + '</span>'
        : '<span class="text-red-600">異常：' + ((result && result.error) || '未知') + '</span>';
    })
    .catch(function (err) {
      if (content)
        content.innerHTML = '<span class="text-red-600">' + ((err && err.message) || '連線失敗') + '</span>';
    });
}

function loadFinanceStats() {
  const yearEl = document.getElementById('financeYear');
  if (yearEl && !yearEl.options.length) {
    const y = new Date().getFullYear();
    for (let i = y - 2; i <= y + 1; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i + '年';
      if (i === y) opt.selected = true;
      yearEl.appendChild(opt);
    }
  }
  const year = yearEl ? parseInt(yearEl.value, 10) : new Date().getFullYear();
  const monthEl = document.getElementById('financeMonth');
  const month = monthEl ? parseInt(monthEl.value, 10) : 0;
  _nfyFetch('GET', '/api/admin/finance?year=' + year + '&month=' + month)
    .then(function (result) {
      if (!result || !result.success) {
        document.getElementById('statRevenue').textContent = '—';
        return;
      }
      document.getElementById('statRevenue').textContent =
        'NT$ ' + (result.revenue || 0).toLocaleString();
      document.getElementById('statAddon').textContent =
        'NT$ ' + (result.addonTotal || 0).toLocaleString();
      if (result.addonTotal || result.addonCostTotal) {
        document.getElementById('statAddonCommissionNote').classList.remove('hidden');
        document.getElementById('statAddonCommission').textContent =
          'NT$ ' + (result.addonCommission != null ? result.addonCommission : result.addonTotal || 0).toLocaleString();
      } else {
        document.getElementById('statAddonCommissionNote').classList.add('hidden');
      }
      document.getElementById('statCost').textContent =
        'NT$ ' +
        (result.costTotal != null
          ? result.costTotal
          : (result.rebateTotal || 0) +
            (result.complimentaryTotal || 0) +
            (result.otherCostTotal || 0)
        ).toLocaleString();
      document.getElementById('statMonthlyExpense').textContent =
        'NT$ ' + (result.monthlyExpenseTotal || 0).toLocaleString();
      document.getElementById('statExtraIncome').textContent =
        'NT$ ' + (result.extraIncomeTotal || 0).toLocaleString();
      if (document.getElementById('statCarRentalRebate'))
        document.getElementById('statCarRentalRebate').textContent =
          'NT$ ' + (result.carRentalRebateTotal || 0).toLocaleString();
      document.getElementById('statNetIncome').textContent =
        'NT$ ' + (result.netIncome != null ? result.netIncome : 0).toLocaleString();
      document.getElementById('statOrders').textContent = (result.orderCount || 0) + ' 組';
      if (document.getElementById('statDeposit'))
        document.getElementById('statDeposit').textContent =
          'NT$ ' + (result.totalDeposit || 0).toLocaleString();
      if (document.getElementById('statBalance'))
        document.getElementById('statBalance').textContent =
          'NT$ ' + (result.totalBalance || 0).toLocaleString();
    })
    .catch(function () {
      document.getElementById('statRevenue').textContent = '載入失敗';
    });
}

function filterOrders() {
  const statusFilter = document.getElementById('filterStatus').value;
  const searchText = document.getElementById('searchInput').value.trim().toLowerCase();
  let filtered = allOrders;
  if (statusFilter) filtered = filtered.filter((o) => o.status === statusFilter);
  if (searchText)
    filtered = filtered.filter(
      (o) =>
        (o.orderID || '').toLowerCase().includes(searchText) ||
        (o.name || '').toLowerCase().includes(searchText) ||
        (o.phone || '').includes(searchText)
    );
  // 預設排序：即將入住優先（未來升序），過去日期降序排後面
  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = filtered
    .filter((o) => (o.checkIn || '') >= todayStr)
    .sort((a, b) => new Date(a.checkIn || 0) - new Date(b.checkIn || 0));
  const past = filtered
    .filter((o) => (o.checkIn || '') < todayStr)
    .sort((a, b) => new Date(b.checkIn || 0) - new Date(a.checkIn || 0));
  _filteredOrders = [...upcoming, ...past];
  _currentPage = 1; // 篩選條件變動時回到第 1 頁
  document.getElementById('totalCount').textContent = String(_filteredOrders.length);
  var hintEl = document.getElementById('orderRainExtraHint');
  if (hintEl) hintEl.textContent = '';
  _renderCurrentPage();
}

function _renderCurrentPage() {
  const total = _filteredOrders.length;
  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
  if (_currentPage > totalPages) _currentPage = totalPages;
  const start = (_currentPage - 1) * PAGE_SIZE;
  renderOrderTable(_filteredOrders.slice(start, start + PAGE_SIZE));
  // 分頁列
  const pEl = document.getElementById('orderPagination');
  if (!pEl) return;
  if (total <= PAGE_SIZE) { pEl.innerHTML = ''; return; }
  pEl.innerHTML = `
    <div class="flex items-center justify-between mt-5 pt-4 border-t border-stone-100 text-sm text-stone-400">
      <button onclick="_changePage(${_currentPage - 1})"
        ${_currentPage <= 1 ? 'disabled' : ''}
        class="px-4 py-1.5 rounded-lg border border-stone-200 disabled:opacity-30 hover:text-stone-700 transition text-xs tracking-wider">
        ← 上一頁
      </button>
      <span class="text-xs tracking-widest">${_currentPage} / ${totalPages} 頁&ensp;·&ensp;共 ${total} 組</span>
      <button onclick="_changePage(${_currentPage + 1})"
        ${_currentPage >= totalPages ? 'disabled' : ''}
        class="px-4 py-1.5 rounded-lg border border-stone-200 disabled:opacity-30 hover:text-stone-700 transition text-xs tracking-wider">
        下一頁 →
      </button>
    </div>`;
}

function _changePage(page) {
  const totalPages = Math.ceil(_filteredOrders.length / PAGE_SIZE) || 1;
  if (page < 1 || page > totalPages) return;
  _currentPage = page;
  _renderCurrentPage();
  // 捲回訂單表頂端
  var tableEl = document.getElementById('orderTableBody');
  if (tableEl) tableEl.closest('table').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fetchBookingCalendarAndRender() {
  try {
    if (!window._bookingCalNavBound) {
      window._bookingCalNavBound = true;
      var prevBtn = document.getElementById('bookingCalPrev');
      var nextBtn = document.getElementById('bookingCalNext');
      if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); prevBookingMonth(); });
      if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); nextBookingMonth(); });
    }
    renderBookingCalendar();
  } catch (e) {
    console.error(e);
  }
}
function getBookingCalDateStr(date) {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}
function prevBookingMonth() {
  var prev = new Date(
    bookingCalCurrentMonth.getFullYear(),
    bookingCalCurrentMonth.getMonth() - 1,
    1
  );
  var todayStart = new Date();
  todayStart.setDate(1);
  todayStart.setHours(0, 0, 0, 0);
  if (prev >= todayStart) {
    bookingCalCurrentMonth = prev;
    renderBookingCalendar();
  }
}
function nextBookingMonth() {
  var next = new Date(
    bookingCalCurrentMonth.getFullYear(),
    bookingCalCurrentMonth.getMonth() + 1,
    1
  );
  if (next.getFullYear() <= new Date().getFullYear() + 1) {
    bookingCalCurrentMonth = next;
    renderBookingCalendar();
  }
}
function renderBookingCalendar() {
  var monthMainEl = document.getElementById('bookingCalMonthMain');
  var yearEl = document.getElementById('bookingCalYear');
  var gridEl = document.getElementById('bookingCalGrid');
  if (!monthMainEl || !yearEl || !gridEl) return;
  var year = bookingCalCurrentMonth.getFullYear(),
    month = bookingCalCurrentMonth.getMonth();
  var monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  monthMainEl.textContent = monthNames[month];
  yearEl.textContent = String(year);
  var startDayOfWeek = new Date(year, month, 1).getDay(),
    daysInMonth = new Date(year, month + 1, 0).getDate();
  var totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
  var todayStr = getBookingCalDateStr(new Date()),
    todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  var validStatuses = ['洽談中', '已付訂'];
  function ordersOnDate(ds) {
    return allOrders.filter(function (o) {
      return validStatuses.includes(o.status) && ds >= o.checkIn && ds < o.checkOut;
    });
  }
  // 退房日（checkOut === ds）且狀態有效
  function checkoutOrdersOnDate(ds) {
    return allOrders.filter(function (o) {
      return validStatuses.includes(o.status) && o.checkOut === ds;
    });
  }
  var html = '';
  for (var i = 0; i < totalCells; i++) {
    var dayNumber = i - startDayOfWeek + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      html += '<div class="cal-day empty"></div>';
      continue;
    }
    var date = new Date(year, month, dayNumber),
      dateStr = getBookingCalDateStr(date);
    var past = date < todayStart,
      today = dateStr === todayStr;
    var ords = ordersOnDate(dateStr);
    var checkoutOrds = checkoutOrdersOnDate(dateStr);
    var isCheckinDay  = ords.some(function (o) { return o.checkIn === dateStr && o.status === '已付訂'; });
    var isCheckoutDay = checkoutOrds.some(function (o) { return o.status === '已付訂'; });
    var isPendingIn   = ords.some(function (o) { return o.checkIn === dateStr && o.status === '洽談中'; });
    var isPendingOut  = checkoutOrds.some(function (o) { return o.status === '洽談中'; });
    var hasAnyConfirmed = ords.some(function (o) { return o.status === '已付訂'; });
    var hasAnyPending   = ords.some(function (o) { return o.status === '洽談中'; });

    // 判斷色彩類別（退+入 > 純退 > 純入 > 住中 > 洽談中）
    var classes = 'cal-day';
    if (past) classes += ' past';
    else if (today) classes += ' today';

    if (!past) {
      if (isCheckinDay && isCheckoutDay) classes += ' both-day';
      else if (isCheckoutDay)            classes += ' checkout-day';
      else if (isCheckinDay)             classes += ' checkin-day';
      else if (hasAnyConfirmed)          classes += ' booked';
      else if (isPendingIn || isPendingOut || hasAnyPending) classes += ' pending';
      else                               classes += ' free';
    }

    // 收集退房姓名（↑）和入住姓名（↓）
    var outNames = [], inNames = [];
    checkoutOrds.forEach(function (o) {
      if (o.status === '已付訂') { var n = (o.name||'').trim(); if (n) outNames.push(n); }
    });
    ords.forEach(function (o) {
      if (o.checkIn === dateStr && o.status === '已付訂') {
        var n = (o.name||'').trim(); if (n) inNames.push(n);
      }
    });

    var eventsHtml = '';
    if (outNames.length) eventsHtml += '<div style="font-size:8px;color:#7a3a10;font-weight:500;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">↑ ' + escapeHtml(outNames[0]) + (outNames.length > 1 ? '…' : '') + '</div>';
    if (inNames.length)  eventsHtml += '<div style="font-size:8px;color:#0a4a6a;font-weight:500;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">↓ ' + escapeHtml(inNames[0]) + (inNames.length > 1 ? '…' : '') + '</div>';
    // 洽談中事件（淡色）
    if (!outNames.length && !inNames.length) {
      var pendInNames = [], pendOutNames = [];
      checkoutOrds.forEach(function(o) { if (o.status==='洽談中') { var n=(o.name||'').trim(); if(n) pendOutNames.push(n); }});
      ords.forEach(function(o) { if (o.checkIn===dateStr && o.status==='洽談中') { var n=(o.name||'').trim(); if(n) pendInNames.push(n); }});
      if (pendOutNames.length) eventsHtml += '<div style="font-size:8px;color:#8a7a6a;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">↑ ' + escapeHtml(pendOutNames[0]) + '</div>';
      if (pendInNames.length)  eventsHtml += '<div style="font-size:8px;color:#8a7a6a;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">↓ ' + escapeHtml(pendInNames[0]) + '</div>';
    }

    html +=
      '<div class="' + classes + '" data-date="' + dateStr +
      '" onclick="showBookingDayInfo(\'' + dateStr + '\')">' +
      '<span class="cal-day-num">' + dayNumber + '</span>' +
      eventsHtml +
      '</div>';
  }
  gridEl.innerHTML = html;
  renderFreeWindows();
}

// ── 計算近期可訂空檔（從今天起往後 90 天）────────────────────────
function renderFreeWindows() {
  var panel = document.getElementById('freeWindowsList');
  if (!panel) return;
  var validStatuses = ['洽談中', '已付訂'];
  var bookedIntervals = allOrders
    .filter(function (o) { return validStatuses.includes(o.status); })
    .map(function (o) { return { s: o.checkIn, e: o.checkOut }; })
    .sort(function (a, b) { return a.s < b.s ? -1 : 1; });

  var nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000);
  var todayStr = nowTW.toISOString().slice(0, 10);
  var windows = [];

  // 找出 [cursor, next_booking_start) 的空隙
  var cursor = todayStr;
  var endLimit = new Date(nowTW);
  endLimit.setDate(endLimit.getDate() + 90);
  var endLimitStr = endLimit.toISOString().slice(0, 10);

  for (var i = 0; i <= bookedIntervals.length; i++) {
    var next = bookedIntervals[i];
    var winEnd = (next && next.s < endLimitStr) ? next.s : endLimitStr;
    if (winEnd > cursor) {
      var ds = new Date(cursor + 'T00:00:00');
      var de = new Date(winEnd + 'T00:00:00');
      var nights = Math.round((de - ds) / 86400000);
      if (nights >= 2) {
        windows.push({ from: cursor, to: winEnd, nights: nights });
      }
    }
    if (!next || next.s >= endLimitStr) break;
    cursor = next.e > cursor ? next.e : cursor;
  }

  if (!windows.length) {
    panel.textContent = '未來 90 天已全數被預訂';
    return;
  }

  panel.innerHTML = windows.slice(0, 6).map(function (w) {
    var fromParts = w.from.split('-');
    var toParts = w.to.split('-');
    var fromLabel = fromParts[1] + '/' + fromParts[2];
    var toLabel = toParts[1] + '/' + toParts[2];
    var nightsText = w.nights + ' 晚';
    return '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid rgba(181,171,160,0.12);">' +
      '<span>' + fromLabel + ' — ' + toLabel + '</span>' +
      '<span style="font-size:10px;color:var(--muted);letter-spacing:0.1em;">' + nightsText + '</span>' +
      '</div>';
  }).join('');
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function showBookingDayInfo(dateStr) {
  var validStatuses = ['洽談中', '已付訂'];
  // 包含該日住宿中 OR 當天退房的訂單
  var onThatDay = allOrders.filter(function (o) {
    return validStatuses.includes(o.status) &&
      ((dateStr >= o.checkIn && dateStr < o.checkOut) || o.checkOut === dateStr);
  });
  var titleEl = document.getElementById('bookingCalDayPopoverTitle');
  var listEl = document.getElementById('bookingCalDayPopoverList');
  var popEl = document.getElementById('bookingCalDayPopover');
  if (!titleEl || !listEl || !popEl) return;

  var seen = {};
  var uniqueOrders = [];
  onThatDay.forEach(function (o) {
    var id = String(o.orderID || '').trim();
    var dedupeKey = id || [o.checkIn, o.checkOut, o.name || '', o.phone || ''].join('|');
    if (!seen[dedupeKey]) {
      seen[dedupeKey] = true;
      uniqueOrders.push(o);
    }
  });

  var parts = dateStr.split('-');
  var dateLabel = parts[1] + ' / ' + parts[2];
  var titleParts = uniqueOrders.map(function (o) {
    var tid = String(o.orderID || '').trim();
    return tid || '（無編號）';
  });
  titleEl.textContent =
    dateLabel + '　' + (uniqueOrders.length ? titleParts.join(' · ') : '無訂單');

  listEl.innerHTML = uniqueOrders.length
    ? uniqueOrders
        .map(function (o) {
          var nights = Math.ceil(
            (new Date(o.checkOut) - new Date(o.checkIn)) / 86400000
          );
          var remaining =
            o.remainingBalance != null && o.remainingBalance !== ''
              ? Number(o.remainingBalance)
              : Number(o.totalPrice || 0) - Number(o.paidDeposit || 0);
          var rooms = o.rooms || '—';
          var phone = o.phone || '—';
          var notes = String(o.notes || o.note || '').trim();
          var oid = String(o.orderID || '').trim();
          var editBtn = oid
            ? '<button onclick="closeBookingCalPopover();viewOrder(\'' +
              oid.replace(/'/g, "\\'") +
              '\')" style="margin-top:10px;width:100%;padding:6px 0;border:1px solid rgba(181,171,160,0.4);border-radius:8px;background:rgba(255,255,255,0.7);font-size:11px;letter-spacing:0.1em;color:var(--ink);cursor:pointer;">編輯訂單</button>'
            : '';
          return (
            '<div style="padding: 10px 0; border-bottom: 1px solid rgba(181,171,160,0.15);">' +
            '<div style="font-size:13px;color:var(--ink);font-weight:400;margin-bottom:6px;">' +
            escapeHtml(o.name || '—') +
            '</div>' +
            '<div style="font-size:11px;color:var(--muted);line-height:1.85;">' +
            '<div>入住 ' + escapeHtml(o.checkIn || '—') +
            ' → 退房 ' + escapeHtml(o.checkOut || '—') +
            '（' + nights + ' 晚）</div>' +
            '<div>' +
            escapeHtml(phone) +
            '　' +
            escapeHtml(String(rooms)) +
            ' 間</div>' +
            '<div>尾款 NT$ ' +
            remaining.toLocaleString() +
            '</div>' +
            '<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(181,171,160,0.12);">' +
            '<span style="font-size:10px;letter-spacing:0.12em;opacity:0.75;">備註</span>' +
            '<div style="font-size:11px;margin-top:4px;white-space:pre-wrap;word-break:break-word;">' +
            (notes ? escapeHtml(notes) : '<span style="opacity:0.55">（無）</span>') +
            '</div></div>' +
            editBtn +
            '</div></div>'
          );
        })
        .join('')
    : '<div style="font-size:12px;color:var(--muted);padding:8px 0;">當日無訂單</div>';
  popEl.classList.add('show');
}
function closeBookingCalPopover() {
  var pop = document.getElementById('bookingCalDayPopover');
  if (pop) pop.classList.remove('show');
}

function renderOrderTable(orders) {
  const tbody = document.getElementById('orderTableBody');
  const emptyState = document.getElementById('emptyState');
  if (!orders.length) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';
  tbody.innerHTML = orders
    .map((order) => {
      const nights = Math.ceil(
        (new Date(order.checkOut) - new Date(order.checkIn)) / 86400000
      );
      const remaining =
        order.remainingBalance != null && order.remainingBalance !== ''
          ? Number(order.remainingBalance)
          : Number(order.totalPrice || 0) - Number(order.paidDeposit || 0);
      return `<tr>
      <td class="px-3 py-4 garamond text-sm text-stone-400 font-light tracking-wider">${order.orderID}</td>
      <td class="px-3 py-4"><div class="text-sm text-stone-700">${order.name}</div></td>
      <td class="px-3 py-4 text-sm text-stone-500 font-light">${order.checkIn}</td>
      <td class="px-3 py-4 text-sm text-stone-500 font-light hidden sm:table-cell">${order.rooms} 間 <span class="text-stone-300 text-[11px]">(${nights} 晚)</span></td>
      <td class="px-3 py-4 text-sm text-stone-700">NT$ ${remaining.toLocaleString()}</td>
      <td class="px-3 py-4"><span class="status-badge status-${order.status ? String(order.status).replace(/\s/g, '') : 'unknown'}">${order.status || '—'}</span></td>
      <td class="px-3 py-4 text-right"><button type="button" onclick="viewOrder('${order.orderID}')" class="text-stone-400 hover:text-stone-700 transition p-2 -mr-2 rounded-lg hover:bg-stone-100" title="查看詳情" aria-label="查看訂單詳情"><i class="fas fa-ellipsis-h text-sm"></i></button></td>
    </tr>`;
    })
    .join('');
}

async function viewOrder(orderID) {
  const order = allOrders.find((o) => o.orderID === orderID);
  if (!order) {
    alert('找不到訂單');
    return;
  }
  currentOrder = order;
  const year = order.checkIn
    ? new Date(order.checkIn).getFullYear()
    : new Date().getFullYear();
  _nfyFetch('GET', '/api/admin/orders/' + encodeURIComponent(orderID) + '/costs')
    .then(function (res) {
      renderOrderDetail(order, res && res.success && res.cost ? res.cost : null);
      _lockScroll();
      document.getElementById('orderModal').classList.add('active');
    })
    .catch(function () {
      renderOrderDetail(order, null);
      _lockScroll();
      document.getElementById('orderModal').classList.add('active');
    });
}

function renderOrderDetail(order, costRow) {
  if (typeof costRow === 'undefined') costRow = null;
  const nights = Math.ceil((new Date(order.checkOut) - new Date(order.checkIn)) / 86400000);
  const content = `
  <div class="space-y-6 text-sm">
    <div class="bg-stone-50 p-5 rounded-xl">
      <h3 class="text-xs text-stone-400 tracking-[0.2em] uppercase mb-4">基本資訊</h3>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-1">訂單編號</label><p class="font-mono text-stone-600">${order.orderID}</p></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-1">建立時間</label><p class="text-stone-600">${order.timestamp || order.createdAt || '—'}</p></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-1">旅人姓名</label><p class="text-stone-700 font-medium">${order.name}</p></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-1">電話</label><p class="text-stone-600">${order.phone}</p></div>
        <div class="col-span-2"><label class="text-[10px] text-stone-400 tracking-wider block mb-1">Email</label><p class="text-stone-600">${order.email || '未提供'}</p></div>
      </div>
    </div>
    <div>
      <h3 class="text-xs text-stone-400 tracking-[0.2em] uppercase mb-4">入住資訊</h3>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">入住日期</label><input type="date" id="editCheckIn" value="${order.checkIn}" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">退房日期</label><input type="date" id="editCheckOut" value="${order.checkOut}" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">房間數</label>
          <select id="editRooms" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full">
            <option value="3" ${order.rooms === 3 ? 'selected' : ''}>3 間房</option>
            <option value="4" ${order.rooms === 4 ? 'selected' : ''}>4 間房</option>
            <option value="5" ${order.rooms === 5 ? 'selected' : ''}>5 間房</option>
          </select></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">加床</label>
          <select id="editExtraBeds" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full">
            <option value="0" ${order.extraBeds === 0 ? 'selected' : ''}>不加床</option>
            <option value="1" ${order.extraBeds === 1 ? 'selected' : ''}>+1 床</option>
            <option value="2" ${order.extraBeds === 2 ? 'selected' : ''}>+2 床</option>
          </select></div>
      </div>
    </div>
    <div class="bg-amber-50 p-5 rounded-xl">
      <h3 class="text-xs text-stone-400 tracking-[0.2em] uppercase mb-4">金額</h3>
      <div class="grid grid-cols-2 gap-4 mb-3">
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">原價（標準售價）</label><input type="number" id="editOriginalTotal" value="${(order.originalTotal != null && order.originalTotal !== '' ? Number(order.originalTotal) : order.totalPrice || 0)}" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-1">折扣碼</label><p class="text-stone-500 pt-2">${order.discountCode ? order.discountCode + ' - NT$ ' + (order.discountAmount || 0).toLocaleString() : '—'}</p></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">折後總價（實收）</label><input type="number" id="editTotalPrice" value="${order.totalPrice || 0}" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" oninput="recalcBalance()"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">已付訂金</label><input type="number" id="editPaidDeposit" value="${order.paidDeposit || 0}" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" oninput="recalcBalance()"/></div>
      </div>
      <div class="pt-3 border-t border-amber-200">
        <label class="text-[10px] text-stone-400 tracking-wider block mb-1">剩餘尾款</label>
        <p id="editRemainingDisplay" class="garamond text-3xl font-light text-stone-700">NT$ ${(order.remainingBalance != null ? order.remainingBalance : (order.totalPrice || 0) - (order.paidDeposit || 0)).toLocaleString()}</p>
      </div>
    </div>
    <div>
      <h3 class="text-xs text-stone-400 tracking-[0.2em] uppercase mb-4">備註</h3>
      <div class="space-y-3">
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">客人備註</label><textarea readonly class="!border !rounded-lg !px-3 !py-2 !bg-stone-50 w-full" rows="2">${order.notes || '無'}</textarea></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">內部備註</label><textarea id="editInternalNotes" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" rows="2" placeholder="租車、行程安排...">${order.internalNotes || ''}</textarea></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">房務備註</label><textarea id="editHousekeepingNote" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" rows="2" placeholder="僅給房務看的提醒...">${order.housekeepingNote || ''}</textarea></div>
      </div>
    </div>
    <div class="bg-stone-50 p-5 rounded-xl">
      <h3 class="text-xs text-stone-400 tracking-[0.2em] uppercase mb-4">成本與代訂</h3>
      <div class="grid grid-cols-2 gap-4">
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">來源</label><select id="editSourceType" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full"><option value="自家" ${(order.sourceType || '自家') === '自家' ? 'selected' : ''}>自家</option><option value="同業推薦" ${(order.sourceType || '') === '同業推薦' ? 'selected' : ''}>同業推薦</option></select></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">來源同業</label><input type="text" id="editAgencyName" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" placeholder="例：OO民宿" value="${(order.agencyName || '').replace(/"/g, '&quot;')}"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">退佣</label><input type="number" id="editRebateAmount" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" value="${costRow ? (costRow.rebateAmount != null ? costRow.rebateAmount : '') : ''}"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">招待費</label><input type="number" id="editComplimentaryAmount" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" value="${costRow ? (costRow.complimentaryAmount != null ? costRow.complimentaryAmount : '') : ''}"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">其他支出</label><input type="number" id="editOtherCost" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" value="${costRow ? (costRow.otherCost != null ? costRow.otherCost : '') : ''}"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">代訂代收</label><input type="number" id="editAddonAmount" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" value="${order.addonAmount != null && order.addonAmount !== '' ? order.addonAmount : ''}"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">旅行社費用</label><input type="number" id="editAddonCost" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" placeholder="月結付旅行社" value="${costRow && costRow.addonCost != null && costRow.addonCost !== '' && costRow.addonCost !== 0 ? costRow.addonCost : ''}"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">其他收入</label><input type="number" id="editExtraIncome" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" value="${order.extraIncome != null && order.extraIncome !== '' ? order.extraIncome : ''}"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">成本備註</label><input type="text" id="editCostNote" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full" placeholder="支出表備註" value="${costRow && costRow.note ? String(costRow.note).replace(/"/g, '&quot;') : ''}"/></div>
        <div class="flex items-center gap-3 col-span-2 pt-1">
          <input type="checkbox" id="editHasCarRental" class="w-4 h-4 accent-stone-600" ${order.hasCarRental ? 'checked' : ''} />
          <label for="editHasCarRental" class="text-sm text-stone-600 cursor-pointer">已安排租車（供年底核帳）</label>
        </div>
      </div>
    </div>
    <div>
      <h3 class="text-xs text-stone-400 tracking-[0.2em] uppercase mb-4">訂單狀態</h3>
      <select id="editStatus" class="!border !rounded-xl !px-4 !py-3 !bg-white w-full garamond text-lg">
        <option value="洽談中" ${order.status === '洽談中' ? 'selected' : ''}>洽談中</option>
        <option value="已付訂" ${order.status === '已付訂' ? 'selected' : ''}>已付訂</option>
        <option value="取消" ${order.status === '取消' ? 'selected' : ''}>取消</option>
        <option value="完成" ${order.status === '完成' ? 'selected' : ''}>完成</option>
      </select>
    </div>
    <div style="background:var(--card);border:1px solid rgba(181,171,160,0.25);border-radius:14px;padding:18px 20px;">
      <h3 class="text-xs text-stone-400 tracking-[0.2em] uppercase mb-4">通知旅人</h3>
      <div class="space-y-3">
        <label class="flex items-center gap-3" style="cursor:pointer;"><input type="checkbox" id="notifyEmail" ${order.email ? '' : 'disabled'}/><span class="text-sm">${order.email ? '自動發送 Email（' + order.email + '）' : '自動發送 Email（未填 Email）'}</span></label>
        <label class="flex items-center gap-3" style="cursor:pointer;"><input type="checkbox" id="notifyLine" checked/><span class="text-sm">產生 LINE 通知文字</span></label>
      </div>
      ${!order.email ? `
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(181,171,160,0.2);">
        <div class="text-xs text-stone-400 mb-2" style="letter-spacing:0.08em;">未填 Email — 請手動傳 LINE 確認訊息</div>
        <button onclick="_copyLineAgreementMsg('${order.orderID}','${(order.name||'').replace(/'/g,"\\'")}','${order.checkIn||''}','${order.checkOut||''}')" style="background:rgba(181,171,160,0.15);border:1px solid rgba(181,171,160,0.35);border-radius:8px;padding:7px 14px;font-size:12px;letter-spacing:0.06em;cursor:pointer;color:#5B5247;width:100%;">
          📋 複製 LINE 確認訊息（含條款連結）
        </button>
      </div>` : ''}
      ${order.agreementSignedName ? `<div style="margin-top:10px;font-size:11.5px;color:rgba(90,80,70,0.6);letter-spacing:0.04em;">✅ 電子簽署：${order.agreementSignedName}${order.agreementSignedAt ? '　' + new Date(order.agreementSignedAt).toLocaleString('zh-TW') : ''}</div>` : `<div style="margin-top:10px;font-size:11.5px;color:rgba(184,121,90,0.7);letter-spacing:0.04em;">⚠️ 本筆未完成電子簽署（舊單或後台建立）</div>`}
    </div>
    <div class="flex gap-3 pt-4 border-t border-stone-100">
      <button onclick="saveOrder()" class="btn-primary flex-1">儲存變更</button>
      <button onclick="closeModal()" class="btn-outline">取消</button>
    </div>
  </div>`;
  document.getElementById('modalContent').innerHTML = content;
}

function recalcBalance() {
  var total =
    parseInt(
      document.getElementById('editTotalPrice') &&
        document.getElementById('editTotalPrice').value,
      10
    ) || 0;
  var paid =
    parseInt(
      document.getElementById('editPaidDeposit') &&
        document.getElementById('editPaidDeposit').value,
      10
    ) || 0;
  var el = document.getElementById('editRemainingDisplay');
  if (el) el.textContent = 'NT$ ' + Math.max(0, total - paid).toLocaleString();
}

async function saveOrder() {
  if (!currentOrder) return;
  const editTotalEl = document.getElementById('editTotalPrice');

  // ── 讀取日曆相關欄位（入退房、房型、狀態）──
  // 只有「真正改動」才放進 updates，否則每次都會觸發 Calendar API（慢 3-6 秒）
  const newCheckIn   = document.getElementById('editCheckIn').value;
  const newCheckOut  = document.getElementById('editCheckOut').value;
  const newRooms     = parseInt(document.getElementById('editRooms').value);
  const newExtraBeds = parseInt(document.getElementById('editExtraBeds').value);
  const newStatus    = document.getElementById('editStatus').value;

  // ── 固定送出（全屬於 CALENDAR_IRRELEVANT_FIELDS，不影響同步速度）──
  const updates = {
    paidDeposit: parseInt(document.getElementById('editPaidDeposit').value) || 0,
    internalNotes: document.getElementById('editInternalNotes').value,
    housekeepingNote: document.getElementById('editHousekeepingNote')
      ? document.getElementById('editHousekeepingNote').value : '',
    sourceType: document.getElementById('editSourceType')
      ? document.getElementById('editSourceType').value : '自家',
    agencyName: document.getElementById('editAgencyName')
      ? document.getElementById('editAgencyName').value.trim() : '',
    addonAmount:
      document.getElementById('editAddonAmount') &&
      document.getElementById('editAddonAmount').value !== ''
        ? parseInt(document.getElementById('editAddonAmount').value, 10) : 0,
    addonCost:
      document.getElementById('editAddonCost') &&
      document.getElementById('editAddonCost').value !== ''
        ? parseInt(document.getElementById('editAddonCost').value, 10) : 0,
    extraIncome:
      document.getElementById('editExtraIncome') &&
      document.getElementById('editExtraIncome').value !== ''
        ? parseInt(document.getElementById('editExtraIncome').value, 10) : 0,
    rebateAmount:
      document.getElementById('editRebateAmount') &&
      document.getElementById('editRebateAmount').value !== ''
        ? parseInt(document.getElementById('editRebateAmount').value, 10) : 0,
    complimentaryAmount:
      document.getElementById('editComplimentaryAmount') &&
      document.getElementById('editComplimentaryAmount').value !== ''
        ? parseInt(document.getElementById('editComplimentaryAmount').value, 10) : 0,
    otherCost:
      document.getElementById('editOtherCost') &&
      document.getElementById('editOtherCost').value !== ''
        ? parseInt(document.getElementById('editOtherCost').value, 10) : 0,
    costNote: document.getElementById('editCostNote')
      ? document.getElementById('editCostNote').value : '',
    hasCarRental: !!(document.getElementById('editHasCarRental') &&
      document.getElementById('editHasCarRental').checked),
  };

  // ── 只有有變動才放入（避免觸發不必要的 Calendar sync）──
  if (newCheckIn  !== currentOrder.checkIn)              updates.checkIn   = newCheckIn;
  if (newCheckOut !== currentOrder.checkOut)             updates.checkOut  = newCheckOut;
  if (newRooms    !== Number(currentOrder.rooms))        updates.rooms     = newRooms;
  if (newExtraBeds !== Number(currentOrder.extraBeds))   updates.extraBeds = newExtraBeds;
  if (newStatus   !== currentOrder.status)               updates.status    = newStatus;

  // ── 價格計算（用表單上的值，不管有沒有改）──
  const nights = Math.ceil((new Date(newCheckOut) - new Date(newCheckIn)) / 86400000);
  const WHOLE_HOUSE_RATES = { 3: 10800, 4: 12800, 5: 14800 };
  const basePrice  = WHOLE_HOUSE_RATES[newRooms] || 10800;
  const extraPrice = newExtraBeds * 1000;
  if (editTotalEl) {
    updates.totalPrice = parseInt(editTotalEl.value, 10);
    updates.remainingBalance = updates.totalPrice - updates.paidDeposit;
  }
  if (updates.totalPrice == null || updates.totalPrice === undefined) {
    updates.totalPrice = (basePrice + extraPrice) * nights;
    updates.remainingBalance = updates.totalPrice - updates.paidDeposit;
  }
  // 原價（標準售價）：可手動修正；預設保留原值
  const origTotalEl = document.getElementById('editOriginalTotal');
  if (origTotalEl && origTotalEl.value !== '') {
    updates.originalTotal = parseInt(origTotalEl.value, 10);
  }
  _nfyFetch('PATCH', '/api/orders/' + encodeURIComponent(currentOrder.orderID), updates)
    .then(async function (result) {
      if (result && result.success) {
        if (document.getElementById('notifyEmail').checked && currentOrder.email)
          await sendEmailNotification(currentOrder.orderID);
        if (document.getElementById('notifyLine').checked)
          await showLineNotification(currentOrder.orderID);
        else {
          alert('✅ 訂單已更新');
          closeModal();
          loadOrders();
        }
      } else alert('更新失敗：' + ((result && result.error) || '未知錯誤'));
    })
    .catch(function (error) {
      alert('儲存失敗：' + ((error && error.message) || ''));
    });
}

async function sendEmailNotification(orderID) {
  // Email 通知暫不支援
  return Promise.resolve();
}
async function showLineNotification(orderID) {
  var order = currentOrder;
  if (order) {
    var text = '【雫旅訂單更新】\n訂單：' + (order.orderID || orderID) +
      '\n旅人：' + order.name +
      '\n入住：' + order.checkIn + ' → ' + order.checkOut +
      '\n狀態：' + order.status;
    try { await navigator.clipboard.writeText(text); } catch (e) {}
    alert('✅ 訂單已儲存\n\n訂單資訊已複製到剪貼簿');
  } else {
    alert('✅ 訂單已儲存');
  }
  closeModal();
  loadOrders();
  return Promise.resolve();
}

function computeAddOrderSuggestedTotal() {
  var prices = { 3: 10800, 4: 12800, 5: 14800 };
  var ci = document.getElementById('addCheckIn').value;
  var co = document.getElementById('addCheckOut').value;
  var rooms = parseInt(document.getElementById('addRooms').value, 10) || 3;
  var eb = parseInt(document.getElementById('addExtraBeds').value, 10) || 0;
  if (!ci || !co || co <= ci) return null;
  var nights = Math.ceil((new Date(co) - new Date(ci)) / 86400000);
  if (nights < 1) return null;
  var pkg = prices[rooms] || 10000;
  return (pkg + eb * 1000) * nights;
}
function updateAddOrderTotalHint() {
  var hintEl = document.getElementById('addTotalHint');
  if (!hintEl) return;
  var suggested = computeAddOrderSuggestedTotal();
  if (suggested == null) {
    hintEl.textContent = '參考試算：請先選擇入退房日期（須晚於入住）';
    return;
  }
  var nights = Math.ceil(
    (new Date(document.getElementById('addCheckOut').value) -
      new Date(document.getElementById('addCheckIn').value)) /
      86400000
  );
  hintEl.textContent =
    '參考試算（' +
    nights +
    ' 晚）：NT$ ' +
    suggested.toLocaleString() +
    ' — 總金額留空建立時會用此金額，亦可自填覆寫';
}
function openAddModal() {
  [
    'addName',
    'addPhone',
    'addEmail',
    'addCheckIn',
    'addCheckOut',
    'addTotalPrice',
    'addAgencyName',
    'addHousekeepingNote',
    'addInternalNotes',
  ].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('addDeposit').value = '0';
  document.getElementById('addAddonAmount').value = '0';
  document.getElementById('addComplimentaryAmount').value = '0';
  document.getElementById('addHasCarRental').checked = false;
  document.getElementById('addRooms').value = '3';
  document.getElementById('addExtraBeds').value = '0';
  document.getElementById('addStatus').value = '洽談中';
  document.getElementById('addSourceType').value = '自家';
  document.getElementById('addError').classList.add('hidden');
  updateAddOrderTotalHint();
  _lockScroll();
  document.getElementById('addModal').classList.add('active');
}
function closeAddModal() {
  document.getElementById('addModal').classList.remove('active');
  _unlockScroll();
}

// ── 月固定支出 Modal ──
function openMonthlyExpenseModal() {
  // 預設填入目前財務篩選的月份
  var monthEl = document.getElementById('financeMonth');
  var yearEl = document.getElementById('financeYear');
  var year = yearEl ? yearEl.value : new Date().getFullYear();
  var month = monthEl ? monthEl.value : (new Date().getMonth() + 1);
  if (!month || month === '0') month = new Date().getMonth() + 1;
  var ym = year + '-' + String(month).padStart(2, '0');
  document.getElementById('meYearMonth').value = ym;
  // 清空欄位
  ['meLaundry','meWater','meElectricity','meInternet','mePlatformFee','meLandTax','meInsurance','meOther','meCarRentalRebate'].forEach(function(id) {
    document.getElementById(id).value = '';
  });
  document.getElementById('meNote').value = '';
  document.getElementById('meError').classList.add('hidden');
  // 載入已有資料
  _nfyFetch('GET', '/api/admin/monthly-expense?yearMonth=' + ym)
    .then(function(res) {
      if (res && res.success && res.expense) {
        var e = res.expense;
        var map = { meLaundry:'laundry', meWater:'water', meElectricity:'electricity',
                    meInternet:'internet', mePlatformFee:'platformFee', meLandTax:'landTax',
                    meInsurance:'insurance', meOther:'other', meCarRentalRebate:'carRentalRebate' };
        Object.keys(map).forEach(function(id) {
          var v = e[map[id]];
          document.getElementById(id).value = (v && v !== 0) ? v : '';
        });
        document.getElementById('meNote').value = e.note || '';
      }
    })
    .catch(function(){});
  _lockScroll();
  document.getElementById('monthlyExpenseModal').classList.add('active');
}
function closeMonthlyExpenseModal() {
  document.getElementById('monthlyExpenseModal').classList.remove('active');
  _unlockScroll();
}
function submitMonthlyExpense() {
  var ym = document.getElementById('meYearMonth').value;
  var errEl = document.getElementById('meError');
  if (!ym) { errEl.textContent = '請選擇月份'; errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden');
  var payload = {
    yearMonth: ym,
    laundry:     Number(document.getElementById('meLaundry').value) || 0,
    water:       Number(document.getElementById('meWater').value) || 0,
    electricity: Number(document.getElementById('meElectricity').value) || 0,
    internet:    Number(document.getElementById('meInternet').value) || 0,
    platformFee: Number(document.getElementById('mePlatformFee').value) || 0,
    landTax:     Number(document.getElementById('meLandTax').value) || 0,
    insurance:   Number(document.getElementById('meInsurance').value) || 0,
    other:            Number(document.getElementById('meOther').value) || 0,
    carRentalRebate:  Number(document.getElementById('meCarRentalRebate').value) || 0,
    note:             document.getElementById('meNote').value.trim(),
  };
  _nfyFetch('PUT', '/api/admin/monthly-expense', payload)
    .then(function(res) {
      if (res && res.success) {
        closeMonthlyExpenseModal();
        loadFinanceStats();
        alert('✅ ' + ym + ' 月固定支出已儲存');
      } else {
        errEl.textContent = (res && res.error) || '儲存失敗';
        errEl.classList.remove('hidden');
      }
    })
    .catch(function(e) {
      errEl.textContent = '連線失敗：' + ((e && e.message) || '');
      errEl.classList.remove('hidden');
    });
}
async function submitAddOrder() {
  const name = document.getElementById('addName').value.trim();
  const phone = document.getElementById('addPhone').value.trim();
  const checkIn = document.getElementById('addCheckIn').value;
  const checkOut = document.getElementById('addCheckOut').value;
  const errEl = document.getElementById('addError');
  if (!name || !phone || !checkIn || !checkOut) {
    errEl.textContent = '請填寫姓名、電話、入退房日期';
    errEl.classList.remove('hidden');
    return;
  }
  if (checkOut <= checkIn) {
    errEl.textContent = '退房日期必須晚於入住日期';
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');
  const rooms = parseInt(document.getElementById('addRooms').value, 10);
  const extraBeds = parseInt(document.getElementById('addExtraBeds').value, 10);
  const paidDeposit = parseInt(document.getElementById('addDeposit').value, 10) || 0;
  const addonAmount = parseInt(document.getElementById('addAddonAmount').value, 10) || 0;
  const complimentaryAmount = parseInt(document.getElementById('addComplimentaryAmount').value, 10) || 0;
  const hasCarRental = document.getElementById('addHasCarRental').checked;
  const status = document.getElementById('addStatus').value;
  const sourceType = document.getElementById('addSourceType').value;
  const agencyName = document.getElementById('addAgencyName').value.trim();
  const housekeepingNote = document.getElementById('addHousekeepingNote').value.trim();
  const internalNotes = document.getElementById('addInternalNotes').value.trim();
  const prices = { 3: 10800, 4: 12800, 5: 14800 };
  const nights = Math.ceil((new Date(checkOut) - new Date(checkIn)) / 86400000);
  const packagePrice = prices[rooms] || 10000;
  const extraBedPrice = extraBeds * 1000;
  const suggestedTotal = (packagePrice + extraBedPrice) * nights;
  const totalRaw = document.getElementById('addTotalPrice').value.trim();
  var totalPrice =
    totalRaw !== '' ? parseInt(totalRaw, 10) : suggestedTotal;
  if (totalRaw !== '' && (isNaN(totalPrice) || totalPrice < 0)) {
    errEl.textContent = '總金額請填有效數字';
    errEl.classList.remove('hidden');
    return;
  }
  if (!totalPrice || totalPrice < 0) {
    errEl.textContent = '無法計算總金額，請選擇日期或手動填寫總金額';
    errEl.classList.remove('hidden');
    return;
  }
  if (paidDeposit > totalPrice) {
    errEl.textContent = '訂金不可超過總金額';
    errEl.classList.remove('hidden');
    return;
  }
  const remainingBalance = totalPrice - paidDeposit;
  _nfyFetch('POST', '/api/admin/orders', {
      adminManual: true,
      name,
      phone,
      email: document.getElementById('addEmail').value.trim(),
      checkIn,
      checkOut,
      rooms,
      extraBeds,
      nights,
      packagePrice,
      extraBedPrice,
      originalTotal: suggestedTotal,
      totalPrice,
      paidDeposit,
      remainingBalance,
      discountCode: '',
      discountAmount: 0,
      addonAmount,
      complimentaryAmount,
      hasCarRental,
      status,
      sourceType,
      agencyName,
      housekeepingNote,
      internalNotes,
      timestamp: new Date().toISOString(),
    })
    .then(function (result) {
      if (result && result.success) {
        closeAddModal();
        loadOrders();
        alert('✅ 訂單已建立：' + (result.orderID || ''));
      } else {
        errEl.textContent = (result && (result.error || result.message)) || '建立失敗';
        errEl.classList.remove('hidden');
      }
    })
    .catch(function (e) {
      errEl.textContent = '網路錯誤：' + ((e && e.message) || '');
      errEl.classList.remove('hidden');
    });
}

function closeModal() {
  document.getElementById('orderModal').classList.remove('active');
  currentOrder = null;
  _unlockScroll();
}

var lastDetailedReport = null;
function openDetailedReportModal() {
  var yearEl = document.getElementById('financeYear');
  var monthEl = document.getElementById('financeMonth');
  var reportYearEl = document.getElementById('reportYear');
  if (reportYearEl && (!reportYearEl.options || !reportYearEl.options.length)) {
    var y = new Date().getFullYear();
    for (var i = y - 2; i <= y + 1; i++) {
      var opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i + '年';
      if (i === (yearEl ? parseInt(yearEl.value, 10) : y)) opt.selected = true;
      reportYearEl.appendChild(opt);
    }
  }
  if (reportYearEl && yearEl) reportYearEl.value = yearEl.value;
  if (document.getElementById('reportMonth') && monthEl)
    document.getElementById('reportMonth').value = monthEl ? monthEl.value : '0';
  _lockScroll();
  document.getElementById('detailedReportModal').classList.add('active');
  queryDetailedReport();
}
function closeDetailedReportModal() {
  document.getElementById('detailedReportModal').classList.remove('active');
  _unlockScroll();
}
function queryDetailedReport() {
  var yearEl = document.getElementById('reportYear');
  var monthEl = document.getElementById('reportMonth');
  var year = yearEl ? parseInt(yearEl.value, 10) : new Date().getFullYear(),
    month = monthEl ? parseInt(monthEl.value, 10) : 0;
  document.getElementById('detailedReportContent').innerHTML =
    '<p class="text-stone-400 p-4">載入中…</p>';
  _nfyFetch('GET', '/api/admin/finance/detailed?year=' + year + '&month=' + month)
    .then(function (result) {
      lastDetailedReport = result;
      if (!result || !result.success) {
        document.getElementById('detailedReportContent').innerHTML =
          '<p class="text-red-600 p-4">無法載入報表</p>';
        return;
      }
      var s = result.summary || {};
      var periodLabel = result.year + '年' + (result.month ? result.month + '月' : '全年');
      var html = '<div class="space-y-6 p-2">';
      html +=
        '<h3 class="garamond text-xl font-light text-stone-700">' +
        periodLabel +
        ' 完整摘要</h3>';
      html += '<div class="grid grid-cols-2 md:grid-cols-4 gap-4">';
      var addonCommission = s.addonCommission != null ? s.addonCommission : (s.addonTotal || 0) - (s.addonCostTotal || 0);
      var items = [
        ['房間營收（折後）', s.revenue || 0],
        ['已收訂金', s.totalDeposit || 0],
        ['剩餘尾款', s.totalBalance || 0],
        ['折扣碼折抵', s.totalDiscount || 0],
        ['老客人訂單', s.returningCount || 0, '筆'],
        ['代訂代收', s.addonTotal || 0],
        ['旅行社費用（月結）', s.addonCostTotal || 0],
        ['行程佣金', addonCommission],
        ['退佣（給業者）', s.rebateTotal || 0],
        ['招待＋其他支出', (s.complimentaryTotal || 0) + (s.otherCostTotal || 0)],
        ['月固定支出', s.monthlyExpenseTotal || 0],
        ['其他收入', s.extraIncomeTotal || 0],
        ['車行退佣（收入）', s.carRentalRebateTotal || 0],
        ['淨利', s.netIncome != null ? s.netIncome : 0],
        ['訂單數', s.orderCount || 0, '筆'],
      ];
      items.forEach(function (item) {
        html +=
          '<div class="bg-stone-50 p-4 rounded-xl"><span class="text-[10px] text-stone-400 tracking-wider block mb-2">' +
          item[0] +
          '</span><strong class="garamond text-xl font-light text-stone-700">' +
          (item[2] || 'NT$ ') +
          (item[2] ? item[1] : item[1].toLocaleString()) +
          '</strong></div>';
      });
      html += '</div>';
      if (!result.month && (result.monthly || []).length > 0) {
        html +=
          '<h3 class="garamond text-lg font-light text-stone-700 pt-2">月度彙總</h3><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-stone-50"><th class="text-left p-3 text-[10px] text-stone-400 tracking-wider">月份</th><th class="text-right p-3 text-[10px] text-stone-400 tracking-wider">房間營收</th><th class="text-right p-3 text-[10px] text-stone-400 tracking-wider">代訂代收</th><th class="text-right p-3 text-[10px] text-stone-400 tracking-wider">旅行社費用</th><th class="text-right p-3 text-[10px] text-stone-400 tracking-wider">行程佣金</th><th class="text-right p-3 text-[10px] text-stone-400 tracking-wider">退佣等</th><th class="text-right p-3 text-[10px] text-stone-400 tracking-wider">月固定支出</th><th class="text-right p-3 text-[10px] text-stone-400 tracking-wider">淨利</th></tr></thead><tbody>';
        (result.monthly || []).forEach(function (m) {
          var mAddonCommission = m.addonCommission != null ? m.addonCommission : (m.addonTotal || 0) - (m.addonCostTotal || 0);
          html +=
            '<tr class="border-b border-stone-100"><td class="p-3">' +
            m.month +
            '</td><td class="text-right p-3">' +
            (m.revenue || 0).toLocaleString() +
            '</td><td class="text-right p-3">' +
            (m.addonTotal || 0).toLocaleString() +
            '</td><td class="text-right p-3">' +
            (m.addonCostTotal || 0).toLocaleString() +
            '</td><td class="text-right p-3">' +
            mAddonCommission.toLocaleString() +
            '</td><td class="text-right p-3">' +
            (
              (m.rebateTotal || 0) +
              (m.complimentaryTotal || 0) +
              (m.otherCostTotal || 0)
            ).toLocaleString() +
            '</td><td class="text-right p-3">' +
            (m.monthlyExpenseTotal || 0).toLocaleString() +
            '</td><td class="text-right p-3 font-medium">' +
            (m.netIncome != null ? m.netIncome : 0).toLocaleString() +
            '</td></tr>';
        });
        html += '</tbody></table></div>';
      }
      html +=
        '<h3 class="garamond text-lg font-light text-stone-700 pt-2">同業退佣統計</h3><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="bg-stone-50"><th class="text-left p-3 text-[10px] text-stone-400 tracking-wider">同業</th><th class="text-right p-3 text-[10px] text-stone-400 tracking-wider">退佣合計</th><th class="text-right p-3 text-[10px] text-stone-400 tracking-wider">訂單數</th></tr></thead><tbody>';
      (result.byAgency || []).forEach(function (a) {
        html +=
          '<tr class="border-b border-stone-100"><td class="p-3">' +
          (a.agencyName || '直客') +
          '</td><td class="text-right p-3">NT$ ' +
          (a.totalRebate || 0).toLocaleString() +
          '</td><td class="text-right p-3">' +
          (a.orderCount || 0) +
          '</td></tr>';
      });
      html += '</tbody></table></div>';
      html +=
        '<h3 class="garamond text-lg font-light text-stone-700 pt-2">訂單明細</h3><div class="flex gap-3 mb-3 items-center"><label class="text-xs text-stone-400">依同業篩選</label><select id="reportAgencyFilter" onchange="filterReportOrdersByAgency()" class="!border !rounded-lg !px-3 !py-2 !bg-white text-sm"><option value="">全部</option>';
      (result.byAgency || []).forEach(function (a) {
        var val = a.agencyName || '直客';
        html +=
          '<option value="' + String(val).replace(/"/g, '&quot;') + '">' + val + '</option>';
      });
      html +=
        '</select></div><div class="rounded-xl border border-stone-100 overflow-hidden" id="reportOrdersContainer">';
      (result.orders || []).forEach(function (o) {
        var agency = (o.agencyName || '').trim() || '直客';
        html +=
          '<div class="border-b border-stone-100 last:border-b-0 report-order-row" data-agency="' +
          String(agency).replace(/"/g, '&quot;') +
          '"><div class="p-3 flex justify-between items-center cursor-pointer hover:bg-stone-50" onclick="toggleReportOrderDetail(\'' +
          String(o.orderID || '').replace(/'/g, "\\'") +
          '\')"><span class="text-sm">' +
          (o.orderID || '') +
          ' ' +
          (o.name || '') +
          ' ' +
          (o.checkIn || '') +
          '</span><span class="text-stone-400 text-sm">NT$ ' +
          (o.totalPrice || 0).toLocaleString() +
          ' · ' +
          agency +
          '</span></div><div id="reportOrder-' +
          String(o.orderID || '').replace(/"/g, '') +
          '" class="hidden px-4 pb-3 text-xs text-stone-500 bg-stone-50">房間營收 ' +
          (o.totalPrice || 0).toLocaleString() +
          ' | 代訂代收 ' +
          (o.addonAmount || 0).toLocaleString() +
          ' | 退佣 ' +
          (o.rebateAmount || 0).toLocaleString() +
          ' | 招待 ' +
          (o.complimentaryAmount || 0).toLocaleString() +
          '</div></div>';
      });
      html += '</div></div>';
      document.getElementById('detailedReportContent').innerHTML = html;
    })
    .catch(function () {
      document.getElementById('detailedReportContent').innerHTML =
        '<p class="text-red-600 p-4">載入失敗</p>';
    });
}
function toggleReportOrderDetail(orderID) {
  var el = document.getElementById('reportOrder-' + orderID);
  if (el) el.classList.toggle('hidden');
}
function filterReportOrdersByAgency() {
  var sel = document.getElementById('reportAgencyFilter');
  var val = sel ? sel.value : '';
  document.querySelectorAll('.report-order-row').forEach(function (el) {
    el.style.display = val === '' || el.getAttribute('data-agency') === val ? '' : 'none';
  });
}
function downloadReportCsv() {
  if (!lastDetailedReport || !lastDetailedReport.success) {
    alert('請先查詢報表再下載');
    return;
  }
  var result = lastDetailedReport,
    s = result.summary || {};
  var periodLabel =
    result.year + (result.month ? '-' + String(result.month).padStart(2, '0') : '');
  var rows = [
    ['雫旅財務報表', periodLabel],
    [
      '房間營收',
      s.revenue || 0,
      '已收訂金',
      s.totalDeposit || 0,
      '淨利',
      s.netIncome != null ? s.netIncome : 0,
    ],
    [],
  ];
  rows.push([
    '訂單編號',
    '姓名',
    '入住',
    '退房',
    '房間營收',
    '已收訂金',
    '折扣',
    '代訂代收',
    '退佣',
    '招待',
    '其他',
    '其他收入',
    '同業',
  ]);
  (result.orders || []).forEach(function (o) {
    rows.push([
      o.orderID || '',
      o.name || '',
      o.checkIn || '',
      o.checkOut || '',
      o.totalPrice || 0,
      o.paidDeposit || 0,
      o.discountAmount || 0,
      o.addonAmount || 0,
      o.rebateAmount || 0,
      o.complimentaryAmount || 0,
      o.otherCost || 0,
      o.extraIncome || 0,
      (o.agencyName || '').trim() || '直客',
    ]);
  });
  var csv =
    '\uFEFF' +
    rows
      .map(function (r) {
        return r
          .map(function (c) {
            return '"' + String(c).replace(/"/g, '""') + '"';
          })
          .join(',');
      })
      .join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '雫旅報表_' + periodLabel.replace(/-/g, '') + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

// 點擊彈窗外部關閉
document.addEventListener('click', function (e) {
  var bp = document.getElementById('bookingCalDayPopover');
  var ap = document.getElementById('agencyDayPopover');
  if (bp && bp.classList.contains('show') && !bp.contains(e.target)) {
    var calGrid = document.getElementById('bookingCalGrid');
    if (!calGrid || !calGrid.contains(e.target)) bp.classList.remove('show');
  }
  if (ap && ap.classList.contains('show') && !ap.contains(e.target)) {
    var agencyWrap = document.getElementById('agencyCalendarWrap');
    if (!agencyWrap || !agencyWrap.contains(e.target)) ap.classList.remove('show');
  }
});

document.getElementById('orderModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
document.getElementById('detailedReportModal').addEventListener('click', function (e) {
  if (e.target === this) closeDetailedReportModal();
});
document.getElementById('addModal').addEventListener('click', function (e) {
  if (e.target === this) closeAddModal();
});

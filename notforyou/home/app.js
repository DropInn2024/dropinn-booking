// rehash 20260527 — force CF Pages re-upload (skip-because-hash-matches bug)
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
      }
  }
  // 切換到漂流 tab 時初始化 Drift Spots 管理（drift-admin.js）
  if (id === 'drift') {
    if (typeof driftInit === 'function') driftInit();
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
// 三個日曆共用：中文月份
var MONTHS_HK = ['一月','二月','三月','四月','五月','六月',
                 '七月','八月','九月','十月','十一月','十二月'];

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
    // 累積支出視圖 — 切到房務 tab 時自動載一次
    hkLoadSummary();
    // 重新整理按鈕
    var refreshBtn = document.getElementById('hkSummaryRefreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', hkLoadSummary);
    // 「結算此月」按鈕（事件委派到 list 容器）
    var summaryListEl = document.getElementById('hkSummaryMonthList');
    if (summaryListEl) {
      summaryListEl.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-action="hkSummarySettle"]');
        if (!btn) return;
        var mk = btn.dataset.month;
        if (!mk) return;
        if (!confirm('確認對「' + mk + '」進行月結？\n月結後本月所有清潔費與雜項不可修改。')) return;
        btn.disabled = true;
        btn.textContent = '結算中…';
        _nfyFetch('POST', '/api/hk/settle', { month: mk })
          .then(function(d) {
            if (!d || !d.success) {
              alert('結算失敗：' + (d && d.error || '未知錯誤'));
              btn.disabled = false;
              btn.textContent = '結算此月';
              return;
            }
            hkLoadSummary();  // 重新載入整張表
          })
          .catch(function(err) {
            alert('結算失敗：' + (err && err.message || err));
            btn.disabled = false;
            btn.textContent = '結算此月';
          });
      });
    }
  }
  document.getElementById('hkMonthMain').textContent = MONTHS_HK[hkMonth];
  document.getElementById('hkMonthYear').textContent = String(hkYear);
  hkLoadAndRender();
}

// 累積支出（跨月份）— 只給金額，不給訂單細節
function hkLoadSummary() {
  var listEl  = document.getElementById('hkSummaryMonthList');
  var grandEl = document.getElementById('hkSummaryGrand');
  var settEl  = document.getElementById('hkSummarySettled');
  var pendEl  = document.getElementById('hkSummaryPending');
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align:center;padding:24px 0;color:#8a7a6a;font-size:12px;letter-spacing:0.12em;">載入中…</div>';

  _nfyFetch('GET', '/api/hk/summary')
    .then(function(data) {
      if (!data || !data.success) {
        listEl.innerHTML = '<div style="text-align:center;padding:24px 0;color:#b8795a;font-size:12px;">載入失敗</div>';
        return;
      }
      var fmt = function(n) { return 'NT$ ' + Number(n || 0).toLocaleString(); };
      grandEl.textContent = fmt(data.grandTotal);
      settEl.textContent  = fmt(data.settledTotal);
      pendEl.textContent  = fmt(data.pendingTotal);

      if (!data.months || !data.months.length) {
        listEl.innerHTML = '<div style="text-align:center;padding:24px 0;color:#8a7a6a;font-size:12px;letter-spacing:0.12em;">尚無資料</div>';
        return;
      }
      var html = '<div style="border-top:1px solid rgba(181,171,160,0.2);">';
      data.months.forEach(function(m) {
        var ms = m.monthKey.split('-');
        var label = (MONTHS_HK[Number(ms[1])-1] || ms[1]+'月') + ' ' + ms[0];
        var badge;
        if (m.isSettled) {
          badge = '<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:10px;letter-spacing:0.12em;background:rgba(164,181,197,0.20);color:#2a4258;margin-left:8px;">已結算' + (m.settledAt ? ' · ' + (m.settledAt||'').slice(0,10) : '') + '</span>';
        } else if (m.canSettle) {
          badge = '<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:10px;letter-spacing:0.12em;background:rgba(165,90,79,0.13);color:var(--highlight);margin-left:8px;">可結算</span>';
        } else {
          badge = '<span style="display:inline-block;padding:2px 9px;border-radius:12px;font-size:10px;letter-spacing:0.12em;background:rgba(230,124,115,0.15);color:#7a3030;margin-left:8px;">待填 ' + (m.expectedCount - m.orderCount) + '/' + m.expectedCount + '</span>';
        }
        html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 4px;border-bottom:1px solid rgba(181,171,160,0.15);flex-wrap:wrap;">';
        html += '<div style="flex:1;min-width:180px;">';
        html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:16px;color:var(--ink);letter-spacing:0.05em;">' + label + badge + '</div>';
        html += '<div style="font-size:11px;color:#8a7a6a;letter-spacing:0.06em;margin-top:3px;">' +
                  '訂單清潔 ' + fmt(m.ordersTotal) + '（' + m.orderCount + '/' + m.expectedCount + ' 筆）' +
                  ' · 其他 ' + fmt(m.extrasTotal) + '（' + m.extraCount + ' 筆）' +
                '</div>';
        html += '</div>';
        html += '<div style="display:flex;align-items:center;gap:12px;">';
        html += '<div style="font-family:\'Cormorant Garamond\',serif;font-size:20px;color:var(--ink);">' + fmt(m.total) + '</div>';
        if (m.canSettle) {
          html += '<button data-action="hkSummarySettle" data-month="' + m.monthKey + '" style="padding:6px 14px;background:#8a7868;color:#f8f5ef;border:none;border-radius:14px;font-family:inherit;font-size:11px;letter-spacing:0.12em;cursor:pointer;white-space:nowrap;">結算此月</button>';
        }
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
      listEl.innerHTML = html;
    })
    .catch(function(err) {
      listEl.innerHTML = '<div style="text-align:center;padding:24px 0;color:#b8795a;font-size:12px;">載入失敗：' + (err && err.message || err) + '</div>';
    });
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
      var orders = (data.orders || []).filter(function(o) {
        return o.status === '已付訂' || o.status === '完成';
      });
      hkCache[mk] = orders;
      // 同步進 allOrders，讓 popover (showBookingDayInfo) 能找到 HK 月份的訂單
      orders.forEach(function(o) {
        var idx = allOrders.findIndex(function(a) {
          return String(a.orderID) === String(o.orderID);
        });
        if (idx >= 0) allOrders[idx] = o;
        else allOrders.push(o);
      });
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

  // day → { checkoutRooms, checkinRooms, notes }
  // 房務只關心當天「幾間退、幾間入」，名字不顯示（節省格子空間）
  var dayMap = {};
  function ensure(ds) {
    if (!dayMap[ds]) dayMap[ds] = { checkoutRooms:0, checkinRooms:0, notes:[] };
    return dayMap[ds];
  }
  orders.forEach(function(o) {
    var rooms = Number(o.rooms) || 1;
    var note = o.housekeepingNote || '';
    if (o.checkOut && o.checkOut.startsWith(mk)) {
      var d = ensure(o.checkOut);
      d.checkoutRooms += rooms;
      if (note) d.notes.push(note);
    }
    if (o.checkIn && o.checkIn.startsWith(mk)) {
      ensure(o.checkIn).checkinRooms += rooms;
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
    var hasOut = dayData && dayData.checkoutRooms > 0;
    var hasIn  = dayData && dayData.checkinRooms > 0;

    // 房務莫蘭迪色票（同 restoretheblank）：灰藍退房 / 暖灰入住 / 暖紅退+入
    var bg = 'transparent';
    var border = '1px solid transparent';
    if (hasOut && hasIn) { bg = 'rgba(230,124,115,0.60)'; border = '1px solid rgba(230,124,115,0.85)'; }
    else if (hasOut)     { bg = 'rgba(164,181,197,0.70)'; border = '1px solid rgba(164,181,197,0.90)'; }
    else if (hasIn)      { bg = 'rgba(219,217,210,0.90)'; border = '1px solid rgba(160,155,145,0.55)'; }

    var dayColor = isWe ? '#b8795a' : '#1a1210';
    if (hasOut && hasIn) dayColor = '#2a0a08';

    // 可點擊 → 沿用訂單日曆的 popover；移除 min-height 讓 aspect-ratio 真正生效
    html += '<div class="hk-cal-day" data-action="showBookingDayInfo" data-date="' + ds + '" style="border-radius:6px;padding:4px 2px;background:' + bg + ';border:' + border + ';position:relative;overflow:hidden;cursor:pointer;transition:background 0.15s;">';
    html += '<span style="font-family:\'Cormorant Garamond\',serif;font-size:17px;font-weight:300;color:' + dayColor + ';display:block;margin-bottom:1px;line-height:1.1;">' + d + '</span>';
    if (dayData) {
      var evColor = (hasOut && hasIn) ? '#2a0a08' : '#3a3028';
      // 房務只看「幾間」— 退/入同天 → 「退 X / 入 Y」；單一狀態 → 「X 間」
      var countText = '';
      if (hasOut && hasIn) {
        countText = '退 ' + dayData.checkoutRooms + ' / 入 ' + dayData.checkinRooms;
      } else if (hasOut) {
        countText = dayData.checkoutRooms + ' 間';
      } else if (hasIn) {
        countText = dayData.checkinRooms + ' 間';
      }
      if (countText) {
        html += '<div style="font-size:11px;font-weight:500;color:' + evColor + ';line-height:1.3;letter-spacing:0.03em;margin-top:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">' + countText + '</div>';
      }
      if (dayData.notes.length) {
        html += '<div style="font-size:9px;color:#8a7a6a;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">★ ' + dayData.notes.join(' / ') + '</div>';
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
    dateLabel.innerHTML =
      now.getFullYear() + ' / ' +
      String(now.getMonth() + 1).padStart(2, '0') + ' / ' +
      String(now.getDate()).padStart(2, '0') +
      '<span class="date-weekday"> 星期' + days[now.getDay()] + '</span>';
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

  // 本月尾款（本月有入住的訂單）
  var pendingBal = active.filter(function(o) {
    return (o.checkIn || '').startsWith(monthStr);
  }).reduce(function (sum, o) {
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
    var balText = o.status === '完成' ? '已結清' : (balance > 0 ? '尾款 NT$ ' + balance.toLocaleString() : '已結清');
    return '<div class="overview-upcoming-item" data-action="viewOrder" data-order-id="' + escapeHtml(o.orderID || '') + '">' +
      '<div><div class="overview-upcoming-date">' + d + '</div><div class="overview-upcoming-date-sub">' + m + ' 月</div></div>' +
      '<div class="overview-status-dot ' + dot + '"></div>' +
      '<div class="overview-upcoming-name">' + (o.name || '—') +
        '<div class="overview-upcoming-detail">' + ci + ' → ' + (o.checkOut || '') + (rooms ? '  ' + rooms : '') + '</div>' +
      '</div>' +
      '<div class="overview-upcoming-detail" style="text-align:right">' + (o.status || '') + '<br>' + balText + '</div>' +
    '</div>';
  }).join('');
}

// ── 財務：支出明細房務費用行 ──────────────────────────
var _hkDetailOpen = false;
var _hkDetailMonthKey = '';

function loadHkFinanceLine(monthKey) {
  var costEl   = document.getElementById('statHkCost');
  var noteEl   = document.getElementById('statHkNote');
  var detailEl = document.getElementById('hkCostDetail');
  _hkDetailMonthKey = monthKey;
  // 月份改變時收合明細
  if (detailEl) detailEl.style.display = 'none';
  _hkDetailOpen = false;
  var chevron = document.getElementById('hkCostChevron');
  if (chevron) chevron.style.transform = '';

  if (!costEl) return;
  if (!monthKey) {
    costEl.textContent = '—';
    if (noteEl) noteEl.textContent = '';
    return;
  }

  // 全年模式：使用 /api/hk/summary 抓所有月份再依年份加總
  if (/^\d{4}$/.test(monthKey)) {
    _nfyFetch('GET', '/api/hk/summary')
      .then(function(d) {
        if (!d || !d.success) return;
        var months = (d.months || []).filter(function(m) { return m.monthKey.startsWith(monthKey + '-'); });
        var total = months.reduce(function(s, m) { return s + (m.total || 0); }, 0);
        var settledMonths = months.filter(function(m){ return m.isSettled; }).length;
        var unsettledMonths = months.length - settledMonths;
        costEl.textContent = 'NT$ ' + total.toLocaleString();
        if (noteEl) {
          if (!months.length) noteEl.textContent = '';
          else if (unsettledMonths === 0) noteEl.textContent = '全年已結算';
          else if (settledMonths === 0) noteEl.textContent = '待結算 ' + unsettledMonths + ' 月';
          else noteEl.textContent = '待結算 ' + unsettledMonths + ' 月';
        }
      })
      .catch(function() {});
    return;
  }

  // 月份模式：使用既有 dash-card endpoint
  _nfyFetch('GET', '/api/hk/dash-card?month=' + monthKey)
    .then(function(d) {
      if (!d || !d.success) return;
      if (d.isSettled) {
        costEl.textContent = 'NT$ ' + (d.actualTotal || 0).toLocaleString();
        if (noteEl) noteEl.textContent = '已結算';
      } else if (d.totalOrders === 0) {
        // 該月沒退房訂單 → 不該有房務費用
        costEl.textContent = 'NT$ 0';
        if (noteEl) noteEl.textContent = '';
      } else if (d.filledCount === d.totalOrders) {
        // 全填完 但還沒月結
        costEl.textContent = 'NT$ ' + (d.actualTotal || 0).toLocaleString();
        if (noteEl) noteEl.textContent = '可結算';
      } else if (d.filledCount > 0) {
        // 部分填
        costEl.textContent = 'NT$ ' + (d.actualTotal || 0).toLocaleString();
        if (noteEl) noteEl.textContent = '待填 ' + (d.totalOrders - d.filledCount) + ' 筆';
      } else {
        // 完全沒填（不再顯示「預估」混淆）
        costEl.textContent = '—';
        if (noteEl) noteEl.textContent = '待填 ' + d.totalOrders + ' 筆';
      }
    })
    .catch(function() {});
}

// ── 財務：代辦行程費用（旅行社月結帳單）── 對應「房務費用」展開模式 ──
var _addonDetailOpen = false;
var _addonDetailMonthKey = '';
var _addonRowsCache = [];   // 暫存目前顯示的訂單列，inline save 用

function loadAddonFinanceLine(monthKey) {
  var costEl   = document.getElementById('statAddonCost');
  var noteEl   = document.getElementById('statAddonCostNote');
  var detailEl = document.getElementById('addonCostDetail');
  _addonDetailMonthKey = monthKey;
  // 月份變 → 收合明細
  if (detailEl) detailEl.style.display = 'none';
  _addonDetailOpen = false;
  var chev = document.getElementById('addonCostChevron');
  if (chev) chev.style.transform = '';

  if (!costEl) return;
  if (!monthKey) {
    costEl.textContent = '—';
    if (noteEl) noteEl.textContent = '';
    return;
  }
  _nfyFetch('GET', '/api/admin/addon-report?month=' + monthKey)
    .then(function(d) {
      if (!d || !d.success) return;
      var s = d.summary || {};
      costEl.textContent = 'NT$ ' + (s.totalCost || 0).toLocaleString();
      if (noteEl) {
        if (!s.totalCount) {
          noteEl.textContent = '';
        } else if (s.filledCount === s.totalCount) {
          noteEl.textContent = '';
        } else if (s.filledCount === 0) {
          noteEl.textContent = '待填 ' + s.totalCount + ' 筆';
        } else {
          noteEl.textContent = '待填 ' + (s.totalCount - s.filledCount) + ' 筆';
        }
      }
    })
    .catch(function(){});
}

// 代辦行程費用 row → 點開 modal
function openAddonCostModal() {
  var modal = document.getElementById('addonCostModal');
  if (!modal) return;
  var monthInput = document.getElementById('addonModalMonth');
  var initMonth;
  if (_addonDetailMonthKey && /^\d{4}-\d{2}$/.test(_addonDetailMonthKey)) {
    initMonth = _addonDetailMonthKey;
  } else {
    var now = new Date();
    initMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }
  if (monthInput) monthInput.value = initMonth;
  modal.classList.add('active');
  loadAddonCostModalContent(initMonth);
}
function closeAddonCostModal() {
  var m = document.getElementById('addonCostModal');
  if (m) m.classList.remove('active');
}

function loadAddonCostModalContent(month) {
  var contentEl = document.getElementById('addonModalContent');
  if (!contentEl) return;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    contentEl.innerHTML = '<div class="text-stone-400 text-xs text-center py-6 tracking-widest">請選擇月份</div>';
    return;
  }
  contentEl.innerHTML = '<div class="text-stone-400 text-xs text-center py-6 tracking-widest">載入中…</div>';
  _addonDetailMonthKey = month;  // 同步 modal 月份 → save 時用得到
  _nfyFetch('GET', '/api/admin/addon-report?month=' + month)
    .then(function(d) {
      if (!d || !d.success) {
        contentEl.innerHTML = '<div class="text-red-400 text-xs text-center py-6">載入失敗：' + (d && d.error || '') + '</div>';
        return;
      }
      renderAddonDetail(d, contentEl);
    })
    .catch(function(err) {
      contentEl.innerHTML = '<div class="text-red-400 text-xs text-center py-6">連線失敗：' + (err && err.message || err) + '</div>';
    });
}

function renderAddonDetail(data, contentEl) {
  var orders = data.orders || [];
  var s      = data.summary || {};
  _addonRowsCache = orders.slice();

  var nt = function(n) { return 'NT$ ' + (n||0).toLocaleString(); };
  var html = '';

  // 摘要
  html += '<div class="grid grid-cols-3 gap-3 mb-4">';
  html += '<div class="bg-stone-50/60 rounded-lg p-3 text-center">';
  html += '<div class="text-[10px] text-stone-400 tracking-[0.2em] uppercase mb-1">代收總額</div>';
  html += '<div class="garamond text-base font-light text-stone-700">' + nt(s.totalAmount) + '</div>';
  html += '</div>';
  html += '<div class="bg-stone-50/60 rounded-lg p-3 text-center">';
  html += '<div class="text-[10px] text-stone-400 tracking-[0.2em] uppercase mb-1">已填成本</div>';
  html += '<div class="garamond text-base font-light text-stone-700">' + nt(s.totalCost) + '</div>';
  html += '</div>';
  html += '<div class="bg-stone-50/60 rounded-lg p-3 text-center">';
  html += '<div class="text-[10px] text-stone-400 tracking-[0.2em] uppercase mb-1">佣金</div>';
  html += '<div class="garamond text-base font-light" style="color:var(--highlight)">' + nt(s.commission) + '</div>';
  html += '</div>';
  html += '</div>';

  if (!orders.length) {
    html += '<div class="text-stone-400 text-xs text-center py-4 tracking-widest">本月無代辦行程訂單</div>';
    contentEl.innerHTML = html;
    return;
  }

  html += '<div class="text-[10px] text-stone-400 tracking-[0.3em] uppercase mb-3">逐筆輸入旅行社成本</div>';
  html += '<div class="space-y-2">';
  orders.forEach(function(o) {
    var hasCost  = o.addonCost != null;
    var datePart = (o.checkIn || '').slice(5).replace('-', '/');
    var rowBg    = hasCost ? '' : 'background:rgba(165,90,79,0.05);border:1px solid rgba(165,90,79,0.15);';
    html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;' + rowBg + '">';
    // 圓點
    html += '<div style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:' + (hasCost ? '#80b880' : 'var(--highlight,#a55a4f)') + '"></div>';
    // 日期
    html += '<div style="min-width:42px;font-family:\'Cormorant Garamond\',serif;font-size:15px;color:#8a7a6a;">' + datePart + '</div>';
    // 姓名
    html += '<div style="flex:1;font-size:12px;color:#1a1210;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(o.name || '—') + '</div>';
    // 代收金額
    html += '<div style="min-width:68px;text-align:right;font-size:10px;color:#b0a090;letter-spacing:0.05em;">代收 ' + (o.addonAmount||0).toLocaleString() + '</div>';
    // 成本輸入框
    html += '<div style="display:flex;align-items:center;gap:4px;">';
    html += '<span style="font-size:11px;color:#8a7a6a;">成本</span>';
    html += '<input type="number" min="0" inputmode="numeric" ' +
              'data-addon-input-id="' + escapeHtml(o.orderID) + '" ' +
              'placeholder="—" ' +
              'value="' + (hasCost ? o.addonCost : '') + '" ' +
              'style="width:80px;padding:4px 8px;border:1px solid rgba(181,171,160,0.4);border-radius:6px;font-family:\'Cormorant Garamond\',serif;font-size:14px;text-align:right;background:#fff;">';
    html += '<span data-addon-save-status="' + escapeHtml(o.orderID) + '" style="font-size:12px;min-width:14px;"></span>';
    html += '</div>';
    html += '</div>';
  });
  html += '</div>';
  contentEl.innerHTML = html;
}

// inline 儲存：blur 時 PUT /api/orders/:id/costs（保留其他成本欄位）
function _addonSaveOne(orderId, newCostStr) {
  var statusEl = document.querySelector('[data-addon-save-status="' + orderId + '"]');
  var row = _addonRowsCache.find(function(o){ return o.orderID === orderId; });
  if (!row) return;
  var newCost = newCostStr === '' ? 0 : Number(newCostStr);
  if (!Number.isFinite(newCost) || newCost < 0) {
    if (statusEl) { statusEl.textContent = '✕'; statusEl.style.color = '#a55a4f'; }
    return;
  }
  if (statusEl) { statusEl.textContent = '…'; statusEl.style.color = '#8a7a6a'; }
  // upsertOrderCost 是「先刪後寫」，要把其他欄位帶回來不洗掉
  var body = {
    name:                row.name,
    checkIn:             row.checkIn,
    addonCost:           newCost,
    rebateAmount:        row.rebateAmount || 0,
    complimentaryAmount: row.complimentaryAmount || 0,
    otherCost:           row.otherCost || 0,
    note:                row.note || '',
  };
  _nfyFetch('PUT', '/api/orders/' + encodeURIComponent(orderId) + '/costs', body)
    .then(function(d) {
      if (!d || !d.success) {
        if (statusEl) { statusEl.textContent = '✕'; statusEl.style.color = '#a55a4f'; }
        return;
      }
      // 更新 cache
      row.addonCost = newCost;
      if (statusEl) { statusEl.textContent = '✓'; statusEl.style.color = 'var(--accent)'; }
      // 重整摘要列
      loadAddonFinanceLine(_addonDetailMonthKey);
      // 重整整張財務 stats
      if (typeof loadFinanceStats === 'function') loadFinanceStats();
    })
    .catch(function() {
      if (statusEl) { statusEl.textContent = '✕'; statusEl.style.color = '#a55a4f'; }
    });
}

// 房務費用 row → 點開 modal（取代下拉式 inline expand）
function openHkCostModal() {
  var modal = document.getElementById('hkCostModal');
  if (!modal) return;
  var monthInput = document.getElementById('hkModalMonth');
  // 預設月份：若 finance 已選月份用之，否則本月
  var initMonth;
  if (_hkDetailMonthKey && /^\d{4}-\d{2}$/.test(_hkDetailMonthKey)) {
    initMonth = _hkDetailMonthKey;
  } else {
    var now = new Date();
    initMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  }
  if (monthInput) monthInput.value = initMonth;
  modal.classList.add('active');
  loadHkCostModalContent(initMonth);
}
function closeHkCostModal() {
  var m = document.getElementById('hkCostModal');
  if (m) m.classList.remove('active');
}

function loadHkCostModalContent(month) {
  var contentEl = document.getElementById('hkModalContent');
  var actionsEl = document.getElementById('hkModalActions');
  if (!contentEl) return;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    contentEl.innerHTML = '<div class="text-stone-400 text-xs text-center py-6 tracking-widest">請選擇月份</div>';
    if (actionsEl) actionsEl.innerHTML = '';
    return;
  }
  contentEl.innerHTML = '<div class="text-stone-400 text-xs text-center py-6 tracking-widest">載入中…</div>';
  if (actionsEl) actionsEl.innerHTML = '';
  _nfyFetch('GET', '/api/hk/report?month=' + month)
    .then(function(data) {
      if (!data || !data.success) {
        contentEl.innerHTML = '<div class="text-red-400 text-xs text-center py-6">載入失敗：' + (data && data.error || '') + '</div>';
        return;
      }
      renderHkReport(data, month, contentEl, { innerHTML: '' });

      // 結算 / 解除結算 按鈕
      var actionsHtml = '';
      if (data.isSettled) {
        actionsHtml += '<button id="hkUnsettleBtn" data-month="' + month + '" class="btn-outline flex-1" style="border-color:#a55a4f;color:#a55a4f;">解除結算</button>';
        actionsHtml += '<span class="flex-1 text-xs text-stone-500 self-center">已於 ' + (data.settledAt || '').slice(0,10) + ' 結算</span>';
      } else {
        var s = data.summary || {};
        var canSettle = s.totalOrders > 0 && s.filledCount === s.totalOrders;
        actionsHtml += '<button id="hkSettleBtn2" data-month="' + month + '" class="btn-primary flex-1"' + (canSettle ? '' : ' disabled style="opacity:0.5;cursor:not-allowed;"') + '>結算此月</button>';
        if (!canSettle) {
          actionsHtml += '<span class="flex-1 text-xs text-stone-500 self-center">尚有 ' + (s.totalOrders - s.filledCount) + ' 筆未填完</span>';
        }
      }
      if (actionsEl) actionsEl.innerHTML = actionsHtml;
    })
    .catch(function(err) {
      contentEl.innerHTML = '<div class="text-red-400 text-xs text-center py-6">連線失敗：' + (err && err.message || err) + '</div>';
    });
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

// ── 資料工具：手動備份下載 ────────────────────────────
function downloadBackup() {
  var resultEl = document.getElementById('toolsResult');
  if (resultEl) { resultEl.classList.remove('hidden'); resultEl.textContent = '備份中，請稍候…'; }

  var token = localStorage.getItem('nfy_token') || '';
  fetch('/api/admin/backup', {
    headers: { 'Authorization': 'Bearer ' + token },
  })
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.blob();
    })
    .then(function (blob) {
      var date = new Date().toISOString().slice(0, 10);
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'dropinn-backup-' + date + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (resultEl) resultEl.textContent = '✅ 備份已下載';
    })
    .catch(function (e) {
      if (resultEl) resultEl.textContent = '❌ 備份失敗：' + ((e && e.message) || '');
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
          '<button data-action="editCoupon" data-params="' + JSON.stringify(c).replace(/</g, '\\u003c').replace(/"/g, '&quot;') + '" class="btn-outline !py-1 !px-2.5 !text-xs flex-shrink-0">編輯</button>' +
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
              '<button type="button" data-action="agencyApproveOne" data-lid=' + JSON.stringify(lid) + ' data-eid=' + JSON.stringify(eid) + ' class="btn-primary !py-1.5 !px-3 !text-sm">核准</button>' +
              '<button type="button" data-action="agencyRejectOne" data-lid=' + JSON.stringify(lid) + ' data-eid=' + JSON.stringify(eid) + ' class="btn-outline !py-1.5 !px-3 !text-sm" style="border-color:rgba(184,64,64,0.35);color:#b84040">拒絕</button>' +
              '<button type="button" data-action="agencyDeleteOne" data-lid=' + JSON.stringify(lid) + ' data-eid=' + JSON.stringify(eid) + ' class="btn-outline !py-1.5 !px-2.5 !text-sm" style="border-color:rgba(140,32,32,0.2);color:#9c6060;" title="刪除申請">✕</button>' +
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
            '<button type="button" data-action="openVpModal" data-lid=' + JSON.stringify(lid) + ' class="btn-outline !py-1.5 !px-3 !text-xs" style="font-size:10px;">可見夥伴</button>' +
            '<button type="button" data-action="agencyResetPassword" data-lid=' + JSON.stringify(lid) + ' class="btn-outline !py-1.5 !px-3 !text-xs" style="font-size:10px;">重設密碼</button>' +
            '<button type="button" data-action="agencyDeleteApprovedRow" data-lid=' + JSON.stringify(lid) + ' data-eid=' + JSON.stringify(eid) + ' class="btn-outline !py-1.5 !px-3 !text-sm flex-shrink-0" style="border-color:rgba(140,32,32,0.22);color:#9c6060;">刪除</button>' +
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
    '<button id="vpCancelBtn" style="all:unset;box-sizing:border-box;padding:10px 20px;border:1px solid rgba(181,171,160,0.4);border-radius:10px;font-family:inherit;font-size:12px;letter-spacing:0.15em;color:#8a7a6a;cursor:pointer;">取消</button>' +
    '<button id="vpSaveBtn" style="all:unset;box-sizing:border-box;padding:10px 24px;background:#a89684;border-radius:10px;font-family:inherit;font-size:12px;letter-spacing:0.15em;color:#f8f5ef;cursor:pointer;">儲存</button>' +
    '</div></div>';
  modal.style.display = 'flex';
  // Wire up VP modal buttons via direct addEventListener (elements now exist in DOM)
  var cancelBtn = document.getElementById('vpCancelBtn');
  var saveBtn2  = document.getElementById('vpSaveBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', closeVpModal);
  if (saveBtn2)  saveBtn2.addEventListener('click', saveVpModal);
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
            ' <button data-action="removeGroupMember" data-group-id="' + escapeHtml(g.groupId) + '" data-agency-id2="' + escapeHtml(m.agencyId) + '" class="text-stone-400 hover:text-red-500 ml-1">×</button>' +
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
            '<button data-action="addGroupMember" data-group-id="' + escapeHtml(g.groupId) + '" class="btn-outline !py-2 !px-3 !text-sm">加入</button>' +
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
        _allAgencyData = { agencies: [], blocksByProperty: {} };
        renderAgencyCalendar();
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
      // 即使 API 失敗也顯示空日曆（尚無同業資料）
      _allAgencyData = { agencies: [], blocksByProperty: {} };
      renderAgencyCalendar();
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
  // 月份 / 年份上下堆疊（跟訂單/房務日曆同款）
  var html = '<div class="agency-cal-nav">';
  html += '<button type="button" data-action="agencyCalPrev" class="agency-nav-btn" aria-label="上個月">←</button>';
  html += '<div class="agency-cal-title">';
  html += '<span class="agency-cal-month">' + MONTHS_HK[m] + '</span>';
  html += '<span class="agency-cal-year">' + y + '</span>';
  html += '</div>';
  html += '<button type="button" data-action="agencyCalNext" class="agency-nav-btn" aria-label="下個月">→</button>';
  html += '</div>';
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
      '" data-action="showAgencyDayDetail" data-date="' +
      ds +
      '">' +
      d +
      '</div>';
  }
  html += '</div>';
  if (!propList.length)
    html += '<p class="text-xs text-stone-400 agency-empty-note" style="text-align:center;margin-top:8px;">尚無同業資料</p>';
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

  // 支出明細：房務費用行 + 代辦行程費用行（兩個都同步支援 月份/全年）
  var financeKey = month ? year + '-' + String(month).padStart(2, '0') : String(year);
  loadHkFinanceLine(financeKey);
  loadAddonFinanceLine(financeKey);
}

// ── 房務清潔費月報 ─────────────────────────────────────────────────────────
function loadHkReport(year, month) {
  var contentEl = document.getElementById('hkReportContent');
  var badgeEl   = document.getElementById('hkReportStatusBadge');
  if (!contentEl) return;

  if (!month) {
    contentEl.innerHTML = '<div class="text-stone-400 text-xs tracking-widest text-center py-8">請選擇特定月份查看</div>';
    if (badgeEl) badgeEl.innerHTML = '';
    return;
  }

  var mk = year + '-' + String(month).padStart(2, '0');
  contentEl.innerHTML = '<div class="text-stone-400 text-xs tracking-widest text-center py-8">載入中…</div>';
  if (badgeEl) badgeEl.innerHTML = '';

  _nfyFetch('GET', '/api/hk/report?month=' + mk)
    .then(function (data) {
      if (!data || !data.success) {
        contentEl.innerHTML = '<div class="text-stone-400 text-xs text-center py-8">載入失敗</div>';
        return;
      }
      renderHkReport(data, mk, contentEl, badgeEl);
    })
    .catch(function () {
      contentEl.innerHTML = '<div class="text-stone-400 text-xs text-center py-8">連線失敗</div>';
    });
}

function renderHkReport(data, mk, contentEl, badgeEl) {
  var s       = data.summary || {};
  var orders  = data.orders  || [];
  var extras  = data.extras  || [];
  var settled = data.isSettled;

  // status badge
  if (badgeEl) {
    if (settled) {
      badgeEl.innerHTML = '<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;letter-spacing:0.12em;background:rgba(164,181,197,0.22);color:#2a4258;">已結算</span>';
    } else if (s.filledCount === s.totalOrders && s.totalOrders > 0) {
      badgeEl.innerHTML = '<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;letter-spacing:0.12em;background:#f5ecd5;color:#8a6a2a;">已填完 · 待月結</span>';
    } else {
      badgeEl.innerHTML = '<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:10px;letter-spacing:0.12em;background:#f2efeb;color:#8a7a6a;">待填寫 ' + (s.filledCount||0) + '/' + (s.totalOrders||0) + '</span>';
    }
  }

  var nt = function(n) { return 'NT$ ' + (n||0).toLocaleString(); };

  var html = '';

  // 摘要數字
  html += '<div class="grid grid-cols-3 gap-4 mb-5">';
  html += '<div class="bg-stone-50/60 rounded-xl p-4 text-center">';
  html += '<div class="text-[10px] text-stone-400 tracking-[0.2em] uppercase mb-1">預估費用</div>';
  html += '<div class="garamond text-lg font-light text-stone-600">' + nt(s.estimateTotal) + '</div>';
  html += '</div>';
  html += '<div class="bg-stone-50/60 rounded-xl p-4 text-center">';
  html += '<div class="text-[10px] text-stone-400 tracking-[0.2em] uppercase mb-1">實填金額</div>';
  html += '<div class="garamond text-lg font-light text-stone-700">' + nt(s.actualTotal) + '</div>';
  html += '</div>';
  var diff = (s.actualTotal||0) - (s.estimateTotal||0);
  // diff > 0 超支 → highlight 茜紅；diff < 0 省錢 → accent 深奶茶；持平 → muted
  var diffColor = diff > 0 ? 'var(--highlight)' : diff < 0 ? 'var(--accent)' : '#8a7a6a';
  html += '<div class="bg-stone-50/60 rounded-xl p-4 text-center">';
  html += '<div class="text-[10px] text-stone-400 tracking-[0.2em] uppercase mb-1">差異</div>';
  html += '<div class="garamond text-lg font-light" style="color:' + diffColor + '">' + (diff >= 0 ? '+' : '') + (diff||0).toLocaleString() + '</div>';
  html += '</div>';
  html += '</div>';

  // 訂單明細
  if (!orders.length) {
    html += '<div class="text-stone-400 text-xs text-center py-4 tracking-widest">本月無退房訂單</div>';
  } else {
    html += '<div class="mb-4">';
    html += '<div class="text-[10px] text-stone-400 tracking-[0.3em] uppercase mb-3">退房訂單明細</div>';
    html += '<div class="space-y-2">';
    orders.forEach(function(o) {
      var hasCost = o.cost && o.cost.amount != null;
      var datePart = (o.checkOut || '').slice(5).replace('-', '/');
      var rowBg = hasCost ? '' : 'background:rgba(184,121,90,0.04);border:1px solid rgba(184,121,90,0.12);';
      html += '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;' + rowBg + '">';
      // 狀態圓點
      html += '<div style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:' + (hasCost ? '#80b880' : '#e0b880') + '"></div>';
      // 日期
      html += '<div style="min-width:42px;font-family:\'Cormorant Garamond\',serif;font-size:15px;color:#8a7a6a;">' + datePart + '</div>';
      // 姓名 + 間數
      html += '<div style="flex:1;font-size:12px;color:#1a1210;">' + escapeHtml(o.name || '—') + '</div>';
      html += '<div style="font-size:11px;color:#8a7a6a;min-width:30px;text-align:right;">' + (o.rooms||'—') + ' 間</div>';
      // 預估
      html += '<div style="min-width:68px;text-align:right;">';
      html += '<div style="font-size:10px;color:#b0a090;letter-spacing:0.05em;">預 ' + (o.estimate||0).toLocaleString() + '</div>';
      if (hasCost) {
        html += '<div style="font-size:13px;font-family:\'Cormorant Garamond\',serif;color:#1a1210;font-weight:300;">實 ' + (o.cost.amount||0).toLocaleString() + '</div>';
      } else {
        html += '<div style="font-size:11px;color:#b8795a;letter-spacing:0.08em;">未填</div>';
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // 其他雜項
  if (extras.length) {
    html += '<div class="mb-4">';
    html += '<div class="text-[10px] text-stone-400 tracking-[0.3em] uppercase mb-3">其他項目</div>';
    html += '<div class="space-y-2">';
    extras.forEach(function(e) {
      html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:10px;background:#f8f5ef;">';
      html += '<div style="flex:1;font-size:12px;color:#1a1210;">' + escapeHtml(e.description||'') + '</div>';
      html += '<div style="font-size:11px;color:#8a7a6a;letter-spacing:0.05em;">' + (e.source==='admin'?'後台':'房務') + '</div>';
      html += '<div style="font-size:13px;font-family:\'Cormorant Garamond\',serif;color:#1a1210;min-width:64px;text-align:right;">NT$ ' + (e.amount||0).toLocaleString() + '</div>';
      if (!settled) {
        html += '<button data-hk-del-extra="' + e.id + '" data-hk-del-month="' + mk + '" style="all:unset;cursor:pointer;color:#c0a090;font-size:14px;padding:0 4px;" title="刪除">×</button>';
      }
      html += '</div>';
    });
    html += '</div></div>';
  }

  // 操作按鈕
  html += '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(181,171,160,0.15);">';
  if (!settled) {
    // 新增雜項
    html += '<button id="hkAddExtraBtn" style="all:unset;cursor:pointer;padding:8px 16px;border:1px solid rgba(181,171,160,0.4);border-radius:20px;font-size:11px;letter-spacing:0.12em;color:#8a7a6a;">＋ 新增雜項</button>';
    // 月結按鈕
    if (s.filledCount === s.totalOrders && s.totalOrders > 0) {
      html += '<button id="hkSettleBtn" data-hk-settle-month="' + mk + '" style="all:unset;cursor:pointer;padding:8px 20px;background:#8a7868;border-radius:20px;font-size:11px;letter-spacing:0.12em;color:#f8f5ef;">月結確認</button>';
    }
  } else if (data.settledAt) {
    html += '<span style="font-size:11px;color:#8a7a6a;letter-spacing:0.1em;">已於 ' + (data.settledAt||'').slice(0,10) + ' 月結</span>';
  }
  html += '</div>';

  // 新增雜項 inline form（hidden by default）
  html += '<div id="hkExtraForm" style="display:none;margin-top:14px;padding:14px 16px;background:#f8f5ef;border-radius:12px;">';
  html += '<div style="font-size:10px;letter-spacing:0.2em;color:#8a7a6a;margin-bottom:10px;text-transform:uppercase;">新增其他費用</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;">';
  html += '<input id="hkExtraDesc" type="text" placeholder="說明（如：備品補充）" style="flex:2;min-width:140px;border:1px solid rgba(181,171,160,0.4);border-radius:8px;padding:7px 10px;font-size:12px;background:#fff;" />';
  html += '<input id="hkExtraAmt" type="number" placeholder="金額" min="0" style="flex:1;min-width:80px;border:1px solid rgba(181,171,160,0.4);border-radius:8px;padding:7px 10px;font-size:12px;background:#fff;" />';
  html += '<button id="hkExtraSubmit" data-hk-extra-month="' + mk + '" style="all:unset;cursor:pointer;padding:7px 16px;background:#a89684;border-radius:8px;font-size:11px;letter-spacing:0.1em;color:#f8f5ef;">新增</button>';
  html += '<button id="hkExtraCancel" style="all:unset;cursor:pointer;padding:7px 12px;font-size:11px;color:#8a7a6a;">取消</button>';
  html += '</div>';
  html += '</div>';

  contentEl.innerHTML = html;

  // 新增雜項 toggle
  var addBtn = document.getElementById('hkAddExtraBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function() {
      var form = document.getElementById('hkExtraForm');
      if (form) { form.style.display = form.style.display === 'none' ? 'block' : 'none'; }
    });
  }
  var cancelBtn = document.getElementById('hkExtraCancel');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      var form = document.getElementById('hkExtraForm');
      if (form) form.style.display = 'none';
    });
  }
  // 新增雜項 submit
  var submitBtn = document.getElementById('hkExtraSubmit');
  if (submitBtn) {
    submitBtn.addEventListener('click', function() {
      var month = submitBtn.dataset.hkExtraMonth;
      var desc = (document.getElementById('hkExtraDesc') || {}).value || '';
      var amt = parseFloat((document.getElementById('hkExtraAmt') || {}).value || '');
      if (!desc.trim() || isNaN(amt) || amt < 0) return;
      _nfyFetch('POST', '/api/hk/extras', { month: month, description: desc.trim(), amount: amt })
        .then(function(r) {
          if (r && r.success) { _hkDetailReload(month); }
        });
    });
  }
  // 月結
  var settleBtn = document.getElementById('hkSettleBtn');
  if (settleBtn) {
    settleBtn.addEventListener('click', function() {
      var m = settleBtn.dataset.hkSettleMonth;
      if (!confirm('確認對 ' + m + ' 進行月結？月結後無法修改清潔費。')) return;
      _nfyFetch('POST', '/api/hk/settle', { month: m })
        .then(function(r) {
          if (r && r.success) { _hkDetailReload(m); }
        });
    });
  }

  // 刪除雜項（事件委派）
  contentEl.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-hk-del-extra]');
    if (!btn) return;
    var id = btn.dataset.hkDelExtra;
    var m  = btn.dataset.hkDelMonth;
    if (!confirm('刪除這筆雜項？')) return;
    _nfyFetch('DELETE', '/api/hk/extras/' + id)
      .then(function(r) {
        if (r && r.success) { _hkDetailReload(m); }
      });
  }, { once: true });
}

function _hkDetailReload(monthKey) {
  loadHkFinanceLine(monthKey);
  // 重新展開明細
  var contentEl = document.getElementById('hkCostDetailContent');
  var detailEl  = document.getElementById('hkCostDetail');
  if (!contentEl || !detailEl) return;
  detailEl.style.display = 'block';
  _hkDetailOpen = true;
  contentEl.innerHTML = '<div class="text-stone-400 text-xs text-center py-4 tracking-widest">載入中…</div>';
  _nfyFetch('GET', '/api/hk/report?month=' + monthKey)
    .then(function(data) {
      if (!data || !data.success) { contentEl.innerHTML = '<div class="text-stone-400 text-xs text-center py-4">載入失敗</div>'; return; }
      renderHkReport(data, monthKey, contentEl, { innerHTML: '' });
    });
}

function filterOrders() {
  const statusFilter = document.getElementById('filterStatus').value;
  const searchText = document.getElementById('searchInput').value.trim().toLowerCase();
  let filtered = allOrders;
  // 有打字搜尋時：忽略狀態 filter，全局搜尋（這樣找「入住中(已付訂)」訂單時，
  //                                   不必先猜對方目前狀態才能搜到）
  // 沒打字時：照狀態 filter 顯示
  if (searchText) {
    filtered = allOrders.filter(
      (o) =>
        (o.orderID || '').toLowerCase().includes(searchText) ||
        (o.name || '').toLowerCase().includes(searchText) ||
        (o.phone || '').includes(searchText)
    );
  } else if (statusFilter) {
    filtered = filtered.filter((o) => o.status === statusFilter);
  }
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
      <button data-action="changePage" data-page="${_currentPage - 1}"
        ${_currentPage <= 1 ? 'disabled' : ''}
        class="px-4 py-1.5 rounded-lg border border-stone-200 disabled:opacity-30 hover:text-stone-700 transition text-xs tracking-wider">
        ← 上一頁
      </button>
      <span class="text-xs tracking-widest">${_currentPage} / ${totalPages} 頁&ensp;·&ensp;共 ${total} 組</span>
      <button data-action="changePage" data-page="${_currentPage + 1}"
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
  var monthNames = MONTHS_HK; // 共用同一份中文月份
  monthMainEl.textContent = monthNames[month];
  yearEl.textContent = String(year);
  var startDayOfWeek = new Date(year, month, 1).getDay(),
    daysInMonth = new Date(year, month + 1, 0).getDate();
  var totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
  var todayStr = getBookingCalDateStr(new Date()),
    todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  var validStatuses = ['洽談中', '已付訂', '完成'];
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
    // 「已付訂 / 完成」皆視為已成立訂單；過去日期大多是 完成（cron 自動轉），
    // 沒納入會導致歷史月份的色塊和名字消失
    var isConfirmed = function (o) { return o.status === '已付訂' || o.status === '完成'; };
    var isCheckinDay  = ords.some(function (o) { return o.checkIn === dateStr && isConfirmed(o); });
    var isCheckoutDay = checkoutOrds.some(isConfirmed);
    var isPendingIn   = ords.some(function (o) { return o.checkIn === dateStr && o.status === '洽談中'; });
    var isPendingOut  = checkoutOrds.some(function (o) { return o.status === '洽談中'; });
    var hasAnyConfirmed = ords.some(isConfirmed);
    var hasAnyPending   = ords.some(function (o) { return o.status === '洽談中'; });

    // 判斷色彩類別（退+入 > 純退 > 純入 > 住中 > 洽談中）
    // Admin 端：過去日期也套狀態色，方便查歷史訂單
    var classes = 'cal-day';
    if (past) classes += ' past';
    if (today) classes += ' today';

    if (isCheckinDay && isCheckoutDay) classes += ' both-day';
    else if (isCheckoutDay)            classes += ' checkout-day';
    else if (isCheckinDay)             classes += ' checkin-day';
    else if (hasAnyConfirmed)          classes += ' booked';
    else if (isPendingIn || isPendingOut || hasAnyPending) classes += ' pending';
    else if (!past)                    classes += ' free';

    // 名字「只放入住那天」— 退房 / 入住中 / 退+入 都不再印名字 → 視覺乾淨
    // 退+入同天：只放新到（入住）那位
    var inNames = [];
    ords.forEach(function (o) {
      if (o.checkIn === dateStr && isConfirmed(o)) {
        var n = (o.name||'').trim(); if (n) inNames.push(n);
      }
    });
    // 洽談中 fallback：純洽談中的日子才印名字（依舊只在 checkin 那天）
    if (!inNames.length) {
      ords.forEach(function(o) {
        if (o.checkIn === dateStr && o.status === '洽談中') {
          var n = (o.name||'').trim(); if (n) inNames.push(n);
        }
      });
    }

    var eventsHtml = '';
    var isBothDay = classes.indexOf('both-day') >= 0;
    var ciColor = isBothDay ? '#2a0a08'
                : (classes.indexOf('pending') >= 0 ? '#5a2828' : '#3a3028');
    if (inNames.length) {
      eventsHtml += '<div class="cal-day-names" style="color:' + ciColor + ';">' +
        escapeHtml(inNames[0]) + (inNames.length > 1 ? '…' : '') + '</div>';
    }

    html +=
      '<div class="' + classes + '" data-date="' + dateStr +
      '" data-action="showBookingDayInfo">' +
      '<span class="cal-day-num">' + dayNumber + '</span>' +
      eventsHtml +
      '</div>';
  }
  gridEl.innerHTML = html;
  renderFreeWindows();
}

// ── 計算近期可訂空檔（從日曆當前月份起往後 90 天）────────────────
function renderFreeWindows() {
  var panel = document.getElementById('freeWindowsList');
  if (!panel) return;
  // 重新計算時若 modal 已開，自動更新內容（無需關閉重開）
  var validStatuses = ['洽談中', '已付訂', '完成'];
  var bookedIntervals = allOrders
    .filter(function (o) { return validStatuses.includes(o.status); })
    .map(function (o) { return { s: o.checkIn, e: o.checkOut }; })
    .sort(function (a, b) { return a.s < b.s ? -1 : 1; });

  var nowTW = new Date(Date.now() + 8 * 60 * 60 * 1000);
  var todayStr = nowTW.toISOString().slice(0, 10);

  // 起算點：日曆當前月份的第一天（若已過今天，以今天為準）
  var calStart = new Date(bookingCalCurrentMonth.getFullYear(), bookingCalCurrentMonth.getMonth(), 1);
  var calStartStr = calStart.toISOString().slice(0, 10);
  var windows = [];

  // 找出 [cursor, next_booking_start) 的空隙
  var cursor = calStartStr > todayStr ? calStartStr : todayStr;
  var endLimit = new Date(calStart);
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
  var validStatuses = ['洽談中', '已付訂', '完成'];
  // 1. 主來源 allOrders；2. 補：hkCache 同月份的訂單（房務 tab 點擊用）
  var poolOrders = allOrders.slice();
  var mk = (dateStr || '').slice(0, 7);
  if (hkCache && hkCache[mk]) {
    var seenIds = {};
    poolOrders.forEach(function(o){ if (o && o.orderID) seenIds[String(o.orderID)] = true; });
    hkCache[mk].forEach(function(o) {
      if (o && o.orderID && !seenIds[String(o.orderID)]) poolOrders.push(o);
    });
  }
  // 包含該日住宿中 OR 當天退房的訂單
  var onThatDay = poolOrders.filter(function (o) {
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
          var hkNote = String(o.housekeepingNote || '').trim();
          var oid = String(o.orderID || '').trim();
          var editBtn = oid
            ? '<button data-action="calPopoverViewOrder" data-order-id="' + escapeHtml(oid) + '" style="margin-top:10px;width:100%;padding:6px 0;border:1px solid rgba(181,171,160,0.4);border-radius:8px;background:rgba(255,255,255,0.7);font-size:11px;letter-spacing:0.1em;color:var(--ink);cursor:pointer;">編輯訂單</button>'
            : '';
          // 房務備注：直接在 popover 內 inline 編輯（不必跳完整訂單編輯）
          var hkEditor = oid
            ? '<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(181,171,160,0.12);">' +
                '<span style="font-size:10px;letter-spacing:0.12em;opacity:0.75;">房務備注</span>' +
                '<textarea data-hk-note-id="' + escapeHtml(oid) + '" rows="2" placeholder="留給房務的話…" ' +
                  'style="display:block;width:100%;margin-top:4px;padding:6px 8px;border:1px solid rgba(181,171,160,0.35);border-radius:6px;background:#fff;font-family:inherit;font-size:11px;color:var(--ink);resize:vertical;box-sizing:border-box;">' +
                  escapeHtml(hkNote) +
                '</textarea>' +
                '<button data-action="saveHkNote" data-order-id="' + escapeHtml(oid) + '" ' +
                  'style="margin-top:6px;padding:5px 14px;background:#a89684;color:#f8f5ef;border:none;border-radius:6px;font-size:10px;letter-spacing:0.12em;cursor:pointer;">儲存備注</button>' +
              '</div>'
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
            hkEditor +
            editBtn +
            '</div></div>'
          );
        })
        .join('')
    : '<div style="font-size:12px;color:var(--muted);padding:8px 0;text-align:center;">當日無訂單<br><span style="font-size:11px;opacity:0.7;">（房務備注需要訂單才能附加）</span></div>';
  popEl.classList.add('show');
  var bg = document.getElementById('bookingCalDayPopoverBackdrop');
  if (bg) bg.classList.add('show');
}
function closeBookingCalPopover() {
  var pop = document.getElementById('bookingCalDayPopover');
  if (pop) pop.classList.remove('show');
  var bg = document.getElementById('bookingCalDayPopoverBackdrop');
  if (bg) bg.classList.remove('show');
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
      <td class="px-3 py-4 text-right"><button type="button" data-action="viewOrder" data-order-id="${order.orderID}" class="text-stone-400 hover:text-stone-700 transition p-2 -mr-2 rounded-lg hover:bg-stone-100" title="查看詳情" aria-label="查看訂單詳情"><i class="fas fa-ellipsis-h text-sm"></i></button></td>
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
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">折後總價（實收）</label><input type="number" id="editTotalPrice" value="${order.totalPrice || 0}" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full"/></div>
        <div><label class="text-[10px] text-stone-400 tracking-wider block mb-2">已付訂金</label><input type="number" id="editPaidDeposit" value="${order.paidDeposit || 0}" min="0" class="!border !rounded-lg !px-3 !py-2 !bg-white w-full"/></div>
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
        <button id="copyLineAgreementBtn" data-action="copyLineAgreementMsg" data-order-id="${order.orderID}" data-name="${(order.name||'').replace(/"/g,'&quot;')}" data-check-in="${order.checkIn||''}" data-check-out="${order.checkOut||''}" style="background:rgba(181,171,160,0.15);border:1px solid rgba(181,171,160,0.35);border-radius:8px;padding:7px 14px;font-size:12px;letter-spacing:0.06em;cursor:pointer;color:#5B5247;width:100%;">
          📋 複製 LINE 確認訊息（含條款連結）
        </button>
      </div>` : ''}
      ${order.agreementSignedName ? `<div style="margin-top:10px;font-size:11.5px;color:rgba(90,80,70,0.6);letter-spacing:0.04em;">✅ 電子簽署：${order.agreementSignedName}${order.agreementSignedAt ? '　' + new Date(order.agreementSignedAt).toLocaleString('zh-TW') : ''}</div>` : `<div style="margin-top:10px;font-size:11.5px;color:rgba(184,121,90,0.7);letter-spacing:0.04em;">⚠️ 本筆未完成電子簽署（舊單或後台建立）</div>`}
    </div>
    <div class="flex gap-3 pt-4 border-t border-stone-100">
      <button id="orderSaveBtn" data-action="saveOrder" class="btn-primary flex-1">儲存變更</button>
      <button id="orderCancelBtn" data-action="closeModal" class="btn-outline">取消</button>
    </div>
  </div>`;
  document.getElementById('modalContent').innerHTML = content;
  // Wire up modal action buttons and inputs directly after injecting HTML
  var saveBtn = document.getElementById('orderSaveBtn');
  var cancelBtn = document.getElementById('orderCancelBtn');
  if (saveBtn) saveBtn.addEventListener('click', saveOrder);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  var totalPriceEl = document.getElementById('editTotalPrice');
  var paidDepositEl = document.getElementById('editPaidDeposit');
  if (totalPriceEl) totalPriceEl.addEventListener('input', recalcBalance);
  if (paidDepositEl) paidDepositEl.addEventListener('input', recalcBalance);
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
  // status→完成：前台同步清零尾款（款項已收訖）
  if (newStatus === '完成') updates.remainingBalance = 0;

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
// 「固定欄位」— 每月幾乎不變的項目，新月會從上次紀錄自動帶入
var _MONTHLY_FIXED_FIELDS = ['laundry', 'internet', 'platformFee'];

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
  // 隱藏 prefill 提示（每次開 modal 先收掉）
  var hintEl = document.getElementById('mePrefillHint');
  if (hintEl) hintEl.style.display = 'none';

  // 載入該月已存資料
  _nfyFetch('GET', '/api/admin/monthly-expense?yearMonth=' + ym)
    .then(function(res) {
      var map = { meLaundry:'laundry', meWater:'water', meElectricity:'electricity',
                  meInternet:'internet', mePlatformFee:'platformFee', meLandTax:'landTax',
                  meInsurance:'insurance', meOther:'other', meCarRentalRebate:'carRentalRebate' };

      if (res && res.success && res.expense) {
        // 該月已存 → 顯示已存值
        var e = res.expense;
        Object.keys(map).forEach(function(id) {
          var v = e[map[id]];
          document.getElementById(id).value = (v && v !== 0) ? v : '';
        });
        document.getElementById('meNote').value = e.note || '';
      } else {
        // 該月沒存過 → 從最近一筆抓「固定欄位」當範本 prefill
        _nfyFetch('GET', '/api/admin/monthly-expense/recent')
          .then(function(r2) {
            if (!r2 || !r2.success || !r2.expense) return;
            var t = r2.expense;
            var prefilled = [];
            var labels = { laundry: '毛巾清洗', internet: '通訊費', platformFee: '平台月費' };
            _MONTHLY_FIXED_FIELDS.forEach(function(f) {
              var v = t[f];
              if (v && v !== 0) {
                // 找對應 input id
                var inputId = Object.keys(map).find(function(k){ return map[k] === f; });
                if (inputId) {
                  document.getElementById(inputId).value = v;
                  prefilled.push(labels[f] + ' ' + Number(v).toLocaleString());
                }
              }
            });
            if (prefilled.length && hintEl) {
              hintEl.innerHTML = '✨ 已從上次紀錄（' + (t.yearMonth || '') + '）帶入固定費用：' + prefilled.join(' · ') + '<br><span style="opacity:0.7;">可改、不改就按儲存</span>';
              hintEl.style.display = 'block';
            }
          })
          .catch(function(){});
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
          (item[2] ? item[1] : 'NT$ ' + item[1].toLocaleString()) +
          (item[2] ? item[2] : '') +
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
          '"><div class="p-3 flex justify-between items-center cursor-pointer hover:bg-stone-50" data-action="toggleReportOrderDetail" data-order-id="' +
          escapeHtml(String(o.orderID || '')) +
          '"><span class="text-sm">' +
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
document.getElementById('freeWindowsModal').addEventListener('click', function (e) {
  if (e.target === this) closeFreeWindowsModal();
});
document.getElementById('openFreeWindowsBtn').addEventListener('click', function () {
  renderFreeWindows();
  _lockScroll();
  document.getElementById('freeWindowsModal').classList.add('active');
});
document.getElementById('closeFreeWindowsBtn').addEventListener('click', function () {
  closeFreeWindowsModal();
});
function closeFreeWindowsModal() {
  document.getElementById('freeWindowsModal').classList.remove('active');
  _unlockScroll();
}

// Replaced inline event handlers (CSP compliance)
document.getElementById('btnTopSettings').addEventListener('click', function() { toggleTopSettings(); });
document.getElementById('topMenuTabTools').addEventListener('click', function() { switchTab('tools'); toggleTopSettings(); });
document.getElementById('topMenuLogout').addEventListener('click', function() { adminLogout(); });

// ── 修改密碼 ──────────────────────────────────────────────────
(function() {
  var modal  = document.getElementById('adminChangePwModal');
  var notice = document.getElementById('adminCpNotice');

  document.getElementById('topMenuChangePw').addEventListener('click', function() {
    document.getElementById('adminCpCurrent').value = '';
    document.getElementById('adminCpNew').value = '';
    document.getElementById('adminCpConfirm').value = '';
    notice.textContent = '';
    modal.style.display = 'flex';
    toggleTopSettings(); // 關閉下拉選單
  });

  document.getElementById('adminCpClose').addEventListener('click', function() {
    modal.style.display = 'none';
  });

  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.style.display = 'none';
  });

  document.getElementById('adminCpSubmit').addEventListener('click', function() {
    var current = document.getElementById('adminCpCurrent').value;
    var newPw   = document.getElementById('adminCpNew').value;
    var confirm = document.getElementById('adminCpConfirm').value;
    if (!current)               { notice.textContent = '請輸入目前密碼'; return; }
    if (!newPw || newPw.length < 6) { notice.textContent = '新密碼至少 6 個字元'; return; }
    if (newPw !== confirm)      { notice.textContent = '兩次密碼不一致'; return; }
    notice.textContent = '';
    var btn = document.getElementById('adminCpSubmit');
    btn.disabled = true; btn.textContent = '更新中…';
    var token = sessionStorage.getItem('admin_key') || '';
    fetch('/api/drift/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ currentPassword: current, newPassword: newPw })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      btn.disabled = false; btn.textContent = '確認修改';
      if (!data.success) { notice.textContent = data.error || '更新失敗'; return; }
      notice.style.color = '#5a8a6a';
      notice.textContent = '✓ 密碼已更新';
      setTimeout(function() { modal.style.display = 'none'; notice.style.color = ''; }, 1500);
    })
    .catch(function() {
      btn.disabled = false; btn.textContent = '確認修改';
      notice.textContent = '連線失敗，請稍後再試';
    });
  });
})();
document.getElementById('overviewAddOrderBtn').addEventListener('click', function() { openAddModal(); });
document.getElementById('financeYear').addEventListener('change', function() { loadFinanceStats(); });
document.getElementById('financeMonth').addEventListener('change', function() { loadFinanceStats(); });
document.getElementById('financeRefreshBtn').addEventListener('click', function() { loadFinanceStats(); });
// 月固定支出 row → 整列點開 modal（取代舊「編輯」文字按鈕）
var monthlyExpenseToggleEl = document.getElementById('monthlyExpenseToggle');
if (monthlyExpenseToggleEl) monthlyExpenseToggleEl.addEventListener('click', function() { openMonthlyExpenseModal(); });
document.getElementById('openMonthlyExpenseBtn').addEventListener('click', function() { openMonthlyExpenseModal(); });
// 房務費用 row → 開 modal
var hkCostToggleEl = document.getElementById('hkCostToggle');
if (hkCostToggleEl) hkCostToggleEl.addEventListener('click', function() { openHkCostModal(); });
// 代辦行程費用 row → 開 modal
var addonCostToggleEl = document.getElementById('addonCostToggle');
if (addonCostToggleEl) addonCostToggleEl.addEventListener('click', function() { openAddonCostModal(); });

// 房務 modal — 關閉 / 換月份 / 結算 / 解除結算
var hkCloseBtn = document.getElementById('closeHkCostModalBtn');
if (hkCloseBtn) hkCloseBtn.addEventListener('click', closeHkCostModal);
var hkModalMonthEl = document.getElementById('hkModalMonth');
if (hkModalMonthEl) hkModalMonthEl.addEventListener('change', function() { loadHkCostModalContent(this.value); });
// 結算 / 解除結算 用事件委派（按鈕在 actions 區塊內動態插入）
var hkActionsEl = document.getElementById('hkModalActions');
if (hkActionsEl) {
  hkActionsEl.addEventListener('click', function(e) {
    var t = e.target;
    if (!t) return;
    if (t.id === 'hkSettleBtn2') {
      var m = t.dataset.month;
      if (!m) return;
      if (!confirm('確認對「' + m + '」進行月結？月結後本月所有清潔費與雜項不可修改（但可再點解除結算還原）。')) return;
      t.disabled = true; t.textContent = '結算中…';
      _nfyFetch('POST', '/api/hk/settle', { month: m })
        .then(function(d) {
          if (!d || !d.success) { alert('結算失敗：' + (d && d.error || '')); t.disabled = false; t.textContent = '結算此月'; return; }
          loadHkCostModalContent(m);
          loadFinanceStats();
        })
        .catch(function(err) { alert('失敗：' + err); t.disabled = false; });
    } else if (t.id === 'hkUnsettleBtn') {
      var m2 = t.dataset.month;
      if (!m2) return;
      if (!confirm('解除「' + m2 + '」的月結？解除後可以再編輯清潔費與雜項。')) return;
      t.disabled = true; t.textContent = '處理中…';
      _nfyFetch('POST', '/api/hk/unsettle', { month: m2 })
        .then(function(d) {
          if (!d || !d.success) { alert('解除失敗：' + (d && d.error || '')); t.disabled = false; t.textContent = '解除結算'; return; }
          loadHkCostModalContent(m2);
          loadFinanceStats();
        })
        .catch(function(err) { alert('失敗：' + err); t.disabled = false; });
    }
  });
}

// 代辦行程 modal — 關閉 / 換月份 / inline input save
var addonCloseBtn = document.getElementById('closeAddonCostModalBtn');
if (addonCloseBtn) addonCloseBtn.addEventListener('click', closeAddonCostModal);
var addonModalMonthEl = document.getElementById('addonModalMonth');
if (addonModalMonthEl) addonModalMonthEl.addEventListener('change', function() { loadAddonCostModalContent(this.value); });
// 代辦行程 inline input blur 自動儲存（事件綁在 modal content 上）
var addonModalContentEl = document.getElementById('addonModalContent');
if (addonModalContentEl) {
  addonModalContentEl.addEventListener('blur', function(e) {
    var t = e.target;
    if (!t || !t.dataset || !t.dataset.addonInputId) return;
    _addonSaveOne(t.dataset.addonInputId, t.value);
  }, true);
  addonModalContentEl.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;
    var t = e.target;
    if (!t || !t.dataset || !t.dataset.addonInputId) return;
    t.blur();
  });
}
document.getElementById('openDetailedReportBtn').addEventListener('click', function() { openDetailedReportModal(); });
document.getElementById('closeMonthlyExpenseXBtn').addEventListener('click', function() { closeMonthlyExpenseModal(); });
document.getElementById('submitMonthlyExpenseBtn').addEventListener('click', function() { submitMonthlyExpense(); });
document.getElementById('closeMonthlyExpenseCancelBtn').addEventListener('click', function() { closeMonthlyExpenseModal(); });
document.getElementById('closeBookingCalPopoverBtn').addEventListener('click', function() { closeBookingCalPopover(); });
// 點 backdrop 也關閉
var _bcdBackdrop = document.getElementById('bookingCalDayPopoverBackdrop');
if (_bcdBackdrop) _bcdBackdrop.addEventListener('click', function() { closeBookingCalPopover(); });
document.getElementById('filterStatus').addEventListener('change', function() { filterOrders(); });
document.getElementById('searchInput').addEventListener('input', function() { filterOrders(); });
// settings-section-headers: event delegation
document.querySelectorAll('.settings-section-header[data-section-toggle]').forEach(function(el) {
  el.addEventListener('click', function() { toggleSection(el.getAttribute('data-section-toggle')); });
});
document.getElementById('exportOrdersCsvBtn').addEventListener('click', function() { exportOrdersCsv(); });
document.getElementById('manualMarkCompletedBtn').addEventListener('click', function() { manualMarkCompleted(); });
document.getElementById('downloadBackupBtn').addEventListener('click', function() { downloadBackup(); });
document.getElementById('loadQuickCheckBtn').addEventListener('click', function() { loadQuickCheck(); });
document.getElementById('submitRecommendationRecordBtn').addEventListener('click', function() { submitRecommendationRecord(); });
document.getElementById('loadRecommendationRecordsBtn').addEventListener('click', function() { loadRecommendationRecords(); });
document.getElementById('agencyReviewRefreshBtn').addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); loadAgencyPendingList(); loadAgencyApprovedList(); });
document.getElementById('couponType').addEventListener('change', function() { updateCouponValueHint(); });
document.getElementById('saveCouponBtn').addEventListener('click', function() { saveCoupon(); });
document.getElementById('clearCouponFormBtn').addEventListener('click', function() { clearCouponForm(); });
document.getElementById('hkPrevMonthBtn').addEventListener('click', function() { hkPrevMonth(); });
document.getElementById('hkNextMonthBtn').addEventListener('click', function() { hkNextMonth(); });
document.getElementById('agencyQueryAgency').addEventListener('change', function() { onAgencyFilterChange(); });
document.getElementById('loadAllAgencyDataBtn').addEventListener('click', function() { loadAllAgencyData(); });
document.getElementById('closeAgencyDayPopoverBtn').addEventListener('click', function() { closeAgencyDayPopover(); });
document.getElementById('closeAddModalXBtn').addEventListener('click', function() { closeAddModal(); });
document.getElementById('submitAddOrderBtn').addEventListener('click', function() { submitAddOrder(); });
document.getElementById('closeAddModalCancelBtn').addEventListener('click', function() { closeAddModal(); });
document.getElementById('addCheckIn').addEventListener('change', function() { updateAddOrderTotalHint(); });
document.getElementById('addCheckOut').addEventListener('change', function() { updateAddOrderTotalHint(); });
document.getElementById('addRooms').addEventListener('change', function() { updateAddOrderTotalHint(); });
document.getElementById('addExtraBeds').addEventListener('change', function() { updateAddOrderTotalHint(); });
// admin-tab bar: event delegation via data-tab attribute
document.querySelectorAll('.admin-tab[data-tab]').forEach(function(btn) {
  btn.addEventListener('click', function() { switchTab(btn.getAttribute('data-tab')); });
});
document.getElementById('closeOrderModalBtn').addEventListener('click', function() { closeModal(); });
document.getElementById('closeDetailedReportXBtn').addEventListener('click', function() { closeDetailedReportModal(); });
document.getElementById('queryDetailedReportBtn').addEventListener('click', function() { queryDetailedReport(); });
document.getElementById('downloadReportCsvBtn').addEventListener('click', function() { downloadReportCsv(); });
// 完整帳目 modal：年份 / 月份選單改變時自動重新查詢
document.getElementById('reportYear').addEventListener('change', function() { queryDetailedReport(); });
document.getElementById('reportMonth').addEventListener('change', function() { queryDetailedReport(); });

// ── 重設密碼功能（同業管理）────────────────────────────────────
function agencyResetPassword(loginId) {
  if (!loginId || !confirm('確定重設「' + loginId + '」的密碼為 123456？')) return;
  _nfyFetch('PATCH', '/api/admin/agency/' + encodeURIComponent(loginId) + '/approve')
    .then(function(data) {
      if (data && data.success) {
        alert('密碼已重設為 123456，對方下次登入時需修改密碼。');
      } else {
        alert('重設失敗：' + ((data && data.error) || '未知錯誤'));
      }
    })
    .catch(function() { alert('連線失敗'); });
}

// ── 事件委派（取代所有動態 onclick 屬性，CSP 合規）────────────

// 總覽 upcoming 列表：點擊開啟訂單
var overviewUpcoming = document.getElementById('overviewUpcoming');
if (overviewUpcoming) {
  overviewUpcoming.addEventListener('click', function(e) {
    var item = e.target.closest('[data-action="viewOrder"]');
    if (!item) return;
    viewOrder(item.dataset.orderId);
  });
}

// 房務費用小卡：點擊跳財務 tab 並選當月
// 折扣碼列表：編輯按鈕
var couponListWrap = document.getElementById('couponListWrap');
if (couponListWrap) {
  couponListWrap.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action="editCoupon"]');
    if (!btn) return;
    try { editCoupon(JSON.parse(btn.dataset.params)); } catch(ex) { console.error(ex); }
  });
}

// 同業待審清單：核准 / 拒絕 / 刪除
var agencyPendingListWrap = document.getElementById('agencyPendingListWrap');
if (agencyPendingListWrap) {
  agencyPendingListWrap.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var lid = btn.dataset.lid;
    var eid = btn.dataset.eid;
    if (action === 'agencyApproveOne') agencyApproveOne(lid, eid);
    else if (action === 'agencyRejectOne') agencyRejectOne(lid, eid);
    else if (action === 'agencyDeleteOne') agencyDeleteOne(lid, eid);
  });
}

// 同業已核准清單：可見夥伴 / 重設密碼 / 刪除
var agencyApprovedListWrap = document.getElementById('agencyApprovedListWrap');
if (agencyApprovedListWrap) {
  agencyApprovedListWrap.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    var lid = btn.dataset.lid;
    var eid = btn.dataset.eid;
    if (action === 'openVpModal') openVpModal(lid);
    else if (action === 'agencyResetPassword') agencyResetPassword(lid);
    else if (action === 'agencyDeleteApprovedRow') agencyDeleteApprovedRow(lid, eid);
  });
}

// 群組成員：移除 / 加入
var agencyGroupListWrap = document.getElementById('agencyGroupListWrap');
if (agencyGroupListWrap) {
  agencyGroupListWrap.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    if (action === 'removeGroupMember') {
      removeGroupMember(btn.dataset.groupId, btn.dataset.agencyId2);
    } else if (action === 'addGroupMember') {
      addGroupMember(btn.dataset.groupId);
    }
  });
}

// 同業日曆：上個月 / 下個月 / 日期格點擊
var agencyCalendarWrap = document.getElementById('agencyCalendarWrap');
if (agencyCalendarWrap) {
  agencyCalendarWrap.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;
    if (action === 'agencyCalPrev') {
      _agencyCalMonth--;
      if (_agencyCalMonth < 0) { _agencyCalMonth = 11; _agencyCalYear--; }
      renderAgencyCalendar();
    } else if (action === 'agencyCalNext') {
      _agencyCalMonth++;
      if (_agencyCalMonth > 11) { _agencyCalMonth = 0; _agencyCalYear++; }
      renderAgencyCalendar();
    } else if (action === 'showAgencyDayDetail') {
      showAgencyDayDetail(btn.dataset.date);
    }
  });
}

// 訂單分頁
var orderPagination = document.getElementById('orderPagination');
if (orderPagination) {
  orderPagination.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action="changePage"]');
    if (!btn) return;
    _changePage(parseInt(btn.dataset.page, 10));
  });
}

// 主訂單日曆格點擊
var bookingCalGrid = document.getElementById('bookingCalGrid');
if (bookingCalGrid) {
  bookingCalGrid.addEventListener('click', function(e) {
    var cell = e.target.closest('[data-action="showBookingDayInfo"]');
    if (!cell) return;
    showBookingDayInfo(cell.dataset.date);
  });
}

// 房務日曆：沿用訂單 popover，讓三個日曆操作一致
var hkCalGrid = document.getElementById('hkCalGrid');
if (hkCalGrid) {
  hkCalGrid.addEventListener('click', function(e) {
    var cell = e.target.closest('[data-action="showBookingDayInfo"]');
    if (!cell) return;
    showBookingDayInfo(cell.dataset.date);
  });
}

// 日曆 popover 內「編輯訂單」按鈕（closePopover + viewOrder）+ 房務備注 inline 儲存
var bookingCalDayPopover = document.getElementById('bookingCalDayPopover');
if (bookingCalDayPopover) {
  bookingCalDayPopover.addEventListener('click', function(e) {
    // 編輯訂單
    var viewBtn = e.target.closest('[data-action="calPopoverViewOrder"]');
    if (viewBtn) {
      closeBookingCalPopover();
      viewOrder(viewBtn.dataset.orderId);
      return;
    }
    // 儲存房務備注（PATCH /api/orders/:id）
    var saveBtn = e.target.closest('[data-action="saveHkNote"]');
    if (saveBtn) {
      var oid = saveBtn.dataset.orderId;
      var ta = bookingCalDayPopover.querySelector('textarea[data-hk-note-id="' + oid + '"]');
      if (!ta) return;
      var note = ta.value;
      saveBtn.disabled = true;
      var originalText = saveBtn.textContent;
      saveBtn.textContent = '儲存中…';
      _nfyFetch('PATCH', '/api/orders/' + encodeURIComponent(oid), { housekeepingNote: note })
        .then(function() {
          saveBtn.textContent = '✓ 已存';
          // 同步本機快取，下次再開 popover 就是新值
          allOrders.forEach(function(o) { if (String(o.orderID) === String(oid)) o.housekeepingNote = note; });
          Object.keys(hkCache).forEach(function(mk) {
            (hkCache[mk] || []).forEach(function(o) { if (String(o.orderID) === String(oid)) o.housekeepingNote = note; });
          });
          setTimeout(function() {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
          }, 1200);
        })
        .catch(function(err) {
          saveBtn.textContent = '✕ 失敗';
          console.error('saveHkNote failed', err);
          setTimeout(function() {
            saveBtn.textContent = originalText;
            saveBtn.disabled = false;
          }, 1600);
        });
    }
  });
}

// 訂單表格：查看詳情按鈕
var orderTableBody = document.getElementById('orderTableBody');
if (orderTableBody) {
  orderTableBody.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action="viewOrder"]');
    if (!btn) return;
    viewOrder(btn.dataset.orderId);
  });
}

// 訂單 Modal 內容（modalContent）：複製 LINE 訊息按鈕
var modalContent = document.getElementById('modalContent');
if (modalContent) {
  modalContent.addEventListener('click', function(e) {
    var btn = e.target.closest('[data-action="copyLineAgreementMsg"]');
    if (!btn) return;
    _copyLineAgreementMsg(btn.dataset.orderId, btn.dataset.name, btn.dataset.checkIn, btn.dataset.checkOut);
  });
}

// 財務報表明細：展開/收合訂單列
var detailedReportContent = document.getElementById('detailedReportContent');
if (detailedReportContent) {
  detailedReportContent.addEventListener('click', function(e) {
    var row = e.target.closest('[data-action="toggleReportOrderDetail"]');
    if (!row) return;
    toggleReportOrderDetail(row.dataset.orderId);
  });
}

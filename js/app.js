window.FRONTEND_CONFIG =
  window.FRONTEND_CONFIG || (typeof FRONTEND_CONFIG !== 'undefined' ? FRONTEND_CONFIG : {});
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', function () {
  navbar.classList.toggle('scrolled-up', window.scrollY > 50);
});

// 花火節 badge：手機版只在 hero 段可見
(function () {
  var badge = document.getElementById('promoBadge');
  var hero = document.querySelector('.hero');
  if (!badge || !hero) return;
  if (window.innerWidth <= 768) {
    var obs = new IntersectionObserver(
      function (entries) {
        badge.classList.toggle('badge-visible', entries[0].isIntersecting);
      },
      { threshold: 0.3 }
    );
    obs.observe(hero);
  }
})();

// 手機版漢堡選單
var hamburger = document.getElementById('navHamburger');
var navLinksEl = document.querySelector('.nav-links');
if (hamburger && navLinksEl) {
  hamburger.addEventListener('click', function () {
    hamburger.classList.toggle('open');
    navLinksEl.classList.toggle('open');
  });
  document.querySelectorAll('.nav-link').forEach(function (link) {
    link.addEventListener('click', function () {
      hamburger.classList.remove('open');
      navLinksEl.classList.remove('open');
    });
  });
  var navClose = document.getElementById('navClose');
  if (navClose) {
    navClose.addEventListener('click', function () {
      hamburger.classList.remove('open');
      navLinksEl.classList.remove('open');
    });
  }
}

function showToast(message) {
  var toast = document.getElementById('toastMessage');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(function () {
    toast.classList.remove('show');
  }, 3000);
}

var observer = new IntersectionObserver(
  function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  },
  {
    threshold: 0.05,
    rootMargin: '0px 0px -5% 0px',
  }
);
document.querySelectorAll('.fade-up').forEach(function (el) {
  observer.observe(el);
});

// === 日曆與價格試算 ===
var BOOKING_YEAR = new Date().getFullYear();

function toastCrossYearLine_() {
  showToast(
    '線上僅開放預訂' +
      BOOKING_YEAR +
      ' 年度。如需跨年度或其他檔期，請透過 LINE（@dropinn）與我們聯絡。'
  );
}

var calendar = document.getElementById('calendar');
var currentMonth = new Date().getMonth(); // 0-11
var currentYear = new Date().getFullYear();
var selStart = null;
var selEnd = null;
var bookedDates    = [];
var boundaryDates  = []; // 每筆訂單的 checkIn 日：可作退房終點，不可作入住起點
var _currentStep = 1;

// 基礎房價（每晚，以後台為準）
var basePrices = {
  3: 10800, // 3 間 / 6 人
  4: 12800, // 4 間 / 8 人
  5: 14800, // 5 間 / 10 人
};

// 在「空下來的日子」區塊上方加入月份切換
var bookingSection = document.getElementById('booking');
var calendarWrapper = document.querySelector('#booking .cal-wrapper') || calendar.parentNode;
// 月份名稱（大字）
var calMonthTitle = document.createElement('div');
calMonthTitle.className = 'cal-month-title';
calMonthTitle.innerHTML = '<span class="month-main" id="calMonthMain">—</span>';
calendarWrapper.insertBefore(calMonthTitle, calendarWrapper.firstChild);

// 箭頭列（← 月份名 →，不含年份）
var calNavBar = document.createElement('div');
calNavBar.className = 'cal-nav';
calNavBar.innerHTML =
  '<div class="nav-empty"></div>' +
  '<button type="button" class="nav-arrow" id="calPrevBtn" aria-label="上一個月">←</button>' +
  '<div class="nav-spacer"></div>' +
  '<button type="button" class="nav-arrow" id="calNextBtn" aria-label="下一個月">→</button>' +
  '<div class="nav-empty"></div>';
calendarWrapper.insertBefore(calNavBar, calMonthTitle.nextSibling);

// 年份（小字，獨立一行）
var calYearRow = document.createElement('div');
calYearRow.className = 'cal-year-row';
calYearRow.innerHTML = '<span class="month-year" id="calYear">—</span>';
calendarWrapper.insertBefore(calYearRow, calNavBar.nextSibling);

// coupon preview: 在 Step 3 couponCode 輸入時觸發
document.getElementById('bookStep3').addEventListener('input', function (e) {
  if (e.target && e.target.id === 'couponCode') scheduleCouponPricePreview();
});

// 從公開 API 取得已被預訂／暫保留的日期
// 策略：先從 sessionStorage 快速渲染，再背景更新（避免使用者看到空白等待）
var BOOKED_CACHE_KEY = 'dropinn_booked_v4';
var BOOKED_CACHE_TTL = 8 * 60 * 1000; // 8 分鐘

function _saveBookedCache(data) {
  try {
    sessionStorage.setItem(BOOKED_CACHE_KEY, JSON.stringify({
      ts: Date.now(),
      booked:     data.booked,
      boundaries: data.boundaries || [],
    }));
  } catch (e) {}
}
function _loadBookedCache() {
  try {
    var raw = sessionStorage.getItem(BOOKED_CACHE_KEY);
    if (!raw) return null;
    var c = JSON.parse(raw);
    if (Date.now() - c.ts > BOOKED_CACHE_TTL) return null;
    return c;
  } catch (e) { return null; }
}

function _applyBookedData(data) {
  bookedDates   = Array.isArray(data.booked)     ? data.booked     : [];
  boundaryDates = Array.isArray(data.boundaries) ? data.boundaries : [];
}

function fetchBookedDates(silent) {
  var cached = _loadBookedCache();
  if (cached) {
    _applyBookedData(cached);
    renderCalendar();
    fetch('/api/booking/dates')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        _saveBookedCache(data);
        _applyBookedData(data);
        renderCalendar();
      })
      .catch(function () {});
    return;
  }

  if (!silent) calendarWrapper.classList.add('cal-loading');

  fetch('/api/booking/dates')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      _saveBookedCache(data);
      _applyBookedData(data);
      renderCalendar();
    })
    .catch(function () {})
    .finally(function () {
      calendarWrapper.classList.remove('cal-loading');
    });
}

var todayYear = new Date().getFullYear();
var todayMonth = new Date().getMonth();

document.getElementById('calPrevBtn').addEventListener('click', function () {
  var prevM = currentMonth - 1;
  var prevY = currentYear;
  if (prevM < 0) {
    prevM = 11;
    prevY--;
  }
  // 不允許回到今日所在月份之前
  if (prevY < todayYear || (prevY === todayYear && prevM < todayMonth)) return;
  currentMonth = prevM;
  currentYear = prevY;
  renderCalendar();
  updatePriceInfo();
  updateBookingBar();
});

document.getElementById('calNextBtn').addEventListener('click', function () {
  var nextM = currentMonth + 1;
  var nextY = currentYear;
  if (nextM > 11) {
    nextM = 0;
    nextY++;
  }
  // 只允許預訂當年度（線上）
  if (nextY > BOOKING_YEAR) {
    toastCrossYearLine_();
    return;
  }
  currentMonth = nextM;
  currentYear = nextY;
  renderCalendar();
  updatePriceInfo();
  updateBookingBar();
});

function renderCalendar() {
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
  var calMonthMain = document.getElementById('calMonthMain');
  var calYearEl = document.getElementById('calYear');
  if (calMonthMain) calMonthMain.textContent = monthNames[currentMonth];
  if (calYearEl) calYearEl.textContent = String(currentYear);

  calendar.innerHTML = '';

  ['日', '一', '二', '三', '四', '五', '六'].forEach(function (d, idx) {
    var el = document.createElement('div');
    el.className = 'cal-day header' + (idx === 0 || idx === 6 ? ' weekend' : '');
    el.textContent = d;
    calendar.appendChild(el);
  });

  var first = new Date(currentYear, currentMonth, 1);
  var last = new Date(currentYear, currentMonth + 1, 0);
  var startDay = first.getDay();
  var days = last.getDate();

  for (var i = 0; i < startDay; i++) {
    var empty = document.createElement('div');
    empty.className = 'cal-day header';
    calendar.appendChild(empty);
  }

  var todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  for (var d = 1; d <= days; d++) {
    var el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = d;
    el.dataset.date =
      currentYear +
      '-' +
      String(currentMonth + 1).padStart(2, '0') +
      '-' +
      String(d).padStart(2, '0');

    var thisDay = new Date(currentYear, currentMonth, d);
    var isPast = thisDay < todayMidnight;
    var outsideBookingYear = thisDay.getFullYear() !== BOOKING_YEAR;

    if (isPast || outsideBookingYear) {
      el.classList.add('is-past');
    } else if (bookedDates.indexOf(el.dataset.date) !== -1) {
      // 訂單內部日期：完全封鎖，不可點擊
      el.classList.add('booked');
    } else if (boundaryDates.indexOf(el.dataset.date) !== -1) {
      // 下一組客人的入住日：可作退房終點，不可作入住起點
      el.classList.add('is-boundary');
      el.addEventListener('click', onBoundaryDayClick);
    } else {
      el.addEventListener('click', onDayClick);
    }
    calendar.appendChild(el);
  }

  highlightSelectedRange();
}

// 退房邊界日點擊（下一組客人 checkIn）：可作退房終點，不可作入住起點
function onBoundaryDayClick(e) {
  var clickedDate = parseDateStr(e.currentTarget.dataset.date);
  if (!selStart) {
    // 尚未選入住起點：提示不能從這天入住
    showToast('此日為下一組客人入住日，無法作為入住起點，請選擇更早的日期入住。');
    return;
  }
  if (clickedDate <= selStart) return;
  var diff = (clickedDate - selStart) / (1000 * 60 * 60 * 24);
  if (diff < 2) {
    showToast('雫旅為兩晚起住，請選擇至少兩晚的日期。');
    return;
  }
  selEnd = clickedDate;
  highlightSelectedRange();
  updatePriceInfo();
  updateBookingBar();
  checkAvailability(selStart, selEnd);
}

function onDayClick(e) {
  var t = e.currentTarget;
  var dateStr = t.dataset.date;
  var clickedDate = parseDateStr(dateStr);

  if (clickedDate.getFullYear() !== BOOKING_YEAR) {
    toastCrossYearLine_();
    return;
  }

  // 沒有任何選取：第一下 = 住進來那天
  if (!selStart && !selEnd) {
    selStart = clickedDate;
    selEnd = null;
  } else if (selStart && !selEnd) {
    // 只選了一天：第二下決定區間
    if (clickedDate.getTime() === selStart.getTime()) {
      // 點同一天 = 取消選取
      selStart = null;
      selEnd = null;
    } else if (clickedDate > selStart) {
      // 至少需入住兩晚（checkout 至少比 checkin 晚 2 天）
      var diff = (clickedDate - selStart) / (1000 * 60 * 60 * 24);
      if (diff < 2) {
        showToast('雫旅為兩晚起住，請選擇至少兩晚的日期。');
      } else {
        selEnd = clickedDate;
      }
    } else {
      // 第二天比第一天早 → 視為重新選開始日
      selStart = clickedDate;
      selEnd = null;
    }
  } else {
    // 已經有一段區間：重新從這一天開始
    selStart = clickedDate;
    selEnd = null;
  }

  highlightSelectedRange();
  updatePriceInfo();
  updateBookingBar();

  // 若已選出一段至少兩晚的區間，靜默驗證
  var nights = countNights();
  if (selStart && selEnd && nights >= 2) {
    checkAvailability(selStart, selEnd);
  }
}

// 退房專用：每段 booked block 的第一天可被點選為退房日
// （不需要先選入住日才能顯示，國際標準日曆行為）

function checkAvailability(startDate, endDate) {
  function toDateStr(d) {
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  var checkIn = toDateStr(startDate);
  var checkOut = toDateStr(endDate);

  fetch('/api/booking/availability?checkIn=' + checkIn + '&checkOut=' + checkOut)
    .then(function (res) {
      return res.json();
    })
    .then(function (data) {
      if (data.available === false) {
        showToast('所選日期已被預訂，請重新選擇');
        selStart = null;
        selEnd = null;
        highlightSelectedRange();
        updatePriceInfo();
        updateBookingBar();
      }
    })
    .catch(function () {
      // 靜默失敗：不影響使用者操作
    });
}

function highlightSelectedRange() {
  document.querySelectorAll('.cal-day.selected').forEach(function (n) {
    n.classList.remove('selected');
  });

  if (!selStart) return;

  var cells = calendar.querySelectorAll('.cal-day:not(.header)');
  cells.forEach(function (cell) {
    var d = parseDateStr(cell.dataset.date);
    d.setHours(0, 0, 0, 0);
    if (selEnd) {
      if (d >= selStart && d <= selEnd) {
        cell.classList.add('selected');
      }
    } else {
      if (d.getTime() === selStart.getTime()) {
        cell.classList.add('selected');
      }
    }
  });
}

// Safari 對 'YYYY-MM-DD' 的解析不一致，改成手動切割
function parseDateStr(str) {
  var parts = str.split('-');
  var y = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10) - 1;
  var d = parseInt(parts[2], 10);
  return new Date(y, m, d);
}

function countNights() {
  if (!selStart || !selEnd) return 0;
  var start = new Date(selStart);
  var end = new Date(selEnd);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  var diff = (end - start) / (1000 * 60 * 60 * 24);
  return diff > 0 ? diff : 0;
}

function fmtDate(d) {
  return d.getMonth() + 1 + ' / ' + d.getDate();
}

function updateBookingBar() {
  var bar = document.getElementById('booking-bar');
  var nights = countNights();
  // 只在 Step 1 顯示底部 bar
  if (_currentStep !== 1) {
    bar.classList.remove('visible');
    bar.setAttribute('aria-hidden', 'true');
    return;
  }
  if (selStart && !selEnd) {
    document.getElementById('bar-checkin').textContent = fmtDate(selStart);
    document.getElementById('bar-checkout').textContent = '選退房日';
    document.getElementById('bar-nights').textContent = '—';
    bar.classList.add('visible');
    bar.setAttribute('aria-hidden', 'false');
  } else if (selStart && selEnd && nights >= 2) {
    document.getElementById('bar-checkin').textContent = fmtDate(selStart);
    document.getElementById('bar-checkout').textContent = fmtDate(selEnd);
    document.getElementById('bar-nights').textContent = nights + ' 晚';
    bar.classList.add('visible');
    bar.setAttribute('aria-hidden', 'false');
  } else {
    bar.classList.remove('visible');
    bar.setAttribute('aria-hidden', 'true');
  }
}

/* ── Step 進度指引更新 ──────────────────────────────────────────── */
function updateStepIndicator(n) {
  var si = document.getElementById('stepIndicator');
  if (!si) return;
  si.classList.toggle('hidden', n === 4);
  si.querySelectorAll('.step-dot').forEach(function (d) {
    var s = parseInt(d.dataset.step);
    d.classList.remove('active', 'done');
    if (s < n) d.classList.add('done');
    else if (s === n) d.classList.add('active');
  });
  var c1 = document.getElementById('stepConn1');
  var c2 = document.getElementById('stepConn2');
  if (c1) c1.classList.toggle('done', n >= 2);
  if (c2) c2.classList.toggle('done', n >= 3);
}

/* ── Step 導航 ────────────────────────────────────────────────── */
function goToStep(n) {
  if (n === 2 && (!selStart || !selEnd || countNights() < 2)) {
    showToast('請先在日曆選擇入住與退房日期（最少 2 晚）。');
    return;
  }
  _currentStep = n;
  document.getElementById('bookStep2').style.display = (n === 2) ? '' : 'none';
  document.getElementById('bookStep3').style.display = (n === 3) ? '' : 'none';
  document.getElementById('bookStepSuccess').style.display = (n === 4) ? '' : 'none';

  if (n === 2) {
    // 更新日期摘要 & 計算價格
    var nights = countNights();
    var d2 = document.getElementById('step2DateText');
    if (d2) d2.textContent = fmtDate(selStart) + ' → ' + fmtDate(selEnd) + '　' + nights + ' 晚';
    updatePriceInfo();
    // 滾到 Step 2 面板
    setTimeout(function () {
      var el = document.getElementById('bookStep2');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }
  if (n === 3) {
    // 更新 Step 3 摘要
    var b = getBookingPriceBreakdown();
    var s3 = document.getElementById('step3Summary');
    if (s3 && b) {
      var roomsLabel = { 3: '3 間房 · 6 人', 4: '4 間房 · 8 人', 5: '5 間房 · 10 人' };
      var extraLabel = b.extraBeds > 0 ? ' + 加床 ×' + b.extraBeds : '';
      s3.innerHTML =
        fmtDate(selStart) + ' → ' + fmtDate(selEnd) + '　' + b.nights + ' 晚<br>' +
        (roomsLabel[b.roomValue] || b.roomValue + ' 間房') + extraLabel +
        '<br><small style="font-size:12px;color:var(--muted)">預估 NT$ ' + b.originalTotal.toLocaleString() + '（含稅）</small>';
    }
    setTimeout(function () {
      var el = document.getElementById('bookStep3');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }
  updateStepIndicator(n);
  updateBookingBar();
}

function clearBookingSelection() {
  selStart = null;
  selEnd = null;
  _currentStep = 1;
  document.getElementById('bookStep2').style.display = 'none';
  document.getElementById('bookStep3').style.display = 'none';
  document.getElementById('bookStepSuccess').style.display = 'none';
  highlightSelectedRange();
  updatePriceInfo();
  updateBookingBar();
}

function getBookingPriceBreakdown() {
  if (!selStart || !selEnd) return null;
  var nights = countNights();
  if (nights === 0) return null;
  var roomsRadio = document.querySelector('input[name="rooms"]:checked');
  if (!roomsRadio) return null;
  var roomValue = roomsRadio.value;
  var basePrice = basePrices[roomValue];
  if (basePrice == null) return null;
  var extraBedRadio = document.querySelector('input[name="extraBeds"]:checked');
  var extraBeds = extraBedRadio ? parseInt(extraBedRadio.value, 10) : 0;
  var extraBedUnit = 1000;
  var originalTotal = (basePrice + extraBeds * extraBedUnit) * nights;
  return {
    nights: nights,
    roomValue: roomValue,
    extraBeds: extraBeds,
    basePrice: basePrice,
    originalTotal: originalTotal,
  };
}

var couponPreviewTimer = null;
var couponPreviewSeq = 0;

function renderPriceInfoLine(b, discountAmount) {
  var info = document.getElementById('priceInfo');
  if (!info) return;

  var rowOriginal   = document.getElementById('priceRowOriginal');
  var rowDiscount   = document.getElementById('priceRowDiscount');
  var rowNight      = document.getElementById('priceRowNight');
  var priceOriginal = document.getElementById('priceOriginal');
  var priceDiscount = document.getElementById('priceDiscount');
  var priceNightLbl = document.getElementById('priceNightLabel');

  if (!b) {
    info.textContent = '—';
    if (rowOriginal) rowOriginal.style.display = 'none';
    if (rowDiscount) rowDiscount.style.display = 'none';
    if (rowNight)    rowNight.style.display    = 'none';
    return;
  }

  var disc  = Math.max(0, discountAmount | 0);
  var total = Math.max(0, b.originalTotal - disc);

  if (disc > 0) {
    if (rowOriginal) rowOriginal.style.display = '';
    if (rowDiscount) rowDiscount.style.display = '';
    if (priceOriginal) priceOriginal.textContent = 'NT$ ' + b.originalTotal.toLocaleString();
    if (priceDiscount) priceDiscount.textContent = '− NT$ ' + disc.toLocaleString();
  } else {
    if (rowOriginal) rowOriginal.style.display = 'none';
    if (rowDiscount) rowDiscount.style.display = 'none';
  }

  info.textContent = 'NT$ ' + total.toLocaleString();

  if (rowNight && priceNightLbl && b.nights > 0) {
    rowNight.style.display = '';
    priceNightLbl.textContent =
      'NT$ ' + Math.round(total / b.nights).toLocaleString() + ' ／晚 × ' + b.nights + ' 晚';
  } else if (rowNight) {
    rowNight.style.display = 'none';
  }
}

function scheduleCouponPricePreview() {
  clearTimeout(couponPreviewTimer);
  couponPreviewTimer = setTimeout(fetchCouponPreviewForPrice, 400);
}

function fetchCouponPreviewForPrice() {
  var b = getBookingPriceBreakdown();
  var couponEl = document.getElementById('couponCode');
  var code = couponEl ? couponEl.value.trim() : '';
  if (!b || !code) {
    if (b) renderPriceInfoLine(b, 0);
    return;
  }
  var seq = ++couponPreviewSeq;
  var info = document.getElementById('priceInfo');
  if (info) info.textContent = '試算中…';
  fetch('/api/booking/coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: code,
      originalTotal: b.originalTotal,
      nights: b.nights,
    }),
  })
    .then(function (res) {
      return res.json();
    })
    .then(function (cr) {
      if (seq !== couponPreviewSeq) return;
      var b2 = getBookingPriceBreakdown();
      var c2 = document.getElementById('couponCode');
      var code2 = c2 ? c2.value.trim() : '';
      if (!b2 || code2 !== code) return;
      if (cr && cr.valid === true) {
        renderPriceInfoLine(b2, cr.discountAmount);
      } else {
        renderPriceInfoLine(b2, 0);
      }
    })
    .catch(function () {
      if (seq !== couponPreviewSeq) return;
      var b2 = getBookingPriceBreakdown();
      var c2 = document.getElementById('couponCode');
      if (!b2 || !c2 || !c2.value.trim()) return;
      renderPriceInfoLine(b2, 0);
    });
}

function updatePriceInfo() {
  var b = getBookingPriceBreakdown();
  if (!b) {
    renderPriceInfoLine(null, 0);
    return;
  }
  var couponEl = document.getElementById('couponCode');
  var code = couponEl ? couponEl.value.trim() : '';
  if (code) {
    scheduleCouponPricePreview();
  } else {
    renderPriceInfoLine(b, 0);
  }
}

document.querySelectorAll('input[name="rooms"]').forEach(function (radio) {
  radio.addEventListener('change', updatePriceInfo);
});
document.querySelectorAll('input[name="extraBeds"]').forEach(function (radio) {
  radio.addEventListener('change', updatePriceInfo);
});

renderCalendar();
fetchBookedDates();

function _updateSubmitBtn() {
  var checked = document.getElementById('agreementCheck').checked;
  var btn = document.getElementById('btnSubmit');
  if (btn) {
    btn.disabled = !checked;
    btn.style.opacity = checked ? '' : '0.45';
  }
}

function submitBooking() {
  var name = document.getElementById('guestName').value.trim();
  var phone = document.getElementById('guestPhone').value.trim();
  if (!name || !phone) {
    showToast('請填寫姓名與聯絡電話哦！');
    return;
  }
  var agreed = document.getElementById('agreementCheck').checked;
  if (!agreed) {
    showToast('請勾選同意住宿約定後再送出');
    return;
  }
  // 自動以訂房人姓名作為電子簽署
  var sigName = name;
  document.getElementById('agreementName').value = sigName;
  var nights = countNights();
  if (!selStart || !selEnd || nights === 0) {
    showToast('請先在日曆選擇入住與退房日期。');
    return;
  }

  if (selStart.getFullYear() !== BOOKING_YEAR || selEnd.getFullYear() !== BOOKING_YEAR) {
    toastCrossYearLine_();
    return;
  }

  // 1. 最低晚數驗證
  if (nights < 2) {
    showToast('最少需預訂 2 晚');
    return;
  }

  // 2. 日期重疊驗證
  var checkDates = [];
  var cur = new Date(selStart);
  var endD = new Date(selEnd);
  cur.setHours(0, 0, 0, 0);
  endD.setHours(0, 0, 0, 0);
  while (cur < endD) {
    var ds =
      cur.getFullYear() +
      '-' +
      String(cur.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(cur.getDate()).padStart(2, '0');
    checkDates.push(ds);
    cur.setDate(cur.getDate() + 1);
  }
  var hasConflict = checkDates.some(function (d) {
    // 同時檢查訂單內部日 & boundary 日（下一組客人 checkIn 落在區間中間）
    return bookedDates.indexOf(d) !== -1 || boundaryDates.indexOf(d) !== -1;
  });
  if (hasConflict) {
    showToast('所選日期包含已被預訂的日期，請重新選擇');
    return;
  }

  // 3. 收集表單資料
  var emailEl = document.getElementById('guestEmail');
  var email = emailEl ? emailEl.value.trim() : '';
  var roomValue = parseInt(document.querySelector('input[name="rooms"]:checked').value);
  var packagePrice = basePrices[roomValue] || 10800;
  var extraBedsEl = document.querySelector('input[name="extraBeds"]:checked');
  var extraBeds = extraBedsEl ? parseInt(extraBedsEl.value) : 0;
  var extraBedPrice = 1000;
  var couponEl = document.getElementById('couponCode');
  var discountCode = couponEl ? couponEl.value.trim() : '';
  var originalTotal = packagePrice * nights + extraBeds * extraBedPrice * nights;
  var noteEl = document.getElementById('guestNote');
  var notes = noteEl ? String(noteEl.value || '').trim() : '';
  if (notes.length > 500) {
    showToast('備註請勿超過 500 字');
    return;
  }

  function toDateStr(d) {
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  var payload = {
    name: name,
    phone: phone,
    email: email,
    checkIn: toDateStr(selStart),
    checkOut: toDateStr(selEnd),
    rooms: roomValue,
    nights: nights,
    packagePrice: packagePrice,
    extraBedPrice: extraBedPrice,
    extraBeds: extraBeds,
    originalTotal: originalTotal,
    totalPrice: originalTotal,
    discountCode: discountCode,
    discountAmount: 0,
    paidDeposit: 0,
    remainingBalance: originalTotal,
    status: '洽談中',
    notes: notes,
    agreementSignedName: sigName,
    agreementSignedAt: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  };

  var btn = document.getElementById('btnSubmit');

  function restoreSubmitBtn() {
    if (btn) {
      btn.textContent = '確認送出預約';
      btn.disabled = false;
      btn.style.opacity = '';
    }
  }

  // 4. 優惠碼試算（與伺服器一致）
  function runRecaptchaAndSubmit() {
    if (btn) {
      btn.textContent = '送出中...';
      btn.disabled = true;
      btn.style.opacity = '0.6';
    }

    var siteKey = (window.FRONTEND_CONFIG && window.FRONTEND_CONFIG.RECAPTCHA_SITE_KEY) || '';

    function doFetch(token) {
      payload.token = token || '';

      var fetchTimeout = setTimeout(function () {
        restoreSubmitBtn();
        showToast('連線逾時，請稍後再試或直接聯絡我們');
      }, 30000);

      fetch('/api/booking/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) {
          clearTimeout(fetchTimeout);
          return res.json();
        })
        .then(function (data) {
          if (data.success === true) {
            // 訂單成功：清除日曆快取
            try { sessionStorage.removeItem(BOOKED_CACHE_KEY); } catch (e) {}
            // 顯示成功面板（Step 4）
            _currentStep = 4;
            document.getElementById('bookStep2').style.display = 'none';
            document.getElementById('bookStep3').style.display = 'none';
            document.getElementById('bookStepSuccess').style.display = '';
            // 顯示訂單編號
            var oidEl = document.getElementById('thankYouOrderID');
            if (oidEl && (data.orderID || data.bookingId)) {
              oidEl.textContent = '訂單編號 ' + (data.orderID || data.bookingId);
              oidEl.style.display = '';
            }
            document.getElementById('bookStepSuccess').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            // 綁定成功頁按鈕
            var lineBtn = document.getElementById('thankYouLineBtn');
            if (lineBtn) {
              lineBtn.onclick = function () {
                window.open('https://line.me/ti/p/@dropinn', '_blank', 'noopener,noreferrer');
              };
            }
            var closeBtn = document.getElementById('thankYouCloseBtn');
            if (closeBtn) {
              closeBtn.onclick = function () {
                window.open('/ourpinkypromise', '_blank', 'noopener,noreferrer');
              };
            }
            updateBookingBar();
          } else {
            restoreSubmitBtn();
            showToast(
              (data && data.message) || '預約送出失敗，請稍後再試或直接聯絡我們'
            );
          }
        })
        .catch(function () {
          clearTimeout(fetchTimeout);
          restoreSubmitBtn();
          showToast('預約送出失敗，請稍後再試或直接聯絡我們');
        });
    }

    try {
      if (siteKey && window.grecaptcha) {
        grecaptcha.ready(function () {
          try {
            grecaptcha
              .execute(siteKey, { action: 'booking' })
              .then(function (token) {
                doFetch(token);
              })
              .catch(function () {
                doFetch('');
              });
          } catch (e) {
            doFetch('');
          }
        });
      } else {
        doFetch('');
      }
    } catch (e) {
      doFetch('');
    }
  }

  if (discountCode) {
    fetch('/api/booking/coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: discountCode,
        originalTotal: originalTotal,
        nights: nights,
      }),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (cr) {
        if (!cr || cr.valid !== true) {
          showToast((cr && cr.message) || '優惠碼無法使用');
          return;
        }
        payload.discountAmount = cr.discountAmount;
        payload.discountType = cr.discountType || '';
        payload.discountValue = cr.discountValue != null ? cr.discountValue : '';
        payload.totalPrice = originalTotal - cr.discountAmount;
        payload.remainingBalance = payload.totalPrice;
        runRecaptchaAndSubmit();
      })
      .catch(function () {
        showToast('優惠碼驗證失敗，請稍後再試');
      });
  } else {
    runRecaptchaAndSubmit();
  }
}

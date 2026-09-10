/* 獲利模型（後台分頁）
   ------------------------------------------------------------
   基礎資料一律從 /api/admin/pricing-model 現算：單數、均房數、均晚數來自
   orders，房務費中位數來自 housekeeping_costs，固定成本與貸款來自
   monthly_expenses。使用者只調「假設」——目標單數、折數、採用率——
   存回 site_config。

   為什麼要這樣切：寫死的基礎數字會過期，而且過期時從畫面上看不出來。
   把「事實」和「假設」分開，才知道哪些數字可以信。 */

(function () {
  'use strict';

  var PER_PERSON = 100;   // 耗材＋毛巾被單清洗，每人
  var PER_NIGHT  = 100;   // 電，每晚
  var DEFAULT_PRICE = { 3: 10800, 4: 12800, 5: 14800 };
  var DEFAULT_HK    = { 3: 2400,  4: 2810,  5: 3257  };   // API 沒資料時的退路

  var data = null;        // 後端回傳的基礎資料
  var A = null;           // 假設參數
  var dirty = false;

  function defaults() {
    return {
      prices: { 3: 10800, 4: 12800, 5: 14800 },
      nightDiscount: 500,        // 每晚折扣（只套前兩晚）
      thirdNight: 60,            // 淡季第三晚收原價的 %
      ladder: false,             // 旺季是否用階梯定價
      offLadder: false,          // 淡季是否改用「第二晚打折」的報價方式
      offNight2: 80,             // 淡季：第二晚收原價的 %
      night2: 90, night3: 80,    // 階梯：第二／三晚收原價的 %
      uptake: 50,                // 原本只住兩晚的客人有多少比例加訂第三晚
      openly: false,             // 優惠公開 or 只在議價時給
      months: {}                 // { 'YYYY-MM': { targetOrders, orders, rooms, nights, peak, fire } }
    };
  }

  var $ = function (id) { return document.getElementById(id); };
  var nt = function (n) { return Math.round(n || 0).toLocaleString('en-US'); };
  var wan = function (n) { return (n / 10000).toFixed(1) + ' 萬'; };

  function blend(rooms, pick) {
    var lo = Math.max(3, Math.min(5, Math.floor(rooms)));
    var hi = Math.max(3, Math.min(5, Math.ceil(rooms)));
    var t = hi === lo ? 0 : (rooms - lo) / (hi - lo);
    return pick(lo) * (1 - t) + pick(hi) * t;
  }
  function priceOf(rooms) { return blend(rooms, function (r) { return Number(A.prices[r]) || DEFAULT_PRICE[r]; }); }
  function hkOf(rooms) {
    return blend(rooms, function (r) {
      var v = data && data.housekeeping ? data.housekeeping[r] : null;
      return Number(v) || DEFAULT_HK[r];
    });
  }
  // 五間都是雙人房，所以人數＝房數×2。耗材按人數計。
  function stayCostOf(rooms) { return hkOf(rooms) + rooms * 2 * PER_PERSON; }

  /* 一個月的損益。open＝優惠是否公開給所有人。 */
  function monthResult(m, open) {
    var O = m.orders, rooms = m.rooms, nights = m.nights;
    var P = priceOf(rooms), stay = stayCostOf(rooms);
    var d = Number(A.nightDiscount) || 0;

    // 均晚數介於 2~3：拆成「本來就住三晚」與「只住兩晚」。
    // 折扣真正的代價，是第一群本來就會付全額。
    var f3 = Math.max(0, Math.min(1, nights - 2));
    var stay3 = O * f3, stay2 = O * (1 - f3);
    var up = stay2 * (Number(A.uptake) || 0) / 100;
    var keep2 = stay2 - up;

    var two, three, three3;
    if (A.ladder && m.peak) {
      var n2 = A.night2 / 100, n3 = A.night3 / 100;
      two = P * (1 + n2);
      three = three3 = P * (1 + n2 + n3);   // 階梯是報價方式，藏不住，人人適用
    } else if (A.offLadder && !m.peak) {
      // 淡季「第二晚打折」。第三晚沿用下面那支滑桿，兩段可以疊。
      // 同樣是報價方式，所以 three3 不另外給——本來就住三晚的人一樣拿得到。
      var o2 = (Number(A.offNight2) || 100) / 100, o3 = (Number(A.thirdNight) || 0) / 100;
      two = P * (1 + o2);
      three = three3 = P * (1 + o2 + o3);
    } else {
      var e = m.fire ? (Number(A.fireBonus) || 0) : 0;
      two = Math.max(0, P - d) * 2;
      three = Math.max(0, P - d - e) * 2 + P * (Number(A.thirdNight) || 0) / 100;
      three3 = open ? three : Math.max(0, P - d) * 3;   // 議價時，本來就住三晚的人拿不到
    }

    var rev = keep2 * two + up * three + stay3 * three3;
    var cost = keep2 * (stay + 2 * PER_NIGHT) + (up + stay3) * (stay + 3 * PER_NIGHT);
    var cmBase = O * P * nights - O * (stay + nights * PER_NIGHT);
    return { orders: O, rev: rev, cost: cost, cm: rev - cost, cmBase: cmBase, up: up,
             nights: keep2 * 2 + (up + stay3) * 3 };
  }

  function totals(open) {
    var a = { cm: 0, cmBase: 0, rev: 0, cost: 0, orders: 0, up: 0, nights: 0, rows: [] };
    months().forEach(function (m) {
      var r = monthResult(m, open);
      a.cm += r.cm; a.cmBase += r.cmBase; a.rev += r.rev; a.cost += r.cost;
      a.orders += r.orders; a.up += r.up; a.nights += r.nights; a.rows.push(r);
    });
    var fixed = Number(data.fixedAnnual) || 0;
    a.net = a.cm - fixed; a.netBase = a.cmBase - fixed;
    return a;
  }

  /* 實際資料 ＋ 使用者覆寫，合成模型要跑的月份清單 */
  function months() {
    return (data.months || []).map(function (r) {
      var o = (A.months && A.months[r.ym]) || {};
      var mm = Number(r.ym.slice(5, 7));
      return {
        ym: r.ym,
        actual: r,
        orders: o.orders != null ? Number(o.orders) : r.orders,
        rooms:  o.rooms  != null ? Number(o.rooms)  : (r.avgRooms || 4),
        nights: o.nights != null ? Number(o.nights) : (r.avgNights || 2),
        target: o.targetOrders != null ? Number(o.targetOrders) : 0,
        peak: o.peak != null ? !!o.peak : (mm >= 5 && mm <= 8),
        fire: o.fire != null ? !!o.fire : (mm === 5)
      };
    });
  }

  function render() {
    if (!data || !A) return;
    var a = totals(A.openly), other = totals(!A.openly);

    $('pmNet').textContent = 'NT$ ' + nt(a.net);
    $('pmNet').className = 'garamond text-4xl ' + (a.net >= 0 ? 'text-emerald-800' : 'text-red-700');
    var tgt = Number(data.target) || 0;
    $('pmTarget').textContent = tgt
      ? (a.net >= tgt ? '已達年度目標 ' + wan(tgt) : '距目標還差 ' + wan(tgt - a.net))
      : '尚未設定年度目標';
    $('pmVsBase').textContent = '對照原價不打折 ' + (a.net >= a.netBase ? '+' : '−') + wan(Math.abs(a.net - a.netBase));
    $('pmGap').textContent = A.openly
      ? '改成議價才給，多賺 ' + nt(other.net - a.net)
      : '公開的話少賺 ' + nt(a.net - other.net);

    // 月別表
    var html = '';
    months().forEach(function (m, i) {
      var r = a.rows[i];
      var miss = m.target && r.orders < m.target;
      html += '<tr class="border-b border-stone-100">'
        + '<td class="py-2 pr-2 whitespace-nowrap">' + m.ym.slice(5) + ' 月'
        + (m.fire ? ' <span class="text-[9px] text-red-700 border border-red-700 rounded px-1">火</span>' : '')
        + (m.peak && !m.fire ? ' <span class="text-[9px] text-amber-700 border border-amber-700 rounded px-1">旺</span>' : '')
        + '</td>'
        + '<td class="py-2 px-1 text-right text-stone-400 tabular-nums">' + m.actual.orders + '</td>'
        + '<td class="py-2 px-1"><input data-pm="orders" data-ym="' + m.ym + '" type="number" min="0" step="1" value="' + m.orders + '" class="w-14 text-right border-b border-stone-200 bg-transparent tabular-nums"></td>'
        + '<td class="py-2 px-1"><input data-pm="targetOrders" data-ym="' + m.ym + '" type="number" min="0" step="1" value="' + (m.target || '') + '" placeholder="—" class="w-14 text-right border-b border-stone-200 bg-transparent tabular-nums ' + (miss ? 'text-red-700' : '') + '"></td>'
        + '<td class="py-2 px-1"><input data-pm="rooms" data-ym="' + m.ym + '" type="number" min="3" max="5" step="0.1" value="' + m.rooms + '" class="w-14 text-right border-b border-stone-200 bg-transparent tabular-nums"></td>'
        + '<td class="py-2 px-1"><input data-pm="nights" data-ym="' + m.ym + '" type="number" min="2" max="3" step="0.1" value="' + m.nights + '" class="w-14 text-right border-b border-stone-200 bg-transparent tabular-nums"></td>'
        + '<td class="py-2 px-1 text-right text-stone-400 tabular-nums">' + (r.orders ? (r.nights / r.orders).toFixed(2) : '—') + '</td>'
        + '<td class="py-2 pl-2 text-right tabular-nums">' + nt(r.cm) + '</td>'
        + '</tr>';
    });
    html += '<tr class="font-medium"><td class="pt-3">全年</td>'
      + '<td class="pt-3 px-1 text-right text-stone-400 tabular-nums">' + (data.months || []).reduce(function (s, r) { return s + r.orders; }, 0) + '</td>'
      + '<td class="pt-3 px-1 text-right tabular-nums">' + a.orders + '</td>'
      + '<td colspan="3"></td>'
      + '<td class="pt-3 px-1 text-right text-stone-400 tabular-nums">' + (a.orders ? (a.nights / a.orders).toFixed(2) : '—') + '</td>'
      + '<td class="pt-3 pl-2 text-right tabular-nums">' + nt(a.cm) + '</td></tr>';
    $('pmMonths').innerHTML = html;

    // 拆解
    $('pmBreakdown').innerHTML =
        row('營業額', nt(a.rev))
      + row('變動成本<span class="block text-[11px] text-stone-400">房務（隨房數）、耗材與被單（隨人數）、電</span>', '−' + nt(a.cost))
      + row('固定成本<span class="block text-[11px] text-stone-400">' + data.monthsFilled + ' 個月已填</span>', '−' + nt(data.fixedAnnual))
      + '<tr class="font-medium border-t border-stone-200"><td class="pt-2">淨利（不含貸款）</td><td class="pt-2 text-right tabular-nums">' + nt(a.net) + '</td></tr>'
      + row('貸款', '−' + nt(data.loanAnnual))
      + '<tr class="font-medium"><td>扣貸款後</td><td class="text-right tabular-nums ' + (a.net - data.loanAnnual >= 0 ? 'text-emerald-800' : 'text-red-700') + '">' + nt(a.net - data.loanAnnual) + '</td></tr>';

    // 資料來源
    var hk = data.housekeeping || {}, hkN = data.housekeepingN || {};
    var parts = [3, 4, 5].filter(function (r) { return hk[r]; })
      .map(function (r) { return r + ' 房 ' + nt(hk[r]) + '（' + hkN[r] + ' 筆）'; });
    $('pmSource').innerHTML =
      '單數／均房數／均晚數取自 <strong>' + data.year + ' 年 orders</strong>（已付訂＋完成）。'
      + '房務費取<strong>中位數</strong>：' + (parts.join('、') || '無資料')
      + '。固定成本與貸款取自 monthly_expenses，該年已填 <strong>' + data.monthsFilled + '</strong> 個月'
      + (data.monthsFilled < 12 ? '<span class="text-amber-700">（未滿一年，金額會偏低）</span>' : '') + '。';

    rateNote();
    $('pmSaveHint').textContent = dirty ? '有未儲存的變更' : '';
  }

  /* 公開一個折數到底要不要錢？基準是「你過去議價實際讓到哪」。
     公開的實收率若高於歷史中位數，公開就不是多花錢。 */
  function rateNote() {
    var el = $('pmRate'); if (!el) return;
    var P = priceOf(4), d = Number(A.nightDiscount) || 0, t = (Number(A.thirdNight) || 0) / 100;
    var r2, r3;
    if (A.offLadder) {
      var o2 = (Number(A.offNight2) || 100) / 100;
      r2 = (1 + o2) / 2;
      r3 = (1 + o2 + t) / 3;
    } else {
      r2 = Math.max(0, P - d) * 2 / (P * 2);
      r3 = (Math.max(0, P - d) * 2 + P * t) / (P * 3);
    }
    var pc = function (x) { return (x * 100).toFixed(0) + '%'; };
    // 淡季規則要跟淡季的議價紀錄比。淡季樣本太少時退回全年。
    var hist = data.realizedOff, histN = data.realizedOffN, histLabel = '淡季';
    if (hist == null || histN < 5) { hist = data.realizedRate; histN = data.realizedN; histLabel = '全年'; }
    var txt = '淡季公開後的實收率：兩晚 <strong>' + pc(r2) + '</strong>、三晚 <strong>' + pc(r3) + '</strong>。';
    if (hist == null) { el.innerHTML = txt + ' 歷史實收率無資料。'; return; }
    txt += ' 你過去 ' + histN + ' 筆' + histLabel + '訂單議價後的實收率中位數是 <strong>' + hist + '%</strong>——';
    var worse2 = r2 * 100 < hist;
    txt += worse2
      ? '<span class="text-amber-700">兩晚這一段讓得比平常多，差額要靠多帶進來的單補回來。</span>'
      : '<span class="text-emerald-800">兩晚這一段並沒有比你平常讓得多，等於把同一筆錢提前拿去換能見度。</span>';
    el.innerHTML = txt;
  }

  function row(label, val) {
    return '<tr class="border-b border-stone-100"><td class="py-1.5">' + label + '</td>'
      + '<td class="py-1.5 text-right tabular-nums">' + val + '</td></tr>';
  }

  function syncControls() {
    $('pmNightDiscount').value = A.nightDiscount;
    $('pmNightDiscountVal').textContent = nt(A.nightDiscount);
    $('pmThird').value = A.thirdNight;
    $('pmThirdVal').textContent = A.thirdNight + '%';
    $('pmUptake').value = A.uptake;
    $('pmUptakeVal').textContent = A.uptake + '%';
    $('pmNight2').value = A.night2; $('pmNight2Val').textContent = A.night2 + '%';
    $('pmNight3').value = A.night3; $('pmNight3Val').textContent = A.night3 + '%';
    $('pmOffNight2').value = A.offNight2; $('pmOffNight2Val').textContent = A.offNight2 + '%';
    $('pmLadderFields').style.display = A.ladder ? '' : 'none';
    $('pmOffLadderFields').style.display = A.offLadder ? '' : 'none';
    [['pmModeFlat', !A.ladder], ['pmModeLadder', A.ladder],
     ['pmOffFlat', !A.offLadder], ['pmOffLadder', A.offLadder],
     ['pmGiveOpen', A.openly], ['pmGiveQuiet', !A.openly]].forEach(function (p) {
      var el = $(p[0]); if (!el) return;
      el.setAttribute('aria-pressed', String(p[1]));
      el.className = 'px-3 py-1.5 text-xs rounded-lg transition ' +
        (p[1] ? 'bg-stone-700 text-stone-50' : 'bg-stone-100 text-stone-500 hover:bg-stone-200');
    });
    [3, 4, 5].forEach(function (r) { $('pmPrice' + r).value = A.prices[r]; });
  }

  function bind() {
    ['pmNightDiscount', 'pmThird', 'pmUptake', 'pmNight2', 'pmNight3', 'pmOffNight2'].forEach(function (id) {
      $(id).addEventListener('input', function () {
        var key = { pmNightDiscount: 'nightDiscount', pmThird: 'thirdNight', pmUptake: 'uptake',
                    pmNight2: 'night2', pmNight3: 'night3', pmOffNight2: 'offNight2' }[id];
        A[key] = Number(this.value); dirty = true; syncControls(); render();
      });
    });
    [3, 4, 5].forEach(function (r) {
      $('pmPrice' + r).addEventListener('input', function () {
        A.prices[r] = Number(this.value) || 0; dirty = true; render();
      });
    });
    $('pmOffFlat').addEventListener('click', function () { A.offLadder = false; dirty = true; syncControls(); render(); });
    $('pmOffLadder').addEventListener('click', function () { A.offLadder = true; dirty = true; syncControls(); render(); });
    $('pmModeFlat').addEventListener('click', function () { A.ladder = false; dirty = true; syncControls(); render(); });
    $('pmModeLadder').addEventListener('click', function () { A.ladder = true; dirty = true; syncControls(); render(); });
    $('pmGiveOpen').addEventListener('click', function () { A.openly = true; dirty = true; syncControls(); render(); });
    $('pmGiveQuiet').addEventListener('click', function () { A.openly = false; dirty = true; syncControls(); render(); });

    // 月別表的輸入用事件委派：表格會重畫，直接綁在節點上會掉
    $('pmMonths').addEventListener('input', function (e) {
      var el = e.target;
      if (!el.dataset || !el.dataset.pm) return;
      var ym = el.dataset.ym, k = el.dataset.pm;
      A.months[ym] = A.months[ym] || {};
      A.months[ym][k] = el.value === '' ? null : Number(el.value);
      dirty = true;
      render();
      // 重畫後把游標放回原本那格，不然打「12」時打完 1 就會斷。
      // 注意：input[type=number] 不支援 setSelectionRange，直接呼叫會丟例外
      // 並中斷後續，所以只 focus 就好。
      var again = document.querySelector('#pmMonths [data-pm="' + k + '"][data-ym="' + ym + '"]');
      if (again && again !== document.activeElement) again.focus();
    });

    $('pmSave').addEventListener('click', save);
    $('pmYear').addEventListener('change', function () { load(this.value); });
  }

  function save() {
    $('pmSave').disabled = true;
    _nfyFetch('POST', '/api/admin/pricing-model', { assumptions: A })
      .then(function (r) {
        if (!r || !r.success) throw new Error(r && r.error || '儲存失敗');
        dirty = false; $('pmSaveHint').textContent = '已儲存';
        setTimeout(function () { if (!dirty) $('pmSaveHint').textContent = ''; }, 2500);
      })
      .catch(function (e) { $('pmSaveHint').textContent = '儲存失敗：' + e.message; })
      .finally(function () { $('pmSave').disabled = false; });
  }

  function load(year) {
    $('pmSource').textContent = '載入中…';
    return _nfyFetch('GET', '/api/admin/pricing-model?year=' + encodeURIComponent(year))
      .then(function (r) {
        if (!r || !r.success) throw new Error(r && r.error || '讀取失敗');
        data = r;
        A = Object.assign(defaults(), r.assumptions || {});
        A.months = A.months || {};
        A.prices = Object.assign({ 3: 10800, 4: 12800, 5: 14800 }, A.prices || {});
        dirty = false;
        syncControls(); render();
      })
      .catch(function (e) { $('pmSource').textContent = '讀取失敗：' + e.message; });
  }

  var booted = false;
  window.initPricingModel = function () {
    if (booted) { return; }
    booted = true;
    var sel = $('pmYear'), now = new Date().getFullYear();
    for (var y = now + 1; y >= now - 3; y--) {
      var o = document.createElement('option');
      o.value = y; o.textContent = y;
      if (y === now) o.selected = true;
      sel.appendChild(o);
    }
    bind();
    load(now);
  };
})();

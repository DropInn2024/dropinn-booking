window.FRONTEND_CONFIG =
  window.FRONTEND_CONFIG || (typeof FRONTEND_CONFIG !== 'undefined' ? FRONTEND_CONFIG : {});
(function () {
  var MONTHS = [
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
  var WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  var TOKEN = sessionStorage.getItem('agency_token') || '';
  var agencyName = sessionStorage.getItem('agency_name') || '—';

  // 如果沒有 token，踢回登入頁
  if (!TOKEN) {
    window.location.replace('/handshake/login');
    return;
  }

  var nameEl = document.getElementById('topAgencyName');
  if (nameEl) nameEl.textContent = agencyName;

  var currentYear = new Date().getFullYear();
  var currentMonth = new Date().getMonth();
  var currentView = 'you';
  var selectedDates = new Set();

  // 資料快取
  var youProperties = [];
  var youCurrentPropId = '';
  var youBlocksCache = {}; // propId → Set<dateStr>
  var andData = null;      // { month, partners: [{agencyId,displayName,properties:[{propertyId,propertyName,blockedDates}]}] }
  var andDataMonth = '';   // 已載入的月份，月份切換後需重拉
  var meData = null;       // { booked: Set, pending: Set }
  var meDataMonth = '';    // 已載入的月份

  // ── API 工具（同業 Worker REST）──────────────────────
  function _agencyFetch(method, path, body) {
    var opts = {
      method: method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
      },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    return fetch(path, opts).then(function (r) {
      // token 過期或無效 → 清除並踢回登入頁
      if (r.status === 401 || r.status === 403) {
        sessionStorage.removeItem('agency_token');
        sessionStorage.removeItem('agency_must_change_pw');
        window.location.replace('/handshake/login');
        return Promise.reject(new Error('session_expired'));
      }
      return r.json();
    });
  }
  // 目前所選年月 → 'YYYY-MM'，給 partner-calendar 用
  function _currentMonthStr() {
    return currentYear + '-' + String(currentMonth + 1).padStart(2, '0');
  }

  // ── Toast ─────────────────────────────────────────────
  function showToast(msg, dur) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () {
      t.classList.remove('show');
    }, dur || 2500);
  }

  // ── 日期工具 ──────────────────────────────────────────
  function dateStr(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }
  function today0() {
    var t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }

  // ── 更新月份標題 ──────────────────────────────────────
  function updateTitles() {
    var m = MONTHS[currentMonth],
      y = currentYear;
    ['you', 'and', 'me'].forEach(function (v) {
      var mm = document.getElementById(v + 'MonthMain');
      var my = document.getElementById(v + 'MonthYear');
      if (mm) mm.textContent = m;
      if (my) my.textContent = String(y);
    });
  }

  // ── 顯示/隱藏 loading ─────────────────────────────────
  function showLoading(view, on) {
    var l = document.getElementById(view + 'Loading');
    var g = document.getElementById('grid-' + view);
    if (l) l.style.display = on ? 'flex' : 'none';
    if (g) g.style.display = on ? 'none' : 'grid';
  }

  // ============================================================
  // YOU 視角
  // ============================================================
  function initYou() {
    showLoading('you', true);
    _agencyFetch('GET', '/api/agency/properties')
      .then(function (data) {
        if (!data.success) {
          showToast('無法載入棟別');
          showLoading('you', false);
          return;
        }
        youProperties = data.properties || [];
        var sel = document.getElementById('propertySelect');
        sel.innerHTML = '';
        if (!youProperties.length) {
          var opt = document.createElement('option');
          opt.value = '';
          opt.textContent = '— 尚無棟別，請先新增 —';
          sel.appendChild(opt);
          showLoading('you', false);
          return;
        }
        youProperties.forEach(function (p) {
          var opt = document.createElement('option');
          opt.value = p.propertyId;   // ← 修正：propertyId 不是 id
          opt.textContent = p.propertyName; // ← 修正：propertyName 不是 name
          sel.appendChild(opt);
        });
        youCurrentPropId = youProperties[0].propertyId;
        sel.value = youCurrentPropId;
        loadYouBlocks(youCurrentPropId);
      })
      .catch(function () {
        showToast('連線失敗');
        showLoading('you', false);
      });
  }

  function loadYouBlocks(propId) {
    showLoading('you', true);
    _agencyFetch('GET', '/api/agency/blocks?propertyId=' + encodeURIComponent(propId))
      .then(function (data) {
        if (!data.success) {
          showToast('無法載入房況');
          showLoading('you', false);
          return;
        }
        youBlocksCache[propId] = new Set(data.dates || []); // ← 修正：dates 不是 blocks
        showLoading('you', false);
        renderYou();
      })
      .catch(function () {
        showToast('連線失敗');
        showLoading('you', false);
      });
  }

  function renderYou() {
    var grid = document.getElementById('grid-you');
    if (!grid) return;
    var blocks = youBlocksCache[youCurrentPropId] || new Set();
    var y = currentYear,
      m = currentMonth;
    var firstDay = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var todayObj = today0();
    var html = '';

    WEEKDAYS.forEach(function (d) {
      var we = d === 'SUN' || d === 'SAT' ? ' weekend' : '';
      html += '<div class="cal-cell header' + we + '">' + d + '</div>';
    });
    for (var i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var dateObj = new Date(y, m, d);
      var ds = dateStr(y, m, d);
      var we = dateObj.getDay() === 0 || dateObj.getDay() === 6 ? ' weekend' : '';
      var cls = 'cal-cell' + we;
      var onclick = '';
      if (dateObj < todayObj) {
        cls += ' past';
      } else {
        cls += ' interactive';
        if (selectedDates.has(ds)) cls += ' selected';
        if (blocks.has(ds)) cls += ' blocked';
        onclick = 'onclick="window._youToggle(this,\'' + ds + '\')"';
      }
      html +=
        '<div class="' + cls + '" data-date="' + ds + '" ' + onclick + '>' + d + '</div>';
    }
    grid.innerHTML = html;
  }

  window._youToggle = function (el, ds) {
    if (currentView !== 'you') return;
    if (selectedDates.has(ds)) {
      selectedDates.delete(ds);
      el.classList.remove('selected');
    } else {
      selectedDates.add(ds);
      el.classList.add('selected');
    }
    updateFab();
  };

  document.getElementById('propertySelect').addEventListener('change', function () {
    youCurrentPropId = this.value;
    selectedDates.clear();
    updateFab();
    if (!youBlocksCache[youCurrentPropId]) loadYouBlocks(youCurrentPropId);
    else renderYou();
  });

  // FAB
  function updateFab() {
    var fab = document.getElementById('selectionFab');
    document.getElementById('selCount').textContent = selectedDates.size;
    fab.classList.toggle('show', selectedDates.size > 0 && currentView === 'you');
  }
  function clearSel() {
    selectedDates.clear();
    document.querySelectorAll('#grid-you .cal-cell.selected').forEach(function (el) {
      el.classList.remove('selected');
    });
    updateFab();
  }
  document.getElementById('btnClearSel').addEventListener('click', clearSel);

  document.getElementById('btnBlock').addEventListener('click', function () {
    if (!selectedDates.size || !youCurrentPropId) return;
    var dates = Array.from(selectedDates);
    var done = 0,
      total = dates.length;
    dates.forEach(function (ds) {
      _agencyFetch('POST', '/api/agency/blocks', {
        propertyId: youCurrentPropId,
        date: ds,
        action: 'block',
      }).then(function (data) {
        if (data.success) {
          if (!youBlocksCache[youCurrentPropId])
            youBlocksCache[youCurrentPropId] = new Set();
          youBlocksCache[youCurrentPropId].add(ds);
        }
        done++;
        if (done === total) {
          clearSel();
          renderYou();
          showToast('已設為無法提供');
        }
      });
    });
  });

  document.getElementById('btnRestore').addEventListener('click', function () {
    if (!selectedDates.size || !youCurrentPropId) return;
    var dates = Array.from(selectedDates);
    var done = 0,
      total = dates.length;
    dates.forEach(function (ds) {
      _agencyFetch('POST', '/api/agency/blocks', {
        propertyId: youCurrentPropId,
        date: ds,
        action: 'unblock',
      }).then(function (data) {
        if (data.success) {
          if (youBlocksCache[youCurrentPropId]) youBlocksCache[youCurrentPropId].delete(ds);
        }
        done++;
        if (done === total) {
          clearSel();
          renderYou();
          showToast('已恢復空房');
        }
      });
    });
  });

  // ============================================================
  // & 視角
  // API 回傳：{ success, month, partners: [{agencyId, displayName,
  //   properties: [{propertyId, propertyName, colorKey, blockedDates:[]}] }] }
  // ============================================================

  // 展開 partners → 所有 property 的扁平陣列，方便渲染
  function _andAllProps() {
    if (!andData) return [];
    var all = [];
    (andData.partners || []).forEach(function (partner) {
      (partner.properties || []).forEach(function (prop) {
        all.push({
          propertyId: prop.propertyId,
          propertyName: prop.propertyName,
          agencyName: partner.displayName,
          blockedDates: prop.blockedDates || [],
        });
      });
    });
    return all;
  }

  function initAnd() {
    var month = _currentMonthStr();
    // 同月份有快取就直接渲染
    if (andData && andDataMonth === month) {
      renderAnd();
      return;
    }
    showLoading('and', true);
    _agencyFetch('GET', '/api/agency/partner-calendar?month=' + encodeURIComponent(month))
      .then(function (data) {
        if (!data.success) {
          showToast('無法載入同業資料');
          showLoading('and', false);
          return;
        }
        andData = data;
        andDataMonth = month;
        showLoading('and', false);
        renderAnd();
      })
      .catch(function () {
        showToast('連線失敗');
        showLoading('and', false);
      });
  }

  function renderAnd() {
    var grid = document.getElementById('grid-and');
    if (!grid || !andData) return;
    var y = currentYear,
      m = currentMonth;
    var firstDay = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var todayObj = today0();
    var props = _andAllProps(); // 扁平化
    var html = '';

    WEEKDAYS.forEach(function (d) {
      var we = d === 'SUN' || d === 'SAT' ? ' weekend' : '';
      html += '<div class="cal-cell header' + we + '">' + d + '</div>';
    });
    for (var i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var dateObj = new Date(y, m, d);
      var ds = dateStr(y, m, d);
      var we = dateObj.getDay() === 0 || dateObj.getDay() === 6 ? ' weekend' : '';
      var cls = 'cal-cell' + we;
      var onclick = '';
      if (dateObj < todayObj) {
        cls += ' past';
      } else if (props.length === 0) {
        // 無同業資料，仍可點（顯示提示）
        cls += ' and-interactive';
        onclick = 'onclick="window._andShowDay(\'' + ds + '\')"';
      } else {
        var availCount = 0, blockedCount = 0;
        props.forEach(function (p) {
          if (p.blockedDates.indexOf(ds) !== -1) blockedCount++;
          else availCount++;
        });
        cls += ' and-interactive';
        if (blockedCount === props.length && props.length > 0) cls += ' all-full';
        else if (blockedCount > 0) cls += ' has-room';
        onclick = 'onclick="window._andShowDay(\'' + ds + '\')"';
      }
      html +=
        '<div class="' + cls + '" data-date="' + ds + '" ' + onclick + '>' + d + '</div>';
    }
    grid.innerHTML = html;
  }

  window._andShowDay = function (ds) {
    if (!andData) return;
    var props = _andAllProps();
    var available = [], blocked = [];
    props.forEach(function (p) {
      var info = { agency: p.agencyName, property: p.propertyName };
      if (p.blockedDates.indexOf(ds) !== -1) blocked.push(info);
      else available.push(info);
    });

    var pop = document.getElementById('andDayPopover');
    var title = document.getElementById('andPopoverTitle');
    var list = document.getElementById('andPopoverList');
    title.textContent = ds + '　可提供包棟';
    var html = '';
    if (available.length) {
      available.forEach(function (i) {
        html +=
          '<div class="and-popover-item"><span class="and-result-available">✅ ' +
          i.agency + '・' + i.property +
          '</span><span class="and-result-tag tag-available">可包棟</span></div>';
      });
    } else if (!props.length) {
      html = '<div style="color:var(--muted);font-size:12px;padding:8px 0">尚無可見同業資料</div>';
    } else {
      html = '<div style="color:var(--muted);font-size:12px;padding:8px 0">此日期無可包棟民宿</div>';
    }
    list.innerHTML = html;
    pop.classList.add('show');
  };

  document.getElementById('btnCloseAndPopover').addEventListener('click', function () {
    document.getElementById('andDayPopover').classList.remove('show');
  });

  // 查詢包棟 overlay
  document.getElementById('btnAndQueryOpen').addEventListener('click', function () {
    document.getElementById('propDropdown').classList.remove('show');
    document.getElementById('andQueryResult').style.display = 'none';
    document.getElementById('andQueryDate').value = '';
    document.getElementById('andQueryOverlay').classList.add('show');
  });
  document.getElementById('btnAndQueryClose').addEventListener('click', function () {
    document.getElementById('andQueryOverlay').classList.remove('show');
  });

  // & 日期查詢工具
  document.getElementById('btnAndQuery').addEventListener('click', function () {
    var ds = document.getElementById('andQueryDate').value;
    if (!ds) { showToast('請選擇日期'); return; }
    if (!andData) { showToast('資料載入中，請稍後再試'); return; }
    var props = _andAllProps();
    var available = [];
    props.forEach(function (p) {
      if (p.blockedDates.indexOf(ds) === -1)
        available.push(p.agencyName + '・' + p.propertyName);
    });

    var resultDiv = document.getElementById('andQueryResult');
    var titleEl = document.getElementById('andQueryTitle');
    var listEl = document.getElementById('andQueryList');
    titleEl.textContent = ds + '　可包棟';
    var html = '';
    if (available.length) {
      available.forEach(function (n) {
        html +=
          '<div class="and-result-item"><span class="and-result-available">✅ ' +
          n + '</span><span class="and-result-tag tag-available">可包棟</span></div>';
      });
    } else if (!props.length) {
      html = '<div style="color:var(--muted);font-size:13px;padding:8px 0">尚無可見同業資料</div>';
    } else {
      html = '<div style="color:var(--muted);font-size:13px;padding:8px 0">此日期無可包棟民宿</div>';
    }
    listEl.innerHTML = html;
    resultDiv.style.display = 'block';
  });

  // ============================================================
  // ME 視角 — 雫旅本月訂單（已付訂/完成 → ✕，洽談中 → 淡色）
  // API 回傳 dropinnBooked / dropinnPending 欄位
  // ============================================================
  function initMe() {
    var month = _currentMonthStr();
    // 同月份有快取就直接渲染
    if (meData && meDataMonth === month) {
      renderMe();
      return;
    }
    showLoading('me', true);
    _agencyFetch('GET', '/api/agency/partner-calendar?month=' + encodeURIComponent(month))
      .then(function (data) {
        if (!data.success) {
          showToast('無法載入雫旅資料');
          showLoading('me', false);
          return;
        }
        meData = {
          booked: new Set(data.dropinnBooked || []),
          pending: new Set(data.dropinnPending || []),
        };
        meDataMonth = month;
        showLoading('me', false);
        renderMe();
      })
      .catch(function () {
        showToast('連線失敗');
        showLoading('me', false);
      });
  }

  function renderMe() {
    var grid = document.getElementById('grid-me');
    if (!grid || !meData) return;
    var y = currentYear,
      m = currentMonth;
    var firstDay = new Date(y, m, 1).getDay();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var todayObj = today0();
    var html = '';

    WEEKDAYS.forEach(function (d) {
      var we = d === 'SUN' || d === 'SAT' ? ' weekend' : '';
      html += '<div class="cal-cell header' + we + '">' + d + '</div>';
    });
    for (var i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';
    for (var d = 1; d <= daysInMonth; d++) {
      var dateObj = new Date(y, m, d);
      var ds = dateStr(y, m, d);
      var we = dateObj.getDay() === 0 || dateObj.getDay() === 6 ? ' weekend' : '';
      var cls = 'cal-cell' + we;
      if (dateObj < todayObj) cls += ' past';
      else if (meData.booked.has(ds)) cls += ' dropinn-booked';
      else if (meData.pending.has(ds)) cls += ' dropinn-pending';
      html += '<div class="' + cls + '" data-date="' + ds + '">' + d + '</div>';
    }
    grid.innerHTML = html;
  }

  // ============================================================
  // 月份導航
  // ============================================================
  function prevMonth() {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    clearSel();
    updateTitles();
    renderCurrent();
  }
  function nextMonth() {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    clearSel();
    updateTitles();
    renderCurrent();
  }
  function renderCurrent() {
    if (currentView === 'you') renderYou();
    else if (currentView === 'and') initAnd(); // 月份可能換了，重新拉（initAnd 內比對快取）
    else initMe();                              // 同上
  }
  ['you', 'and', 'me'].forEach(function (v) {
    document.getElementById(v + 'Prev').addEventListener('click', prevMonth);
    document.getElementById(v + 'Next').addEventListener('click', nextMonth);
  });

  // ============================================================
  // 視角切換
  // ============================================================
  function switchView(viewId) {
    currentView = viewId;
    ['you', 'and', 'me'].forEach(function (v) {
      document.getElementById('view-' + v).classList.toggle('active', v === viewId);
      var nb = v === 'and' ? 'navAnd' : 'nav' + v.charAt(0).toUpperCase() + v.slice(1);
      document.getElementById(nb).classList.toggle('active', v === viewId);
    });
    clearSel();
    document.getElementById('andDayPopover').classList.remove('show');
    if (viewId === 'and') initAnd();
    else if (viewId === 'me') initMe();
    else renderCurrent();
  }
  document.getElementById('navYou').addEventListener('click', function () {
    switchView('you');
  });
  document.getElementById('navAnd').addEventListener('click', function () {
    switchView('and');
  });
  document.getElementById('navMe').addEventListener('click', function () {
    switchView('me');
  });

  // ============================================================
  // ⋯ 棟別管理
  // ============================================================
  var dropdown = document.getElementById('propDropdown');
  var overlay = document.getElementById('propOverlay');
  var modalLabel = document.getElementById('propModalLabel');
  var modalInput = document.getElementById('propModalInput');
  var modalList = document.getElementById('propModalList');
  var btnConfirm = document.getElementById('btnModalConfirm');
  var btnCancel = document.getElementById('btnModalCancel');
  var currentModalMode = '',
    selectedPropId = '';

  document.getElementById('btnPropMenu').addEventListener('click', function (e) {
    e.stopPropagation();
    dropdown.classList.toggle('show');
  });
  document.addEventListener('click', function () {
    dropdown.classList.remove('show');
  });

  function openModal(mode) {
    dropdown.classList.remove('show');
    currentModalMode = mode;
    selectedPropId = '';
    modalInput.style.display = 'none';
    modalList.innerHTML = '';
    modalList.style.display = 'none';
    btnConfirm.className = 'prop-modal-btn primary';
    btnConfirm.textContent = '確認';

    if (mode === 'add') {
      modalLabel.textContent = '新增民宿棟別';
      modalInput.value = '';
      modalInput.placeholder = '例如：海風 A 棟';
      modalInput.style.display = 'block';
      setTimeout(function () {
        modalInput.focus();
      }, 100);
    } else if (mode === 'rename') {
      modalLabel.textContent = '選擇要修改的棟別';
      buildPropList(function (id, name) {
        selectedPropId = id;
        modalLabel.textContent = '新的名稱';
        modalList.style.display = 'none';
        modalInput.value = name;
        modalInput.style.display = 'block';
        setTimeout(function () {
          modalInput.focus();
        }, 100);
      });
    } else if (mode === 'delete') {
      modalLabel.textContent = '選擇要刪除的棟別';
      btnConfirm.className = 'prop-modal-btn danger';
      btnConfirm.textContent = '刪除';
      buildPropList(function (id) {
        selectedPropId = id;
      });
    }
    overlay.classList.add('show');
  }

  function buildPropList(onSelect) {
    modalList.innerHTML = '';
    modalList.style.display = 'flex';
    youProperties.forEach(function (p) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prop-modal-option';
      btn.textContent = p.propertyName;
      btn.addEventListener('click', function () {
        document.querySelectorAll('.prop-modal-option').forEach(function (b) {
          b.classList.remove('selected');
        });
        btn.classList.add('selected');
        onSelect(p.propertyId, p.propertyName);
      });
      modalList.appendChild(btn);
    });
  }

  function closeModal() {
    overlay.classList.remove('show');
    currentModalMode = '';
    selectedPropId = '';
  }
  document.getElementById('btnAddProp').addEventListener('click', function () {
    openModal('add');
  });
  document.getElementById('btnRenameProp').addEventListener('click', function () {
    openModal('rename');
  });
  document.getElementById('btnDeleteProp').addEventListener('click', function () {
    openModal('delete');
  });
  btnCancel.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });

  btnConfirm.addEventListener('click', function () {
    if (currentModalMode === 'add') {
      var name = modalInput.value.trim();
      if (!name) {
        modalInput.focus();
        return;
      }
      btnConfirm.disabled = true;
      _agencyFetch('POST', '/api/agency/properties', { propertyName: name })
        .then(function (data) {
          btnConfirm.disabled = false;
          if (!data.success) {
            showToast(data.message || '新增失敗');
            return;
          }
          showToast('已新增「' + name + '」');
          closeModal();
          // 重新載入棟別清單
          youBlocksCache = {};
          initYou();
        })
        .catch(function () {
          btnConfirm.disabled = false;
          showToast('連線失敗');
        });
    } else if (currentModalMode === 'rename') {
      if (!selectedPropId) return;
      var name = modalInput.value.trim();
      if (!name) {
        modalInput.focus();
        return;
      }
      btnConfirm.disabled = true;
      _agencyFetch('PATCH', '/api/agency/properties/' + encodeURIComponent(selectedPropId), { propertyName: name })
        .then(function (data) {
          btnConfirm.disabled = false;
          if (!data.success) {
            showToast(data.message || '修改失敗');
            return;
          }
          showToast('已更新名稱');
          closeModal();
          youBlocksCache = {};
          initYou();
        })
        .catch(function () {
          btnConfirm.disabled = false;
          showToast('連線失敗');
        });
    } else if (currentModalMode === 'delete') {
      if (!selectedPropId) return;
      btnConfirm.disabled = true;
      _agencyFetch('DELETE', '/api/agency/properties/' + encodeURIComponent(selectedPropId))
        .then(function (data) {
          btnConfirm.disabled = false;
          if (!data.success) {
            showToast(data.message || '刪除失敗');
            return;
          }
          showToast('已刪除');
          closeModal();
          youBlocksCache = {};
          initYou();
        })
        .catch(function () {
          btnConfirm.disabled = false;
          showToast('連線失敗');
        });
    }
  });

  modalInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') btnConfirm.click();
    if (e.key === 'Escape') closeModal();
  });

  // ============================================================
  // Info Modal / 登出
  // ============================================================
  document.getElementById('btnInfoMenu').addEventListener('click', function () {
    document.getElementById('propDropdown').classList.remove('show');
    document.getElementById('infoModal').classList.add('show');
  });
  document.getElementById('btnCloseModal').addEventListener('click', function () {
    document.getElementById('infoModal').classList.remove('show');
  });
  function doLogout() {
    sessionStorage.removeItem('agency_token');
    sessionStorage.removeItem('agency_name');
    window.location.replace('/handshake/login');
  }
  document.getElementById('btnLogoutMenu').addEventListener('click', doLogout);

  // ============================================================
  // 首次登入強制換密碼
  // ============================================================
  var mustChangePw = sessionStorage.getItem('agency_must_change_pw') === '1';
  if (mustChangePw) {
    document.getElementById('changePwOverlay').style.display = 'flex';
  }

  document.getElementById('cpSubmitBtn').addEventListener('click', function () {
    var newPw = document.getElementById('cpNewPw').value;
    var confirmPw = document.getElementById('cpConfirmPw').value;
    var notice = document.getElementById('cpNotice');
    if (!newPw || newPw.length < 6) {
      notice.textContent = '密碼至少需要 6 個字元';
      return;
    }
    if (newPw !== confirmPw) {
      notice.textContent = '兩次密碼不一致，請重新輸入';
      return;
    }
    notice.textContent = '';
    var btn = document.getElementById('cpSubmitBtn');
    btn.disabled = true;
    btn.textContent = '更新中…';
    _agencyFetch('POST', '/api/agency/change-password', { newPassword: newPw })
      .then(function (data) {
        btn.disabled = false;
        btn.textContent = '確認設定';
        if (!data.success) {
          notice.textContent = data.error || '更新失敗，請再試一次';
          return;
        }
        sessionStorage.removeItem('agency_must_change_pw');
        document.getElementById('changePwOverlay').style.display = 'none';
        showToast('密碼已更新，歡迎使用 ✦', 3000);
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = '確認設定';
        notice.textContent = '連線失敗，請稍後再試';
      });
  });

  // ============================================================
  // 初始化
  // ============================================================
  updateTitles();
  initYou();
})();

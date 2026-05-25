/**
 * Drift Spots 管理（雫編後台分頁）
 * Mount point：notforyou/home 的「漂流」tab，由 app.js 的 switchTab('drift')
 * 第一次切過去時呼叫 driftInit()。
 *
 * API：/api/drift/spots（GET/POST/PUT/DELETE），所有寫入帶 Authorization: Bearer <admin_key>
 */
(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────────
  var initialized   = false;
  var allSpots      = [];       // 從 API 拉到的完整陣列
  var editingId     = null;     // null = 新增，string = 編輯既有
  var filterText    = '';
  var filterType    = '';
  var filterArea    = '';
  var currentPage   = 1;
  var PAGE_SIZE     = 10;

  // ── Map picker state ───────────────────────────────────────────────────
  var pickerMap     = null;     // Leaflet map instance（lazy init）
  var pickerMarker  = null;     // 當前位置的 marker
  var lastSearchAt  = 0;        // Nominatim rate-limit (>= 1s gap)
  var DEFAULT_CENTER = [23.5820, 119.6530]; // 雫旅民宿位置（fallback）

  // ── DOM 參考（lazy resolve）─────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }

  // ── HTTP helper ────────────────────────────────────────────────────────
  function authToken() {
    return sessionStorage.getItem('admin_key') || '';
  }
  async function api(method, path, body) {
    var headers = { 'Authorization': 'Bearer ' + authToken() };
    var opts = { method: method, headers: headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    var res = await fetch(path, opts);
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      throw new Error(data.error || ('HTTP ' + res.status));
    }
    return data;
  }

  // ── Render ─────────────────────────────────────────────────────────────
  function applyFilters() {
    return allSpots.filter(function (s) {
      if (filterType && s.type !== filterType) return false;
      if (filterArea && s.area !== filterArea) return false;
      if (filterText) {
        var q = filterText.toLowerCase();
        var hit =
          (s.name || '').toLowerCase().indexOf(q) >= 0 ||
          (s.cat || '').toLowerCase().indexOf(q) >= 0 ||
          (s.note || '').toLowerCase().indexOf(q) >= 0 ||
          (s.id || '').toLowerCase().indexOf(q) >= 0;
        if (!hit) return false;
      }
      return true;
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderList() {
    var list = applyFilters();
    var badge = $('driftCountBadge');
    if (badge) badge.textContent = list.length + ' / ' + allSpots.length;

    var wrap = $('driftSpotList');
    if (!wrap) return;
    if (list.length === 0) {
      wrap.innerHTML = '<p class="text-sm text-stone-400" style="padding:24px 0;text-align:center;">沒有符合的景點</p>';
      return;
    }

    // 依 type DESC（food 先）+ displayOrder + id 排序
    list.sort(function (a, b) {
      if (a.type !== b.type) return a.type === 'food' ? -1 : 1;
      var da = a.displayOrder == null ? 999999 : a.displayOrder;
      var db = b.displayOrder == null ? 999999 : b.displayOrder;
      if (da !== db) return da - db;
      return String(a.id).localeCompare(String(b.id));
    });

    // 分頁：避免一次塞 52 筆
    var totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;
    var pageStart = (currentPage - 1) * PAGE_SIZE;
    var pageItems = list.slice(pageStart, pageStart + PAGE_SIZE);

    var rows = pageItems.map(function (s) {
      var ratingDot = '';
      if (s.rating === 3) ratingDot = '<span style="color:#b8795a;font-size:11px;letter-spacing:0.04em;">● 私藏</span>';
      else if (s.rating === 2) ratingDot = '<span style="color:#8a7a6a;font-size:11px;">○ 推薦</span>';
      else if (s.rating === 1) ratingDot = '<span style="color:#b8b0a6;font-size:11px;">· 一般</span>';
      else ratingDot = '<span style="color:#c4b8a8;font-size:11px;">—</span>';

      var statusBadge = '';
      if (s.status === 'tbd') statusBadge = '<span style="background:#f0e8d8;color:#8a7a6a;padding:1px 7px;border-radius:6px;font-size:10px;margin-left:6px;">整理中</span>';
      else if (s.status === 'irregular') statusBadge = '<span style="background:#e8e1d7;color:#8a7a6a;padding:1px 7px;border-radius:6px;font-size:10px;margin-left:6px;">不定時</span>';

      var nearbyBadge = s.nearby ? '<span style="background:rgba(184,121,90,0.12);color:#b8795a;padding:1px 7px;border-radius:6px;font-size:10px;margin-left:6px;">附近</span>' : '';

      // 類型小圓徽：食=暖橘、景=海洋藍
      var isAttr = s.type === 'attraction';
      var typeLabel = isAttr ? '景點' : '美食';
      var typeChar  = isAttr ? '景' : '食';
      var typeBg    = isAttr ? '#c8d8ec' : '#f0d0b0';
      var typeFg    = isAttr ? '#5680a8' : '#a86840';

      return (
        '<div class="drift-row" data-id="' + escapeHtml(s.id) + '" ' +
          'style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(181,171,160,0.18);cursor:pointer;transition:background 0.15s;">' +
          '<div style="flex-shrink:0;width:32px;height:32px;border-radius:50%;background:' + typeBg + ';color:' + typeFg + ';display:flex;align-items:center;justify-content:center;font-family:\'Cormorant Garamond\',serif;font-size:13px;font-weight:400;">' + typeChar + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:14px;color:#1a1210;letter-spacing:0.04em;">' + escapeHtml(s.name) + statusBadge + nearbyBadge + '</div>' +
            '<div style="font-size:11px;color:#8a7a6a;letter-spacing:0.06em;margin-top:2px;">' + typeLabel + ' · ' + escapeHtml(s.cat || '—') + ' · ' + escapeHtml(s.area || '—') + '</div>' +
          '</div>' +
          '<div style="flex-shrink:0;">' + ratingDot + '</div>' +
        '</div>'
      );
    }).join('');

    // 分頁控制（只有 > 1 頁才顯示）
    var pagerHtml = '';
    if (totalPages > 1) {
      pagerHtml =
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 4px 4px;border-top:1px solid rgba(181,171,160,0.18);margin-top:6px;font-size:12px;color:#8a7a6a;letter-spacing:0.08em;">' +
          '<button id="driftPrevPage" ' + (currentPage <= 1 ? 'disabled' : '') +
            ' style="padding:6px 14px;background:transparent;border:1px solid rgba(181,171,160,0.4);border-radius:8px;font-family:inherit;font-size:11px;color:#8a7a6a;cursor:pointer;' +
            (currentPage <= 1 ? 'opacity:0.35;cursor:not-allowed;' : '') + '">← 上一頁</button>' +
          '<span style="font-family:\'Cormorant Garamond\',serif;font-size:13px;">' + currentPage + ' / ' + totalPages + '　·　共 ' + list.length + ' 筆</span>' +
          '<button id="driftNextPage" ' + (currentPage >= totalPages ? 'disabled' : '') +
            ' style="padding:6px 14px;background:transparent;border:1px solid rgba(181,171,160,0.4);border-radius:8px;font-family:inherit;font-size:11px;color:#8a7a6a;cursor:pointer;' +
            (currentPage >= totalPages ? 'opacity:0.35;cursor:not-allowed;' : '') + '">下一頁 →</button>' +
        '</div>';
    }

    wrap.innerHTML = rows + pagerHtml;

    // 點 row 開編輯
    wrap.querySelectorAll('.drift-row').forEach(function (row) {
      row.addEventListener('click', function () {
        openEditor(row.dataset.id);
      });
      row.addEventListener('mouseenter', function () {
        row.style.background = 'rgba(181,171,160,0.08)';
      });
      row.addEventListener('mouseleave', function () {
        row.style.background = '';
      });
    });

    // 分頁按鈕
    var prevBtn = $('driftPrevPage');
    var nextBtn = $('driftNextPage');
    if (prevBtn) prevBtn.addEventListener('click', function () { if (currentPage > 1) { currentPage--; renderList(); } });
    if (nextBtn) nextBtn.addEventListener('click', function () { if (currentPage < totalPages) { currentPage++; renderList(); } });
  }

  // ── Friend management ─────────────────────────────────────────────────
  function openFriendModal() {
    var modal = $('driftFriendModal');
    if (!modal) return;
    modal.classList.add('active');
    loadFriends();
  }
  function closeFriendModal() {
    var modal = $('driftFriendModal');
    if (modal) modal.classList.remove('active');
  }

  function formatDate(s) {
    if (!s) return '';
    var d = new Date(s);
    if (isNaN(d)) return s.slice(0, 10);
    return d.toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit' });
  }

  async function loadFriends() {
    // 並行抓 pending 和 approved
    var pendingWrap = $('driftPendingList');
    var friendWrap  = $('driftFriendList');
    var badge       = $('driftPendingBadge');
    if (pendingWrap) pendingWrap.innerHTML = '<p class="text-sm text-stone-400" style="padding:14px 0;font-style:italic;">載入中…</p>';
    if (friendWrap)  friendWrap.innerHTML  = '<p class="text-sm text-stone-400" style="padding:14px 0;font-style:italic;">載入中…</p>';

    try {
      var [pRes, aRes] = await Promise.all([
        api('GET', '/api/drift/admin/users?status=pending'),
        api('GET', '/api/drift/admin/users'),
      ]);
      renderPending(pRes.users || []);
      renderFriends(aRes.users || []);
    } catch (e) {
      if (pendingWrap) pendingWrap.innerHTML = '<p class="text-sm text-red-400" style="padding:14px 0;">' + escapeHtml(e.message) + '</p>';
      if (friendWrap)  friendWrap.innerHTML  = '';
    }
  }

  function renderPending(users) {
    var wrap = $('driftPendingList');
    var badge = $('driftPendingBadge');
    var btnBadge = $('driftPendingBadgeBtn');
    if (!wrap) return;
    if (!users.length) {
      wrap.innerHTML = '<p class="text-sm text-stone-400" style="padding:8px 0;font-style:italic;">目前沒有待審申請</p>';
      if (badge) badge.style.display = 'none';
      if (btnBadge) btnBadge.style.display = 'none';
      return;
    }
    if (badge) {
      badge.style.display = '';
      badge.textContent = users.length + ' 筆';
    }
    if (btnBadge) {
      btnBadge.style.display = '';
      btnBadge.textContent = users.length;
    }
    wrap.innerHTML = users.map(function (u) {
      return (
        '<div class="drift-pending-row" data-user-id="' + escapeHtml(u.userId) + '" ' +
          'style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;background:rgba(224,192,128,0.10);border:1px solid rgba(224,192,128,0.3);border-radius:10px;margin-bottom:8px;">' +
          '<div>' +
            '<div style="font-size:13px;color:#1a1210;font-weight:500;">' + escapeHtml(u.displayName || '—') + '</div>' +
            '<div style="font-size:11px;color:#8a7a6a;margin-top:2px;letter-spacing:0.05em;">' + escapeHtml(u.loginId || '') + ' · ' + formatDate(u.createdAt) + '</div>' +
          '</div>' +
          '<div style="display:flex;gap:6px;">' +
            '<button data-action="approve" style="padding:6px 14px;background:#1a1210;color:#f8f5ef;border:none;border-radius:8px;font-size:11px;letter-spacing:0.1em;cursor:pointer;">核准</button>' +
            '<button data-action="reject"  style="padding:6px 14px;background:transparent;color:#9a8a7a;border:1px solid rgba(181,171,160,0.4);border-radius:8px;font-size:11px;letter-spacing:0.1em;cursor:pointer;">拒絕</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');
    wrap.querySelectorAll('.drift-pending-row button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.drift-pending-row');
        var uid = row.dataset.userId;
        reviewFriend(uid, btn.dataset.action);
      });
    });
  }

  function renderFriends(users) {
    var wrap = $('driftFriendList');
    if (!wrap) return;
    // 過濾掉 owner（顯示 owner 在這沒意義）
    var list = users.filter(function (u) { return (u.role || '') !== 'owner' && (u.userId || '') !== 'owner'; });
    if (!list.length) {
      wrap.innerHTML = '<p class="text-sm text-stone-400" style="padding:8px 0;font-style:italic;">目前沒有朋友帳號</p>';
      return;
    }
    wrap.innerHTML =
      '<table style="width:100%;border-collapse:collapse;font-size:13px;">' +
        '<thead><tr style="border-bottom:1px solid rgba(181,171,160,0.3);">' +
          '<th style="text-align:left;padding:8px 10px;font-size:10px;letter-spacing:0.16em;color:#8a7a6a;font-weight:400;">暱稱</th>' +
          '<th style="text-align:left;padding:8px 10px;font-size:10px;letter-spacing:0.16em;color:#8a7a6a;font-weight:400;">帳號</th>' +
          '<th style="text-align:left;padding:8px 10px;font-size:10px;letter-spacing:0.16em;color:#8a7a6a;font-weight:400;">建立</th>' +
          '<th></th>' +
        '</tr></thead><tbody>' +
        list.map(function (u) {
          var uid = escapeHtml(u.userId || u.id || '');
          var nick = escapeHtml(u.displayName || u.nickname || u.loginId || '—');
          var login = escapeHtml(u.loginId || u.account || '');
          var created = formatDate(u.createdAt || u.created_at);
          return (
            '<tr class="drift-friend-row" data-user-id="' + uid + '" data-nick="' + nick + '" style="border-bottom:1px solid rgba(181,171,160,0.15);">' +
              '<td style="padding:12px 10px;font-family:\'Cormorant Garamond\',serif;font-size:16px;color:#1a1210;">' + nick + '</td>' +
              '<td style="padding:12px 10px;font-size:11.5px;color:#8a7a6a;letter-spacing:0.04em;">' + login + '</td>' +
              '<td style="padding:12px 10px;font-size:11px;color:#8a7a6a;">' + created + '</td>' +
              '<td style="padding:12px 10px;text-align:right;">' +
                '<button data-action="delete-friend" style="background:transparent;border:1px solid rgba(107,95,86,0.2);border-radius:6px;padding:5px 10px;font-size:11px;color:#8a7a6a;cursor:pointer;letter-spacing:0.06em;">刪除</button>' +
              '</td>' +
            '</tr>'
          );
        }).join('') +
        '</tbody></table>';
    wrap.querySelectorAll('.drift-friend-row button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var row = btn.closest('.drift-friend-row');
        deleteFriend(row.dataset.userId, row.dataset.nick);
      });
    });
  }

  async function reviewFriend(userId, action) {
    if (!confirm(action === 'approve' ? '確定核准這位朋友？' : '確定拒絕這位朋友？')) return;
    try {
      await api('PATCH', '/api/drift/admin/users/' + encodeURIComponent(userId) + '/' + action);
      loadFriends(); // refresh both lists
    } catch (e) {
      alert('操作失敗：' + e.message);
    }
  }

  async function deleteFriend(userId, nick) {
    if (!confirm('確定刪除「' + nick + '」的帳號？此動作無法復原。')) return;
    try {
      await api('DELETE', '/api/drift/admin/users/' + encodeURIComponent(userId));
      loadFriends();
    } catch (e) {
      alert('刪除失敗：' + e.message);
    }
  }

  // ── Load from API ──────────────────────────────────────────────────────
  async function loadSpots() {
    var wrap = $('driftSpotList');
    if (wrap) wrap.innerHTML = '<p class="text-sm text-stone-400" style="padding:24px 0;text-align:center;">載入中…</p>';
    try {
      var data = await api('GET', '/api/drift/spots');
      allSpots = (data && data.spots) || [];
      renderList();
    } catch (e) {
      if (wrap) wrap.innerHTML = '<p class="text-sm text-red-400" style="padding:24px 0;text-align:center;">載入失敗：' + escapeHtml(e.message) + '</p>';
    }
  }

  // ── Editor modal ───────────────────────────────────────────────────────
  function openEditor(id) {
    editingId = id || null;
    var modal = $('driftSpotModal');
    var title = $('driftModalTitle');
    var delBtn = $('driftDeleteBtn');
    var err = $('driftModalError');
    if (err) err.textContent = '';

    if (editingId) {
      var s = allSpots.find(function (x) { return x.id === editingId; });
      if (!s) return;
      title.textContent = '編輯：' + s.name;
      $('driftFType').value = s.type || 'food';
      $('driftFCat').value = s.cat || '';
      $('driftFName').value = s.name || '';
      $('driftFArea').value = s.area || '';
      $('driftFRating').value = String(s.rating || 0);
      $('driftFPrice').value = s.price || '';
      $('driftFNote').value = s.note || '';
      $('driftFFeature').value = s.feature || '';
      $('driftFTags').value = (s.tags || []).join(' ');
      $('driftFLat').value = s.lat || '';
      $('driftFLng').value = s.lng || '';
      $('driftFStatus').value = s.status || 'open';
      $('driftFNearby').checked = !!s.nearby;
      $('driftFNoLoc').checked = !!s.noLoc;
      $('driftFDisplayOrder').value = s.displayOrder == null ? '' : s.displayOrder;
      delBtn.style.display = '';
      // 既有景點 → 顯示並載入評論清單
      $('driftReviewsSection').style.display = '';
      loadSpotReviews(editingId);
    } else {
      title.textContent = '新增景點';
      $('driftFType').value = 'food';
      $('driftFCat').value = '';
      $('driftFName').value = '';
      $('driftFArea').value = '';
      $('driftFRating').value = '0';
      $('driftFPrice').value = '';
      $('driftFNote').value = '';
      $('driftFFeature').value = '';
      $('driftFTags').value = '';
      $('driftFLat').value = '';
      $('driftFLng').value = '';
      $('driftFStatus').value = 'open';
      $('driftFNearby').checked = false;
      $('driftFNoLoc').checked = false;
      $('driftFDisplayOrder').value = '';
      delBtn.style.display = 'none';
      // 新增景點時隱藏評論區
      $('driftReviewsSection').style.display = 'none';
    }
    modal.classList.add('active');
  }

  // ── Spot reviews（在編輯 modal 內顯示，可置頂 / 刪除）─────────────────
  async function loadSpotReviews(spotId) {
    var wrap = $('driftReviewsList');
    var countEl = $('driftReviewsCount');
    if (!wrap) return;
    wrap.innerHTML = '<p class="text-sm text-stone-400" style="padding:6px 0;font-style:italic;">載入中…</p>';
    try {
      var data = await api('GET', '/api/drift/reviews?spotId=' + encodeURIComponent(spotId));
      var reviews = (data && data.reviews) || [];
      if (countEl) countEl.textContent = '（' + reviews.length + '）';
      if (!reviews.length) {
        wrap.innerHTML = '<p class="text-sm text-stone-400" style="padding:6px 0;font-style:italic;">尚無評論</p>';
        return;
      }
      wrap.innerHTML = reviews.map(function (r) {
        var pinned = r.pinnedOrder != null;
        var isOwnerRv = r.isOwner === 1 || r.isOwner === true || r.userId === 'owner';
        var pinIcon = pinned ? '★ 置頂中' : '☆ 置頂';
        var pinColor = pinned ? '#b8795a' : '#8a7a6a';
        return (
          '<div class="drift-review-row" data-review-id="' + escapeHtml(r.reviewId) + '" data-pinned="' + (pinned ? '1' : '0') + '" ' +
            'style="border:1px solid ' + (pinned ? 'rgba(184,121,90,0.4)' : 'rgba(181,171,160,0.25)') + ';background:' + (pinned ? 'rgba(184,121,90,0.06)' : 'transparent') + ';border-radius:10px;padding:12px 14px;margin-bottom:8px;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;">' +
              '<div style="font-size:11px;letter-spacing:0.1em;color:' + (isOwnerRv ? '#b8795a' : '#8a7a6a') + ';">' +
                escapeHtml(r.author || (isOwnerRv ? '雫編' : '朋友')) +
              '</div>' +
              '<div style="display:flex;gap:4px;">' +
                '<button data-action="pin" style="padding:4px 10px;font-size:10.5px;background:transparent;border:1px solid rgba(181,171,160,0.4);border-radius:6px;color:' + pinColor + ';cursor:pointer;letter-spacing:0.06em;">' + pinIcon + '</button>' +
                '<button data-action="delete-review" style="padding:4px 10px;font-size:10.5px;background:transparent;border:1px solid rgba(181,171,160,0.4);border-radius:6px;color:#b94040;cursor:pointer;letter-spacing:0.06em;">刪除</button>' +
              '</div>' +
            '</div>' +
            '<div style="font-size:13px;line-height:1.7;color:#1a1210;letter-spacing:0.03em;">' + escapeHtml(r.note || '') + '</div>' +
          '</div>'
        );
      }).join('');

      // wire buttons
      wrap.querySelectorAll('.drift-review-row button').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var row = btn.closest('.drift-review-row');
          var rid = row.dataset.reviewId;
          var act = btn.dataset.action;
          if (act === 'pin') {
            togglePinReview(rid, row.dataset.pinned !== '1', spotId);
          } else if (act === 'delete-review') {
            deleteReview(rid, spotId);
          }
        });
      });
    } catch (e) {
      wrap.innerHTML = '<p class="text-sm text-red-400" style="padding:6px 0;">載入失敗：' + escapeHtml(e.message) + '</p>';
    }
  }

  async function togglePinReview(reviewId, pinned, spotId) {
    try {
      await api('PATCH', '/api/drift/reviews/' + encodeURIComponent(reviewId) + '/pin', { pinned: pinned });
      loadSpotReviews(spotId);
    } catch (e) {
      alert('置頂失敗：' + e.message);
    }
  }

  async function deleteReview(reviewId, spotId) {
    if (!confirm('確定刪除這則評論？')) return;
    try {
      await api('DELETE', '/api/drift/reviews/' + encodeURIComponent(reviewId));
      loadSpotReviews(spotId);
    } catch (e) {
      alert('刪除失敗：' + e.message);
    }
  }

  function closeEditor() {
    $('driftSpotModal').classList.remove('active');
    editingId = null;
    // 重設地圖選點區（收起來，下次開新景點時不會殘留）
    var picker = $('driftMapPicker');
    if (picker) picker.style.display = 'none';
  }

  // ── 地圖選點：lazy init + 拖曳/點擊更新 lat/lng ───────────────────────
  function ensurePickerMap() {
    if (pickerMap || typeof L === 'undefined') return pickerMap;
    var el = $('driftMap');
    if (!el) return null;

    // 取當前 lat/lng（若空，用雫旅民宿）
    var lat = Number($('driftFLat').value) || DEFAULT_CENTER[0];
    var lng = Number($('driftFLng').value) || DEFAULT_CENTER[1];

    pickerMap = L.map(el, { zoomControl: true }).setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(pickerMap);

    pickerMarker = L.marker([lat, lng], { draggable: true }).addTo(pickerMap);
    pickerMarker.on('dragend', function () {
      var p = pickerMarker.getLatLng();
      $('driftFLat').value = p.lat.toFixed(4);
      $('driftFLng').value = p.lng.toFixed(4);
    });
    pickerMap.on('click', function (e) {
      pickerMarker.setLatLng(e.latlng);
      $('driftFLat').value = e.latlng.lat.toFixed(4);
      $('driftFLng').value = e.latlng.lng.toFixed(4);
    });
    return pickerMap;
  }

  function showPicker() {
    var box = $('driftMapPicker');
    if (!box) return;
    box.style.display = '';
    // Leaflet 在「先隱藏才顯示」時要 invalidateSize 才會正確繪製
    setTimeout(function () {
      var m = ensurePickerMap();
      if (m) {
        m.invalidateSize();
        // 若 lat/lng 有值，移動到那個位置
        var lat = Number($('driftFLat').value);
        var lng = Number($('driftFLng').value);
        if (lat && lng) {
          pickerMarker.setLatLng([lat, lng]);
          m.setView([lat, lng], 15);
        }
      }
    }, 50);
  }

  function hidePicker() {
    var box = $('driftMapPicker');
    if (box) box.style.display = 'none';
  }

  function toggleMapPicker() {
    var box = $('driftMapPicker');
    if (!box) return;
    if (box.style.display === 'none' || !box.style.display) showPicker();
    else hidePicker();
  }

  async function searchPlace() {
    var q = ($('driftMapSearch').value || '').trim();
    if (!q) return;

    // Nominatim 使用政策：>= 1 req/sec
    var now = Date.now();
    var since = now - lastSearchAt;
    if (since < 1100) {
      await new Promise(function (r) { setTimeout(r, 1100 - since); });
    }
    lastSearchAt = Date.now();

    var btn = $('driftMapSearchBtn');
    btn.disabled = true; var oldTxt = btn.textContent; btn.textContent = '…';
    try {
      // 加上「澎湖」當區域提示，提升小店命中率
      var query = encodeURIComponent(q.indexOf('澎湖') >= 0 ? q : q + ' 澎湖');
      var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + query;
      var res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW' } });
      var arr = await res.json();
      if (!arr || arr.length === 0) {
        alert('找不到「' + q + '」');
        return;
      }
      var hit = arr[0];
      var lat = parseFloat(hit.lat);
      var lng = parseFloat(hit.lon);
      $('driftFLat').value = lat.toFixed(4);
      $('driftFLng').value = lng.toFixed(4);
      ensurePickerMap();
      pickerMarker.setLatLng([lat, lng]);
      pickerMap.setView([lat, lng], 16);
    } catch (e) {
      alert('搜尋失敗：' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = oldTxt;
    }
  }

  function collectForm() {
    var tagsRaw = ($('driftFTags').value || '').trim();
    var tagsArr = tagsRaw ? tagsRaw.split(/\s+/).filter(Boolean) : [];
    return {
      type: $('driftFType').value,
      cat: $('driftFCat').value,
      name: ($('driftFName').value || '').trim(),
      area: $('driftFArea').value,
      rating: Number($('driftFRating').value || 0),
      price: $('driftFPrice').value,
      note: ($('driftFNote').value || '').trim(),
      feature: ($('driftFFeature').value || '').trim(),
      tags: tagsArr,
      lat: $('driftFLat').value === '' ? 0 : Number($('driftFLat').value),
      lng: $('driftFLng').value === '' ? 0 : Number($('driftFLng').value),
      status: $('driftFStatus').value,
      nearby: $('driftFNearby').checked,
      noLoc: $('driftFNoLoc').checked,
      displayOrder: $('driftFDisplayOrder').value === '' ? null : Number($('driftFDisplayOrder').value),
    };
  }

  async function saveSpot() {
    var err = $('driftModalError');
    err.textContent = '';
    var data = collectForm();
    if (!data.name) { err.textContent = '請填寫店名 / 景點名'; return; }

    var btn = $('driftSaveBtn');
    btn.disabled = true; btn.textContent = '儲存中…';
    try {
      var result;
      if (editingId) {
        result = await api('PUT', '/api/drift/spots/' + encodeURIComponent(editingId), data);
      } else {
        result = await api('POST', '/api/drift/spots', data);
      }
      // 更新本地 cache 而不是重抓整個列表
      if (result && result.spot) {
        var idx = allSpots.findIndex(function (x) { return x.id === result.spot.id; });
        if (idx >= 0) allSpots[idx] = result.spot;
        else allSpots.unshift(result.spot);
      }
      renderList();
      closeEditor();
    } catch (e) {
      err.textContent = e.message || '儲存失敗';
    } finally {
      btn.disabled = false; btn.textContent = '儲存';
    }
  }

  async function deleteSpot() {
    if (!editingId) return;
    var s = allSpots.find(function (x) { return x.id === editingId; });
    if (!s) return;
    if (!confirm('確定要刪除「' + s.name + '」嗎？此動作無法復原。')) return;
    var btn = $('driftDeleteBtn');
    btn.disabled = true;
    try {
      await api('DELETE', '/api/drift/spots/' + encodeURIComponent(editingId));
      allSpots = allSpots.filter(function (x) { return x.id !== editingId; });
      renderList();
      closeEditor();
    } catch (e) {
      $('driftModalError').textContent = '刪除失敗：' + e.message;
    } finally {
      btn.disabled = false;
    }
  }

  // ── Init（由 app.js 的 switchTab('drift') 觸發）───────────────────────
  window.driftInit = function () {
    if (initialized) {
      // 重複進入 tab 時可以保留資料，不強制重抓
      return;
    }
    initialized = true;

    // 按鈕事件
    $('driftNewSpotBtn').addEventListener('click', function () { openEditor(null); });

    // 朋友管理 modal 開關
    $('driftManageFriendsBtn').addEventListener('click', openFriendModal);
    $('driftFriendModalCloseBtn').addEventListener('click', closeFriendModal);
    $('driftFriendModal').addEventListener('click', function (e) {
      if (e.target === $('driftFriendModal')) closeFriendModal();
    });
    var reloadFriendsBtn = $('driftReloadFriendsBtn');
    if (reloadFriendsBtn) reloadFriendsBtn.addEventListener('click', loadFriends);

    // Modal 事件
    $('driftModalCloseBtn').addEventListener('click', closeEditor);
    $('driftCancelBtn').addEventListener('click', closeEditor);
    $('driftSaveBtn').addEventListener('click', saveSpot);
    $('driftDeleteBtn').addEventListener('click', deleteSpot);
    $('driftSpotModal').addEventListener('click', function (e) {
      if (e.target === $('driftSpotModal')) closeEditor();
    });

    // 地圖選點
    $('driftToggleMapBtn').addEventListener('click', toggleMapPicker);
    $('driftMapSearchBtn').addEventListener('click', searchPlace);
    $('driftMapSearch').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); searchPlace(); }
    });

    // 篩選（任何改變都回第 1 頁，避免位在不存在的分頁上）
    var debounceTimer;
    $('driftSearch').addEventListener('input', function (e) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        filterText = e.target.value || ''; currentPage = 1; renderList();
      }, 150);
    });
    $('driftFilterType').addEventListener('change', function (e) { filterType = e.target.value; currentPage = 1; renderList(); });
    $('driftFilterArea').addEventListener('change', function (e) { filterArea = e.target.value; currentPage = 1; renderList(); });

    loadSpots();
    loadFriends();
  };
})();

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

    var rows = list.map(function (s) {
      var ratingDot = '';
      if (s.rating === 3) ratingDot = '<span style="color:#b8795a;font-size:11px;letter-spacing:0.04em;">● 私藏</span>';
      else if (s.rating === 2) ratingDot = '<span style="color:#8a7a6a;font-size:11px;">○ 推薦</span>';
      else if (s.rating === 1) ratingDot = '<span style="color:#b8b0a6;font-size:11px;">· 一般</span>';
      else ratingDot = '<span style="color:#c4b8a8;font-size:11px;">—</span>';

      var statusBadge = '';
      if (s.status === 'tbd') statusBadge = '<span style="background:#f0e8d8;color:#8a7a6a;padding:1px 7px;border-radius:6px;font-size:10px;margin-left:6px;">整理中</span>';
      else if (s.status === 'irregular') statusBadge = '<span style="background:#e8e1d7;color:#8a7a6a;padding:1px 7px;border-radius:6px;font-size:10px;margin-left:6px;">不定時</span>';

      var nearbyBadge = s.nearby ? '<span style="background:rgba(184,121,90,0.12);color:#b8795a;padding:1px 7px;border-radius:6px;font-size:10px;margin-left:6px;">附近</span>' : '';

      var typeLabel = s.type === 'attraction' ? '景點' : '美食';

      return (
        '<div class="drift-row" data-id="' + escapeHtml(s.id) + '" ' +
          'style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-bottom:1px solid rgba(181,171,160,0.18);cursor:pointer;transition:background 0.15s;">' +
          '<div style="flex-shrink:0;width:48px;text-align:right;font-family:\'Cormorant Garamond\',serif;font-size:11px;color:#c4b8a8;letter-spacing:0.05em;">' + escapeHtml(s.id) + '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-size:14px;color:#1a1210;letter-spacing:0.04em;">' + escapeHtml(s.name) + statusBadge + nearbyBadge + '</div>' +
            '<div style="font-size:11px;color:#8a7a6a;letter-spacing:0.06em;margin-top:2px;">' + typeLabel + ' · ' + escapeHtml(s.cat || '—') + ' · ' + escapeHtml(s.area || '—') + '</div>' +
          '</div>' +
          '<div style="flex-shrink:0;">' + ratingDot + '</div>' +
        '</div>'
      );
    }).join('');

    wrap.innerHTML = rows;

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
    }
    modal.classList.add('active');
  }

  function closeEditor() {
    $('driftSpotModal').classList.remove('active');
    editingId = null;
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
    $('driftReloadBtn').addEventListener('click', loadSpots);
    $('driftNewSpotBtn').addEventListener('click', function () { openEditor(null); });

    // Modal 事件
    $('driftModalCloseBtn').addEventListener('click', closeEditor);
    $('driftCancelBtn').addEventListener('click', closeEditor);
    $('driftSaveBtn').addEventListener('click', saveSpot);
    $('driftDeleteBtn').addEventListener('click', deleteSpot);
    $('driftSpotModal').addEventListener('click', function (e) {
      if (e.target === $('driftSpotModal')) closeEditor();
    });

    // 篩選
    var debounceTimer;
    $('driftSearch').addEventListener('input', function (e) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function () {
        filterText = e.target.value || '';
        renderList();
      }, 150);
    });
    $('driftFilterType').addEventListener('change', function (e) { filterType = e.target.value; renderList(); });
    $('driftFilterArea').addEventListener('change', function (e) { filterArea = e.target.value; renderList(); });

    loadSpots();
  };
})();

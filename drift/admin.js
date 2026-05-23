/* ════════════════════════════════════════════════
   CONFIG & API
════════════════════════════════════════════════ */
const DRIFT_API_ROOT = '/api/drift';
const DRIFT_TOKEN_KEY = 'drift_user_token';

function getAuthToken() {
  return localStorage.getItem(DRIFT_TOKEN_KEY) || '';
}

async function apiRequest(path, options = {}) {
  const method = options.method || 'GET';
  const headers = { Accept: 'application/json' };
  const token = options.auth === false ? '' : getAuthToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    const res = await fetch(DRIFT_API_ROOT + path, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errStr = (typeof data.error === 'string' && data.error)
        || (typeof data.message === 'string' && data.message)
        || (data.error && typeof data.error === 'object' && data.error.message)
        || '請求失敗';
      return { ...data, success: false, message: errStr };
    }
    return data;
  } catch(e) {
    return { success: false, message: '網路錯誤' };
  }
}
function apiGet(path, params = {}, options = {}) {
  const qs = new URLSearchParams(params).toString();
  return apiRequest(path + (qs ? '?' + qs : ''), { ...options, method: 'GET' });
}
function apiPost(path, body = {}, options = {}) {
  return apiRequest(path, { ...options, method: 'POST', body });
}
function apiPut(path, body = {}, options = {}) {
  return apiRequest(path, { ...options, method: 'PUT', body });
}
function apiDelete(path, options = {}) {
  return apiRequest(path, { ...options, method: 'DELETE' });
}
function apiPatch(path, body = {}, options = {}) {
  return apiRequest(path, { ...options, method: 'PATCH', body: JSON.stringify(body) });
}
function normalizeReview(rv) {
  const isOwner = rv.isOwner === true || rv.isOwner === 1 || rv.role === 'owner' || rv.userId === 'owner';
  return {
    ...rv,
    id: rv.id || rv.reviewId,
    userId: rv.userId || rv.authorId || '',
    role: rv.role || (isOwner ? 'owner' : 'friend'),
    nickname: rv.nickname || rv.authorName || rv.author || (isOwner ? '主理人' : '朋友'),
    note: rv.note || ''
  };
}
function normalizeUser(u) {
  return {
    ...u,
    id: u.id || u.userId,
    account: u.account || u.loginId,
    nickname: u.nickname || u.displayName,
    created_at: u.created_at || u.createdAt
  };
}

/* ════════════════════════════════════════════════
   MOCK DATA (fallback when API unavailable)
════════════════════════════════════════════════ */
const MOCK_SPOTS = [
  {
    id: 'mock-1', name: '藍冉 Yukkuri', area: '馬公市區', type: '咖啡甜點',
    address: '治平路5號', rating: '4.9', ratingCount: '42'
  },
  {
    id: 'mock-2', name: '鐘記燒餅', area: '馬公市區', type: '早餐',
    address: '中正路113號', rating: '4.7', ratingCount: '118'
  },
  {
    id: 'mock-3', name: '新村小吃部', area: '湖西鄉', type: '小吃',
    address: '湖西村中山路旁', rating: '4.6', ratingCount: '55'
  }
];
const MOCK_REVIEWS = {
  'mock-1': [
    { id: 'r1', userId: 'owner', role: 'owner', nickname: '主理人', note: '每次回馬公必訪。老闆手沖的品味很細膩，環境也是難得的沉靜。' },
    { id: 'r2', userId: 'friend1', role: 'friend', nickname: '愛吃鬼 A', note: '傍晚來坐著看窗外很有感覺，蛋糕也好吃。' }
  ],
  'mock-2': [
    { id: 'r3', userId: 'owner', role: 'owner', nickname: '主理人', note: '馬公老城區的早晨標配。芝麻燒餅配熱豆漿，簡單的幸福。' }
  ],
  'mock-3': []
};

/* ════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════ */
let currentToken    = null;
let currentRole     = null;
let currentNick     = null;
let currentUserId   = null;
let allSpots        = [];
let allReviews      = {};  // spotId -> reviews[]
let isMockMode      = false;

/* ════════════════════════════════════════════════
   UTILITIES
════════════════════════════════════════════════ */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function showToast(msg, duration = 2200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
function formatDate(str) {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return str;
  return d.toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit' });
}

/* ════════════════════════════════════════════════
   LOGIN / REGISTER FORMS
════════════════════════════════════════════════ */
function showForm(mode) {
  document.getElementById('loginForm').style.display    = mode === 'login'    ? '' : 'none';
  document.getElementById('registerForm').style.display = mode === 'register' ? '' : 'none';
  document.getElementById('pendingView').style.display  = mode === 'pending'  ? 'flex' : 'none';
}

document.getElementById('btnLogin').addEventListener('click', doLogin);
document.getElementById('loginPassword').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('btnRegister').addEventListener('click', doRegister);

// ── Event delegation (CSP-safe replacement for inline onclick/onchange) ──
document.addEventListener('click', function(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  const sid = el.dataset.spotId;
  const who = el.dataset.who;
  const rid = el.dataset.reviewId;
  const uid = el.dataset.userId;
  switch (a) {
    case 'show-register':            showForm('register'); break;
    case 'show-login':               showForm('login'); break;
    case 'logout':                   logout(); break;
    case 'fetch-spot':               fetchSpotData(); break;
    case 'save-persona':             savePersona(); break;
    case 'start-edit':               startEdit(sid, who, rid); break;
    case 'ai-polish':                aiPolish(sid); break;
    case 'start-new-owner-review':   startNewOwnerReview(sid); break;
    case 'delete-friend-review':     deleteFriendReview(rid, sid); break;
    case 'open-new-friend-review':   openNewFriendReview(sid); break;
    case 'cancel-edit':              cancelEdit(sid, who, rid, el.dataset.original || ''); break;
    case 'save-edit':                saveEdit(sid, who, rid); break;
    case 'cancel-new-owner-review':  cancelNewOwnerReview(sid); break;
    case 'save-new-owner-review':    saveNewOwnerReview(sid); break;
    case 'cancel-new-friend-review': cancelNewFriendReview(sid); break;
    case 'save-new-friend-review':   saveNewFriendReview(sid); break;
    case 'review-user':              reviewUser(uid, el.dataset.decision); break;
    case 'delete-user':              deleteUser(uid, el.dataset.nick); break;
  }
});

document.addEventListener('change', function(e) {
  const el = e.target.closest('[data-action="apply-filters"]');
  if (el) applyFilters();
});

async function doLogin() {
  const account  = document.getElementById('loginAccount').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  errEl.textContent = '';
  if (!account || !password) { errEl.textContent = '請填寫帳號與密碼'; return; }

  const btn = document.getElementById('btnLogin');
  btn.disabled = true; btn.textContent = '登入中…';

  const r = await apiPost('/login', { loginId: account, password }, { auth: false });

  if (r.success) {
    localStorage.setItem(DRIFT_TOKEN_KEY,        r.token       || '');
    localStorage.setItem('drift_admin_role',     r.role        || 'friend');
    localStorage.setItem('drift_admin_nickname', r.displayName || r.nickname || account);
    localStorage.setItem('drift_admin_userId',   r.userId      || '');
    enterDashboard(r.token, r.role, r.displayName || r.nickname, r.userId);
  } else {
    errEl.textContent = r.message || '帳號或密碼錯誤';
    btn.disabled = false; btn.textContent = '登入';
  }
}

async function doRegister() {
  const nickname = document.getElementById('regNickname').value.trim();
  const account  = document.getElementById('regAccount').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;
  const errEl    = document.getElementById('registerError');
  errEl.textContent = '';
  if (!nickname || !account || !password) { errEl.textContent = '請填寫所有欄位'; return; }
  if (password !== confirm) { errEl.textContent = '兩次密碼不一致'; return; }

  const btn = document.getElementById('btnRegister');
  btn.disabled = true; btn.textContent = '申請中…';

  const r = await apiPost('/register', { loginId: account, displayName: nickname, password }, { auth: false });
  if (r.success && r.pending) {
    showForm('pending');
  } else if (r.success) {
    errEl.style.color = 'var(--accent)';
    errEl.textContent = '帳號建立成功！請登入。';
    setTimeout(() => { errEl.style.color = ''; showForm('login'); }, 1500);
  } else {
    errEl.textContent = r.error || r.message || '申請失敗，請稍後再試';
  }
  btn.disabled = false; btn.textContent = '建立帳號';
}

/* ════════════════════════════════════════════════
   LOGOUT
════════════════════════════════════════════════ */
function logout() {
  [DRIFT_TOKEN_KEY,'drift_admin_token','drift_admin_role','drift_admin_nickname','drift_admin_userId']
    .forEach(k => localStorage.removeItem(k));
  currentToken = currentRole = currentNick = currentUserId = null;
  allSpots = []; allReviews = {};
  document.getElementById('dashView').style.display  = 'none';
  document.getElementById('loginView').style.display = '';
  document.getElementById('loginAccount').value  = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').textContent  = '';
}

/* ════════════════════════════════════════════════
   ENTER DASHBOARD
════════════════════════════════════════════════ */
async function enterDashboard(token, role, nick, userId) {
  currentToken  = token;
  currentRole   = role  || 'friend';
  currentNick   = nick  || '';
  currentUserId = userId || '';

  document.getElementById('loginView').style.display = 'none';
  document.getElementById('dashView').style.display  = 'flex';
  document.getElementById('roleDisplay').textContent = '當前身分：' + (currentNick || '—');

  await loadAllData();
  renderDashboard();
}

/* ════════════════════════════════════════════════
   DATA LOADING
════════════════════════════════════════════════ */
async function loadAllData() {
  const container = document.getElementById('mainContainer');
  container.innerHTML = '<div class="state-loading"><div class="spinner"></div><br>載入中…</div>';

  // Worker routes currently expose auth/profile/reviews/admin, not spots.
  // Keep the local spot list and attach live reviews through /api/drift/reviews.
  isMockMode = false;
  allSpots = MOCK_SPOTS;
  allReviews = {};
  const reviewResults = await Promise.all(
    allSpots.map(sp => apiGet('/reviews', { spotId: sp.id }))
  );
  allSpots.forEach((sp, i) => {
    allReviews[sp.id] = (reviewResults[i].success && reviewResults[i].reviews)
      ? reviewResults[i].reviews.map(normalizeReview)
      : [];
  });

  // Resolve current user id from profile if not set
  if (!currentUserId && currentToken) {
    const p = await apiGet('/profile');
    if (p.success) {
      currentUserId = p.userId || '';
      if (p.displayName || p.nickname) {
        currentNick = p.displayName || p.nickname;
        document.getElementById('roleDisplay').textContent = '當前身分：' + currentNick;
      }
    }
  }
}

/* ════════════════════════════════════════════════
   RENDER DASHBOARD
════════════════════════════════════════════════ */
function renderDashboard() {
  const container = document.getElementById('mainContainer');
  const isOwner   = currentRole === 'owner';

  let html = '';

  /* ── Owner section ── */
  if (isOwner) {
    html += `
    <div id="owner-section">
      <div class="section-title">新增收錄</div>
      <div class="search-box">
        <input type="text" class="search-input" id="searchInput"
          placeholder="在 Google 地圖搜尋店名或景點…" />
        <button class="btn-search" data-action="fetch-spot">抓取資料</button>
      </div>
    </div>`;
  }

  /* ── Friend persona section ── */
  if (!isOwner) {
    html += `
    <div id="friend-section">
      <div class="persona-box">
        <div class="persona-title">✍️ 我的味蕾人設（顯示名稱：${esc(currentNick)}）</div>
        <textarea class="persona-input" id="personaInput" rows="2"
          placeholder="一句話描述你的飲食風格，例：喜歡在小巷裡尋找隱藏版早餐的人。"></textarea>
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;">
          <span class="persona-feedback" id="personaFeedback">✓ 已儲存</span>
          <button class="btn-save-persona" data-action="save-persona">儲存設定</button>
        </div>
      </div>
    </div>`;
  }

  /* ── Filter row ── */
  const areas = ['全部','馬公市區','湖西鄉','白沙鄉','西嶼鄉'];
  const types = ['全部','早餐','小吃','海鮮餐廳','宵夜','咖啡甜點','景點'];

  html += `
  <div class="filter-row">
    <select class="filter-select" id="filterArea" data-action="apply-filters">
      ${areas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('')}
    </select>
    <select class="filter-select" id="filterType" data-action="apply-filters">
      ${types.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join('')}
    </select>
  </div>
  <div class="section-title">已收錄清單${isMockMode ? '（預覽資料）' : ''}</div>
  <div id="spotList"></div>`;

  /* ── Owner: user management ── */
  if (isOwner) {
    html += `
    <div class="users-section" id="usersSection">
      <div class="users-section-title">待審申請 <span id="pendingBadge" style="display:none;background:#e0c080;color:#5a4010;font-size:10px;padding:2px 8px;border-radius:10px;letter-spacing:.05em;margin-left:6px;"></span></div>
      <div id="pendingContainer"><div class="state-loading"><div class="spinner"></div><br>載入中…</div></div>
      <div class="users-section-title" style="margin-top:28px;">已開通好友</div>
      <div id="usersContainer"><div class="state-loading"><div class="spinner"></div><br>載入中…</div></div>
    </div>`;
  }

  container.innerHTML = html;

  // Render spots
  renderSpotList();

  // Load persona for friends
  if (!isOwner) loadPersona();

  // Load users for owner
  if (isOwner) { loadPendingUsers(); loadUsers(); }
}

/* ════════════════════════════════════════════════
   SPOT LIST
════════════════════════════════════════════════ */
function renderSpotList() {
  const listEl  = document.getElementById('spotList');
  if (!listEl) return;

  const area    = (document.getElementById('filterArea') || {}).value || '全部';
  const type    = (document.getElementById('filterType') || {}).value || '全部';
  const isOwner = currentRole === 'owner';

  const visible = allSpots.filter(sp => {
    const matchArea = area === '全部' || sp.area === area;
    const matchType = type === '全部' || sp.type === type || sp.category === type;
    return matchArea && matchType;
  });

  if (!visible.length) {
    listEl.innerHTML = '<div class="state-empty">沒有符合篩選條件的景點</div>';
    return;
  }

  listEl.innerHTML = visible.map(sp => renderSpotCard(sp, isOwner)).join('');
}

function applyFilters() {
  renderSpotList();
}

function renderSpotCard(sp, isOwner) {
  const reviews = allReviews[sp.id] || [];
  const ownerRv = reviews.find(r => r.role === 'owner');
  const friendRvs = reviews.filter(r => r.role !== 'owner');

  // Detect my own review (for friend)
  const myRv = !isOwner
    ? reviews.find(r => r.userId === currentUserId || r.authorId === currentUserId)
    : null;

  const ratingStr = sp.rating
    ? `⭐ ${esc(sp.rating)}${sp.ratingCount ? ' (' + esc(sp.ratingCount) + ')' : ''}`
    : '';

  const metaParts = [sp.area, sp.address].filter(Boolean).map(esc).join(' · ');

  let html = `<div class="spot-card" data-id="${esc(sp.id)}" data-area="${esc(sp.area||'')}" data-type="${esc(sp.type||sp.category||'')}">
    <div class="spot-header">
      <div>
        <div class="spot-name">${esc(sp.name)}</div>
        <div class="spot-meta">${metaParts}</div>
      </div>
      ${ratingStr ? `<div class="google-badge">${ratingStr}</div>` : ''}
    </div>`;

  /* ── Owner review ── */
  if (isOwner) {
    // Owner's own review
    if (ownerRv) {
      html += `
    <div class="review-item" id="ri_owner_${esc(sp.id)}">
      <div class="review-author">主理人</div>
      <div class="review-text" id="rt_owner_${esc(sp.id)}">${esc(ownerRv.note || '')}</div>
      <div class="review-actions owner-only">
        <div style="display:flex;gap:8px;">
          <button class="btn-text" data-action="start-edit" data-spot-id="${esc(sp.id)}" data-who="owner" data-review-id="${esc(ownerRv.id)}">編輯內容</button>
          <button class="btn-text btn-ai" data-action="ai-polish" data-spot-id="${esc(sp.id)}">✨ AI 潤飾</button>
        </div>
      </div>
    </div>`;
    } else {
      html += `
    <div id="ri_owner_${esc(sp.id)}">
      <button class="btn-add-review" data-action="start-new-owner-review" data-spot-id="${esc(sp.id)}">+ 新增主理人點評</button>
    </div>`;
    }

    // Friend reviews (owner can see & delete)
    friendRvs.forEach(rv => {
      html += `
    <div class="review-item" id="ri_${esc(rv.id)}">
      <div class="review-item-inner">
        <div class="review-item-body">
          <div class="review-author">${esc(rv.nickname || rv.authorName || '朋友')}</div>
          <div class="review-text">${esc(rv.note || '')}</div>
        </div>
        <button class="btn-delete-review" title="刪除此評論"
          data-action="delete-friend-review" data-review-id="${esc(rv.id)}" data-spot-id="${esc(sp.id)}">×</button>
      </div>
    </div>`;
    });

  } else {
    /* ── Friend view ── */

    // Owner review (read-only for friends)
    if (ownerRv) {
      html += `
    <div class="review-item">
      <div class="review-author">主理人</div>
      <div class="review-text">${esc(ownerRv.note || '')}</div>
    </div>`;
    }

    // Other friends' reviews (read-only)
    friendRvs.forEach(rv => {
      const isMe = rv.userId === currentUserId || rv.authorId === currentUserId;
      if (isMe) return; // rendered separately below
      html += `
    <div class="review-item">
      <div class="review-author">${esc(rv.nickname || rv.authorName || '朋友')}</div>
      <div class="review-text">${esc(rv.note || '')}</div>
    </div>`;
    });

    // My own review
    if (myRv) {
      html += `
    <div class="review-item friend-review" id="ri_my_${esc(sp.id)}">
      <div class="review-author">${esc(myRv.nickname || currentNick || '你')}（你）</div>
      <div class="review-text" id="rt_my_${esc(sp.id)}">${esc(myRv.note || '')}</div>
      <div class="review-actions friend-only">
        <button class="btn-text" data-action="start-edit" data-spot-id="${esc(sp.id)}" data-who="friend" data-review-id="${esc(myRv.id)}">編輯我的點評</button>
      </div>
    </div>`;
    } else {
      // No own review yet
      html += `
    <div id="ri_my_${esc(sp.id)}">
      <button class="btn-add-review friend-only"
        data-action="open-new-friend-review" data-spot-id="${esc(sp.id)}">+ 加上我的私藏點評</button>
    </div>`;
    }
  }

  html += `</div>`; // .spot-card
  return html;
}

/* ════════════════════════════════════════════════
   EDIT / SAVE REVIEWS
════════════════════════════════════════════════ */
function startEdit(spotId, who, reviewId) {
  const textId = who === 'owner' ? `rt_owner_${spotId}` : `rt_my_${spotId}`;
  const textEl = document.getElementById(textId);
  if (!textEl) return;

  const existing = textEl.textContent;
  const parent   = textEl.closest('.review-item');

  // Replace content area with editor
  textEl.outerHTML = `
    <textarea class="review-edit-area" id="ea_${spotId}_${who}">${esc(existing)}</textarea>
    <div class="review-edit-actions">
      <button class="btn-edit-cancel" data-action="cancel-edit" data-spot-id="${esc(spotId)}" data-who="${esc(who)}" data-review-id="${esc(reviewId)}" data-original="${esc(existing)}">取消</button>
      <button class="btn-edit-save" data-action="save-edit" data-spot-id="${esc(spotId)}" data-who="${esc(who)}" data-review-id="${esc(reviewId)}">儲存</button>
    </div>`;
}

function cancelEdit(spotId, who, reviewId, original) {
  const ea = document.getElementById(`ea_${spotId}_${who}`);
  if (!ea) return;
  const actionsEl = ea.nextElementSibling;

  // Restore original text div
  const textId = who === 'owner' ? `rt_owner_${spotId}` : `rt_my_${spotId}`;
  ea.outerHTML = `<div class="review-text" id="${textId}">${esc(original)}</div>`;
  if (actionsEl) actionsEl.remove();
}

async function saveEdit(spotId, who, reviewId) {
  const ea   = document.getElementById(`ea_${spotId}_${who}`);
  if (!ea) return;
  const note = ea.value.trim();
  if (!note) return;

  let r;
  if (isMockMode) {
    // Update mock data
    const rv = allReviews[spotId] && allReviews[spotId].find(x => x.id === reviewId);
    if (rv) rv.note = note;
    r = { success: true };
  } else {
    r = await apiPost('/reviews', { spotId, note, rating: 0 });
  }

  if (r.success) {
    const actionsEl = ea.nextElementSibling;
    const textId    = who === 'owner' ? `rt_owner_${spotId}` : `rt_my_${spotId}`;
    ea.outerHTML = `<div class="review-text" id="${textId}">${esc(note)}</div>`;
    if (actionsEl) actionsEl.remove();
    showToast('✓ 已儲存');
  } else {
    showToast(r.message || '儲存失敗，請稍後再試');
  }
}

function aiPolish(spotId) {
  alert('AI 潤飾功能即將上線，敬請期待。');
}

/* ── Owner: new review ── */
function startNewOwnerReview(spotId) {
  const wrapper = document.getElementById(`ri_owner_${spotId}`);
  if (!wrapper) return;
  wrapper.innerHTML = `
    <div class="new-review-form">
      <textarea id="nr_owner_${esc(spotId)}" placeholder="寫下主理人的推薦語…"></textarea>
      <div class="review-edit-actions">
        <button class="btn-edit-cancel" data-action="cancel-new-owner-review" data-spot-id="${esc(spotId)}">取消</button>
        <button class="btn-edit-save" data-action="save-new-owner-review" data-spot-id="${esc(spotId)}">儲存</button>
      </div>
    </div>`;
}

function cancelNewOwnerReview(spotId) {
  const wrapper = document.getElementById(`ri_owner_${spotId}`);
  if (!wrapper) return;
  wrapper.innerHTML = `<button class="btn-add-review" data-action="start-new-owner-review" data-spot-id="${esc(spotId)}">+ 新增主理人點評</button>`;
}

async function saveNewOwnerReview(spotId) {
  const ta   = document.getElementById(`nr_owner_${spotId}`);
  if (!ta) return;
  const note = ta.value.trim();
  if (!note) return;

  let r;
  if (isMockMode) {
    const newId = 'mock-r-' + Date.now();
    if (!allReviews[spotId]) allReviews[spotId] = [];
    allReviews[spotId].unshift({ id: newId, userId: 'owner', role: 'owner', nickname: '主理人', note });
    r = { success: true, reviewId: newId };
  } else {
    r = await apiPost('/reviews', { spotId, note, rating: 0 });
  }

  if (r.success) {
    const wrapper = document.getElementById(`ri_owner_${spotId}`);
    if (wrapper) {
      const newId = r.reviewId || ('local-' + Date.now());
      wrapper.innerHTML = `
        <div class="review-item" id="ri_owner_${esc(spotId)}">
          <div class="review-author">主理人</div>
          <div class="review-text" id="rt_owner_${esc(spotId)}">${esc(note)}</div>
          <div class="review-actions owner-only">
            <div style="display:flex;gap:8px;">
              <button class="btn-text" data-action="start-edit" data-spot-id="${esc(spotId)}" data-who="owner" data-review-id="${esc(newId)}">編輯內容</button>
              <button class="btn-text btn-ai" data-action="ai-polish" data-spot-id="${esc(spotId)}">✨ AI 潤飾</button>
            </div>
          </div>
        </div>`;
    }
    showToast('✓ 已儲存');
  } else {
    showToast(r.message || '儲存失敗');
  }
}

/* ── Friend: new review ── */
function openNewFriendReview(spotId) {
  const wrapper = document.getElementById(`ri_my_${spotId}`);
  if (!wrapper) return;
  wrapper.innerHTML = `
    <div class="new-review-form">
      <textarea id="nr_friend_${esc(spotId)}" placeholder="寫下你的私藏感想…"></textarea>
      <div class="review-edit-actions">
        <button class="btn-edit-cancel" data-action="cancel-new-friend-review" data-spot-id="${esc(spotId)}">取消</button>
        <button class="btn-edit-save" data-action="save-new-friend-review" data-spot-id="${esc(spotId)}">儲存</button>
      </div>
    </div>`;
}

function cancelNewFriendReview(spotId) {
  const wrapper = document.getElementById(`ri_my_${spotId}`);
  if (!wrapper) return;
  wrapper.innerHTML = `<button class="btn-add-review friend-only"
    data-action="open-new-friend-review" data-spot-id="${esc(spotId)}">+ 加上我的私藏點評</button>`;
}

async function saveNewFriendReview(spotId) {
  const ta   = document.getElementById(`nr_friend_${spotId}`);
  if (!ta) return;
  const note = ta.value.trim();
  if (!note) return;

  let r;
  if (isMockMode) {
    const newId = 'mock-rf-' + Date.now();
    if (!allReviews[spotId]) allReviews[spotId] = [];
    allReviews[spotId].push({
      id: newId, userId: currentUserId || 'me',
      role: 'friend', nickname: currentNick, note
    });
    r = { success: true, reviewId: newId };
  } else {
    r = await apiPost('/reviews', { spotId, note, rating: 0 });
  }

  if (r.success) {
    const newId   = r.reviewId || ('local-' + Date.now());
    const wrapper = document.getElementById(`ri_my_${spotId}`);
    if (wrapper) {
      wrapper.outerHTML = `
        <div class="review-item friend-review" id="ri_my_${esc(spotId)}">
          <div class="review-author">${esc(currentNick || '你')}（你）</div>
          <div class="review-text" id="rt_my_${esc(spotId)}">${esc(note)}</div>
          <div class="review-actions friend-only">
            <button class="btn-text" data-action="start-edit" data-spot-id="${esc(spotId)}" data-who="friend" data-review-id="${esc(newId)}">編輯我的點評</button>
          </div>
        </div>`;
    }
    showToast('✓ 已儲存');
  } else {
    showToast(r.message || '儲存失敗');
  }
}

/* ── Delete friend review (owner only) ── */
async function deleteFriendReview(reviewId, spotId) {
  if (!confirm('確定要刪除這則評論？')) return;

  let r;
  if (isMockMode) {
    if (allReviews[spotId]) {
      allReviews[spotId] = allReviews[spotId].filter(x => x.id !== reviewId);
    }
    r = { success: true };
  } else {
    r = await apiDelete('/reviews/' + encodeURIComponent(reviewId));
  }

  if (r.success) {
    const el = document.getElementById('ri_' + reviewId);
    if (el) el.remove();
    showToast('評論已刪除');
  } else {
    showToast('刪除失敗，請稍後再試');
  }
}

/* ════════════════════════════════════════════════
   FETCH SPOT DATA (owner)
════════════════════════════════════════════════ */
async function fetchSpotData() {
  const input = document.getElementById('searchInput');
  if (!input || !input.value.trim()) return;
  if (isMockMode) { showToast('預覽模式不支援新增'); return; }
  showToast('功能即將推出，敬請期待。');
}

/* ════════════════════════════════════════════════
   PERSONA (friend)
════════════════════════════════════════════════ */
async function loadPersona() {
  if (isMockMode) return;
  const r = await apiGet('/profile');
  if (r.success && r.persona) {
    const ta = document.getElementById('personaInput');
    if (ta) ta.value = r.persona;
  }
}

async function savePersona() {
  const ta       = document.getElementById('personaInput');
  const nickname = currentNick || '';
  const persona  = ta ? ta.value.trim() : '';

  let r;
  if (isMockMode) {
    r = { success: true };
  } else {
    r = await apiPut('/profile', { displayName: nickname, persona });
  }

  if (r.success) {
    const fb = document.getElementById('personaFeedback');
    if (fb) { fb.classList.add('show'); setTimeout(() => fb.classList.remove('show'), 2200); }
    showToast('✓ 人設已儲存');
  } else {
    showToast(r.message || '儲存失敗');
  }
}

/* ════════════════════════════════════════════════
   USER MANAGEMENT (owner only)
════════════════════════════════════════════════ */
async function loadPendingUsers() {
  const container = document.getElementById('pendingContainer');
  const badge = document.getElementById('pendingBadge');
  if (!container) return;

  const r = await apiGet('/admin/users?status=pending');
  if (!r.success) { container.innerHTML = '<div class="state-empty">載入失敗</div>'; return; }

  const users = r.users || [];
  if (!users.length) {
    badge.style.display = 'none';
    container.innerHTML = '<div class="state-empty" style="font-size:12px;color:#aaa;">目前沒有待審申請</div>';
    return;
  }

  badge.style.display = 'inline';
  badge.textContent = users.length + ' 筆';

  let html = '';
  users.forEach(u => {
    html += `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:rgba(224,192,128,0.12);border-radius:10px;margin-bottom:8px;border:1px solid rgba(224,192,128,0.3);" id="pu_${esc(u.userId)}">
      <div>
        <div style="font-size:13px;font-weight:500;letter-spacing:.04em;">${esc(u.displayName)}</div>
        <div style="font-size:10px;color:#9a8a7a;letter-spacing:.08em;margin-top:2px;">${esc(u.loginId)} · ${formatDate(u.createdAt)}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button data-action="review-user" data-user-id="${esc(u.userId)}" data-decision="approve" style="padding:6px 14px;background:#1a1210;color:#f8f5ef;border:none;border-radius:8px;font-size:11px;letter-spacing:.1em;cursor:pointer;">核准</button>
        <button data-action="review-user" data-user-id="${esc(u.userId)}" data-decision="reject"  style="padding:6px 14px;background:transparent;color:#9a8a7a;border:1px solid rgba(181,171,160,0.4);border-radius:8px;font-size:11px;letter-spacing:.1em;cursor:pointer;">拒絕</button>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

async function reviewUser(userId, action) {
  const r = await apiPatch('/admin/users/' + encodeURIComponent(userId) + '/' + action, {});
  if (r.success) {
    const el = document.getElementById('pu_' + userId);
    if (el) el.remove();
    showToast(action === 'approve' ? '已核准' : '已拒絕');
    loadPendingUsers();
    if (action === 'approve') loadUsers();
  } else {
    showToast(r.error || '操作失敗');
  }
}

async function loadUsers() {
  const container = document.getElementById('usersContainer');
  if (!container) return;

  let users = [];
  if (isMockMode) {
    users = [
      { id: 'owner', nickname: '主理人', account: 'owner', role: 'owner', created_at: '' },
      { id: 'friend1', nickname: '愛吃鬼 A', account: 'friend_a', role: 'friend', created_at: '2025-03-10' }
    ];
  } else {
    const r = await apiGet('/admin/users');
    if (!r.success) {
      container.innerHTML = '<div class="state-empty">無法載入使用者清單</div>';
      return;
    }
    users = (r.users || []).map(normalizeUser);
  }

  if (!users.length) {
    container.innerHTML = '<div class="state-empty">目前沒有朋友帳號</div>';
    return;
  }

  let html = `<table class="user-table">
    <thead><tr>
      <th>暱稱</th><th>帳號</th><th>建立日期</th><th></th>
    </tr></thead><tbody>`;

  users.forEach(u => {
    const isOwner = u.role === 'owner';
    html += `<tr id="ur_${esc(u.id)}">
      <td class="td-nick">${esc(u.nickname || u.account)}</td>
      <td class="td-acct">${esc(u.account)}</td>
      <td class="td-date">${formatDate(u.created_at)}</td>
      <td>${isOwner ? '' : `<button class="btn-del-user" data-action="delete-user" data-user-id="${esc(u.id)}" data-nick="${esc(u.nickname||u.account)}">刪除</button>`}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

async function deleteUser(userId, nickname) {
  if (!confirm(`確定要刪除「${nickname}」的帳號？此操作無法復原。`)) return;

  let r;
  if (isMockMode) {
    r = { success: true };
  } else {
    r = await apiDelete('/admin/users/' + encodeURIComponent(userId));
  }

  if (r.success) {
    const row = document.getElementById('ur_' + userId);
    if (row) row.remove();
    showToast('帳號已刪除');
  } else {
    showToast(r.message || '刪除失敗');
  }
}

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */
(function init() {
  const token = localStorage.getItem(DRIFT_TOKEN_KEY) || localStorage.getItem('drift_admin_token');
  const role  = localStorage.getItem('drift_admin_role');
  const nick  = localStorage.getItem('drift_admin_nickname');
  const uid   = localStorage.getItem('drift_admin_userId');
  if (token && role) {
    enterDashboard(token, role, nick || '', uid || '');
  }
})();

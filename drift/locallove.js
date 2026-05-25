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
    nickname: rv.nickname || rv.authorName || rv.author || (isOwner ? '雫編' : '朋友'),
    note: rv.note || ''
  };
}

/* ════════════════════════════════════════════════
   STATE
════════════════════════════════════════════════ */
let currentToken    = null;
let currentRole     = null;
let currentNick     = null;
let currentUserId   = null;
let allSpots        = [];
let allReviews      = {};  // spotId -> reviews[]

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
    case 'change-pw':                openChangePwModal(); break;
    case 'save-persona':             savePersona(); break;
    // Friend 自身的評論動作
    case 'start-edit':               startEdit(sid, who, rid); break;
    case 'open-new-friend-review':   openNewFriendReview(sid); break;
    case 'cancel-edit':              cancelEdit(sid, who, rid, el.dataset.original || ''); break;
    case 'save-edit':                saveEdit(sid, who, rid); break;
    case 'cancel-new-friend-review': cancelNewFriendReview(sid); break;
    case 'save-new-friend-review':   saveNewFriendReview(sid); break;
    case 'open-new-spot':            openNewSpotModal(); break;
  }
});

// "+ 推薦新地點" 按鈕用 id 而非 data-action（避免 dataset 太雜）
document.addEventListener('click', function(e) {
  if (e.target.id === 'openNewSpotBtn') openNewSpotModal();
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

    // 雫編 (owner) 同步把 token 寫進 sessionStorage，方便切換到 /notforyou/home
    // 但「不自動跳轉」── 讓 owner 自己決定要不要過去
    if (r.role === 'owner') {
      sessionStorage.setItem('admin_key', r.token);
    }

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
/* ── 修改密碼 Modal ─────────────────────────────────────────────── */
function openChangePwModal() {
  document.getElementById('driftCpCurrent').value = '';
  document.getElementById('driftCpNew').value = '';
  document.getElementById('driftCpConfirm').value = '';
  document.getElementById('driftCpNotice').textContent = '';
  document.getElementById('driftChangePwModal').style.display = 'flex';
}

document.getElementById('driftCpClose').addEventListener('click', () => {
  document.getElementById('driftChangePwModal').style.display = 'none';
});
document.getElementById('driftChangePwModal').addEventListener('click', (e) => {
  if (e.target === document.getElementById('driftChangePwModal'))
    document.getElementById('driftChangePwModal').style.display = 'none';
});
document.getElementById('driftCpSubmit').addEventListener('click', async () => {
  const current = document.getElementById('driftCpCurrent').value;
  const newPw   = document.getElementById('driftCpNew').value;
  const confirm = document.getElementById('driftCpConfirm').value;
  const notice  = document.getElementById('driftCpNotice');
  if (!current)              { notice.textContent = '請輸入目前密碼'; return; }
  if (!newPw || newPw.length < 6) { notice.textContent = '新密碼至少 6 個字元'; return; }
  if (newPw !== confirm)     { notice.textContent = '兩次密碼不一致'; return; }
  notice.textContent = '';
  const btn = document.getElementById('driftCpSubmit');
  btn.disabled = true; btn.textContent = '更新中…';
  try {
    // owner 用 /api/drift/change-password，好友用 /api/drift/profile 改密碼（如需再加）
    const endpoint = currentRole === 'owner' ? '/api/drift/change-password' : '/api/drift/change-password';
    const data = await apiRequest(endpoint, { method: 'POST', body: { currentPassword: current, newPassword: newPw } });
    btn.disabled = false; btn.textContent = '確認修改';
    if (!data.success) { notice.textContent = data.error || '更新失敗'; return; }
    notice.style.color = '#2ecc71';
    notice.textContent = '✓ 密碼已更新';
    setTimeout(() => {
      document.getElementById('driftChangePwModal').style.display = 'none';
      notice.style.color = '';
    }, 1500);
  } catch {
    btn.disabled = false; btn.textContent = '確認修改';
    notice.textContent = '連線失敗，請稍後再試';
  }
});

function logout() {
  [DRIFT_TOKEN_KEY,'drift_admin_token','drift_admin_role','drift_admin_nickname','drift_admin_userId']
    .forEach(k => localStorage.removeItem(k));
  sessionStorage.removeItem('admin_key');
  currentToken = currentRole = currentNick = currentUserId = null;
  allSpots = []; allReviews = {};
  document.getElementById('dashView').style.display  = 'none';
  document.getElementById('loginView').style.display = '';
  document.getElementById('loginAccount').value  = '';
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').textContent  = '';
  showOwnerHint(false);
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

  // owner 在這頁時，提示完整管理在 notforyou
  showOwnerHint(currentRole === 'owner');

  await loadAllData();
  renderDashboard();
}

function showOwnerHint(show) {
  let bar = document.getElementById('ownerHintBar');
  if (!show) {
    if (bar) bar.remove();
    return;
  }
  if (bar) return; // 已顯示
  bar = document.createElement('div');
  bar.id = 'ownerHintBar';
  bar.style.cssText = 'background:rgba(184,121,90,0.10);border-bottom:1px solid rgba(184,121,90,0.25);padding:10px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px;letter-spacing:0.06em;color:var(--accent);';
  bar.innerHTML =
    '<span>你目前是 <b>雫編</b>。完整管理介面（含店家 / 朋友審核）在 notforyou 那邊。</span>' +
    '<a href="/notforyou/home" style="padding:5px 14px;background:var(--ink);color:var(--bg);border-radius:6px;letter-spacing:0.1em;text-decoration:none;font-size:11px;white-space:nowrap;">前往 ↗</a>';
  // 插在 dashView 最上方
  const dash = document.getElementById('dashView');
  dash.insertBefore(bar, dash.firstChild);
}

/* ════════════════════════════════════════════════
   DATA LOADING
════════════════════════════════════════════════ */
async function loadAllData() {
  const container = document.getElementById('mainContainer');
  container.innerHTML = '<div class="state-loading"><div class="spinner"></div><br>載入中…</div>';

  // 從 /api/drift/spots 拉真實資料；失敗就空陣列（顯示「沒有景點」訊息）
  try {
    const r = await apiGet('/spots');
    allSpots = (r && r.success && Array.isArray(r.spots)) ? r.spots : [];
  } catch (e) {
    allSpots = [];
  }

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
// LocalLove 從 B-B 起只服務 friend 角色；owner 留在頁面只會看到提示橫幅 +
// 朋友視角的內容（dashboard 結構維持），完整管理請至 /notforyou/home。
function renderDashboard() {
  const container = document.getElementById('mainContainer');

  let html = `
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
      <button id="openNewSpotBtn" style="width:100%;margin-bottom:20px;padding:14px;background:transparent;border:1px dashed rgba(184,121,90,0.5);border-radius:12px;font-family:'Noto Serif TC',serif;font-size:13px;color:var(--accent);letter-spacing:0.14em;cursor:pointer;transition:all 0.18s;">＋ 推薦新地點</button>
    </div>`;

  const areas = ['全部','馬公市','湖西鄉','白沙鄉','西嶼鄉','望安鄉','七美鄉'];
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
  <div class="section-title">已收錄清單</div>
  <div id="spotList"></div>`;

  container.innerHTML = html;

  renderSpotList();
  loadPersona();
}

/* ════════════════════════════════════════════════
   SPOT LIST
════════════════════════════════════════════════ */
function renderSpotList() {
  const listEl  = document.getElementById('spotList');
  if (!listEl) return;

  const area = (document.getElementById('filterArea') || {}).value || '全部';
  const type = (document.getElementById('filterType') || {}).value || '全部';

  const visible = allSpots.filter(sp => {
    const matchArea = area === '全部' || sp.area === area;
    const matchType = type === '全部' || sp.type === type || sp.category === type;
    return matchArea && matchType;
  });

  if (!visible.length) {
    listEl.innerHTML = '<div class="state-empty">沒有符合篩選條件的景點</div>';
    return;
  }

  listEl.innerHTML = visible.map(renderSpotCard).join('');
}

function applyFilters() {
  renderSpotList();
}

// Friend 視角：顯示雫編點評（唯讀）+ 其他朋友點評（唯讀）+ 自己的點評（可編輯）
function renderSpotCard(sp) {
  const reviews   = allReviews[sp.id] || [];
  const ownerRv   = reviews.find(r => r.role === 'owner');
  const friendRvs = reviews.filter(r => r.role !== 'owner');
  const myRv      = reviews.find(r => r.userId === currentUserId || r.authorId === currentUserId);

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

  // 雫編點評（唯讀）
  if (ownerRv) {
    html += `
    <div class="review-item">
      <div class="review-author">雫編</div>
      <div class="review-text">${esc(ownerRv.note || '')}</div>
    </div>`;
  }

  // 其他朋友的點評（唯讀，排除自己）
  friendRvs.forEach(rv => {
    const isMe = rv.userId === currentUserId || rv.authorId === currentUserId;
    if (isMe) return;
    html += `
    <div class="review-item">
      <div class="review-author">${esc(rv.nickname || rv.authorName || '朋友')}</div>
      <div class="review-text">${esc(rv.note || '')}</div>
    </div>`;
  });

  // 自己的點評（可編輯）
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
    html += `
    <div id="ri_my_${esc(sp.id)}">
      <button class="btn-add-review friend-only"
        data-action="open-new-friend-review" data-spot-id="${esc(sp.id)}">+ 加上我的私藏點評</button>
    </div>`;
  }

  html += `</div>`;
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

  const r = await apiPost('/reviews', { spotId, note, rating: 0 });

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

  const r = await apiPost('/reviews', { spotId, note, rating: 0 });

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

/* ════════════════════════════════════════════════
   PERSONA (friend)
════════════════════════════════════════════════ */
async function loadPersona() {
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
  const r = await apiPut('/profile', { displayName: nickname, persona });

  if (r.success) {
    const fb = document.getElementById('personaFeedback');
    if (fb) { fb.classList.add('show'); setTimeout(() => fb.classList.remove('show'), 2200); }
    showToast('✓ 人設已儲存');
  } else {
    showToast(r.message || '儲存失敗');
  }
}

/* ════════════════════════════════════════════════
   NEW SPOT MODAL（朋友推薦新地點）+ 地圖選點
════════════════════════════════════════════════ */
let nsMap = null;
let nsMarker = null;
let nsLastSearch = 0;
const NS_DEFAULT_CENTER = [23.5820, 119.6530];

function openNewSpotModal() {
  document.getElementById('newSpotModal').style.display = 'flex';
  // 重設欄位
  ['nsName','nsNote','nsLat','nsLng','nsMapSearch'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('nsType').value = 'food';
  document.getElementById('nsCat').value = '';
  document.getElementById('nsArea').value = '';
  document.getElementById('nsError').textContent = '';
  document.getElementById('nsMapPicker').style.display = 'none';
}

function closeNewSpotModal() {
  document.getElementById('newSpotModal').style.display = 'none';
}

function nsEnsureMap() {
  if (nsMap || typeof L === 'undefined') return nsMap;
  const el = document.getElementById('nsMap');
  if (!el) return null;
  const lat = Number(document.getElementById('nsLat').value) || NS_DEFAULT_CENTER[0];
  const lng = Number(document.getElementById('nsLng').value) || NS_DEFAULT_CENTER[1];
  nsMap = L.map(el).setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap', maxZoom: 19,
  }).addTo(nsMap);
  nsMarker = L.marker([lat, lng], { draggable: true }).addTo(nsMap);
  nsMarker.on('dragend', () => {
    const p = nsMarker.getLatLng();
    document.getElementById('nsLat').value = p.lat.toFixed(4);
    document.getElementById('nsLng').value = p.lng.toFixed(4);
  });
  nsMap.on('click', (e) => {
    nsMarker.setLatLng(e.latlng);
    document.getElementById('nsLat').value = e.latlng.lat.toFixed(4);
    document.getElementById('nsLng').value = e.latlng.lng.toFixed(4);
  });
  return nsMap;
}

function nsToggleMap() {
  const box = document.getElementById('nsMapPicker');
  if (box.style.display === 'none' || !box.style.display) {
    box.style.display = '';
    setTimeout(() => {
      const m = nsEnsureMap();
      if (m) {
        m.invalidateSize();
        const lat = Number(document.getElementById('nsLat').value);
        const lng = Number(document.getElementById('nsLng').value);
        if (lat && lng) { nsMarker.setLatLng([lat, lng]); m.setView([lat, lng], 15); }
      }
    }, 50);
  } else {
    box.style.display = 'none';
  }
}

async function nsSearch() {
  const q = (document.getElementById('nsMapSearch').value || '').trim();
  if (!q) return;
  const now = Date.now();
  const since = now - nsLastSearch;
  if (since < 1100) await new Promise(r => setTimeout(r, 1100 - since));
  nsLastSearch = Date.now();
  const btn = document.getElementById('nsMapSearchBtn');
  btn.disabled = true; const oldTxt = btn.textContent; btn.textContent = '…';
  try {
    const query = encodeURIComponent(q.indexOf('澎湖') >= 0 ? q : q + ' 澎湖');
    const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + query, { headers: { 'Accept-Language': 'zh-TW' } });
    const arr = await res.json();
    if (!arr || arr.length === 0) { alert('找不到「' + q + '」'); return; }
    const hit = arr[0];
    const lat = parseFloat(hit.lat), lng = parseFloat(hit.lon);
    document.getElementById('nsLat').value = lat.toFixed(4);
    document.getElementById('nsLng').value = lng.toFixed(4);
    nsEnsureMap();
    nsMarker.setLatLng([lat, lng]);
    nsMap.setView([lat, lng], 16);
  } catch (e) {
    alert('搜尋失敗：' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = oldTxt;
  }
}

async function nsSubmit() {
  const err = document.getElementById('nsError');
  err.textContent = '';
  const data = {
    type: document.getElementById('nsType').value,
    cat:  document.getElementById('nsCat').value,
    name: document.getElementById('nsName').value.trim(),
    area: document.getElementById('nsArea').value,
    note: document.getElementById('nsNote').value.trim(),
    lat:  Number(document.getElementById('nsLat').value) || 0,
    lng:  Number(document.getElementById('nsLng').value) || 0,
    rating: 0,
    status: 'open',
  };
  if (!data.name) { err.textContent = '請填寫店名 / 景點名'; return; }
  const btn = document.getElementById('nsSubmitBtn');
  btn.disabled = true; btn.textContent = '送出中…';
  try {
    const r = await apiPost('/spots', data);
    if (r && r.success) {
      showToast('✓ 已新增：' + data.name);
      closeNewSpotModal();
      // 把新景點加進 allSpots，重畫列表
      if (r.spot) {
        allSpots.unshift(r.spot);
        allReviews[r.spot.id] = [];
        renderSpotList();
      }
    } else {
      err.textContent = (r && r.message) || '新增失敗';
    }
  } catch (e) {
    err.textContent = '網路錯誤：' + e.message;
  } finally {
    btn.disabled = false; btn.textContent = '送出';
  }
}

// Modal 互動 wiring（DOM 元素在 HTML 末端固定 id，直接 attach）
document.addEventListener('DOMContentLoaded', function () {
  const closeBtn = document.getElementById('newSpotCloseBtn');
  const cancelBtn = document.getElementById('nsCancelBtn');
  const submitBtn = document.getElementById('nsSubmitBtn');
  const toggleMapBtn = document.getElementById('nsToggleMapBtn');
  const searchBtn = document.getElementById('nsMapSearchBtn');
  const searchInput = document.getElementById('nsMapSearch');
  const modal = document.getElementById('newSpotModal');
  if (closeBtn) closeBtn.addEventListener('click', closeNewSpotModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeNewSpotModal);
  if (submitBtn) submitBtn.addEventListener('click', nsSubmit);
  if (toggleMapBtn) toggleMapBtn.addEventListener('click', nsToggleMap);
  if (searchBtn) searchBtn.addEventListener('click', nsSearch);
  if (searchInput) searchInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); nsSearch(); }
  });
  if (modal) modal.addEventListener('click', function (e) {
    if (e.target === modal) closeNewSpotModal();
  });
});

/* ════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════ */
(function init() {
  const token = localStorage.getItem(DRIFT_TOKEN_KEY) || localStorage.getItem('drift_admin_token');
  const role  = localStorage.getItem('drift_admin_role');
  const nick  = localStorage.getItem('drift_admin_nickname');
  const uid   = localStorage.getItem('drift_admin_userId');
  if (token && role) {
    // owner 帶 token 進來：同步給 notforyou，但留在此頁
    if (role === 'owner') {
      sessionStorage.setItem('admin_key', token);
    }
    enterDashboard(token, role, nick || '', uid || '');
  }
})();

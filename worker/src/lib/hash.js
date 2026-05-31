/**
 * 密碼雜湊工具 v2
 *
 * 新格式（v2）：PBKDF2 + 每帳號獨立隨機 salt，全部嵌在 hash 字串裡
 *   "v2:{base64_salt}:{base64_hash}"
 *   不依賴任何外部 SALT 環境變數。
 *
 * 舊格式（v1，已淘汰）：
 *   base64( SHA256(loginId::password::globalSalt) )
 *   保留 verifyPassword 的 fallback 讀取，確保升級期間不會鎖帳號。
 */

const PBKDF2_ITERATIONS = 100000;
const KEY_BITS          = 256; // 32 bytes

// ── 工具 ──────────────────────────────────────────────────────────

function _b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function _fromB64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

async function _pbkdf2(password, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    KEY_BITS
  );
  return bits;
}

// ── 公開 API ──────────────────────────────────────────────────────

/**
 * 產生新的 v2 hash（新帳號 / 改密碼時使用）
 * 每次呼叫產生全新隨機 salt，不需要傳入任何外部 salt。
 */
export async function hashPasswordV2(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await _pbkdf2(password, salt);
  return `v2:${_b64(salt)}:${_b64(hash)}`;
}

/**
 * 驗證密碼（同時支援 v2 新格式與 v1 舊格式）
 *
 * @param {string} password     使用者輸入的明文密碼
 * @param {string} stored       DB 裡存的 hash 字串
 * @param {string} legacyLoginId  v1 fallback 用，loginId
 * @param {string} legacySalt     v1 fallback 用，全域 SALT
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, stored, legacyLoginId = '', legacySalt = '') {
  if (!stored) return false;

  if (stored.startsWith('v2:')) {
    // 新格式：v2:{salt}:{hash}
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const salt     = _fromB64(parts[1]);
    const expected = parts[2];
    const computed = await _pbkdf2(password, salt);
    return _b64(computed) === expected;
  }

  // 舊格式 fallback（升級期間相容）
  if (legacySalt) {
    const v1 = await hashPassword(legacyLoginId, password, legacySalt);
    return v1 === stored;
  }

  return false;
}

/**
 * 舊版 SHA-256 hash（僅供 v1 fallback 內部使用，不對外新建）
 */
async function hashPassword(loginId, password, salt) {
  const input = `${loginId}::${password}::${salt}`;
  const enc   = new TextEncoder();
  const buf   = await crypto.subtle.digest('SHA-256', enc.encode(input));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

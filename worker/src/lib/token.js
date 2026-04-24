/**
 * Token 工具
 * 登入後發一串識別碼（類似飯店房卡），有效期 30 天
 * 用 HMAC-SHA256 簽名，不需要額外查資料庫就能驗證
 */

const ALGO = { name: 'HMAC', hash: 'SHA-256' };
const EXPIRY_DAYS = 30;

// 將字串轉為 base64url（URL 安全的 base64）
function toBase64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function fromBase64url(str) {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

// 取得簽名用的 CryptoKey
async function getKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(secret), ALGO, false, ['sign', 'verify']);
}

/**
 * 產生 token
 * payload: { userId, role }
 * 回傳: "base64url_payload.base64url_signature"
 */
export async function createToken(payload, secret) {
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_DAYS * 86400;
  const data = JSON.stringify({ ...payload, exp });
  const encoded = toBase64url(data);

  const key = await getKey(secret);
  const sig = await crypto.subtle.sign(ALGO, key, new TextEncoder().encode(encoded));
  const sigB64 = toBase64url(String.fromCharCode(...new Uint8Array(sig)));

  return `${encoded}.${sigB64}`;
}

/**
 * 驗證 token，成功回傳 payload，失敗丟錯誤
 */
export async function verifyToken(token, secret) {
  if (!token) throw Object.assign(new Error('no token'), { status: 401 });

  const parts = token.split('.');
  if (parts.length !== 2) throw Object.assign(new Error('invalid token'), { status: 401 });

  const [encoded, sigB64] = parts;

  // 驗簽
  const key = await getKey(secret);
  const sigBytes = Uint8Array.from(fromBase64url(sigB64), c => c.charCodeAt(0));
  const valid = await crypto.subtle.verify(ALGO, key, sigBytes, new TextEncoder().encode(encoded));
  if (!valid) throw Object.assign(new Error('invalid signature'), { status: 401 });

  // 解碼 payload
  const payload = JSON.parse(fromBase64url(encoded));

  // 確認未過期
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw Object.assign(new Error('token expired'), { status: 401 });
  }

  return payload; // { userId, role, exp }
}

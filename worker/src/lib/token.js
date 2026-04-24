/**
 * Token 工具
 * 登入後發一串識別碼，有效期 30 天
 * HMAC-SHA256 簽名，不需要查資料庫就能驗證
 */

const ALGO = { name: 'HMAC', hash: 'SHA-256' };
const EXPIRY_DAYS = 30;

/** 字串 → UTF-8 bytes → base64url（支援中文等 Unicode）*/
function toBase64url(str) {
  const bytes = new TextEncoder().encode(str);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** base64url → bytes → UTF-8 字串 */
function fromBase64url(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function getKey(secret) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), ALGO, false, ['sign', 'verify']
  );
}

/** 產生 token：base64url(payload).base64url(signature) */
export async function createToken(payload, secret) {
  const exp = Math.floor(Date.now() / 1000) + EXPIRY_DAYS * 86400;
  const encoded = toBase64url(JSON.stringify({ ...payload, exp }));

  const key = await getKey(secret);
  const sigBuf = await crypto.subtle.sign(ALGO, key, new TextEncoder().encode(encoded));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return `${encoded}.${sigB64}`;
}

/** 驗證 token，成功回傳 payload，失敗丟 { status: 401 } 的錯誤 */
export async function verifyToken(token, secret) {
  if (!token) throw Object.assign(new Error('no token'), { status: 401 });

  const parts = token.split('.');
  if (parts.length !== 2) throw Object.assign(new Error('invalid token'), { status: 401 });

  const [encoded, sigB64] = parts;

  const key = await getKey(secret);
  const sigBytes = Uint8Array.from(
    atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')),
    c => c.charCodeAt(0)
  );
  const valid = await crypto.subtle.verify(
    ALGO, key, sigBytes, new TextEncoder().encode(encoded)
  );
  if (!valid) throw Object.assign(new Error('invalid signature'), { status: 401 });

  const payload = JSON.parse(fromBase64url(encoded));
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw Object.assign(new Error('token expired'), { status: 401 });
  }

  return payload;
}

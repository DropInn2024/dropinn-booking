/* 產生一組本機用的 owner token。
 *
 *   node dev-token.mjs
 *
 * 為什麼不用登入畫面：本機資料庫是假的，沒有 owner 帳號密碼；而且
 * token 本來就只是用 TOKEN_SECRET 簽的 HMAC，直接簽一組比繞一圈登入
 * 乾淨，也不必把任何密碼放進任何地方。
 *
 * 簽出來的 token 只對「用同一把 TOKEN_SECRET 的環境」有效。.dev.vars
 * 是本機專用且在 .gitignore 裡，跟正式站的 secret 不同，所以這組 token
 * 對正式站無效。
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

// 讀 .dev.vars 取 TOKEN_SECRET（只在記憶體裡用，不印出來）
let secret = '';
try {
  for (const line of readFileSync(join(HERE, '.dev.vars'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*TOKEN_SECRET\s*=\s*(.*)$/.exec(line);
    if (m) secret = m[1].trim().replace(/^["']|["']$/g, '');
  }
} catch {
  console.error('讀不到 worker/.dev.vars —— 請先建立，內容至少要有 TOKEN_SECRET=隨便一串長字串');
  process.exit(1);
}
if (!secret) { console.error('.dev.vars 裡沒有 TOKEN_SECRET'); process.exit(1); }

/* 以下簽章邏輯與 src/lib/token.js 一致（同樣的 base64url + HMAC-SHA256）。
   不直接 import 是因為那支檔案是 Worker 模組，這裡只要能跑就好。 */
const EXPIRY_DAYS = 30;
const b64url = (str) => {
  const bytes = new TextEncoder().encode(str);
  return Buffer.from(bytes).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
};

const payload = {
  userId: 'owner',
  role: 'owner',
  displayName: '雫編（本機）',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + EXPIRY_DAYS * 86400,
};
const body = b64url(JSON.stringify(payload));
const key = await crypto.subtle.importKey(
  'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
);
const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
const sig = Buffer.from(sigBuf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

const token = body + '.' + sig;
console.log(token);
console.error('\n── 怎麼用 ──');
console.error('  1. 開 http://localhost:8788/notforyou/home/');
console.error('  2. 開發者工具 Console 貼上：');
console.error("     sessionStorage.setItem('admin_key', '" + token.slice(0, 24) + "...');");
console.error('     （完整 token 是上面那行 stdout，可以 node dev-token.mjs | clip 複製）');
console.error('  3. 重新整理\n');

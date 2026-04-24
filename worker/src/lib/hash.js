/**
 * 密碼雜湊工具
 * 相容 GAS 原有的 hashPassword_ 邏輯（SHA-256 + salt）
 */

export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

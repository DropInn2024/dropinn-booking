/**
 * 密碼雜湊工具
 * 必須與 GAS hashPassword_(loginId, password, salt) 完全一致：
 *   input  = loginId + '::' + password + '::' + salt
 *   output = base64( SHA256(input) )
 */

export async function hashPassword(loginId, password, salt) {
  const input = `${loginId}::${password}::${salt}`;
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(input));
  // GAS 用的是標準 base64（非 URL-safe）
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

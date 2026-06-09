/**
 * line.js — LINE Messaging API（官方帳號 OA）
 *
 * 用途：
 *   - 客人加好友並回傳訂單號 → webhook 綁定 lineUserId（lineReply 免費）
 *   - 訂單成立 → linePush 主動通知客人「已為您訂到」
 *
 * 環境變數（wrangler secret put）：
 *   env.LINE_CHANNEL_ACCESS_TOKEN  — Messaging API channel 的 long-lived token
 *   env.LINE_CHANNEL_SECRET        — channel secret（驗證 webhook 簽章）
 *
 * 註：主動 push 免費方案每月 200 則；webhook 內 lineReply 免費不限量。
 *     只能推播給「已加官方帳號好友」的 userId。
 */

const PUSH_URL = 'https://api.line.me/v2/bot/message/push';
const REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

/** 字串或陣列 → LINE messages 陣列（最多 5 則） */
function toMessages(messages) {
  const arr = Array.isArray(messages) ? messages : [messages];
  return arr
    .map((m) => (typeof m === 'string' ? { type: 'text', text: m } : m))
    .filter(Boolean)
    .slice(0, 5);
}

async function send(env, url, payload) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.warn('[line] LINE_CHANNEL_ACCESS_TOKEN 未設定，跳過');
    return { success: false, error: 'no token' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { success: true };
    const data = await res.text();
    console.error('[line] API error:', res.status, data);
    return { success: false, error: data };
  } catch (err) {
    console.error('[line] fetch error:', err);
    return { success: false, error: String(err) };
  }
}

/** 主動推播給已綁定的 userId（計入每月額度） */
export function linePush(env, to, messages) {
  if (!to) return Promise.resolve({ success: false, error: 'no userId' });
  return send(env, PUSH_URL, { to, messages: toMessages(messages) });
}

/** webhook 內回覆（免費、不限量），須在 replyToken 有效期內 */
export function lineReply(env, replyToken, messages) {
  if (!replyToken) return Promise.resolve({ success: false, error: 'no replyToken' });
  return send(env, REPLY_URL, { replyToken, messages: toMessages(messages) });
}

/**
 * 驗證 LINE webhook 簽章：base64(HMAC-SHA256(channelSecret, rawBody)) === x-line-signature
 * @returns {Promise<boolean>}
 */
export async function verifyLineSignature(rawBody, signature, secret) {
  if (!secret || !signature) return false;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const b64 = btoa(String.fromCharCode(...new Uint8Array(mac)));
    return b64 === signature;
  } catch (err) {
    console.error('[line] signature verify error:', err);
    return false;
  }
}

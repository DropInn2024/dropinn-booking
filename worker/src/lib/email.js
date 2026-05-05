/**
 * email.js — 透過 Resend API 發信
 *
 * 使用方式：
 *   import { sendEmail } from '../lib/email.js';
 *   await sendEmail(env, {
 *     to: 'guest@example.com',
 *     subject: '雫旅 — 入住提醒',
 *     html: '<p>...</p>',
 *   });
 *
 * 環境變數：
 *   env.RESEND_API_KEY  — Resend API Key（wrangler secret put RESEND_API_KEY）
 */

const FROM = '雫旅 Drop Inn <hello@dropinn.tw>';

/**
 * 傳送一封信
 * @param {object} env Cloudflare Worker env
 * @param {{ to: string|string[], subject: string, html: string, text?: string }} opts
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
export async function sendEmail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY 未設定，跳過發信');
    return { success: false, error: 'RESEND_API_KEY not set' };
  }

  const body = {
    from: FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (text) body.text = text;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (res.ok) {
      return { success: true, id: data.id };
    }
    console.error('[email] Resend error:', data);
    return { success: false, error: data.message || 'Resend error' };
  } catch (err) {
    console.error('[email] fetch error:', err);
    return { success: false, error: String(err) };
  }
}

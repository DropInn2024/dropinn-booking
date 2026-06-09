import { json } from '../lib/utils.js';
import { lineReply, verifyLineSignature } from '../lib/line.js';

/* 訂單號樣式：TO-/FR-/TR- + 日期 + 4 碼 */
const ORDER_RE = /\b((?:TO|FR|TR)-\d{8}-[A-Z0-9]{4})\b/i;

const HELP_TEXT =
  '嗨～這裡是雫旅 🌊\n要接收預訂進度，請把你的「預訂單號」貼上來（像 TO-20260610-AB12），我就會幫你綁定，成立後第一時間通知你。';

/* ═══════════════════════════════════════════════════════════
   LINE webhook  POST /api/line/webhook
   - 驗證 x-line-signature（用 CHANNEL_SECRET）
   - 客人貼訂單號 → 綁定 lineUserId → 免費 reply 回覆
   ═══════════════════════════════════════════════════════════ */
export async function lineWebhook(request, env, ctx) {
  const raw = await request.text();
  const signature = request.headers.get('x-line-signature');

  // 未設定 CHANNEL_SECRET = webhook 尚未啟用，安全起見不處理任何事件
  if (!env.LINE_CHANNEL_SECRET) return json({ success: true });

  // 驗章：防偽造（驗不過直接拒絕）
  const ok = await verifyLineSignature(raw, signature, env.LINE_CHANNEL_SECRET);
  if (!ok) return json({ error: 'bad signature' }, 401);

  let body;
  try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
  const events = Array.isArray(body.events) ? body.events : [];

  const work = Promise.all(events.map((ev) => handleEvent(ev, env).catch((e) => console.error('[line/webhook]', e))));
  if (ctx && ctx.waitUntil) ctx.waitUntil(work); else await work;

  // LINE 要求 2xx
  return json({ success: true });
}

async function handleEvent(ev, env) {
  const userId = ev && ev.source && ev.source.userId;
  const replyToken = ev && ev.replyToken;

  // 加好友：歡迎並引導貼單號
  if (ev.type === 'follow') {
    return lineReply(env, replyToken, HELP_TEXT);
  }

  // 文字訊息：嘗試綁定訂單
  if (ev.type === 'message' && ev.message && ev.message.type === 'text') {
    const m = String(ev.message.text || '').match(ORDER_RE);
    if (!m) return lineReply(env, replyToken, HELP_TEXT);

    const orderId = m[1].toUpperCase();
    const order = await env.DB.prepare('SELECT id, detail FROM tour_orders WHERE id = ?').bind(orderId).first();
    if (!order) {
      return lineReply(env, replyToken, `找不到單號 ${orderId} 🥲\n請確認後再貼一次，或直接在這裡留言問雫旅。`);
    }
    if (userId) {
      await env.DB.prepare('UPDATE tour_orders SET lineUserId = ? WHERE id = ?').bind(userId, orderId).run();
    }
    let name = '';
    try { name = JSON.parse(order.detail || '{}').productName || ''; } catch (e) { /* ignore */ }
    return lineReply(
      env,
      replyToken,
      `✅ 已綁定單號 ${orderId}${name ? `\n（${name}）` : ''}\n名額確認成立後，我會在這裡第一時間通知你 🌊`,
    );
  }

  return undefined;
}

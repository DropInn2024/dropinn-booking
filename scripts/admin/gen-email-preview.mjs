#!/usr/bin/env node
/**
 * 產生 email 模板預覽頁（給雫編在瀏覽器上一次檢視所有信件 + 挑 icon）。
 *
 * 用法：
 *   node scripts/admin/gen-email-preview.mjs
 *   → 產出 website/email-preview.html
 *
 * 直接 import worker 的真實模板（emailTemplates.js 無外部相依），
 * 所以預覽 = 實際寄出的 HTML，不會走樣。每封信放在獨立 iframe 隔離樣式；
 * 頂端可切換「顯示 / 隱藏 emoji icon」供決定要不要拿掉。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as T from '../../worker/src/lib/emailTemplates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../website/email-preview.html');

// 範例訂單（涵蓋各模板會用到的欄位）
const order = {
  orderID: 'DROP-20260701-001',
  name: '王小明',
  phone: '0912-345-678',
  email: 'guest@example.com',
  checkIn: '2026-07-01',
  checkOut: '2026-07-03',
  rooms: 3,
  extraBeds: 1,
  originalTotal: 15000,
  totalPrice: 13500,
  paidDeposit: 4000,
  remainingBalance: 9500,
  discountCode: 'SUMMER',
  discountType: 'percent',
  discountAmount: 1500,
  isReturningGuest: 1,
  complimentaryNote: '招待仙草冰',
  hasCarRental: 1,
  agreementSignedName: '王小明',
  agreementSignedAt: '2026-06-01T10:30:00+08:00',
  cancelReason: '行程臨時有變',
  notes: '希望安排靠海的房間，會比較晚到（約 20:00）。',
};

const sections = [
  ['客 1', '預約申請已收到（洽談中・48h 催付訂金）', T.bookingPendingHtml(order)],
  ['客 2', '訂單成立（已付訂確認信）',               T.bookingConfirmHtml(order)],
  ['客 3', '入住前一天提醒（含 drift 連結）',         T.checkInReminderHtml(order)],
  ['客 4', '取消通知 — 有訂金（退款說明）',          T.cancellationHtml({ ...order, paidDeposit: 4000 })],
  ['客 4b','取消通知 — 無訂金（感謝信）',            T.cancellationHtml({ ...order, paidDeposit: 0 })],
  ['客 5', '退房感謝信「島嶼的餘韻」',               T.thankYouHtml(order)],
  ['客 6', '旅遊手冊',                              T.travelGuideHtml(order)],
  ['客 7', '洽談中 40h 警告（剩 8h 自動取消）',       T.pendingWarningHtml(order)],
  ['管 1', '管理員 — 新訂單通知',                   T.adminNewOrderHtml(order)],
  ['管 2', '管理員 — 狀態變更（已付訂）',            T.adminStatusNotifyHtml(order, '已付訂')],
  ['管 3', '管理員 — 狀態變更（取消）',              T.adminStatusNotifyHtml(order, '取消')],
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const cards = sections.map(([tag, title, html], i) => `
  <section class="card">
    <h2><span class="tag">${tag}</span>${title}</h2>
    <iframe id="f${i}" loading="lazy" srcdoc="${esc(html)}"></iframe>
  </section>`).join('\n');

const page = `<!doctype html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>雫旅 — 信件模板預覽</title>
<style>
  :root { --bg:#ece8e1; --card:#f8f5ef; --ink:#3a342e; --muted:#8a7a6a; --border:rgba(181,171,160,.4); }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font-family:'Noto Serif TC',-apple-system,sans-serif; padding:0 0 80px; }
  .bar { position:sticky; top:0; z-index:5; background:rgba(236,232,225,.95);
    backdrop-filter:blur(6px); border-bottom:1px solid var(--border);
    padding:16px 24px; display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
  .bar h1 { font-size:16px; letter-spacing:.1em; margin:0; font-weight:500; }
  .bar label { font-size:13px; color:var(--muted); display:flex; align-items:center; gap:8px; cursor:pointer; }
  .wrap { max-width:680px; margin:0 auto; padding:24px; display:flex; flex-direction:column; gap:34px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:14px; overflow:hidden; }
  .card h2 { font-size:14px; font-weight:500; letter-spacing:.04em; margin:0;
    padding:14px 18px; border-bottom:1px solid var(--border); color:var(--ink);
    display:flex; align-items:center; gap:10px; }
  .tag { font-size:11px; background:#e0d8cc; color:#6b5f56; border-radius:999px; padding:3px 10px; letter-spacing:.05em; }
  iframe { width:100%; height:760px; border:0; background:#fff; display:block; }
  .hint { max-width:680px; margin:0 auto; padding:0 24px; color:var(--muted); font-size:13px; line-height:1.9; }
</style>
</head>
<body>
  <div class="bar">
    <h1>雫旅 · 信件模板預覽</h1>
    <label><input type="checkbox" id="noIcon" /> 隱藏所有 emoji icon（看純文字版）</label>
    <span style="font-size:12px;color:var(--muted);">共 ${sections.length} 封</span>
  </div>
  <p class="hint">這裡每封信都是「實際寄出的 HTML」。勾上方核取方塊可比較「拿掉 emoji」的樣子，決定要保留／拿掉哪些再告訴我。</p>
  <div class="wrap">
${cards}
  </div>
<script>
  // 原始 srcdoc 備份
  var frames = [...document.querySelectorAll('iframe')];
  var originals = frames.map(function(f){ return f.getAttribute('srcdoc'); });
  // emoji / 符號清除（涵蓋常見區段）
  var EMOJI = /[\\u{1F000}-\\u{1FAFF}\\u{2190}-\\u{21FF}\\u{2300}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}\\u{200D}]/gu;
  document.getElementById('noIcon').addEventListener('change', function(e){
    var strip = e.target.checked;
    frames.forEach(function(f, i){
      f.setAttribute('srcdoc', strip ? originals[i].replace(EMOJI, '') : originals[i]);
    });
  });
</script>
</body>
</html>`;

fs.writeFileSync(OUT, page, 'utf8');
console.log('✓ wrote', path.relative(path.resolve(__dirname, '../..'), OUT), `(${sections.length} templates)`);

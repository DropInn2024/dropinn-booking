/**
 * emailTemplates.js — 雫旅 Worker 信件 HTML 模板
 *
 * 對應 EmailTemplates.js（GAS 版），但精簡為 Worker 直接可用的函式。
 * 不依賴任何外部套件，純字串拼接。
 */

const COLORS = {
  cream:    '#FDFBF7',
  stone:    '#5B5247',
  warmGray: '#E5E1DA',
  lightGray:'#F5F5F0',
};

const LINKS = {
  agreement:   'https://dropinn.tw/ourpinkypromise',
  travelGuide: 'https://dropinn.tw/howtogetlost',
  maps:        'https://maps.app.goo.gl/fjGjjtXbRJ9Qrk9A7',
  instagram:   'https://www.instagram.com/dropinn.penghu/',
  line:        'https://line.me/ti/p/@dropinn',
};

/* ── 共用樣式 ──────────────────────────────────────────────────── */
function commonStyles() {
  return `
    <style>
      :root { color-scheme: only light; }
      body { margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
             background:${COLORS.cream};color:${COLORS.stone};line-height:1.8; }
      .wrapper { max-width:600px;margin:0 auto;padding:48px 24px; }
      .logo { text-align:center;margin-bottom:40px; }
      .logo-zh { display:block;font-size:22px;letter-spacing:0.4em;color:${COLORS.stone}; }
      .logo-en { display:block;font-size:12px;letter-spacing:0.5em;color:#9b8f85;margin-top:4px; }
      .divider { border:none;border-top:1px solid ${COLORS.warmGray};margin:32px 0; }
      h2 { font-size:20px;font-weight:400;letter-spacing:0.15em;margin:0 0 16px;color:${COLORS.stone}; }
      .greeting { font-size:16px;margin-bottom:24px; }
      .info-box { background:${COLORS.lightGray};border-radius:8px;padding:20px 24px;margin:24px 0; }
      .info-row { display:flex;justify-content:space-between;padding:6px 0;
                  border-bottom:1px solid ${COLORS.warmGray};font-size:14px; }
      .info-row:last-child { border-bottom:none; }
      .info-label { color:#9b8f85;letter-spacing:0.05em; }
      .info-value { color:${COLORS.stone};font-weight:500; }
      p { font-size:14px;margin:12px 0;color:#6b5e56; }
      a { color:${COLORS.stone}; }
      .footer { margin-top:48px;text-align:center;font-size:12px;color:#b5a89e;letter-spacing:0.1em;line-height:2; }
    </style>
  `;
}

function logoHtml() {
  return `<div class="logo"><span class="logo-zh">雫旅</span><span class="logo-en">DROP INN</span></div>`;
}

function footerHtml() {
  return `
    <div class="footer">
      雫旅 Drop Inn<br>
      LINE：<a href="${LINKS.line}" style="color:#b5a89e;text-decoration:none;">@dropinn</a>
      　·　Instagram：<a href="${LINKS.instagram}" style="color:#b5a89e;text-decoration:none;">@dropinn.penghu</a><br>
      <span style="font-size:11px;">如有任何問題，請直接回覆此封信件。</span>
    </div>
  `;
}

function wrap(content) {
  return `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8">${commonStyles()}</head>
<body><div class="wrapper">${logoHtml()}${content}${footerHtml()}</div></body></html>`;
}

function infoRow(label, value) {
  return `<div class="info-row"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`;
}

/* ── 格式化工具 ────────────────────────────────────────────────── */
function fmt(n) { return Number(n || 0).toLocaleString(); }

/* ── 1. 入住前一天提醒 ─────────────────────────────────────────── */
export function checkInReminderHtml(order) {
  const nights = Math.round((new Date(order.checkOut) - new Date(order.checkIn)) / 86400000);
  return wrap(`
    <h2>明天見！</h2>
    <p class="greeting">Hihi ${order.name}，</p>
    <p>您的入住日是明天 <strong>${order.checkIn}</strong>，迫不及待見到你們了！</p>
    <div class="info-box">
      ${infoRow('入住日期', order.checkIn + '（16:00 後入住）')}
      ${infoRow('退房日期', order.checkOut + '（11:00 前退房）')}
      ${infoRow('住宿天數', nights + ' 晚')}
      ${order.remainingBalance > 0 ? infoRow('尾款', 'NT$ ' + fmt(order.remainingBalance)) : ''}
    </div>
    <p>有任何問題隨時 LINE 我們：<a href="${LINKS.line}">@dropinn</a></p>
    <p>旅遊資訊：<a href="${LINKS.travelGuide}">島嶼迷路指南</a></p>
    <hr class="divider">
    <p style="text-align:center;font-size:13px;letter-spacing:0.1em;">待你歸來，澎湖的風都替你等著。</p>
  `);
}

/* ── 2. 預訂確認（洽談中 → 建立訂單時）─────────────────────────── */
export function bookingConfirmHtml(order) {
  const nights = Math.round((new Date(order.checkOut) - new Date(order.checkIn)) / 86400000);
  return wrap(`
    <h2>已收到您的預訂申請</h2>
    <p class="greeting">Hihi ${order.name}，</p>
    <p>我們已收到您的預訂申請，正在確認中，稍後會聯繫您。</p>
    <div class="info-box">
      ${infoRow('訂單編號', order.orderID)}
      ${infoRow('入住日期', order.checkIn + '（16:00 後）')}
      ${infoRow('退房日期', order.checkOut + '（11:00 前）')}
      ${infoRow('住宿天數', nights + ' 晚')}
      ${infoRow('總金額', 'NT$ ' + fmt(order.totalPrice))}
    </div>
    <p>有任何問題隨時 LINE 我們：<a href="${LINKS.line}">@dropinn</a></p>
    <p>
      <a href="${LINKS.agreement}">入住須知與規範</a>
    </p>
  `);
}

/* ── 3. 取消通知 ────────────────────────────────────────────────── */
export function cancellationHtml(order) {
  return wrap(`
    <h2>訂單已取消</h2>
    <p class="greeting">Hihi ${order.name}，</p>
    <p>您的訂單（<strong>${order.orderID}</strong>）已取消。</p>
    ${order.cancelReason ? `<p>取消原因：${order.cancelReason}</p>` : ''}
    <div class="info-box">
      ${infoRow('訂單編號', order.orderID)}
      ${infoRow('入住日期', order.checkIn)}
      ${infoRow('退房日期', order.checkOut)}
    </div>
    <p>如有任何問題，歡迎直接回覆此信件或 LINE 我們。</p>
    <p>期待下次與你們相遇於澎湖！</p>
  `);
}

/* ── 4. 入住感謝信（完成）──────────────────────────────────────── */
export function thankYouHtml(order) {
  return wrap(`
    <h2>謝謝你們的到來</h2>
    <p class="greeting">Hihi ${order.name}，</p>
    <p>感謝你們選擇在雫旅度過這段時光，希望這趟澎湖之旅留下了美好的記憶。</p>
    <p>如果有任何回饋或想說的話，非常歡迎直接回覆這封信。</p>
    <p>旅途愉快，期待再見。</p>
    <hr class="divider">
    <p style="text-align:center;font-size:13px;letter-spacing:0.1em;">
      澎湖的風永遠在，待你再來。
    </p>
    <p style="text-align:center;margin-top:8px;font-size:12px;">
      <a href="${LINKS.maps}">在 Google 地圖留下評價</a>
    </p>
  `);
}

/* ── 5. 管理員通知（新訂單）───────────────────────────────────── */
export function adminNewOrderHtml(order) {
  const nights = Math.round((new Date(order.checkOut) - new Date(order.checkIn)) / 86400000);
  return wrap(`
    <h2>新訂單通知</h2>
    <div class="info-box">
      ${infoRow('訂單編號', order.orderID)}
      ${infoRow('姓名', order.name)}
      ${infoRow('電話', order.phone || '—')}
      ${infoRow('Email', order.email || '—')}
      ${infoRow('入住', order.checkIn)}
      ${infoRow('退房', order.checkOut)}
      ${infoRow('天數', nights + ' 晚')}
      ${infoRow('總金額', 'NT$ ' + fmt(order.totalPrice))}
      ${order.notes ? infoRow('備註', order.notes) : ''}
    </div>
    <p><a href="https://dropinn.tw/notforyou/home/">前往後台查看</a></p>
  `);
}

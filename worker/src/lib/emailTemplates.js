/**
 * emailTemplates.js — 雫旅 Worker 信件 HTML 模板
 *
 * 對齊 EmailTemplates.js（GAS 版），函式名稱與用途一一對應：
 *
 *   bookingPendingHtml     建立訂單（洽談中）→ 48h LINE 催促
 *   bookingConfirmHtml     狀態改為「已付訂」→ 正式確認信
 *   checkInReminderHtml    入住前一天提醒
 *   cancellationHtml       取消通知（自動判斷有無訂金）
 *   thankYouHtml           退房感謝信「島嶼的餘韻」+ STILLDROPINN
 *   adminNewOrderHtml      管理員新訂單通知
 *
 * Subject 格式（在呼叫端組合）：
 *   【雫旅】HiHi 王小明，預約申請已收到
 *   【雫旅】HiHi 王小明，訂單成立
 *   【雫旅】明天見！入住提醒（2026-07-01）
 *   【雫旅】謝謝您，王小明         ← 無訂金取消
 *   【雫旅】王小明，已為您辦理退訂與退款說明  ← 有訂金取消
 *   【雫旅】王小明，島嶼的餘韻
 */

/* ── 品牌常數 ─────────────────────────────────────────────────── */
const CREAM    = '#FDFBF7';
const STONE    = '#5B5247';
const WARM     = '#E5E1DA';
const LIGHT    = '#F5F5F0';

const LINKS = {
  agreement:  'https://dropinn.tw/ourpinkypromise',
  travelGuide:'https://dropinn.tw/howtogetlost',
  drift:      'https://dropinn.tw/drift',
  maps:       'https://maps.app.goo.gl/fjGjjtXbRJ9Qrk9A7',
  instagram:  'https://www.instagram.com/dropinn.penghu/',
  facebook:   'https://www.facebook.com/profile.php?id=61560025202726',
  line:       'https://line.me/ti/p/@dropinn',
};

/* ── 工具 ─────────────────────────────────────────────────────── */
function fmt(n) { return Number(n || 0).toLocaleString(); }

function nights(checkIn, checkOut) {
  return Math.round((new Date(checkOut) - new Date(checkIn)) / 86400000);
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  const days = ['日','一','二','三','四','五','六'];
  return `${dt.getMonth()+1}月${dt.getDate()}日（${days[dt.getDay()]}）`;
}

/* ── 共用樣式 ──────────────────────────────────────────────────── */
function styles() {
  return `<style>
    :root{color-scheme:only light;}
    body{margin:0;padding:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
         background-color:${CREAM}!important;color:${STONE};line-height:1.6;}
    .container{max-width:600px;margin:0 auto;background:${CREAM}!important;}
    .header{padding:40px 20px;text-align:center;border-bottom:1px solid ${WARM};background:${CREAM}!important;}
    .logo-zh{display:block;font-size:23px;font-weight:300;letter-spacing:0.5em;color:${STONE};margin:0 0 12px;}
    .logo-en{display:block;font-size:11px;font-weight:400;letter-spacing:0.42em;
             text-transform:uppercase;color:#8a7a6a;margin:0;}
    .subtitle{font-size:12px;letter-spacing:0.2em;color:#999;margin-top:8px;}
    .content{padding:40px 30px;background:${CREAM}!important;}
    .section{margin-bottom:30px;}
    .section-title{font-size:14px;letter-spacing:0.2em;color:#999;
                   margin-bottom:12px;text-transform:uppercase;}
    .info-row{display:flex;justify-content:space-between;align-items:flex-start;
              gap:20px;padding:12px 8px;}
    .info-label{flex:0 0 100px;font-size:13px;color:#999;letter-spacing:0.1em;padding-left:4px;}
    .info-value{flex:1;font-size:14px;color:${STONE};text-align:right;word-wrap:break-word;padding-right:4px;}
    .highlight-box{background-color:#f0ebe3!important;padding:28px 32px;margin:20px 0;
                   border-left:3px solid ${STONE};color:${STONE}!important;}
    .price{font-size:32px;color:${STONE};text-align:center;margin:20px 0;}
    .price-label{font-size:12px;color:#999;letter-spacing:0.2em;}
    .notice{background-color:#FFF8F0;padding:22px 26px;margin:20px 0;
            border-radius:4px;font-size:13px;line-height:1.8;}
    .footer{padding:30px 20px;text-align:center;border-top:1px solid ${WARM};background:${CREAM}!important;}
    .footer-text{font-size:12px;color:#999;line-height:1.8;}
    .divider{height:1px;background-color:${WARM};margin:30px 0;}
    @media only screen and (max-width:600px){
      .content{padding:30px 20px;}
      .info-row{flex-direction:column;gap:4px;}
      .info-value{text-align:left;}
    }
  </style>`;
}

function logo() {
  return `<h1 style="margin:0;padding:0;">
    <span class="logo-zh">雫旅</span>
    <span class="logo-en">DROP INN</span>
  </h1>`;
}

function footer() {
  return `<div class="footer-text">
    雫旅 Drop Inn<br>
    LINE：<a href="${LINKS.line}" style="color:#999;text-decoration:none;">@dropinn</a>
    　·　Instagram：<a href="${LINKS.instagram}" style="color:#999;text-decoration:none;">@dropinn.penghu</a><br>
    <span style="font-size:11px;color:#aaa;">如有任何問題，請直接回覆此封信件。</span>
  </div>`;
}

function wrap(subtitle, content) {
  return `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    ${styles()}
  </head><body>
    <div class="container">
      <div class="header">${logo()}<p class="subtitle">${subtitle}</p></div>
      <div class="content">${content}</div>
      <div class="footer">${footer()}</div>
    </div>
  </body></html>`;
}

function infoRow(label, value) {
  return `<div class="info-row">
    <div class="info-label">${label}</div>
    <div class="info-value">${value}</div>
  </div>`;
}

function orderBox(order) {
  return `<div class="highlight-box">
    <div style="text-align:center;">
      <div class="price-label">訂單編號</div>
      <div style="font-size:20px;margin-top:8px;letter-spacing:0.1em;">${order.orderID}</div>
    </div>
  </div>`;
}

/* ══════════════════════════════════════════════════════════════════
   1. 建立訂單（洽談中）→ 48h LINE 催促
   subject: 【雫旅】HiHi ${name}，預約申請已收到
══════════════════════════════════════════════════════════════════ */
export function bookingPendingHtml(order) {
  const n = nights(order.checkIn, order.checkOut);
  return wrap('預約申請已收到', `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:22px;line-height:1.8;color:${STONE};margin:0;">
        HiHi ${order.name}
      </p>
      <p style="font-size:16px;line-height:1.8;color:${STONE};margin-top:20px;">
        感謝您選擇雫旅<br>您的預約申請已收到
      </p>
    </div>

    ${orderBox(order)}

    <div class="section">
      <div class="section-title">您的預約資訊</div>
      ${infoRow('入住日期', fmtDate(order.checkIn) + ' 16:00 後')}
      ${infoRow('退房日期', fmtDate(order.checkOut) + ' 11:00 前')}
      ${infoRow('住宿天數', n + ' 晚')}
      ${order.rooms ? infoRow('包棟規模', order.rooms + ' 間房') : ''}
      ${order.totalPrice ? infoRow('費用總計', 'NT$ ' + fmt(order.totalPrice)) : ''}
    </div>

    <div class="notice" style="background:#F6F1E8;border-left:4px solid #C2A878;">
      <strong>重要！下一步行動</strong><br><br>
      <strong>請於 48 小時內完成訂金付款</strong><br>
      請加入官方 LINE，我們會與您確認：<br>
      • 訂金金額與付款方式<br>
      • 入住時間與接待安排<br>
      • 特殊需求處理<br><br>
      <div style="text-align:center;margin:20px 0;">
        <a href="${LINKS.line}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;background:#06C755;color:#ffffff;text-decoration:none;
                  padding:12px 30px;border-radius:8px;font-weight:500;">
          加入 LINE：@dropinn
        </a>
      </div>
      <p style="text-align:center;color:${STONE};margin:0 0 4px;">
        加入 LINE 即可領取專屬優惠碼
      </p>
      <p style="color:#A55A4F;margin-top:15px;font-weight:500;text-align:center;">
        未在期限內完成付訂金，您的預約將自動取消
      </p>
    </div>

    <div class="notice">
      <strong>住宿約定確認紀錄</strong><br>
      ${order.agreementSignedName ? `本次訂房已由 <strong>${order.agreementSignedName}</strong> 完成電子簽署確認，代表同意雫旅全部住宿約定。<br><br>` : ''}
      完整住宿約定與退費準則請見：<a href="${LINKS.agreement}" style="color:${STONE};">雫旅約定</a>
    </div>
  `);
}

/* ══════════════════════════════════════════════════════════════════
   2. 已付訂 → 正式確認信
   subject: 【雫旅】HiHi ${name}，訂單成立
══════════════════════════════════════════════════════════════════ */
export function bookingConfirmHtml(order) {
  const n = nights(order.checkIn, order.checkOut);
  return wrap('訂單成立', `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:22px;line-height:1.8;color:${STONE};margin:0;">
        HiHi ${order.name}
      </p>
      <p style="font-size:16px;line-height:1.8;color:${STONE};margin-top:20px;">
        感謝您選擇雫旅<br>您的訂單已確認成立
      </p>
    </div>

    ${orderBox(order)}

    <div class="section">
      <div class="section-title">您的預約資訊</div>
      ${infoRow('入住日期', fmtDate(order.checkIn) + ' 16:00 後')}
      ${infoRow('退房日期', fmtDate(order.checkOut) + ' 11:00 前')}
      ${infoRow('住宿天數', n + ' 晚')}
      ${order.rooms ? infoRow('包棟規模', order.rooms + ' 間房（' + n + ' 晚）') : ''}
      ${order.totalPrice ? `<div class="divider"></div>
        <div class="price-label" style="text-align:center;">訂單總額</div>
        <div class="price">NT$ ${fmt(order.totalPrice)}</div>` : ''}
    </div>

    <div class="notice">
      <strong>入住須知</strong><br><br>
      <a href="${LINKS.agreement}" style="color:${STONE};font-size:13px;">→ 雫旅約定（點此查看）</a><br><br>
      <strong>Check In / Out</strong><br>
      • 入住時間：16:00 後　退房時間：11:00 前<br><br>
      <strong>注意事項</strong><br>
      • 22:30 後請輕聲細語<br>
      • 響應環保，不主動提供一次性用品<br>
      • 室內全面禁菸・禁止攜帶寵物
    </div>

    <div class="section">
      <div class="section-title">有任何問題？</div>
      <div style="text-align:center;padding:20px 0;font-size:13px;line-height:1.9;">
        <p style="margin:4px 0;">LINE：<a href="${LINKS.line}" style="color:${STONE};text-decoration:none;">@dropinn</a></p>
        <p style="margin:4px 0;">Instagram：<a href="${LINKS.instagram}" style="color:${STONE};text-decoration:none;">@dropinn.penghu</a></p>
      </div>
    </div>

    <div style="text-align:center;margin-top:40px;padding-top:30px;border-top:1px solid ${WARM};">
      <p style="font-size:16px;line-height:1.8;color:${STONE};">
        花火散落後<br>期待您回到雫旅
      </p>
    </div>
  `);
}

/* ══════════════════════════════════════════════════════════════════
   3. 入住前一天提醒
   subject: 【雫旅】明天見！入住提醒（${checkIn}）
══════════════════════════════════════════════════════════════════ */
export function checkInReminderHtml(order) {
  const n = nights(order.checkIn, order.checkOut);
  return wrap('入住提醒', `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:22px;line-height:1.8;color:${STONE};margin:0;">
        HiHi ${order.name}
      </p>
      <p style="font-size:16px;line-height:1.8;color:${STONE};margin-top:20px;">
        明天就要見面了！<br>我們已經準備好迎接你的到來。
      </p>
    </div>

    <div class="highlight-box">
      <div style="text-align:center;">
        <div class="price-label">入住日期</div>
        <div style="font-size:20px;margin-top:8px;letter-spacing:0.1em;">${fmtDate(order.checkIn)}</div>
        <div style="font-size:12px;color:#999;margin-top:8px;">訂單編號：${order.orderID}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">住宿資訊</div>
      ${infoRow('入住時間', '16:00 後')}
      ${infoRow('退房時間', '11:00 前（' + fmtDate(order.checkOut) + '）')}
      ${infoRow('住宿天數', n + ' 晚')}
      ${order.remainingBalance > 0 ? infoRow('尾款', 'NT$ ' + fmt(order.remainingBalance)) : ''}
    </div>

    <div class="notice" style="background:#F0F7FF;border-left:4px solid #5B9BD5;">
      <strong>開門密碼</strong><br><br>
      入住密碼我們將透過 LINE 私訊告知。<br>
      若尚未加入官方 LINE，請盡快加入：<strong>@dropinn</strong>
    </div>

    <div class="notice">
      <strong>地址</strong><br>
      <a href="${LINKS.maps}" style="color:${STONE};">澎湖縣湖西鄉港底212號</a>（點此導航）
    </div>

    <div class="section">
      <div class="section-title">旅遊手冊</div>
      <div style="text-align:center;margin:16px 0;">
        <a href="${LINKS.travelGuide}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;background:${STONE};color:#fff;
                  padding:12px 28px;border-radius:8px;text-decoration:none;
                  font-size:14px;letter-spacing:0.08em;">
          開啟島嶼迷路指南
        </a>
      </div>
    </div>

    <div class="section">
      <div class="section-title">島嶼漂流 drift・在地味地圖</div>
      <p style="font-size:14px;line-height:1.85;color:${STONE};text-align:center;margin:4px 0 16px;">
        雫編私藏的吃喝玩樂與離島路線，<br>替你把澎湖的角落都標好了。
      </p>
      <div style="text-align:center;margin:16px 0;">
        <a href="${LINKS.drift}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;background:${STONE};color:#fff;
                  padding:12px 28px;border-radius:8px;text-decoration:none;
                  font-size:14px;letter-spacing:0.08em;">
          開啟島嶼漂流
        </a>
      </div>
      <div class="notice" style="background:#FBF7F0;border-left:4px solid ${STONE};">
        <strong>你的專屬登入碼</strong><br><br>
        進場代碼就是你的<strong>訂單編號：${order.orderID}</strong><br>
        （住宿期間有效，退房後 3 天內仍可回看收藏）
      </div>
    </div>

    <div style="text-align:center;margin-top:40px;padding-top:30px;border-top:1px solid ${WARM};">
      <p style="font-size:16px;line-height:1.8;color:${STONE};">
        待你歸來，<br>澎湖的風都替你等著。
      </p>
    </div>
  `);
}

/* ══════════════════════════════════════════════════════════════════
   4. 取消通知
   subject（無訂金）: 【雫旅】謝謝您，${name}
   subject（有訂金）: 【雫旅】${name}，已為您辦理退訂與退款說明
══════════════════════════════════════════════════════════════════ */
export function cancellationHtml(order) {
  const hasDeposit = Number(order.paidDeposit) > 0;

  if (hasDeposit) {
    // 有訂金 → 退款說明
    return wrap('退款確認', `
      <p style="font-size:18px;">HiHi ${order.name}，</p>
      <p>已為您辦理退訂，訂單 <strong>${order.orderID}</strong> 的退款已辦理。</p>
      <div class="highlight-box">
        <div style="text-align:center;">
          <div class="price-label">退款金額</div>
          <div style="font-size:20px;margin-top:8px;">NT$ ${fmt(order.paidDeposit)}</div>
        </div>
      </div>
      <p style="font-size:14px;line-height:1.85;color:${STONE};">
        訂金若為<strong>銀行匯款</strong>，請透過 LINE 提供退款入帳之
        <strong>戶名、銀行代碼、帳號</strong>（與當初匯款資料一致者為佳），
        我們將於核對後匯回。<br><br>
        一般約 <strong>3–5 個工作天</strong>可入帳。若逾期未見款項或有任何疑問，
        請直接回覆本信或透過 LINE／Instagram 與我們聯繫。
      </p>
    `);
  } else {
    // 無訂金 → 感謝信
    return wrap('謝謝您', `
      <p style="font-size:18px;">HiHi ${order.name}，</p>
      <p>謝謝您曾考慮雫旅，期待下次有機會為您服務。<br>
         若之後有住宿需求，歡迎隨時與我們聯絡。</p>
      <div class="notice">
        LINE：@dropinn　·　Instagram：@dropinn.penghu
      </div>
    `);
  }
}

/* ══════════════════════════════════════════════════════════════════
   5. 退房感謝信「島嶼的餘韻」
   subject: 【雫旅】${name}，島嶼的餘韻
══════════════════════════════════════════════════════════════════ */
export function thankYouHtml(order) {
  return `<!DOCTYPE html><html><head>
    <meta charset="UTF-8">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    ${styles()}
  </head><body>
    <div class="container" style="background:#f8f6f0;padding:40px 0;">
      <div style="max-width:640px;margin:0 auto;text-align:center;background:#ffffff;
                  border:1px solid #e2dbcf;padding:40px 30px 48px;
                  font-family:'Noto Serif TC',serif;color:#332c27;">

        <h1 style="font-size:22px;letter-spacing:0.2em;font-weight:300;margin:0 0 6px;">島嶼的餘韻</h1>
        <p style="font-size:11px;letter-spacing:0.4em;color:#9b9084;
                  text-transform:uppercase;margin:0 0 8px;">UNTIL NEXT TIME</p>
        <p style="font-size:12px;color:#9b9084;letter-spacing:0.12em;margin:0 0 20px;">
          訂單編號 ${order.orderID || ''}
        </p>

        <div style="width:1px;height:60px;background:linear-gradient(to bottom,transparent,#d6cfc4,transparent);
                    margin:0 auto 32px;opacity:0.7;"></div>

        <p style="font-size:14px;letter-spacing:0.12em;line-height:2.1;margin-bottom:28px;">
          當花火散落，旅程在此暫歇。<br>
          謝謝你，將這幾天珍貴的時間交給了雫旅。<br>
          希望這裡的一切，有為你充飽再次出發的電。
        </p>

        <div style="font-size:13px;letter-spacing:0.18em;color:#9b9084;margin:8px 0 10px;">留下這趟旅程的痕跡</div>
        <div style="font-size:13px;letter-spacing:0.12em;line-height:2;margin-bottom:28px;">
          如果這次的停留，在你心裡留下了什麼，<br>
          歡迎留下隻字片語，或把島嶼的海風一起打包帶走。<br><br>
         寫下你的感受：
          <a href="${LINKS.maps}" target="_blank" rel="noopener noreferrer"
             style="color:#b8795a;text-decoration:none;">Google 評論連結</a><br>
         與我們保持聯繫：
          <a href="${LINKS.instagram}" target="_blank" rel="noopener noreferrer"
             style="color:#b8795a;text-decoration:none;">Instagram</a>
          ·
          <a href="${LINKS.facebook}" target="_blank" rel="noopener noreferrer"
             style="color:#b8795a;text-decoration:none;">Facebook</a>
          ·
          <a href="${LINKS.line}" target="_blank" rel="noopener noreferrer"
             style="color:#b8795a;text-decoration:none;">LINE @dropinn</a>
        </div>

        <div style="font-size:13px;letter-spacing:0.18em;color:#9b9084;margin:8px 0 10px;">留給歸人的鑰匙</div>
        <p style="font-size:13px;letter-spacing:0.12em;line-height:2.1;margin-bottom:18px;">
          為了未來的重逢，我們悄悄為老朋友留了一把鑰匙。<br>
          在未來某個剛好有空的日子，歡迎隨時回來，就像回到島上另一個家。
        </p>
        <p style="font-size:13px;letter-spacing:0.14em;line-height:2;margin-bottom:18px;">
         專屬歸期密碼：<strong>STILLDROPINN</strong><br>
          <span style="font-size:12px;color:#777;">
            （憑此密碼預訂，每晚可享 500 元老客專屬折扣。可加上年度，例如
            <strong>stilldropinn2026</strong>。此為老友專屬心意，恕不與其他優惠併用。）
          </span>
        </p>

        <p style="font-size:14px;letter-spacing:0.12em;line-height:2.1;margin-top:24px;margin-bottom:18px;">
          在未來的日子裡，我們依然會為你預留一處空白。<br>
          祝你有一趟平安順心的回程。
        </p>

        <p style="font-size:12px;letter-spacing:0.25em;color:#9b9084;margin-top:20px;">
          — 雫旅一直都在
        </p>

        <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2dbcf;
                    font-size:11px;color:#9b9084;line-height:1.9;">
          雫旅 Drop Inn<br>
          LINE：<a href="${LINKS.line}" style="color:#9b9084;text-decoration:none;">@dropinn</a>
          　·　Instagram：<a href="${LINKS.instagram}" style="color:#9b9084;text-decoration:none;">@dropinn.penghu</a><br>
          如有任何問題，請直接回覆此封信件。
        </div>
      </div>
    </div>
  </body></html>`;
}

/* ══════════════════════════════════════════════════════════════════
   6. 管理員新訂單通知（內部用）
══════════════════════════════════════════════════════════════════ */
export function adminNewOrderHtml(order) {
  const n = nights(order.checkIn, order.checkOut);
  return wrap('新訂單通知', `
    ${orderBox(order)}

    <div class="section">
      <div class="section-title">客人資訊</div>
      ${infoRow('姓名', order.name || '—')}
      ${infoRow('電話', order.phone || '—')}
      ${order.email ? infoRow('Email', order.email) : ''}
    </div>

    <div class="section">
      <div class="section-title">住宿資訊</div>
      ${infoRow('入住日期', fmtDate(order.checkIn))}
      ${infoRow('退房日期', fmtDate(order.checkOut))}
      ${infoRow('住宿天數', n + ' 晚')}
      ${order.rooms ? infoRow('房間數', order.rooms + ' 間') : ''}
      ${order.totalPrice ? `<div class="divider"></div>
        <div class="price-label" style="text-align:center;">訂單總額</div>
        <div class="price">NT$ ${fmt(order.totalPrice)}</div>` : ''}
    </div>

    ${order.notes ? `<div class="notice"><strong>客人備註</strong><br>${order.notes}</div>` : ''}

    <div class="notice">
      <strong>處理步驟</strong><br>
      1. 等待客人加入 LINE（@dropinn）<br>
      2. 確認訂金收款後，更新訂單狀態為「已付訂」<br>
      3. 系統將自動發送確認信給客人（若有提供 Email）
    </div>

    <div style="text-align:center;margin-top:20px;">
      <a href="https://dropinn.tw/notforyou/home/"
         style="display:inline-block;background:${STONE};color:#fff;
                padding:12px 28px;border-radius:8px;text-decoration:none;
                font-size:14px;letter-spacing:0.08em;">
        前往後台查看
      </a>
    </div>
  `);
}

/* ══════════════════════════════════════════════════════════════════
   7. 管理員狀態變更通知（已付訂 / 取消）
══════════════════════════════════════════════════════════════════ */
export function adminStatusNotifyHtml(order, newStatus) {
  const isCancel = newStatus === '取消';
  const isPaid   = newStatus === '已付訂';
  const emoji    = isCancel ? '' : isPaid ? '' : '';
  const label    = isCancel ? '訂單已取消' : isPaid ? '訂單已付訂確認' : `訂單狀態：${newStatus}`;
  const n        = nights(order.checkIn, order.checkOut);

  return wrap(`${emoji} ${label}`, `
    ${orderBox(order)}

    <div class="section">
      <div class="section-title">客人資訊</div>
      ${infoRow('姓名', order.name || '—')}
      ${infoRow('電話', order.phone || '—')}
      ${order.email ? infoRow('Email', order.email) : ''}
    </div>

    <div class="section">
      <div class="section-title">住宿資訊</div>
      ${infoRow('入住日期', fmtDate(order.checkIn))}
      ${infoRow('退房日期', fmtDate(order.checkOut))}
      ${infoRow('住宿天數', n + ' 晚')}
      ${infoRow('訂單總額', 'NT$ ' + fmt(order.totalPrice))}
      ${order.paidDeposit ? infoRow('已付訂金', 'NT$ ' + fmt(order.paidDeposit)) : ''}
      ${order.remainingBalance ? infoRow('待收尾款', 'NT$ ' + fmt(order.remainingBalance)) : ''}
    </div>

    ${isCancel && order.cancelReason ? `
      <div class="notice"><strong>取消原因</strong><br>${order.cancelReason}</div>` : ''}

    <div style="text-align:center;margin-top:20px;">
      <a href="https://dropinn.tw/notforyou/home/"
         style="display:inline-block;background:${STONE};color:#fff;
                padding:12px 28px;border-radius:8px;text-decoration:none;
                font-size:14px;letter-spacing:0.08em;">
        前往後台查看
      </a>
    </div>
  `);
}

/* ══════════════════════════════════════════════════════════════════
   8. 旅遊手冊（入住前 7 天）
══════════════════════════════════════════════════════════════════ */
export function travelGuideHtml(order) {
  const d = new Date(order.checkIn + 'T00:00:00+08:00');
  const checkInStr = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;

  return wrap('旅遊手冊已備妥', `
    <p style="text-align:center;font-size:15px;color:${STONE};margin:0 0 24px;">
      HiHi ${order.name}<br>
      再 7 天就要見面了！以下是我們特別為您準備的旅遊手冊，
      希望能讓您的澎湖旅程更順暢。
    </p>

    ${orderBox(order)}

    <div class="section">
      <div class="section-title">怎麼到雫旅</div>
      <p style="color:${STONE};font-size:14px;line-height:1.7;margin:0;">
        從馬公機場或馬公港出發，開車約 20 分鐘即可抵達。<br>
        建議提前在島上租車，方便自由探索澎湖各景點。<br>
        抵達前請透過 LINE 與我們確認，我們會提供精確導航連結。
      </p>
    </div>

    <div class="section">
      <div class="section-title">租車推薦</div>
      <p style="color:${STONE};font-size:14px;line-height:1.7;margin:0;">
        澎湖景點較分散，強烈建議租車出行。<br>
        我們與幾家在地租車行有合作，如需協助請提前透過 LINE 詢問，
        我們幫您推薦並代訂。
      </p>
    </div>

    <div class="section">
      <div class="section-title">入住說明</div>
      <p style="color:${STONE};font-size:14px;line-height:1.7;margin:0;">
        入住時間：下午 3 點後<br>
        退房時間：上午 11 點前<br>
        門鎖密碼將在入住前一天透過 LINE 告知，請保持聯繫。
      </p>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="${LINKS.travelGuide}"
         style="display:inline-block;background:${STONE};color:#fff;
                padding:14px 32px;border-radius:8px;text-decoration:none;
                font-size:15px;letter-spacing:0.08em;">
        完整旅遊手冊 →
      </a>
    </div>

    <div class="notice">
      澎湖的夏天充滿驚喜，期待在 ${checkInStr} 與您相遇
    </div>

    <p style="text-align:center;font-size:13px;color:#999;margin:24px 0 0;">
      有任何疑問，歡迎透過 LINE（@dropinn）隨時聯繫我們
    </p>
  `);
}

/* ══════════════════════════════════════════════════════════════════
   9. 洽談中 40 小時警告（客人版）
══════════════════════════════════════════════════════════════════ */
export function pendingWarningHtml(order) {
  return wrap('預約快到期囉，還剩 8 小時', `
    <p style="text-align:center;font-size:15px;color:${STONE};margin:0 0 24px;">
      HiHi ${order.name}<br>
      我們在約 40 小時前收到您的預約申請，距離系統自動取消只剩 <strong>8 小時</strong>。
    </p>

    ${orderBox(order)}

    <div class="notice" style="background:#FFF3CD;border-left:4px solid #F5A623;">
      <strong>請盡快完成以下步驟：</strong><br><br>
      加入雫旅官方 LINE，與我們確認訂金與入住細節，即可鎖定您的預約。
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://line.me/ti/p/@dropinn"
         style="display:inline-block;background:#00B900;color:#fff;
                padding:14px 32px;border-radius:8px;text-decoration:none;
                font-size:15px;letter-spacing:0.04em;">
        LINE 加入好友 →
      </a>
    </div>

    <p style="text-align:center;font-size:13px;color:#999;margin:0;">
      如您已加入 LINE，請忽略此信。若有任何問題，請直接回覆 LINE 訊息。
    </p>
  `);
}

/* ══════════════════════════════════════════════════════════════════
   行程／船票／租車 — 預訂需求已收到（客人）
   order: { orderId, kindLabel, productName, date, session, peopleText,
            total, contactName, cancelPolicy }
══════════════════════════════════════════════════════════════════ */
export function tourOrderPendingHtml(order) {
  const k = order.kindLabel || '行程';
  return wrap('預訂需求已收到', `
    <div style="text-align:center;margin-bottom:34px;">
      <p style="font-size:22px;line-height:1.8;color:${STONE};margin:0;">HiHi ${order.contactName || ''}</p>
      <p style="font-size:16px;line-height:1.8;color:${STONE};margin-top:18px;">
        感謝您透過雫旅預訂${k}<br>您的<strong>預訂需求已收到</strong>
      </p>
    </div>
    <div class="section">
      <div class="section-title">預訂內容</div>
      ${infoRow('單號', order.orderId)}
      ${infoRow(k, order.productName || '')}
      ${order.date ? infoRow('日期', order.date) : ''}
      ${order.session ? infoRow('場次', order.session) : ''}
      ${order.peopleText ? infoRow('人數', order.peopleText) : ''}
      ${order.total ? infoRow('預估金額', 'NT$ ' + fmt(order.total)) : ''}
    </div>
    <div class="notice" style="background:#F6F1E8;border-left:4px solid #C2A878;">
      <strong>接下來</strong><br><br>
      名額／船位有限，<strong>送出後尚未代表成立</strong>。雫旅將為您向業者確認，<strong>確認結果會再回覆您</strong>。<br>
      建議加入官方 LINE，確認與後續通知更即時：
      <div style="text-align:center;margin:18px 0;">
        <a href="${LINKS.line}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;background:#06C755;color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:8px;font-weight:500;">加入 LINE：@dropinn</a>
      </div>
    </div>
    ${order.cancelPolicy ? `<div class="notice"><strong>取消說明</strong><br>${order.cancelPolicy}</div>` : ''}
  `);
}

/* 行程／船票／租車 — 管理員新訂單通知 */
export function tourOrderAdminHtml(order) {
  const k = order.kindLabel || '行程';
  return wrap('新' + k + '訂單', `
    <div class="section">
      <div class="section-title">新${k}訂單</div>
      ${infoRow('單號', order.orderId)}
      ${infoRow('項目', order.productName || '')}
      ${order.date ? infoRow('日期', order.date) : ''}
      ${order.session ? infoRow('場次', order.session) : ''}
      ${order.peopleText ? infoRow('人數', order.peopleText) : ''}
      ${infoRow('聯絡人', (order.contactName || '') + '　' + (order.contactPhone || ''))}
      ${order.email ? infoRow('Email', order.email) : ''}
      ${order.total ? infoRow('預估金額', 'NT$ ' + fmt(order.total)) : ''}
    </div>
  `);
}

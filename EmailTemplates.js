/**
 * emailTemplates.js
 * 雫旅訂房系統 - Email HTML 模板
 * ✅ 修改：改為 "Hihi 王小明" 親切風格
 * ✅ 修改：移除「澎湖質感民宿」改為「澎湖包棟民宿」
 */

const EmailTemplates = (() => {
  // 品牌色系
  const COLORS = {
    cream: '#FDFBF7',
    stone: '#5B5247',
    warmGray: '#E5E1DA',
    lightGray: '#F5F5F0',
    accent: '#5B5247',
    lightInk: '#5B5247',
  };

  /**
   * 信件內文連結（與官網／社群一致；地圖為 Google 地點頁，可導航與留評）
   */
  const LINKS = {
    agreement: 'https://dropinn.tw/ourpinkypromise',
    travelGuide: 'https://dropinn.tw/howtogetlost',
    // 與官網 index.html「聯絡我們」四 icon 一致
    mapsPlace: 'https://maps.app.goo.gl/fjGjjtXbRJ9Qrk9A7',
    instagram: 'https://www.instagram.com/dropinn.penghu/',
    facebook: 'https://www.facebook.com/profile.php?id=61560025202726',
    line: 'https://line.me/ti/p/@dropinn',
  };

  /** 客人信件頁尾：不含地址與電話，引導 LINE／IG，可回覆郵件 */
  const getCustomerFooterHtml = () => `
            <div class="footer-text">
              雫旅 Drop Inn<br>
              LINE：<a href="${LINKS.line}" style="color:#999;text-decoration:none;">@dropinn</a>
              　·　Instagram：<a href="${LINKS.instagram}" style="color:#999;text-decoration:none;">@dropinn.penghu</a><br>
              <span style="font-size:11px;color:#aaa;">如有任何問題，請直接回覆此封信件。</span>
            </div>
  `;

  /**
   * 共用樣式
   */
  /** 標題兩行：雫旅 / DROP INN（避免郵件客戶端把「雫旅 DROP」與「INN」斷開） */
  const brandLogoHtml = () =>
    '<h1 class="logo"><span class="logo-zh">雫旅</span><span class="logo-en">DROP INN</span></h1>';

  const getCommonStyles = () => `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&family=Noto+Serif+TC:wght@300;400;700&family=Noto+Sans+TC:wght@300;400;500&display=swap');
      :root { color-scheme: only light; }
      body {
        margin: 0;
        padding: 0;
        font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, sans-serif;
        background-color: ${COLORS.cream} !important;
        color: ${COLORS.stone};
        line-height: 1.6;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: ${COLORS.cream} !important;
      }
      .header {
        padding: 40px 20px;
        text-align: center;
        border-bottom: 1px solid ${COLORS.warmGray};
        background-color: ${COLORS.cream} !important;
      }
      .logo {
        margin: 0;
        padding: 0;
      }
      .logo-zh {
        display: block;
        font-family: 'Noto Serif TC', serif;
        font-size: 23px;
        font-weight: 300;
        letter-spacing: 0.5em;
        color: ${COLORS.stone};
        margin: 0 0 12px 0;
      }
      .logo-en {
        display: block;
        font-family: 'Cormorant Garamond', 'Noto Serif TC', Georgia, serif;
        font-size: 11px;
        font-weight: 400;
        letter-spacing: 0.42em;
        text-transform: uppercase;
        color: #8a7a6a;
        margin: 0;
      }
      .subtitle {
        font-size: 12px;
        letter-spacing: 0.2em;
        color: #999;
        margin-top: 8px;
      }
      .content {
        padding: 40px 30px;
        background-color: ${COLORS.cream} !important;
      }
      .section {
        margin-bottom: 30px;
      }
      .section-title {
        font-size: 14px;
        letter-spacing: 0.2em;
        color: #999;
        margin-bottom: 12px;
        text-transform: uppercase;
      }
      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        padding: 12px 8px;
      }
      .info-label {
        flex: 0 0 100px;
        font-size: 13px;
        color: #999;
        letter-spacing: 0.1em;
        padding-left: 4px;
      }
      .info-value {
        flex: 1;
        font-size: 14px;
        color: ${COLORS.stone};
        text-align: right;
        word-wrap: break-word;
        padding-right: 4px;
      }
      .highlight-box {
        background-color: #f0ebe3 !important;
        padding: 28px 32px;
        margin: 20px 0;
        border-left: 3px solid ${COLORS.stone};
        color: ${COLORS.stone} !important;
      }
      .price {
        font-family: 'Noto Serif TC', serif;
        font-size: 32px;
        color: ${COLORS.stone};
        text-align: center;
        margin: 20px 0;
      }
      .price-label {
        font-size: 12px;
        color: #999;
        letter-spacing: 0.2em;
      }
      .notice {
        background-color: #FFF8F0;
        padding: 22px 26px;
        margin: 20px 0;
        border-radius: 4px;
        font-size: 13px;
        line-height: 1.8;
      }
      .footer {
        padding: 30px 20px;
        text-align: center;
        border-top: 1px solid ${COLORS.warmGray};
        background-color: ${COLORS.cream} !important;
      }
      .footer-text {
        font-size: 12px;
        color: #999;
        line-height: 1.8;
      }
      .divider {
        height: 1px;
        background-color: ${COLORS.warmGray};
        margin: 30px 0;
      }
      
      @media only screen and (max-width: 600px) {
        .content {
          padding: 30px 20px;
        }
        .info-row {
          flex-direction: column;
          gap: 4px;
        }
        .info-value {
          text-align: left;
        }
      }
    </style>
  `;

  /**
   * 計算住宿晚數
   */
  const getNights = (checkIn, checkOut) => {
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  };

  /**
   * 格式化日期
   */
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = days[date.getDay()];
    return `${month}月${day}日 (${weekday})`;
  };

  /**
   * 管理員通知模板
   */
  function getAdminNotificationTemplate(order) {
    const nights = getNights(order.checkIn, order.checkOut);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${getCommonStyles()}
      </head>
      <body>
        <div class="container">
          
          <!-- Header -->
          <div class="header">
            ${brandLogoHtml()}
            <p class="subtitle">新訂單通知</p>
          </div>
          
          <!-- Content -->
          <div class="content">
            
            <!-- 訂單編號 -->
            <div class="highlight-box">
              <div style="text-align: center;">
                <div class="price-label">訂單編號</div>
                <div style="font-family: 'Noto Serif TC', serif; font-size: 20px; margin-top: 8px; letter-spacing: 0.1em;">
                  ${order.orderID}
                </div>
              </div>
            </div>
            
            <!-- 客人資訊 -->
            <div class="section">
              <div class="section-title">客人資訊</div>
              <div class="info-row">
                <div class="info-label">姓名</div>
                <div class="info-value">${order.name}</div>
              </div>
              <div class="info-row">
                <div class="info-label">電話</div>
                <div class="info-value">${order.phone}</div>
              </div>
              ${
                order.email
                  ? `
              <div class="info-row">
                <div class="info-label">Email</div>
                <div class="info-value">${order.email}</div>
              </div>
              `
                  : ''
              }
            </div>
            
            <!-- 住宿資訊 -->
            <div class="section">
              <div class="section-title">住宿資訊</div>
              <div class="info-row">
                <div class="info-label">入住日期</div>
                <div class="info-value">${formatDate(order.checkIn)}</div>
              </div>
              <div class="info-row">
                <div class="info-label">退房日期</div>
                <div class="info-value">${formatDate(order.checkOut)}</div>
              </div>
              <div class="info-row">
                <div class="info-label">住宿晚數</div>
                <div class="info-value">${nights} 晚</div>
              </div>
              <div class="info-row">
                <div class="info-label">房間數</div>
                <div class="info-value">${order.rooms} 間</div>
              </div>
              ${
                order.extraBeds > 0
                  ? `
              <div class="info-row">
                <div class="info-label">加床</div>
                <div class="info-value">${order.extraBeds} 床</div>
              </div>
              `
                  : ''
              }
            </div>
            
            <!-- 總金額 -->
            <div class="section">
              <div class="divider"></div>
              <div class="price-label">訂單總額</div>
              <div class="price">NT$ ${order.totalPrice.toLocaleString()}</div>
              <div style="text-align: center; font-size: 12px; color: #999;">
                包棟 ${order.rooms} 間 · ${nights} 晚${order.extraBeds > 0 ? ` · 加床 ${order.extraBeds} 床` : ''}，實際金額以上方數字為準
              </div>
            </div>
            
            ${
              order.notes
                ? `
            <!-- 備註 -->
            <div class="section">
              <div class="section-title">客人備註</div>
              <div class="notice">${order.notes}</div>
            </div>
            `
                : ''
            }
            
            <!-- 下一步 -->
            <div class="notice">
              <strong>📋 處理步驟：</strong><br>
              1. 等待客人加入 LINE（@dropinn）<br>
              2. 確認訂金收款後，更新試算表狀態為「已付訂」<br>
              3. 系統將自動發送確認信給客人（若有提供 Email）
            </div>
            
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <div class="footer-text">
              此為系統自動通知信件<br>
              請勿直接回覆此郵件
            </div>
          </div>
          
        </div>
      </body>
      </html>
    `;
  }

  /**
   * ✅ 修改：客人確認信模板（Hihi 風格 + 48小時提醒）
   */
  function getCustomerConfirmationTemplate(order) {
    const nights = getNights(order.checkIn, order.checkOut);
    const deposit = Math.round(order.totalPrice * 0.3);
    const balance = order.totalPrice - deposit;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${getCommonStyles()}
      </head>
      <body>
        <div class="container">
          
          <!-- Header -->
          <div class="header">
            ${brandLogoHtml()}
            <p class="subtitle">訂單成立</p>
          </div>
          
          <!-- Content -->
          <div class="content">
            
            <!-- ✅ 歡迎訊息（Hihi 風格） -->
            <div style="text-align: center; margin-bottom: 40px;">
              <p style="font-family: 'Noto Serif TC', serif; font-size: 22px; line-height: 1.8; color: ${COLORS.stone}; margin: 0;">
                Hihi ${order.name} 👋
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: ${COLORS.stone}; margin-top: 20px;">
                感謝您選擇雫旅<br>
                您的預約申請已收到
              </p>
            </div>
            
            <!-- 訂單編號 -->
            <div class="highlight-box">
              <div style="text-align: center;">
                <div class="price-label">訂單編號</div>
                <div style="font-family: 'Noto Serif TC', serif; font-size: 20px; margin-top: 8px; letter-spacing: 0.1em;">
                  ${order.orderID}
                </div>
              </div>
            </div>
            
            <!-- 住宿資訊 -->
            <div class="section">
              <div class="section-title">您的預約資訊</div>
              <div class="info-row">
                <div class="info-label">入住日期</div>
                <div class="info-value">${formatDate(order.checkIn)} 16:00 後</div>
              </div>
              <div class="info-row">
                <div class="info-label">退房日期</div>
                <div class="info-value">${formatDate(order.checkOut)} 11:00 前</div>
              </div>
              <div class="info-row">
                <div class="info-label">住宿晚數</div>
                <div class="info-value">${nights} 晚</div>
              </div>
              <div class="info-row">
                <div class="info-label">包棟規模</div>
                <div class="info-value">${order.rooms} 間房（${nights} 晚）</div>
              </div>
              ${
                order.extraBeds > 0
                  ? `
              <div class="info-row">
                <div class="info-label">加床</div>
                <div class="info-value">${order.extraBeds} 床</div>
              </div>
              `
                  : ''
              }
            </div>
            
            <!-- 費用明細 -->
            <div class="section">
              <div class="section-title">預估金額</div>
              <div class="info-row">
                <div class="info-label">費用總計</div>
                <div class="info-value" style="font-size: 18px; color: #F4C430; font-weight: 500;">NT$ ${order.totalPrice.toLocaleString()}</div>
              </div>
              <div style="text-align: center; font-size: 12px; color: #999; margin-top: 8px;">
                包棟 ${nights} 晚${order.extraBeds > 0 ? ` + ${order.extraBeds} 加床` : ''}
              </div>
            </div>
            
            <!-- ✅ 重要提醒（48小時） -->
            <div class="notice" style="background-color: #FFF9E6; border-left: 4px solid #F4C430;">
              <strong>⚠️ 重要！下一步行動</strong><br><br>
              
              <strong>請於 48 小時內加入我們的官方 LINE</strong><br>
              我們需要與您確認以下事項：<br>
              • 訂金金額與付款方式<br>
              • 入住時間與接待安排<br>
              • 特殊需求處理<br><br>
              
              <div style="text-align: center; margin: 20px 0;">
                <div style="display: inline-block; background: #06C755; color: white; padding: 12px 30px; border-radius: 8px; font-weight: 500;">
                  💬 LINE ID: @dropinn
                </div>
              </div>
              
              <p style="color: #d32f2f; margin-top: 15px; font-weight: 500;">
                ⏰ 未在期限內加入 LINE，您的預約將自動取消
              </p>
            </div>
            
            <!-- 入住須知 -->
            <div class="notice">
              <strong>🏠 入住須知</strong><br><br>
              <a href="${LINKS.agreement}" style="color: #5b5247; font-size: 13px; letter-spacing: 0.05em;">→ 雫旅約定（點此查看）</a><br><br>
              
              <strong>Check In / Out</strong><br>
              • 入住時間：16:00 後<br>
              • 退房時間：11:00 前<br><br>
              
              <strong>公共空間</strong><br>
              • 22:00 後請輕聲細語<br>
              • 響應環保，不主動提供一次性用品<br><br>
              
              <strong>其他提醒</strong><br>
              • 室內全面禁菸<br>
              • 請愛護空間設施
            </div>
            
            <!-- 聯絡方式 -->
            <div class="section">
              <div class="section-title">聯絡我們</div>
              <div style="text-align: center; padding: 20px 0; font-size:13px; line-height:1.9;">
                <p style="margin: 4px 0;">
                  LINE：
                  <a href="${LINKS.line}" style="color:${COLORS.stone}; text-decoration:none;">@dropinn</a>
                </p>
                <p style="margin: 4px 0;">
                  Instagram：
                  <a href="${LINKS.instagram}" style="color:${COLORS.stone}; text-decoration:none;">@dropinn.penghu</a>
                </p>
              </div>
            </div>
            
            <!-- 結語 -->
            <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid ${COLORS.warmGray};">
              <p style="font-family: 'Noto Serif TC', serif; font-size: 16px; line-height: 1.8; color: ${COLORS.stone};">
                花火散落後<br>
                期待您回到雫旅
              </p>
            </div>
            
          </div>
          
          <!-- Footer -->
          <div class="footer">
            ${getCustomerFooterHtml()}
          </div>
          
        </div>
      </body>
      </html>
    `;
  }

  /**
   * ✅ 新增：旅遊手冊 Email 模板（入住前 7 天發送）
   */
  function getTravelGuideTemplate(order, checkInStr) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${getCommonStyles()}
      </head>
      <body>
        <div class="container">
          
          <!-- Header -->
          <div class="header">
            ${brandLogoHtml()}
            <p class="subtitle">旅遊手冊</p>
          </div>
          
          <!-- Content -->
          <div class="content">
            
            <!-- 歡迎訊息 -->
            <div style="text-align: center; margin-bottom: 40px;">
              <p style="font-family: 'Noto Serif TC', serif; font-size: 22px; line-height: 1.8; color: ${COLORS.stone}; margin: 0;">
                Hihi ${order.name} 👋
              </p>
              <p style="font-size: 16px; line-height: 1.8; color: ${COLORS.stone}; margin-top: 20px;">
                再 7 天就要見面了！<br>
                我們已經準備好迎接你的到來
              </p>
              <p style="font-size: 13px; line-height: 1.8; color: #666; margin-top: 16px;">
                若您曾委託我們協助租車，請留意<strong>入住前一天</strong>車行是否已與您聯絡接送事宜；若未接到通知，請馬上與我們聯繫，以便協助安排。
              </p>
            </div>
            
            <!-- 訂單資訊 -->
            <div class="highlight-box">
              <div style="text-align: center;">
                <div class="price-label">入住日期</div>
                <div style="font-family: 'Noto Serif TC', serif; font-size: 20px; margin-top: 8px; letter-spacing: 0.1em;">
                  ${checkInStr}
                </div>
                <div style="font-size: 12px; color: #999; margin-top: 8px;">
                  訂單編號：${order.orderID}
                </div>
              </div>
            </div>
            
            <!-- 交通與入住重點 -->
            <div class="section">
              <div class="section-title">怎麼到雫旅</div>
              <div class="info-row">
                <div class="info-label">地址</div>
                <div class="info-value">
                  <a href="${LINKS.mapsPlace}" target="_blank" rel="noopener noreferrer" style="color: ${COLORS.accent}; text-decoration: none;">澎湖縣湖西鄉港底212號</a>
                </div>
              </div>
              <div class="info-row">
                <div class="info-label">入住時間</div>
                <div class="info-value">16:00 後</div>
              </div>
              <div class="info-row">
                <div class="info-label">退房時間</div>
                <div class="info-value">11:00 前</div>
              </div>
              <div class="info-row">
                <div class="info-label">開門方式</div>
                <div class="info-value">密碼鎖；入住前會透過 LINE 另傳</div>
              </div>
            </div>
            
            <!-- 開門密碼說明 -->
            <div class="section">
              <div class="section-title">入住當天</div>
              <div class="notice" style="background-color: #F0F7FF; border-left: 4px solid #5B9BD5;">
                <strong>🔑 開門密碼</strong><br><br>
                入住當天的開門密碼，我們會在確認你已加入 LINE 後，透過 LINE 私訊告知。<br>
                請記得加入我們的官方 LINE：<strong>@dropinn</strong>
              </div>
            </div>
            
            <!-- 旅遊手冊 -->
            <div class="section">
              <div class="section-title">完整旅遊手冊</div>
              <p style="font-size: 14px; line-height: 1.8; color: ${COLORS.lightInk};">
                我們為你準備了完整的旅遊手冊，包含：<br>
                • 民宿設備使用說明<br>
                • 澎湖推薦景點與美食<br>
                • 交通與行程建議<br>
                • 緊急聯絡方式<br><br>
                內容已整理在官網「旅遊手冊」頁面，點下方按鈕即可閱讀。<br>
                入住當天我們也會提供紙本手冊供你參考。
              </p>
              <div style="text-align: center; margin: 24px 0 8px;">
                <a href="${LINKS.travelGuide}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: ${COLORS.stone}; color: #fff; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 14px; letter-spacing: 0.08em;">開啟旅遊手冊</a>
              </div>
            </div>
            
            <!-- 聯絡方式 -->
            <div class="section">
              <div class="section-title">有任何問題？</div>
              <div style="text-align: center; padding: 20px 0; font-size:13px; line-height:1.9;">
                <p style="margin: 4px 0;">
                  LINE：
                  <a href="${LINKS.line}" style="color:${COLORS.stone}; text-decoration:none;">@dropinn</a>
                </p>
                <p style="margin: 4px 0;">
                  Instagram：
                  <a href="${LINKS.instagram}" style="color:${COLORS.stone}; text-decoration:none;">@dropinn.penghu</a>
                </p>
              </div>
            </div>
            
            <!-- 結語 -->
            <div style="text-align: center; margin-top: 40px; padding-top: 30px; border-top: 1px solid ${COLORS.warmGray};">
              <p style="font-family: 'Noto Serif TC', serif; font-size: 16px; line-height: 1.8; color: ${COLORS.stone};">
                期待你的到來<br>
                讓我們一起在澎湖創造美好的回憶
              </p>
            </div>
            
          </div>
          
          <!-- Footer -->
          <div class="footer">
            ${getCustomerFooterHtml()}
          </div>
          
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 待確認信（客人下單後）：48 小時內確認、住宿須知連結、聯絡 LINE／IG
   */
  function getPendingConfirmationTemplate(order) {
    const nights = getNights(order.checkIn, order.checkOut);
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><meta name="viewport" content="width=device-width, initial-scale=1.0">${getCommonStyles()}</head>
      <body>
        <div class="container">
          <div class="header">
            ${brandLogoHtml()}
            <p class="subtitle">預約申請已收到</p>
          </div>
          <div class="content">
            <p style="font-size: 18px;">Hihi ${order.name}，</p>
            <p>感謝您選擇雫旅，您的預約申請已收到，請於 <strong>48 小時內</strong> 與我們聯繫確認，以完成預訂。</p>
            <div class="highlight-box">
              <div class="price-label">訂單編號</div>
              <div style="font-size: 20px; margin-top: 8px;">${order.orderID}</div>
              <div style="margin-top: 12px;">入住 ${formatDate(order.checkIn)} · ${nights} 晚</div>
            </div>
            <div class="notice">
              <strong>下一步</strong><br>
              請加入官方 LINE 或 Instagram 私訊，我們將與您確認<strong>訂金</strong>與入住事宜。<br>
              訂金若為匯款，後續退款亦須依您提供的銀行帳戶辦理，請屆時一併確認。<br><br>
              LINE：@dropinn<br>
              IG：@dropinn.penghu
            </div>
            <div class="notice">
              <strong>住宿約定確認紀錄</strong><br>
              ${order.agreementSignedName ? `本次訂房已由 <strong>${order.agreementSignedName}</strong> 完成電子簽署確認，代表同意雫旅全部住宿約定。<br><br>` : ''}
              以下為住宿規範摘要，完整版請見：<a href="${LINKS.agreement}" style="color: #5b5247;">雫旅約定</a><br><br>
              01 室內全面禁菸及檳榔，違者收環境維護費 $5,000<br>
              02 全面謝絕訪客，私自增人以 $1,000/人 計費<br>
              03 安靜時間 22:30 後，請降低音量<br>
              04 禁止砸蛋糕、刮鬍泡或彩色粉末，違者收 $5,000<br>
              05 禁止攜帶寵物，設備損壞照價賠償<br>
              06 個人貴重物品請隨身攜帶，民宿不負保管責任<br>
              07 嚴禁一切違法行為（含持有使用毒品），一經發現強制退房不退費並報警，並請求全額營業損失賠償
            </div>
          </div>
          <div class="footer">${getCustomerFooterHtml()}</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 已取消（無訂金）：感謝信，開心口吻、邀請再來、聯絡方式
   */
  function getCancelThanksTemplate(order) {
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><meta name="viewport" content="width=device-width, initial-scale=1.0">${getCommonStyles()}</head>
      <body>
        <div class="container">
          <div class="header">${brandLogoHtml()}<p class="subtitle">謝謝您</p></div>
          <div class="content">
            <p style="font-size: 18px;">Hihi ${order.name}，</p>
            <p>謝謝您曾考慮雫旅，期待下次有機會為您服務。若之後有住宿需求，歡迎隨時與我們聯絡。</p>
            <div class="notice">LINE：@dropinn · Instagram：@dropinn.penghu</div>
          </div>
          <div class="footer">${getCustomerFooterHtml()}</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 已取消（有訂金）：退訂＋確認退款信
   */
  function getCancelRefundTemplate(order) {
    const refundAmount = Number(order.paidDeposit) || 0;
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><meta name="viewport" content="width=device-width, initial-scale=1.0">${getCommonStyles()}</head>
      <body>
        <div class="container">
          <div class="header">${brandLogoHtml()}<p class="subtitle">退款確認</p></div>
          <div class="content">
            <p style="font-size: 18px;">Hihi ${order.name}，</p>
            <p>已為您辦理退訂，訂單 ${order.orderID} 的退款已辦理。</p>
            <div class="highlight-box">
              <div class="price-label">退款金額</div>
              <div style="font-size: 20px;">NT$ ${refundAmount.toLocaleString()}</div>
            </div>
            <p style="font-size:14px;line-height:1.85;color:${COLORS.stone};">
              訂金若為<strong>銀行匯款</strong>，請透過 LINE 提供退款入帳之<strong>戶名、銀行代碼、帳號</strong>（與當初匯款資料一致者為佳），我們將於核對後匯回。<br><br>
              一般約 <strong>3–5 個工作天</strong>可入帳。若逾期未見款項或有任何訂金疑問，請直接回覆本信或透過 LINE／Instagram 與我們聯繫。
            </p>
          </div>
          <div class="footer">${getCustomerFooterHtml()}</div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 退房感謝信（島嶼的餘韻）
   * 文案與 untilnexttime.html 保持一致（單一來源請以 repo 根目錄 untilnexttime.html 為準並同步至此）
   */
  function getPostStayThankyouTemplate(order) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${getCommonStyles()}
      </head>
      <body>
        <div class="container" style="background:#f8f6f0;padding:40px 0;">
          <div style="max-width:640px;margin:0 auto;text-align:center;background:#ffffff;border:1px solid #e2dbcf;padding:40px 30px 48px;font-family:'Noto Serif TC',serif;color:#332c27;">
            <h1 style="font-size:22px;letter-spacing:0.2em;font-weight:300;margin:0 0 6px;">島嶼的餘韻</h1>
            <p style="font-family:'Cormorant Garamond',serif;font-size:11px;letter-spacing:0.4em;color:#9b9084;text-transform:uppercase;margin:0 0 8px;">UNTIL NEXT TIME</p>
            <p style="font-size:12px;color:#9b9084;letter-spacing:0.12em;margin:0 0 20px;">訂單編號 ${order.orderID || ''}</p>
            <div style="width:1px;height:60px;background:linear-gradient(to bottom,transparent,#d6cfc4,transparent);margin:0 auto 32px;opacity:0.7;"></div>
            <p style="font-size:14px;letter-spacing:0.12em;line-height:2.1;margin-bottom:28px;">
              當花火散落，旅程在此暫歇。<br>
              謝謝你，將這幾天珍貴的時間交給了雫旅。<br>
              希望這裡的一切，有為你充飽再次出發的電。
            </p>

            <div style="font-size:13px;letter-spacing:0.18em;color:#9b9084;margin-top:8px;margin-bottom:10px;">留下這趟旅程的痕跡</div>
            <div style="font-size:13px;letter-spacing:0.12em;line-height:2;margin-bottom:28px;">
              如果這次的停留，在你心裡留下了什麼，<br>
              歡迎留下隻字片語，或把島嶼的海風一起打包帶走。<br><br>
              💬 寫下你的感受：<a href="${LINKS.mapsPlace}" target="_blank" rel="noopener noreferrer" style="color:#b8795a;text-decoration:none;">Google 評論連結</a><br>
              ✨ 與我們保持聯繫：
              <a href="${LINKS.instagram}" target="_blank" rel="noopener noreferrer" style="color:#b8795a;text-decoration:none;">Instagram</a>
              ·
              <a href="${LINKS.facebook}" target="_blank" rel="noopener noreferrer" style="color:#b8795a;text-decoration:none;">Facebook</a>
              ·
              <a href="${LINKS.line}" target="_blank" rel="noopener noreferrer" style="color:#b8795a;text-decoration:none;">LINE @dropinn</a>
            </div>

            <div style="font-size:13px;letter-spacing:0.18em;color:#9b9084;margin-top:8px;margin-bottom:10px;">留給歸人的鑰匙</div>
            <p style="font-size:13px;letter-spacing:0.12em;line-height:2.1;margin-bottom:18px;">
              為了未來的重逢，我們悄悄為老朋友留了一把鑰匙。<br>
              在未來某個剛好有空的日子，歡迎隨時回來，就像回到島上另一個家。
            </p>
            <p style="font-size:13px;letter-spacing:0.14em;line-height:2;margin-bottom:18px;">
              🔑 專屬歸期密碼：<strong>STILLDROPINN</strong><br>
              <span style="font-size:12px;color:#777;">
                （憑此密碼預訂，每晚可享 500 元老客專屬折扣。可加上年度，例如 <strong>stilldropinn2026</strong>。此為老友專屬心意，恕不與其他優惠併用。）
              </span>
            </p>

            <p style="font-size:14px;letter-spacing:0.12em;line-height:2.1;margin-top:24px;margin-bottom:18px;">
              在未來的日子裡，我們依然會為你預留一處空白。<br>
              祝你有一趟平安順心的回程。
            </p>

            <p style="font-family:'Cormorant Garamond',serif;font-size:12px;letter-spacing:0.25em;color:#9b9084;margin-top:20px;">
              — 雫旅一直都在
            </p>
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2dbcf;font-size:11px;color:#9b9084;line-height:1.9;">
              雫旅 Drop Inn<br>
              LINE：<a href="${LINKS.line}" style="color:#9b9084;text-decoration:none;">@dropinn</a>
              　·　Instagram：<a href="${LINKS.instagram}" style="color:#9b9084;text-decoration:none;">@dropinn.penghu</a><br>
              如有任何問題，請直接回覆此封信件。
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 退房感謝信純文字版（方便 LINE / IG 貼上）
   */
  function getPostStayThankyouPlain(order) {
    const oid = order && order.orderID ? String(order.orderID) : '';
    return [
      '島嶼的餘韻',
      oid ? '訂單編號 ' + oid : '',
      '',
      '當花火散落，旅程在此暫歇。',
      '謝謝你，將這幾天珍貴的時間交給了雫旅。',
      '希望這裡的一切，有為你充飽再次出發的電。',
      '',
      '如果這次的停留，在你心裡留下了什麼，',
      '歡迎留下隻字片語，或把島嶼的海風一起打包帶走。',
      '',
      'Google 地點／評論：' + LINKS.mapsPlace,
      '',
      '🔑 專屬歸期密碼：STILLDROPINN（可加上年度，例如 stilldropinn2026，以免舊碼被重複使用）',
      '（憑此密碼預訂，每晚可享 500 元老客專屬折扣。此為老友專屬心意，恕不與其他優惠併用。）',
      '',
      '在未來的日子裡，我們依然會為你預留一處空白，',
      '祝你有一趟平安順心的回程。',
      '',
      '— 雫旅一直都在',
      '',
      '雫旅 Drop Inn',
      'LINE @dropinn · Instagram @dropinn.penghu',
      '如有任何問題，請直接回覆此封信件。'
    ].join('\\n');
  }

  /**
   * 管理員狀態變更通知：訂單摘要＋可複製 LINE 文案
   */
  function getAdminStatusNotificationTemplate(order, status, lineText) {
    const nights = getNights(order.checkIn, order.checkOut);
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">${getCommonStyles()}</head>
      <body>
        <div class="container">
          <div class="header">${brandLogoHtml()}<p class="subtitle">訂單狀態變更：${status}</p></div>
          <div class="content">
            <div class="section">
              <div class="section-title">訂單摘要</div>
              <div class="info-row"><div class="info-label">訂單編號</div><div class="info-value">${order.orderID}</div></div>
              <div class="info-row"><div class="info-label">姓名</div><div class="info-value">${order.name}</div></div>
              <div class="info-row"><div class="info-label">入住</div><div class="info-value">${order.checkIn} ～ ${order.checkOut}（${nights} 晚）</div></div>
              <div class="info-row"><div class="info-label">總額</div><div class="info-value">NT$ ${(order.totalPrice || 0).toLocaleString()}</div></div>
            </div>
            <div class="notice">
              <strong>可複製 LINE 文案</strong><br>
              <textarea rows="8" style="width:100%; font-size:12px; padding:8px;" readonly>${(lineText || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
            </div>
          </div>
          <div class="footer"><div class="footer-text">此為系統自動通知</div></div>
        </div>
      </body>
      </html>
    `;
  }

  // 公開方法
  return {
    getAdminNotificationTemplate,
    getCustomerConfirmationTemplate,
    getTravelGuideTemplate,
    getPendingConfirmationTemplate,
    getCancelThanksTemplate,
    getCancelRefundTemplate,
    getPostStayThankyouTemplate,
    getPostStayThankyouPlain,
    getAdminStatusNotificationTemplate,
  };
})();

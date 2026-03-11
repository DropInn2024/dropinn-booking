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
   * 共用樣式
   */
  const getCommonStyles = () => `
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;700&family=Noto+Sans+TC:wght@300;400;500&display=swap');
      
      body {
        margin: 0;
        padding: 0;
        font-family: 'Noto Sans TC', -apple-system, BlinkMacSystemFont, sans-serif;
        background-color: ${COLORS.lightGray};
        color: ${COLORS.stone};
        line-height: 1.6;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: ${COLORS.cream};
      }
      .header {
        padding: 40px 20px;
        text-align: center;
        border-bottom: 1px solid ${COLORS.warmGray};
      }
      .logo {
        font-family: 'Noto Serif TC', serif;
        font-size: 24px;
        letter-spacing: 0.3em;
        color: ${COLORS.stone};
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
        padding: 12px 0;
        border-bottom: 1px solid ${COLORS.warmGray};
      }
      .info-label {
        width: 100px;
        font-size: 13px;
        color: #999;
        letter-spacing: 0.1em;
      }
      .info-value {
        flex: 1;
        font-size: 14px;
        color: ${COLORS.stone};
      }
      .highlight-box {
        background-color: ${COLORS.lightGray};
        padding: 24px;
        margin: 20px 0;
        border-left: 3px solid ${COLORS.stone};
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
        padding: 20px;
        margin: 20px 0;
        border-radius: 4px;
        font-size: 13px;
        line-height: 1.8;
      }
      .footer {
        padding: 30px 20px;
        text-align: center;
        border-top: 1px solid ${COLORS.warmGray};
        background-color: white;
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
        }
        .info-label {
          width: 100%;
          margin-bottom: 4px;
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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${getCommonStyles()}
      </head>
      <body>
        <div class="container">
          
          <!-- Header -->
          <div class="header">
            <h1 class="logo">雫旅 DROP INN</h1>
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
                (${order.rooms} 間 × ${nights} 晚 × $3,000${order.extraBeds > 0 ? ` + ${order.extraBeds} 床 × ${nights} 晚 × $1,000` : ''})
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
              2. 確認訂金收款後，更新試算表狀態為「預定中」<br>
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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${getCommonStyles()}
      </head>
      <body>
        <div class="container">
          
          <!-- Header -->
          <div class="header">
            <h1 class="logo">雫旅 DROP INN</h1>
            <p class="subtitle">訂單確認</p>
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
                我們已收到您的預約申請
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
              <a href="https://dropinn2024.github.io/dropinn-booking/agreement.html" style="color: #5b5247; font-size: 13px; letter-spacing: 0.05em;">→ 雫旅約定（點此查看）</a><br><br>
              
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
              <div style="text-align: center; padding: 20px 0;">
                <p style="margin: 8px 0;">📱 LINE: @dropinn</p>
                <p style="margin: 8px 0;">📧 Instagram: @dropinn.penghu</p>
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
            <div class="footer-text">
              雫旅 Drop Inn | 澎湖包棟民宿<br>
              此為系統自動發送郵件，請勿直接回覆<br>
              如有疑問，請透過 LINE 聯繫我們
            </div>
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
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${getCommonStyles()}
      </head>
      <body>
        <div class="container">
          
          <!-- Header -->
          <div class="header">
            <h1 class="logo">雫旅 DROP INN</h1>
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
            
            <!-- 交通資訊 -->
            <div class="section">
              <div class="section-title">怎麼來雫旅</div>
              <div class="info-row">
                <div class="info-label">地址</div>
                <div class="info-value">
                  澎湖縣湖西鄉成功村 212 號<br>
                  <a href="https://www.google.com/maps/place/DropInn+%E9%9B%AB%E6%97%85/@23.5722566,119.6126808,17z" target="_blank" style="color: ${COLORS.accent}; text-decoration: none; border-bottom: 1px solid rgba(196,137,106,0.3);">↗ 在 Google 地圖開啟</a>
                </div>
              </div>
              <div class="info-row">
                <div class="info-label">距離</div>
                <div class="info-value">離馬公市中心約 7 分鐘車程</div>
              </div>
            </div>
            
            <!-- 租車提醒 -->
            <div class="notice" style="background-color: #FFF9E6; border-left: 4px solid #F4C430;">
              <strong>🚗 租車提醒</strong><br><br>
              
              我們與在地車行長期合作，可代為安排租車服務。<br>
              如需租車，請儘早透過 LINE 告知我們，我們會幫你預約。<br><br>
              
              <div style="text-align: center; margin: 20px 0;">
                <div style="display: inline-block; background: #06C755; color: white; padding: 12px 30px; border-radius: 8px; font-weight: 500;">
                  💬 LINE ID: @dropinn
                </div>
              </div>
            </div>
            
            <!-- 開門方式 -->
            <div class="section">
              <div class="section-title">入住當天</div>
              <div class="notice" style="background-color: #F0F7FF; border-left: 4px solid #5B9BD5;">
                <strong>🔑 開門密碼</strong><br><br>
                
                入住當天的開門密碼，我們會在確認你已加入 LINE 後，透過 LINE 私訊告知。<br>
                請記得加入我們的官方 LINE：<strong>@dropinn</strong><br><br>
                
                <p style="color: ${COLORS.accent}; margin-top: 15px; font-weight: 500;">
                  ⏰ 入住時間：16:00 以後
                </p>
              </div>
            </div>
            
            <!-- 旅遊手冊 -->
            <div class="section">
              <div class="section-title">完整旅遊手冊</div>
              <p style="font-size: 14px; line-height: 1.8; color: ${COLORS.lightInk};">
                我們為你準備了完整的旅遊手冊，包含：<br>
                • 民宿設備使用說明<br>
                • 澎湖推薦景點與美食<br>
                • 交通與租車資訊<br>
                • 緊急聯絡方式<br><br>
                
                手冊已以附件形式附在本 Email，請下載查看。<br>
                入住當天我們也會提供紙本手冊供你參考。
              </p>
            </div>
            
            <!-- 聯絡方式 -->
            <div class="section">
              <div class="section-title">有任何問題？</div>
              <div style="text-align: center; padding: 20px 0;">
                <p style="margin: 8px 0;">📱 LINE: @dropinn</p>
                <p style="margin: 8px 0;">📞 電話: 0967-212-168</p>
                <p style="margin: 8px 0;">📧 Email: dropinn2024@gmail.com</p>
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
            <div class="footer-text">
              雫旅 Drop Inn | 澎湖包棟民宿<br>
              此為系統自動發送郵件，請勿直接回覆<br>
              如有疑問，請透過 LINE 聯繫我們
            </div>
          </div>
          
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 待確認信（客人下單後）：48 小時內確認、住宿須知連結、聯絡 LINE / IG / 電話 0967-212-168（純文字）
   */
  function getPendingConfirmationTemplate(order) {
    const nights = getNights(order.checkIn, order.checkOut);
    const agreementUrl = 'https://dropinn2024.github.io/dropinn-booking/agreement.html';
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${getCommonStyles()}</head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">雫旅 DROP INN</h1>
            <p class="subtitle">我們收到您的預約申請</p>
          </div>
          <div class="content">
            <p style="font-size: 18px;">Hihi ${order.name}，</p>
            <p>感謝您選擇雫旅，我們已收到您的預約申請，請於 <strong>48 小時內</strong> 與我們聯繫確認，以完成預訂。</p>
            <div class="highlight-box">
              <div class="price-label">訂單編號</div>
              <div style="font-size: 20px; margin-top: 8px;">${order.orderID}</div>
              <div style="margin-top: 12px;">入住 ${formatDate(order.checkIn)} · ${nights} 晚</div>
            </div>
            <div class="notice">
              <strong>下一步</strong><br>
              請加入官方 LINE 或來電，我們將與您確認訂金與入住事宜。<br><br>
              LINE：@dropinn<br>
              IG：@dropinn.penghu<br>
              電話：0967-212-168
            </div>
            <div class="notice">
              <strong>入住須知</strong><br>
              <a href="${agreementUrl}" style="color: #5b5247;">→ 雫旅約定（點此查看）</a>
            </div>
          </div>
          <div class="footer"><div class="footer-text">雫旅 Drop Inn | 澎湖包棟民宿</div></div>
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
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${getCommonStyles()}</head>
      <body>
        <div class="container">
          <div class="header"><h1 class="logo">雫旅 DROP INN</h1><p class="subtitle">謝謝您</p></div>
          <div class="content">
            <p style="font-size: 18px;">Hihi ${order.name}，</p>
            <p>謝謝您曾考慮雫旅，期待下次有機會為您服務。若之後有住宿需求，歡迎隨時與我們聯絡。</p>
            <div class="notice">LINE：@dropinn · IG：@dropinn.penghu · 電話：0967-212-168</div>
          </div>
          <div class="footer"><div class="footer-text">雫旅 Drop Inn | 澎湖包棟民宿</div></div>
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
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">${getCommonStyles()}</head>
      <body>
        <div class="container">
          <div class="header"><h1 class="logo">雫旅 DROP INN</h1><p class="subtitle">退款確認</p></div>
          <div class="content">
            <p style="font-size: 18px;">Hihi ${order.name}，</p>
            <p>您的訂單 ${order.orderID} 已取消，我們已辦理退款。</p>
            <div class="highlight-box">
              <div class="price-label">退款金額</div>
              <div style="font-size: 20px;">NT$ ${refundAmount.toLocaleString()}</div>
            </div>
            <p>請確認是否已入帳。若有疑問請與我們聯繫：LINE @dropinn、IG @dropinn.penghu、電話 0967-212-168。</p>
          </div>
          <div class="footer"><div class="footer-text">雫旅 Drop Inn | 澎湖包棟民宿</div></div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * 管理員狀態變更通知：訂單摘要＋可複製 LINE 文案
   */
  function getAdminStatusNotificationTemplate(order, status, lineText) {
    const nights = getNights(order.checkIn, order.checkOut);
    return `
      <!DOCTYPE html>
      <html>
      <head><meta charset="UTF-8">${getCommonStyles()}</head>
      <body>
        <div class="container">
          <div class="header"><h1 class="logo">雫旅 DROP INN</h1><p class="subtitle">訂單狀態變更：${status}</p></div>
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
    getAdminStatusNotificationTemplate,
  };
})();

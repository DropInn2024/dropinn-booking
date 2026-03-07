/**
 * travelGuideSender.gs
 * 雫旅訂房系統 - 自動發送旅遊手冊
 * ✅ 入住前 7 天自動發送 Email + 旅遊手冊
 * ✅ 內容：怎麼來民宿、租車行提醒、怎麼開門、開門密碼（需加 LINE）
 */

/**
 * 主函式：檢查所有「已付訂」訂單，找出 7 天後要入住的
 * 由觸發器每天自動執行
 */
function checkAndSendTravelGuides() {
  Logger.log('');
  Logger.log('=== 📧 開始檢查旅遊手冊發送時機 ===');
  Logger.log(`執行時間: ${new Date()}`);
  Logger.log('');

  try {
    const allOrders = DataStore.getOrders();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let sentCount = 0;
    let skippedCount = 0;

    allOrders.forEach(order => {
      // 只處理「已付訂」狀態
      if (order.status !== '已付訂') {
        return;
      }

      // 檢查是否已發送過（避免重複發送）
      if (order.travelGuideSent === true) {
        Logger.log(`⏭️  訂單 ${order.orderID} 已發送過，跳過`);
        skippedCount++;
        return;
      }

      const checkInDate = new Date(order.checkIn);
      checkInDate.setHours(0, 0, 0, 0);

      // 計算距離入住還有幾天
      const daysUntilCheckIn = Math.floor((checkInDate - now) / (1000 * 60 * 60 * 24));

      Logger.log(`訂單 ${order.orderID}：距離入住還有 ${daysUntilCheckIn} 天`);

      // 如果是 7 天後入住（或剛好 7 天），發送旅遊手冊
      if (daysUntilCheckIn === 7 || (daysUntilCheckIn >= 6 && daysUntilCheckIn <= 8)) {
        Logger.log(`📧 訂單 ${order.orderID} 符合發送條件（${daysUntilCheckIn} 天後入住），開始發送`);
        sendTravelGuideEmail(order);
        sentCount++;

        // 標記為已發送
        DataStore.updateOrder(order.orderID, {
          travelGuideSent: true,
          travelGuideSentAt: new Date(),
        });
      }
    });

    Logger.log('');
    Logger.log('=== ✅ 檢查完成 ===');
    Logger.log(`📧 發送: ${sentCount} 筆`);
    Logger.log(`⏭️  跳過: ${skippedCount} 筆`);
    Logger.log('');

  } catch (error) {
    Logger.log(`❌ 檢查訂單錯誤: ${error.message}`);
    Logger.log(error.stack);

    if (typeof LoggerService !== 'undefined') {
      LoggerService.logError(error, 'checkAndSendTravelGuides');
    }
  }
}

/**
 * 發送旅遊手冊 Email
 */
function sendTravelGuideEmail(order) {
  try {
    if (!order.email || order.email.trim() === '') {
      Logger.log(`⚠️ 客人未提供 Email，無法發送旅遊手冊: ${order.orderID}`);
      return { success: false, message: 'Customer email not provided' };
    }

    const checkInDate = new Date(order.checkIn);
    const checkInStr = Utilities.formatDate(checkInDate, 'GMT+8', 'yyyy年MM月dd日');

    // Email 主旨
    const subject = `【雫旅】Hihi ${order.name}，再 7 天就要見面了！旅遊手冊已準備好 ✈️`;

    // Email 內容（HTML）
    const htmlBody = EmailTemplates.getTravelGuideTemplate(order, checkInStr);

    MailApp.sendEmail({
      to: order.email,
      subject: subject,
      htmlBody: htmlBody,
      name: '雫旅 Drop Inn',
    });

    Logger.log(`✅ 旅遊手冊已發送: ${order.orderID} → ${order.email}`);
    return { success: true, message: 'Travel guide email sent' };

  } catch (error) {
    Logger.log(`❌ 發送旅遊手冊失敗: ${error.message}`);

    if (typeof LoggerService !== 'undefined') {
      LoggerService.logError(error, 'sendTravelGuideEmail');
    }

    return { success: false, message: error.message };
  }
}

/**
 * 設定自動發送觸發器（只需執行一次）
 */
function setupTravelGuideTrigger() {
  // 刪除舊的觸發器（避免重複）
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkAndSendTravelGuides') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 已刪除舊觸發器`);
    }
  });

  // 建立新的觸發器：每天執行一次（凌晨 2 點）
  ScriptApp.newTrigger('checkAndSendTravelGuides')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .inTimezone('Asia/Taipei')
    .create();

  Logger.log('✅ 旅遊手冊觸發器已設定：每天凌晨 2 點執行 checkAndSendTravelGuides');
  Logger.log('');
  Logger.log('系統將自動：');
  Logger.log('  - 檢查所有「已付訂」訂單');
  Logger.log('  - 入住前 7 天自動發送旅遊手冊 Email');
  Logger.log('');
}

/**
 * 測試發送（開發用）
 */
function testTravelGuideEmail(testEmail) {
  const testOrder = {
    orderID: 'DROP-TEST-TRAVEL',
    name: '測試旅客',
    phone: '0912345678',
    email: testEmail,
    checkIn: Utilities.formatDate(
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      'GMT+8',
      'yyyy-MM-dd'
    ),
    checkOut: Utilities.formatDate(
      new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
      'GMT+8',
      'yyyy-MM-dd'
    ),
    rooms: 3,
    extraBeds: 1,
    totalPrice: 20000,
    status: '已付訂',
  };

  Logger.log('📧 開始發送測試旅遊手冊...');
  const result = sendTravelGuideEmail(testOrder);
  Logger.log(`結果: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
  Logger.log('');
  Logger.log('請檢查你的信箱');
}

/**
 * reminders.gs
 * 雫旅訂房系統 - 自動提醒系統
 * ✅ 40 小時提醒（剩餘 40 小時）
 * ✅ 48 小時自動取消
 */

/**
 * 主函式：檢查所有待確認訂單
 * 由觸發器每小時自動執行
 */
function checkPendingOrders() {
  Logger.log('');
  Logger.log('=== 🔍 開始檢查待確認訂單 ===');
  Logger.log(`執行時間: ${new Date()}`);
  Logger.log('');
  
  try {
    const allOrders = DataStore.getOrders();
    const now = new Date();
    
    let reminderCount = 0;
    let cancelCount = 0;
    
    allOrders.forEach(order => {
      // 只處理「待確認」狀態
      if (order.status !== '待確認') return;
      
      const createdTime = new Date(order.createdAt || order.timestamp);
      const hoursPassed = (now - createdTime) / (1000 * 60 * 60);
      
      Logger.log(`訂單 ${order.orderID}：已過 ${hoursPassed.toFixed(1)} 小時`);
      
      // 情境 A：超過 48 小時 → 自動取消
      if (hoursPassed >= 48) {
        Logger.log(`⚠️ 訂單 ${order.orderID} 超過 48 小時，自動取消`);
        autoCancelOrder(order);
        cancelCount++;
      }
      
      // 情境 B：超過 8 小時（剩餘 40 小時）→ 發送提醒
      else if (hoursPassed >= 8 && !order.reminderSent) {
        Logger.log(`📢 訂單 ${order.orderID} 已過 8 小時，發送 40 小時提醒`);
        send40HourReminder(order);
        reminderCount++;
      }
    });
    
    Logger.log('');
    Logger.log('=== ✅ 檢查完成 ===');
    Logger.log(`📧 發送提醒: ${reminderCount} 筆`);
    Logger.log(`❌ 自動取消: ${cancelCount} 筆`);
    Logger.log('');
    
  } catch (error) {
    Logger.log(`❌ 檢查訂單錯誤: ${error.message}`);
    Logger.log(error.stack);
    
    if (typeof LoggerService !== 'undefined') {
      LoggerService.logError(error, 'checkPendingOrders');
    }
  }
}

/**
 * 發送 40 小時倒數提醒
 */
function send40HourReminder(order) {
  try {
    const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    
    // === 提醒你（管理員）===
    if (adminEmail) {
      const adminSubject = `⏰ 提醒：訂單 ${order.orderID} 剩餘 40 小時`;
      const adminBody = `
訂單編號：${order.orderID}
客人姓名：${order.name}
電話：${order.phone}
Email：${order.email || '未填寫'}

入住日期：${order.checkIn}
退房日期：${order.checkOut}
房間數：${order.rooms} 間
費用：NT$ ${order.totalPrice.toLocaleString()}

⚠️ 此訂單已建立 8 小時，剩餘 40 小時
   如客人未在期限內加入 LINE，系統將自動取消

建議動作：
- 主動聯繫客人（電話或 LINE）
- 或等待客人加入 LINE 後，手動改狀態為「已預訂」

管理後台：
${ScriptApp.getService().getUrl()}?page=admin
      `.trim();
      
      MailApp.sendEmail({
        to: adminEmail,
        subject: adminSubject,
        body: adminBody,
        name: '雫旅訂房系統'
      });
      
      Logger.log(`✅ 已發送提醒給管理員：${adminEmail}`);
    }
    
    // === 提醒客人（如果有 Email）===
    if (order.email) {
      const customerSubject = `【雫旅】Hihi ${order.name}，別忘了加入 LINE 喔 ⏰`;
      const customerBody = `
Hihi ${order.name} 👋

我們在 8 小時前收到您的預約申請：

📅 入住：${order.checkIn}
📅 退房：${order.checkOut}
🏠 房間：${order.rooms} 間

⏰ 您還有 40 小時可以完成預約流程

請記得加入我們的官方 LINE，
我們需要與您確認訂金金額與入住細節

💬 LINE ID: @dropinn
🔗 https://line.me/ti/p/@dropinn

如未在期限內加入，您的預約將自動取消喔

━━━━━━━━━━━━━━━
雫旅 Drop Inn | 澎湖包棟民宿
此為系統自動發送郵件，請勿直接回覆
      `.trim();
      
      MailApp.sendEmail({
        to: order.email,
        subject: customerSubject,
        body: customerBody,
        name: '雫旅 Drop Inn'
      });
      
      Logger.log(`✅ 已發送提醒給客人：${order.email}`);
    } else {
      Logger.log(`⚠️ 客人未填 Email，無法發送提醒`);
    }
    
    // === 標記「已發送提醒」===
    DataStore.updateOrder(order.orderID, {
      reminderSent: true
    });
    
    Logger.log(`✅ 已標記訂單 ${order.orderID} 為「已提醒」`);
    
  } catch (error) {
    Logger.log(`❌ 發送提醒錯誤: ${error.message}`);
    
    if (typeof LoggerService !== 'undefined') {
      LoggerService.logError(error, 'send40HourReminder');
    }
  }
}

/**
 * 自動取消訂單（超過 48 小時）
 */
function autoCancelOrder(order) {
  try {
    // === 更新訂單狀態 ===
    DataStore.updateOrder(order.orderID, {
      status: '已取消',
      cancelReason: '超過 48 小時未加入 LINE',
      updatedBy: 'System'
    });
    
    Logger.log(`✅ 已取消訂單：${order.orderID}`);
    
    // === 刪除日曆事件（如果有）===
    if (order.publicCalendarEventID || order.housekeepingCalendarEventID) {
      try {
        CalendarService.deleteCalendarEvents(order);
        Logger.log(`🗑️ 已刪除日曆事件：${order.orderID}`);
      } catch (calendarError) {
        Logger.log(`⚠️ 刪除日曆事件失敗: ${calendarError.message}`);
      }
    }
    
    // === 通知你（管理員）===
    const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    
    if (adminEmail) {
      const adminSubject = `❌ 訂單已自動取消：${order.orderID}`;
      const adminBody = `
訂單編號：${order.orderID}
客人姓名：${order.name}
電話：${order.phone}
Email：${order.email || '未填寫'}

入住日期：${order.checkIn}
退房日期：${order.checkOut}
房間數：${order.rooms} 間

取消原因：超過 48 小時未加入 LINE

此訂單已自動取消，日曆已清除，無需處理。

管理後台：
${ScriptApp.getService().getUrl()}?page=admin
      `.trim();
      
      MailApp.sendEmail({
        to: adminEmail,
        subject: adminSubject,
        body: adminBody,
        name: '雫旅訂房系統'
      });
      
      Logger.log(`✅ 已通知管理員訂單取消`);
    }
    
  } catch (error) {
    Logger.log(`❌ 自動取消訂單錯誤: ${error.message}`);
    
    if (typeof LoggerService !== 'undefined') {
      LoggerService.logError(error, 'autoCancelOrder');
    }
  }
}

/**
 * 設定提醒觸發器（只需執行一次）
 */
function setupReminderTrigger() {
  // 刪除舊的觸發器（避免重複）
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkPendingOrders') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 已刪除舊觸發器`);
    }
  });
  
  // 建立新的觸發器：每小時執行一次
  ScriptApp.newTrigger('checkPendingOrders')
    .timeBased()
    .everyHours(1)
    .create();
  
  Logger.log('✅ 提醒觸發器已設定：每小時執行 checkPendingOrders');
  Logger.log('');
  Logger.log('系統將自動：');
  Logger.log('  - 8 小時後：發送 40 小時提醒');
  Logger.log('  - 48 小時後：自動取消訂單');
}

/**
 * 測試提醒功能
 */
function testReminderSystem() {
  Logger.log('=== 測試提醒系統 ===');
  Logger.log('');
  
  // 建立測試訂單（已過 8 小時）
  const testOrder = {
    orderID: 'DROP-TEST-REMINDER',
    name: '測試旅客',
    phone: '0912345678',
    email: 'test@example.com',
    checkIn: '2026-03-01',
    checkOut: '2026-03-03',
    rooms: 3,
    extraBeds: 0,
    totalPrice: 18000,
    status: '待確認',
    reminderSent: false,
    createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000) // 9 小時前
  };
  
  Logger.log('測試訂單:', JSON.stringify(testOrder));
  Logger.log('');
  
  send40HourReminder(testOrder);
  
  Logger.log('');
  Logger.log('✅ 測試完成，請檢查您的信箱');
}

/**
 * 查看所有觸發器
 */
function listReminderTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  
  Logger.log('📋 目前的觸發器：');
  Logger.log('');
  
  triggers.forEach((trigger, index) => {
    Logger.log(`${index + 1}. ${trigger.getHandlerFunction()}`);
    Logger.log(`   類型: ${trigger.getTriggerSource()}`);
    
    if (trigger.getTriggerSource() === ScriptApp.TriggerSource.CLOCK) {
      Logger.log(`   頻率: ${trigger.getEventType()}`);
    }
    
    Logger.log('');
  });
}
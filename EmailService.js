/**
 * emailService.js
 * 雫旅訂房系統 - Email 通知服務
 * ✅ 修改：主旨改為 "Hihi 王小明" 風格
 */

const EmailService = (() => {

  /**
   * 發送管理員通知（新訂單）
   */
  function sendNewOrderNotification(orderData) {
    try {
      const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');

      if (!adminEmail) {
        Logger.log('⚠️ ADMIN_EMAIL 未設定，跳過管理員通知');
        return { success: false, message: 'ADMIN_EMAIL not configured' };
      }

      const subject = `🔔 新訂單通知 - ${orderData.name}`;
      const htmlBody = EmailTemplates.getAdminNotificationTemplate(orderData);

      MailApp.sendEmail({
        to: adminEmail,
        subject: subject,
        htmlBody: htmlBody,
        name: '雫旅訂房系統'
      });

      Logger.log(`✅ 管理員通知已發送: ${orderData.orderID} → ${adminEmail}`);
      return { success: true, message: 'Admin notification sent' };

    } catch (error) {
      Logger.log(`❌ 發送管理員通知失敗: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * ✅ 修改：發送客人確認信（Hihi 風格主旨）
   */
  function sendConfirmationEmail(orderData) {
    try {
      if (!orderData.email || orderData.email.trim() === '') {
        Logger.log(`ℹ️ 客人未提供 Email，跳過確認信: ${orderData.orderID}`);
        return { success: false, message: 'Customer email not provided' };
      }

      // ✅ Hihi 風格主旨
      const subject = `【雫旅】Hihi ${orderData.name}，訂單確認通知`;
      const htmlBody = EmailTemplates.getCustomerConfirmationTemplate(orderData);

      MailApp.sendEmail({
        to: orderData.email,
        subject: subject,
        htmlBody: htmlBody,
        name: '雫旅 Drop Inn'
      });

      Logger.log(`✅ 客人確認信已發送: ${orderData.orderID} → ${orderData.email}`);
      return { success: true, message: 'Confirmation email sent' };

    } catch (error) {
      Logger.log(`❌ 發送客人確認信失敗: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

  /**
   * 檢查狀態變更（觸發器用）
   */
  function checkStatusChanges() {
    try {
      const sheetName = DataStore.getCurrentSheetName();
      const sheet = SpreadsheetApp.openById(Config.SHEET_ID).getSheetByName(sheetName);

      if (!sheet) {
        Logger.log(`⚠️ 找不到工作表：${sheetName}`);
        return;
      }

      const data = sheet.getDataRange().getValues();
      const headers = data[0];

      const statusIndex = headers.indexOf('status');
      const emailSentIndex = headers.indexOf('emailSent');

      if (statusIndex === -1 || emailSentIndex === -1) {
        Logger.log('⚠️ 找不到必要欄位');
        return;
      }

      for (let i = 1; i < data.length; i++) {
        const status = data[i][statusIndex];
        const emailSent = data[i][emailSentIndex];

        if (status === '已預訂' && emailSent !== true) {
          const order = SchemaManager.mapRowToData(data[i]);

          const result = sendConfirmationEmail(order);

          if (result.success) {
            sheet.getRange(i + 1, emailSentIndex + 1).setValue(true);
            Logger.log(`✅ 已發送確認信: ${order.orderID}`);

            // ✅ 日曆同步
            try {
              if (typeof CalendarService !== 'undefined') {
                CalendarService.syncOrderToCalendars(order);
                Logger.log(`📅 狀態變更後日曆同步完成: ${order.orderID}`);
              }
            } catch (calendarError) {
              Logger.log(`⚠️ 日曆同步失敗: ${calendarError.message}`);
            }
          }
        }
      }
    } catch (error) {
      Logger.log('❌ checkStatusChanges 錯誤:', error);
      if (typeof LoggerService !== 'undefined') {
        LoggerService.logError(error, 'checkStatusChanges');
      }
    }
  }

  /**
   * 測試發送（開發用）
   */
  function sendTestEmails(testEmail) {
    const testOrder = {
      orderID: "DROP-TEST-001",
      name: "測試旅客",
      phone: "0912345678",
      email: testEmail,
      checkIn: "2026-03-15",
      checkOut: "2026-03-17",
      rooms: 3,
      extraBeds: 1,
      totalPrice: 20000,
      status: "待確認",
      timestamp: new Date(),
      notes: "測試備註"
    };

    Logger.log('📧 開始發送測試信件...');

    const adminResult = sendNewOrderNotification(testOrder);
    Logger.log(`管理員通知: ${adminResult.success ? '✅ 成功' : '❌ 失敗'}`);

    testOrder.status = "已預訂";
    const customerResult = sendConfirmationEmail(testOrder);
    Logger.log(`客人確認信: ${customerResult.success ? '✅ 成功' : '❌ 失敗'}`);

    return {
      admin: adminResult,
      customer: customerResult
    };
  }

  return {
    sendNewOrderNotification,
    sendConfirmationEmail,
    checkStatusChanges,
    sendTestEmails
  };
})();
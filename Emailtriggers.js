/**
 * emailTriggers.gs
 * 雫旅訂房系統 - Email 觸發器管理
 * ✅ 修改：支援年份工作表
 */

/**
 * 一鍵設定所有觸發器
 */
function setupEmailTriggers() {
  deleteAllTriggers();
  
  ScriptApp.newTrigger('checkStatusChanges')
    .timeBased()
    .everyHours(1)
    .create();
  
  Logger.log('✅ Email 觸發器已設定：每小時檢查訂單狀態變更');
  Logger.log('📧 當訂單狀態從「洽談中」改為「已付訂」時，將自動發送客人確認信');
}

/**
 * 刪除所有觸發器
 */
function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkStatusChanges') {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`🗑️ 已刪除舊觸發器: ${trigger.getHandlerFunction()}`);
    }
  });
}

/**
 * 檢查訂單狀態變更（由觸發器自動執行）
 * ✅ 修改：支援年份工作表
 */
function checkStatusChanges() {
  try {
    const sheetName = DataStore.getCurrentSheetName();
    const sheet = SpreadsheetApp.openById(Config.SHEET_ID).getSheetByName(sheetName);
    
    if (!sheet) {
      Logger.log(`❌ 找不到工作表：${sheetName}`);
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const statusCol = headers.indexOf('status');
    const emailSentCol = headers.indexOf('emailSent');
    
    if (statusCol === -1 || emailSentCol === -1) {
      Logger.log('❌ 找不到 status 或 emailSent 欄位');
      return;
    }
    
    let sentCount = 0;
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[statusCol];
      const emailSent = row[emailSentCol];
      
      if (status === '已付訂' && !emailSent) {
        const orderData = SchemaManager.mapRowToData(row);
        
        const result = EmailService.sendConfirmationEmail(orderData);
        
        if (result.success) {
          sheet.getRange(i + 1, emailSentCol + 1).setValue(new Date());
          sentCount++;
          Logger.log(`✅ 已發送確認信: ${orderData.orderID}`);
        } else {
          Logger.log(`⚠️ 確認信發送失敗: ${orderData.orderID} - ${result.message}`);
        }
      }
    }
    
    if (sentCount > 0) {
      Logger.log(`📧 本次檢查共發送 ${sentCount} 封確認信`);
    } else {
      Logger.log('ℹ️ 本次檢查無需發送確認信');
    }
    
  } catch (error) {
    Logger.log(`❌ 檢查狀態變更時發生錯誤: ${error.message}`);
    Logger.log(error.stack);
  }
}

/**
 * 查看所有觸發器
 */
function listAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  Logger.log(`📋 目前共有 ${triggers.length} 個觸發器：`);
  
  triggers.forEach((trigger, index) => {
    Logger.log(`${index + 1}. ${trigger.getHandlerFunction()} - ${trigger.getTriggerSource()}`);
  });
}
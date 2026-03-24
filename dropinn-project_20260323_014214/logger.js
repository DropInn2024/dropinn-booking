// logger.gs

const LoggerService = {
  logError(error, context = '') {
    try {
      // 取得 ID (改用 PropertiesService)
      const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
      const ss = SpreadsheetApp.openById(sheetId);
      
      // 找或建立 'SystemLogs' 分頁
      let sheet = ss.getSheetByName('SystemLogs');
      if (!sheet) {
        sheet = ss.insertSheet('SystemLogs');
        sheet.appendRow(['Timestamp', 'Context', 'ErrorMessage', 'Stack']);
      }
      
      // 寫入錯誤
      sheet.appendRow([
        new Date(),
        context,
        error.toString(),
        error.stack || ''
      ]);
      
      // 同時印在 GAS 後台
      console.error(`[${context}] ${error}`);
      
    } catch (e) {
      // 如果連 Log 都寫失敗，只能印在 Console 了
      console.error('Critical: Logging Failed', e);
    }
  }
};
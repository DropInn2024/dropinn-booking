/**
 * Sheet 初始化工具
 */

function initializeCurrentYearSheet() {
  const year = new Date().getFullYear();
  const sheetName = `訂單_${year}`;
  Logger.log(`🔧 開始初始化工作表: ${sheetName}`);
  const sheet = DataStore.ensureYearSheetExists(sheetName);
  Logger.log(`✅ 初始化完成！`);
  return sheet;
}

function initializeYearSheet(year) {
  const sheetName = `訂單_${year}`;
  Logger.log(`🔧 開始初始化工作表: ${sheetName}`);
  const sheet = DataStore.ensureYearSheetExists(sheetName);
  Logger.log(`✅ 初始化完成！`);
  return sheet;
}

function initializeMultipleYears() {
  const startYear = 2026;
  const endYear = 2028;
  Logger.log(`🔧 開始批次建立工作表 (${startYear} ~ ${endYear})`);
  for (let year = startYear; year <= endYear; year++) {
    initializeYearSheet(year);
  }
  Logger.log('✅ 批次建立完成！');
}

function checkYearSheets() {
  const ss = DataStore.getDB();
  const allSheets = ss.getSheets();
  Logger.log('📋 目前的工作表列表：');
  allSheets.forEach((sheet, index) => {
    const name = sheet.getName();
    const rows = sheet.getLastRow();
    Logger.log(`${index + 1}. ${name} (${rows} 列)`);
  });
}

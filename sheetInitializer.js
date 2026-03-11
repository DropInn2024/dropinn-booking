/**
 * Sheet 初始化工具
 *
 * - 訂單依「年份」分表：訂單_2026、訂單_2027…
 * - 複數年：預先建立未來幾年的空白表，避免第一筆訂單進來時才建表。
 * - 計數器：見 DataStore.getNextSequence，用「系統計數器」工作表產生訂單編號序號（如 DROP-20260315-001）。
 */

function initializeCurrentYearSheet() {
  const year = new Date().getFullYear();
  const sheetName = `訂單_${year}`;
  Logger.log(`🔧 開始初始化工作表: ${sheetName}`);
  const sheet = DataStore.ensureYearSheetExists(sheetName);
  Logger.log(`✅ 初始化完成！`);
  return sheet;
}

/**
 * 建立指定年份的訂單工作表；若未傳 year 則用今年。
 */
function initializeYearSheet(year) {
  if (year == null || year === undefined) {
    year = new Date().getFullYear();
  }
  const sheetName = `訂單_${year}`;
  Logger.log(`🔧 開始初始化工作表: ${sheetName}`);
  const sheet = DataStore.ensureYearSheetExists(sheetName);
  Logger.log(`✅ 初始化完成！`);
  return sheet;
}

/**
 * 複數年：預先建立 2026～2028 的訂單表，之後有該年訂單時表已存在，不必當場建表。
 * 可依需要改 startYear / endYear。
 */
function initializeMultipleYears() {
  const startYear = 2026;
  const endYear = 2028;
  Logger.log(`🔧 開始批次建立工作表 (${startYear} ~ ${endYear})`);
  for (let y = startYear; y <= endYear; y++) {
    initializeYearSheet(y);
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

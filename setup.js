/**
 * ========================================
 * 雫旅訂房系統 - 系統設定與工作表初始化
 * ========================================
 *
 * 📋 功能說明：
 *
 * 【工作表】initializeYearSheet(year) - 建立／補齊指定年訂單表（不傳參數＝今年）
 *          initializeMultipleYears()   - 預建多年度表；checkYearSheets() - 列出工作表
 * 【日常】  setupSystem()              - ✅ 日常使用（含建表／補欄、觸發器、狀態統一）
 * 【首次】  setupEverything()          - ⚠️ 第一次使用，會建立新日曆
 * 【狀態】  runStatusMigration()      - 訂單狀態統一
 * 【日曆】  listAllCalendars() / deleteOldCalendars()
 * 【檢查】  quickCheck() / checkTriggerCount() / cleanupDuplicateTriggers()
 *
 * @version 2.1
 */

// ==========================================
// 工作表初始化（訂單_YYYY 建表／補齊 schema）
// ==========================================

/**
 * 建立指定年份的訂單工作表；不傳參數則用今年。若表已存在會自動補齊缺少的欄位。
 * 使用方式：initializeYearSheet() 今年，或 initializeYearSheet(2024) 指定年。
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
 * 預建多年度訂單表（可改 startYear / endYear）。
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

/**
 * 列出試算表內所有工作表名稱與列數。
 */
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

// ==========================================
// 日常使用：系統初始化（不會建立新日曆）
// ==========================================

/**
 * 日常使用的系統初始化
 * ✅ 不會建立新日曆
 * ✅ 檢查現有設定
 * ✅ 設定觸發器
 */
function setupSystem() {
  Logger.log('');
  Logger.log('==========================================');
  Logger.log('🎉 雫旅訂房系統 - 系統初始化');
  Logger.log('==========================================');
  Logger.log('');

  // ==========================================
  // Step 1: 檢查 Properties 設定
  // ==========================================
  Logger.log('📋 Step 1: 檢查 Properties 設定...');

  const props = PropertiesService.getScriptProperties();
  const requiredProps = [
    'SHEET_ID',
    'RECAPTCHA_SECRET',
    'PUBLIC_CALENDAR_ID',
    'HOUSEKEEPING_CALENDAR_ID',
  ];

  let allPropsSet = true;
  requiredProps.forEach((prop) => {
    const value = props.getProperty(prop);
    if (value) {
      Logger.log(`✅ ${prop}: 已設定`);
    } else {
      Logger.log(`❌ ${prop}: 未設定`);
      allPropsSet = false;
    }
  });

  if (!allPropsSet) {
    Logger.log('');
    Logger.log('⚠️ 有 Properties 未設定！');
    Logger.log('請先執行 setupEverything() 或手動設定 Properties');
    return;
  }

  Logger.log('✅ Properties 設定完成');
  Logger.log('');

  // ==========================================
  // Step 2: 檢查日曆連線
  // ==========================================
  Logger.log('📅 Step 2: 檢查日曆連線...');

  try {
    const publicCal = CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
    Logger.log('✅ 公開日曆連線正常:', publicCal.getName());
  } catch (e) {
    Logger.log('❌ 公開日曆連線失敗:', e.message);
  }

  try {
    const housekeepingCal = CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
    Logger.log('✅ 房務日曆連線正常:', housekeepingCal.getName());
  } catch (e) {
    Logger.log('❌ 房務日曆連線失敗:', e.message);
  }

  Logger.log('');

  // ==========================================
  // Step 3: 初始化工作表（建立或補齊 schema 欄位）
  // ==========================================
  Logger.log('📊 Step 3: 初始化工作表...');

  try {
    const currentYear = new Date().getFullYear();
    initializeYearSheet(currentYear);
    Logger.log('✅ 工作表已就緒（若已存在會自動補齊缺少欄位）');
  } catch (e) {
    Logger.log('⚠️ 工作表初始化失敗:', e.message);
  }

  Logger.log('');

  // ==========================================
  // Step 4: 設定自動觸發器（清理 / 完成 / 確認信 / 旅遊手冊 / 退房感謝）
  // ==========================================
  Logger.log('⏰ Step 4: 設定自動觸發器...');

  try {
    const triggers = ScriptApp.getProjectTriggers();
    const handlersToRemove = [
      'cleanupOldYearEvents',
      'markCompletedOrdersInternal',
      'checkStatusChanges',
      'checkAndSendTravelGuides',
      'sendPostStayThankyouBatch',
    ];
    // 刪除舊的相關觸發器
    triggers.forEach((trigger) => {
      if (handlersToRemove.indexOf(trigger.getHandlerFunction()) !== -1) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    // 每天凌晨 3 點檢查去年事件
    ScriptApp.newTrigger('cleanupOldYearEvents')
      .timeBased()
      .everyDays(1)
      .atHour(3)
      .inTimezone('Asia/Taipei')
      .create();

    // 每天早上 6 點整理已完成訂單
    ScriptApp.newTrigger('markCompletedOrdersInternal')
      .timeBased()
      .everyDays(1)
      .atHour(6)
      .inTimezone('Asia/Taipei')
      .create();

    // 每小時檢查狀態變更（若你之後決定保留 checkStatusChanges，可在這裡打開）
    // ScriptApp.newTrigger('checkStatusChanges')
    //   .timeBased()
    //   .everyHours(1)
    //   .create();

    // 每天 2 點寄旅遊手冊（入住前 7 天）
    ScriptApp.newTrigger('checkAndSendTravelGuides')
      .timeBased()
      .everyDays(1)
      .atHour(2)
      .inTimezone('Asia/Taipei')
      .create();

    // 每天 10 點寄退房感謝信（島嶼的餘韻）
    ScriptApp.newTrigger('sendPostStayThankyouBatch')
      .timeBased()
      .everyDays(1)
      .atHour(10)
      .inTimezone('Asia/Taipei')
      .create();

    Logger.log(
      '✅ 觸發器已設定：cleanupOldYearEvents / markCompletedOrdersInternal / checkAndSendTravelGuides / sendPostStayThankyouBatch'
    );
  } catch (e) {
    Logger.log('⚠️ 觸發器設定失敗:', e.message);
  }

  Logger.log('');

  // ==========================================
  // Step 5: 訂單狀態統一（試算表）
  // ==========================================
  Logger.log('📋 Step 5: 訂單狀態統一...');
  try {
    runStatusMigration();
  } catch (e) {
    Logger.log('⚠️ 狀態統一時發生錯誤:', e.message);
  }

  Logger.log('');

  // ==========================================
  // 完成報告
  // ==========================================
  Logger.log('====================================');
  Logger.log('✅ 系統初始化完成！');
  Logger.log('====================================');
}

// ==========================================
// 訂單狀態統一（試算表）
// ==========================================

/**
 * 將試算表內訂單狀態統一為四種：洽談中、已付訂、取消、完成
 * - 待確認 → 洽談中；預定中／已付訂／已預訂／已成立 → 已付訂；已取消 → 取消；已完成 → 完成
 * - 退房日已過的「已付訂」→ 改為「完成」
 * 可在 GAS 編輯器選此函式後「執行」單獨跑一次，或由 setupSystem() 一併執行。
 */
function runStatusMigration() {
  if (typeof DataStore === 'undefined') {
    Logger.log('❌ DataStore 未載入，請在專案中確認 dataStore.js 已加入');
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const orders = DataStore.getOrders();
  const toNegotiating = ['待確認'];
  const toPaid = ['預定中', '已付訂', '已預訂', '已成立'];
  const toCancel = ['已取消'];
  const toComplete = ['已完成'];
  let migrated = 0;
  let marked = 0;
  orders.forEach(function (order) {
    var s = order.status;
    if (toNegotiating.indexOf(s) !== -1) {
      if (DataStore.updateOrder(order.orderID, { status: '洽談中' }).success) migrated++;
    } else if (toPaid.indexOf(s) !== -1) {
      if (DataStore.updateOrder(order.orderID, { status: '已付訂' }).success) migrated++;
    } else if (toCancel.indexOf(s) !== -1) {
      if (DataStore.updateOrder(order.orderID, { status: '取消' }).success) migrated++;
    } else if (toComplete.indexOf(s) !== -1) {
      if (DataStore.updateOrder(order.orderID, { status: '完成' }).success) migrated++;
    }
  });
  const ordersAfter = migrated > 0 ? DataStore.getOrders() : orders;
  ordersAfter.forEach(function (order) {
    if (order.status !== '已付訂') return;
    const checkOut = new Date(order.checkOut);
    checkOut.setHours(0, 0, 0, 0);
    if (checkOut < today) {
      if (DataStore.updateOrder(order.orderID, { status: '完成' }).success) marked++;
    }
  });
  Logger.log('✅ 狀態統一完成：' + migrated + ' 筆正規化，' + marked + ' 筆標記為完成');
}

// ==========================================
// ⚠️ 第一次使用：完整設定（會建立新日曆）
// ==========================================

/**
 * 第一次使用的完整設定
 * ⚠️ 會建立新的日曆
 * ⚠️ 只在第一次部署時使用
 */
function setupEverything() {
  Logger.log('🚀 開始完整設定...');
  Logger.log('⚠️ 注意：此函數會建立新日曆！');
  Logger.log('');

  // ==========================================
  // Step 1: 建立兩個日曆
  // ==========================================
  Logger.log('📅 Step 1: 建立日曆...');

  const publicCal = CalendarApp.createCalendar('雫旅 Drop Inn - 公開日曆', {
    summary: '顯示入住日期的公開日曆',
    timeZone: 'Asia/Taipei',
    color: CalendarApp.Color.BLUE,
  });

  const housekeepingCal = CalendarApp.createCalendar('雫旅 Drop Inn - 房務日曆', {
    summary: '退房與清潔任務日曆',
    timeZone: 'Asia/Taipei',
    color: CalendarApp.Color.ORANGE,
  });

  Logger.log('✅ 日曆建立完成');
  Logger.log('');

  // ==========================================
  // Step 2: 設定日曆相關 Properties（不覆蓋既有 SHEET_ID / 密鑰）
  // ==========================================
  Logger.log('🔧 Step 2: 設定日曆 Properties...');

  const props = PropertiesService.getScriptProperties();
  // 只寫入剛建立的日曆 ID，其他敏感設定請在 Script Properties 介面手動設定
  props.setProperty('PUBLIC_CALENDAR_ID', publicCal.getId());
  props.setProperty('HOUSEKEEPING_CALENDAR_ID', housekeepingCal.getId());

  Logger.log('✅ 日曆 ID 已寫入 Properties（SHEET_ID / RECAPTCHA_SECRET / ADMIN_EMAIL 保留不動）');
  Logger.log('');

  // ==========================================
  // Step 3: 初始化 Sheet（統一用 SchemaManager 欄位，避免重複定義）
  // ==========================================
  Logger.log('📊 Step 3: 初始化 Sheet...');

  try {
    const currentYear = new Date().getFullYear();
    initializeYearSheet(currentYear);
    Logger.log('✅ Sheet 初始化完成（與 schemaManager 一致）');
  } catch (e) {
    Logger.log('⚠️ Sheet 初始化失敗:', e.message);
  }

  Logger.log('');

  // ==========================================
  // Step 4: 設定觸發器
  // ==========================================
  Logger.log('⏰ Step 4: 設定自動清理觸發器...');

  try {
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach((trigger) => {
      if (trigger.getHandlerFunction() === 'cleanupOldYearEvents') {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    ScriptApp.newTrigger('cleanupOldYearEvents')
      .timeBased()
      .everyDays(1)
      .atHour(3)
      .inTimezone('Asia/Taipei')
      .create();

    Logger.log('✅ 自動清理觸發器已設定');
  } catch (e) {
    Logger.log('⚠️ 觸發器設定失敗:', e.message);
  }

  Logger.log('');

  // ==========================================
  // 完成報告
  // ==========================================
  Logger.log('====================================');
  Logger.log('🎉 設定完成！');
  Logger.log('====================================');
  Logger.log('');
  Logger.log('📅 公開日曆 ID:');
  Logger.log('   ', publicCal.getId());
  Logger.log('');
  Logger.log('🧹 房務日曆 ID:');
  Logger.log('   ', housekeepingCal.getId());
  Logger.log('');
  Logger.log('🔗 日曆連結：');
  Logger.log('');
  Logger.log('公開日曆:');
  Logger.log(
    'https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(publicCal.getId())
  );
  Logger.log('');
  Logger.log('房務日曆:');
  Logger.log(
    'https://calendar.google.com/calendar/embed?src=' + encodeURIComponent(housekeepingCal.getId())
  );
  Logger.log('');
  Logger.log('✅ 系統已就緒！');
}

// ==========================================
// 🔍 日曆管理工具
// ==========================================

/**
 * 列出所有日曆
 */
function listAllCalendars() {
  Logger.log('');
  Logger.log('📅 列出所有日曆...');
  Logger.log('');

  // 取得 Properties 中儲存的日曆 ID
  const props = PropertiesService.getScriptProperties();
  const storedPublicId = props.getProperty('PUBLIC_CALENDAR_ID');
  const storedHousekeepingId = props.getProperty('HOUSEKEEPING_CALENDAR_ID');

  Logger.log('🔧 Properties 中的日曆 ID:');
  Logger.log('  公開日曆:', storedPublicId || '❌ 未設定');
  Logger.log('  房務日曆:', storedHousekeepingId || '❌ 未設定');
  Logger.log('');

  // 取得所有自己建立的日曆
  const allCalendars = CalendarApp.getAllCalendars();

  Logger.log('📋 所有日曆列表:');
  Logger.log('');

  let dropinnCount = 0;

  allCalendars.forEach((cal, index) => {
    const name = cal.getName();
    const id = cal.getId();

    if (name.includes('雫旅') || name.includes('Drop Inn')) {
      dropinnCount++;
      const isPublic = id === storedPublicId ? ' ✅ 目前使用中（公開）' : '';
      const isHousekeeping = id === storedHousekeepingId ? ' ✅ 目前使用中（房務）' : '';

      Logger.log(`${dropinnCount}. ${name}`);
      Logger.log(`   ID: ${id}`);
      Logger.log(`   ${isPublic}${isHousekeeping}`);
      Logger.log('');
    }
  });

  if (dropinnCount === 0) {
    Logger.log('⚠️ 沒有找到雫旅相關的日曆');
  }

  Logger.log('====================================');
  Logger.log('💡 建議:');
  Logger.log('====================================');

  if (dropinnCount > 2) {
    Logger.log('⚠️ 發現重複的日曆！');
    Logger.log('');
    Logger.log('1. 保留「✅ 目前使用中」的日曆');
    Logger.log('2. 執行 deleteOldCalendars() 自動清理重複的日曆');
  } else if (dropinnCount === 2) {
    Logger.log('✅ 日曆數量正常（2 個）');
  } else {
    Logger.log('⚠️ 日曆數量不足');
    Logger.log('請執行 setupEverything() 建立日曆');
  }

  Logger.log('');
}

/**
 * 刪除重複的日曆
 * ✅ 保留 Properties 中設定的日曆
 * 🗑️ 刪除其他重複的日曆
 */
function deleteOldCalendars() {
  Logger.log('');
  Logger.log('🗑️ 開始清理重複的日曆...');
  Logger.log('');

  // 取得 Properties 中儲存的日曆 ID（這些是要保留的）
  const props = PropertiesService.getScriptProperties();
  const keepPublicId = props.getProperty('PUBLIC_CALENDAR_ID');
  const keepHousekeepingId = props.getProperty('HOUSEKEEPING_CALENDAR_ID');

  if (!keepPublicId || !keepHousekeepingId) {
    Logger.log('❌ Properties 中沒有設定日曆 ID');
    Logger.log('請先執行 setupEverything() 或 setupSystem()');
    return;
  }

  Logger.log('✅ 保留的日曆:');
  Logger.log('  公開日曆:', keepPublicId);
  Logger.log('  房務日曆:', keepHousekeepingId);
  Logger.log('');

  // 取得所有日曆
  const allCalendars = CalendarApp.getAllCalendars();
  let deletedCount = 0;

  Logger.log('🔍 檢查所有日曆...');
  Logger.log('');

  allCalendars.forEach((cal) => {
    const name = cal.getName();
    const id = cal.getId();

    // 只處理雫旅相關的日曆
    if (name.includes('雫旅') || name.includes('Drop Inn')) {
      // 如果不是 Properties 中儲存的，就刪除
      if (id !== keepPublicId && id !== keepHousekeepingId) {
        Logger.log(`🗑️ 刪除重複日曆: ${name}`);
        Logger.log(`   ID: ${id}`);

        try {
          cal.deleteCalendar();
          deletedCount++;
          Logger.log('   ✅ 已刪除');
        } catch (e) {
          Logger.log('   ❌ 刪除失敗:', e.message);
        }

        Logger.log('');
      } else {
        Logger.log(`✅ 保留: ${name}`);
        Logger.log('');
      }
    }
  });

  Logger.log('====================================');
  Logger.log(`✅ 清理完成！共刪除 ${deletedCount} 個重複日曆`);
  Logger.log('====================================');
  Logger.log('');

  if (deletedCount === 0) {
    Logger.log('💡 沒有發現重複的日曆');
  }
}

// ==========================================
// 🔍 系統檢查工具
// ==========================================

/**
 * 快速檢查系統狀態
 */
function quickCheck() {
  Logger.log('');
  Logger.log('=== 🔍 系統快速檢查 ===');
  Logger.log('');

  // 1. 檢查 Properties
  Logger.log('📋 Properties:');
  const props = PropertiesService.getScriptProperties();
  Logger.log('  SHEET_ID:', props.getProperty('SHEET_ID') ? '✅' : '❌');
  Logger.log('  RECAPTCHA_SECRET:', props.getProperty('RECAPTCHA_SECRET') ? '✅' : '❌');
  Logger.log('  PUBLIC_CALENDAR_ID:', props.getProperty('PUBLIC_CALENDAR_ID') ? '✅' : '❌');
  Logger.log(
    '  HOUSEKEEPING_CALENDAR_ID:',
    props.getProperty('HOUSEKEEPING_CALENDAR_ID') ? '✅' : '❌'
  );
  Logger.log('');

  // 2. 檢查觸發器
  Logger.log('⏰ 觸發器:');
  const triggers = ScriptApp.getProjectTriggers();
  if (triggers.length === 0) {
    Logger.log('  ❌ 無觸發器');
  } else {
    triggers.forEach((trigger, index) => {
      Logger.log(`  ${index + 1}. ${trigger.getHandlerFunction()} ✅`);
    });
  }
  Logger.log('');

  // 3. 檢查日曆
  Logger.log('📅 日曆:');
  try {
    const publicCal = CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
    Logger.log('  公開日曆:', publicCal ? '✅' : '❌');
  } catch (e) {
    Logger.log('  公開日曆: ❌', e.message);
  }

  try {
    const housekeepingCal = CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
    Logger.log('  房務日曆:', housekeepingCal ? '✅' : '❌');
  } catch (e) {
    Logger.log('  房務日曆: ❌', e.message);
  }
  Logger.log('');

  // 4. 檢查 Sheet
  Logger.log('📊 工作表:');
  try {
    checkYearSheets();
  } catch (e) {
    Logger.log('  ❌ 檢查失敗:', e.message);
  }

  Logger.log('');
  Logger.log('✅ 檢查完成');
  Logger.log('');
}

/**
 * 檢查觸發器數量
 */
function checkTriggerCount() {
  Logger.log('');
  Logger.log('🔍 檢查觸發器數量...');
  Logger.log('');

  const triggers = ScriptApp.getProjectTriggers();

  Logger.log(`總共有 ${triggers.length} 個觸發器：`);
  Logger.log('');

  if (triggers.length === 0) {
    Logger.log('⚠️ 沒有任何觸發器');
    Logger.log('請執行 setupSystem() 建立觸發器');
  } else {
    triggers.forEach((trigger, index) => {
      Logger.log(`${index + 1}. 函式：${trigger.getHandlerFunction()}`);
      Logger.log(`   類型：${trigger.getEventType()}`);
      Logger.log('');
    });
  }

  // 檢查是否有重複的 cleanupOldYearEvents
  const cleanupTriggers = triggers.filter((t) => t.getHandlerFunction() === 'cleanupOldYearEvents');

  Logger.log('====================================');

  if (cleanupTriggers.length === 0) {
    Logger.log('⚠️ 沒有找到 cleanupOldYearEvents 觸發器');
    Logger.log('請執行 setupSystem() 建立');
  } else if (cleanupTriggers.length === 1) {
    Logger.log('✅ cleanupOldYearEvents 觸發器正常（1 個）');
  } else {
    Logger.log(`❌ cleanupOldYearEvents 觸發器重複了！（${cleanupTriggers.length} 個）`);
    Logger.log('');
    Logger.log('請執行 cleanupDuplicateTriggers() 清理');
  }

  Logger.log('====================================');
  Logger.log('');
}

/**
 * 清理重複的觸發器
 */
function cleanupDuplicateTriggers() {
  Logger.log('');
  Logger.log('🗑️ 開始清理重複的觸發器...');
  Logger.log('');

  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'cleanupOldYearEvents') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
      Logger.log(`✅ 已刪除: ${trigger.getHandlerFunction()}`);
    }
  });

  Logger.log('');
  Logger.log(`✅ 共刪除 ${removed} 個 cleanupOldYearEvents 觸發器`);
  Logger.log('');
  Logger.log('🔄 現在可以執行 setupSystem() 重新建立（只會建立 1 個）');
  Logger.log('');
}

// ==========================================
// 🧪 測試工具
// ==========================================

/**
 * 快速測試（會建立測試訂單）
 */
function quickTest() {
  Logger.log('=== 🧪 快速測試 ===');
  Logger.log('');

  // 測試 1: 檢查 Properties
  Logger.log('📋 Step 1: Properties 檢查');
  const props = PropertiesService.getScriptProperties();
  Logger.log('  SHEET_ID:', props.getProperty('SHEET_ID') ? '✅' : '❌');
  Logger.log('  RECAPTCHA_SECRET:', props.getProperty('RECAPTCHA_SECRET') ? '✅' : '❌');
  Logger.log('  PUBLIC_CALENDAR_ID:', props.getProperty('PUBLIC_CALENDAR_ID') ? '✅' : '❌');
  Logger.log(
    '  HOUSEKEEPING_CALENDAR_ID:',
    props.getProperty('HOUSEKEEPING_CALENDAR_ID') ? '✅' : '❌'
  );
  Logger.log('');

  // 測試 2: 測試日曆同步
  Logger.log('📅 Step 2: 測試日曆同步');
  const testOrder = {
    orderID: 'TEST-' + new Date().getTime(),
    name: '測試客人',
    checkIn: '2026-07-01',
    checkOut: '2026-07-03',
    rooms: 3,
    extraBeds: 1,
    status: '已付訂',
  };

  Logger.log('  訂單資料:', testOrder.orderID);
  const result = CalendarManager.syncOrderToCalendars(testOrder);

  if (result.success) {
    Logger.log('  ✅ 同步成功！');
  } else {
    Logger.log('  ❌ 同步失敗:', result.error);
  }
  Logger.log('');

  // 測試 3: 查看日曆統計
  Logger.log('📊 Step 3: 日曆統計');
  CalendarManager.getCalendarStats();
  Logger.log('');

  Logger.log('====================================');
  Logger.log('🎉 測試完成！');
  Logger.log('====================================');
  Logger.log('');
  Logger.log('請打開 Google Calendar 查看：');
  Logger.log('1. 公開日曆應該有「❌ 已訂走」事件');
  Logger.log('2. 房務日曆應該有「✅ 一般打掃 - 3 間 + 1 加床」事件');
  Logger.log('');
}

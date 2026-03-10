/**
 * ========================================
 * 日曆管理服務 - 安全強化版
 * ========================================
 *
 * ✅ 新增功能：
 * 1. 年份驗證：只能新增當年度和未來的事件
 * 2. 自動清理：每年二月刪除「去年」的事件
 * 3. Calendar ID 完全隱蔽
 * 4. 防呆機制：拒絕無效日期
 *
 * @author 雫旅訂房系統
 * @version 2.1 安全強化版（修正清理邏輯）
 */

const CalendarManager = (() => {
  // ==========================================
  // 私有工具函數
  // ==========================================

  /**
   * 驗證日期是否為有效年份
   * @param {string} dateStr - 格式：'2026-06-01'
   * @returns {boolean}
   */
  function _isValidYear(dateStr) {
    try {
      const date = new Date(dateStr);
      const year = date.getFullYear();
      const currentYear = new Date().getFullYear();

      // 規則：只接受「今年」或「未來」
      if (year < currentYear) {
        Logger.log(`❌ 拒絕過去年份：${year}（當前年份：${currentYear}）`);
        return false;
      }

      // 規則：不接受太遠的未來（最多 3 年後）
      if (year > currentYear + 3) {
        Logger.log(`❌ 拒絕過於未來的年份：${year}（最多到 ${currentYear + 3}）`);
        return false;
      }

      return true;
    } catch (error) {
      Logger.log(`❌ 日期格式錯誤：${dateStr}`);
      return false;
    }
  }

  /**
   * 檢查訂單的日期是否有效
   * @param {Object} order
   * @returns {Object} {valid: boolean, reason: string}
   */
  function _validateOrderDates(order) {
    // 檢查入住日期
    if (!_isValidYear(order.checkIn)) {
      return {
        valid: false,
        reason: `入住日期 ${order.checkIn} 為過去年份或過於未來，拒絕新增到日曆`,
      };
    }

    // 檢查退房日期
    if (!_isValidYear(order.checkOut)) {
      return {
        valid: false,
        reason: `退房日期 ${order.checkOut} 為過去年份或過於未來，拒絕新增到日曆`,
      };
    }

    return { valid: true, reason: '' };
  }

  // ==========================================
  // 核心功能：同步訂單到日曆（帶年份驗證）
  // ==========================================

  /**
   * 同步單一訂單到日曆（公開 + 房務）
   * ✅ 新增：年份驗證
   */
  function syncOrderToCalendars(order) {
    try {
      Logger.log(`📅 開始同步訂單到日曆: ${order.orderID}`);

      // 🛡️ 步驟 1: 驗證日期
      const validation = _validateOrderDates(order);
      if (!validation.valid) {
        Logger.log(`⚠️ ${validation.reason}`);

        // 記錄拒絕原因到 Sheet
        DataStore.updateOrder(order.orderID, {
          calendarSyncStatus: 'rejected',
          calendarSyncNote: validation.reason,
          lastCalendarSync: new Date(),
        });

        return {
          success: false,
          error: validation.reason,
        };
      }

      // 步驟 2: 同步到公開日曆
      const publicEventID = _syncToPublicCalendar(order);

      // 步驟 3: 同步到房務日曆
      const housekeepingEventID = _syncToHousekeepingCalendar(order);

      // 步驟 4: 更新 Sheet 記錄
      DataStore.updateOrder(order.orderID, {
        publicCalendarEventID: publicEventID,
        housekeepingCalendarEventID: housekeepingEventID,
        lastCalendarSync: new Date(),
        calendarSyncStatus: 'synced',
      });

      Logger.log(`✅ 日曆同步完成: ${order.orderID}`);
      return { success: true };
    } catch (error) {
      Logger.log(`❌ 日曆同步失敗: ${error.message}`);

      try {
        DataStore.updateOrder(order.orderID, {
          calendarSyncStatus: 'failed',
          calendarSyncNote: error.message,
        });
      } catch (e) {}

      if (typeof LoggerService !== 'undefined') {
        LoggerService.logError(error, 'CalendarManager.syncOrderToCalendars');
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * (內部) 同步到公開日曆
   *
   * 📅 日期邏輯：
   * - 入住日到退房日的「前一天」
   * - 例：6/30 入住，7/2 退房 → 只標記 6/30 和 7/1
   * - 原因：7/2 客人已退房，新客可以入住
   */
  function _syncToPublicCalendar(order) {
    const calendar = CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
    if (!calendar) throw new Error('無法存取公開日曆');

    const checkIn = new Date(order.checkIn);
    const checkOut = new Date(order.checkOut);

    // ✅ 修正：不再加 1 天
    // Google Calendar 的 createAllDayEvent 結束日期是「不包含」的
    // 所以直接用 checkOut 就好
    const title = '❌ 已訂走';
    const description = `訂單：${order.orderID}\n房數：${order.rooms}\n姓名：${order.name}`;

    const event = calendar.createAllDayEvent(title, checkIn, checkOut, {
      description: description,
      location: '雫旅 Drop Inn',
    });

    event.setColor(CalendarApp.EventColor.RED);
    Logger.log(`✅ 已加入公開日曆: ${title} (${order.checkIn} ~ ${order.checkOut}，不含退房日)`);

    return event.getId();
  }

  /**
   * (內部) 同步到房務日曆
   */
  function _syncToHousekeepingCalendar(order) {
    const calendar = CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
    if (!calendar) throw new Error('無法存取房務日曆');

    const checkOutDate = new Date(order.checkOut);
    const isUrgent = _checkIfSameDayCheckIn(order.checkOut);

    const bedsInfo = order.extraBeds > 0 ? ` + ${order.extraBeds} 加床` : '';
    const title = isUrgent
      ? `⚠️ 緊急打掃 - ${order.rooms} 間${bedsInfo}`
      : `✅ 一般打掃 - ${order.rooms} 間${bedsInfo}`;

    const description = `退房訂單：${order.orderID}\n${isUrgent ? '⚠️ 當天有新客入住！' : ''}`;

    const event = calendar.createAllDayEvent(title, checkOutDate, {
      description: description,
      location: '雫旅 Drop Inn',
    });

    event.setColor(isUrgent ? CalendarApp.EventColor.ORANGE : CalendarApp.EventColor.GREEN);
    Logger.log(`✅ 已加入房務日曆: ${title} (${order.checkOut})`);

    return event.getId();
  }

  /**
   * (內部) 檢查是否有同日入住的訂單
   */
  function _checkIfSameDayCheckIn(dateStr) {
    try {
      const allOrders = DataStore.getOrders();
      const hasCheckIn = allOrders.some(
        (order) =>
          (order.status === '預定中' || ['已付訂', '已預訂', '已成立'].includes(order.status)) && order.checkIn === dateStr
      );
      return hasCheckIn;
    } catch (e) {
      Logger.log('⚠️ 檢查同日入住失敗，預設為 false', e);
      return false;
    }
  }

  // ==========================================
  // 刪除功能
  // ==========================================

  /**
   * 刪除訂單的日曆事件
   */
  function deleteCalendarEvents(order) {
    try {
      Logger.log(`🗑️ 開始刪除日曆事件: ${order.orderID}`);

      let deletedCount = 0;

      // 刪除公開日曆事件
      if (order.publicCalendarEventID) {
        try {
          const publicCal = CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
          const event = publicCal.getEventById(order.publicCalendarEventID);
          if (event) {
            event.deleteEvent();
            deletedCount++;
            Logger.log(`✅ 已刪除公開日曆事件`);
          }
        } catch (e) {
          Logger.log(`⚠️ 公開日曆事件不存在或已刪除`);
        }
      }

      // 刪除房務日曆事件
      if (order.housekeepingCalendarEventID) {
        try {
          const housekeepingCal = CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
          const event = housekeepingCal.getEventById(order.housekeepingCalendarEventID);
          if (event) {
            event.deleteEvent();
            deletedCount++;
            Logger.log(`✅ 已刪除房務日曆事件`);
          }
        } catch (e) {
          Logger.log(`⚠️ 房務日曆事件不存在或已刪除`);
        }
      }

      // 更新 Sheet
      DataStore.updateOrder(order.orderID, {
        publicCalendarEventID: null,
        housekeepingCalendarEventID: null,
        lastCalendarSync: new Date(),
        calendarSyncStatus: 'deleted',
      });

      Logger.log(`✅ 刪除完成，共刪除 ${deletedCount} 個事件`);
      return { success: true, deletedCount };
    } catch (error) {
      Logger.log(`❌ 刪除日曆事件失敗: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  // ==========================================
  // 清理功能：刪除「去年」的事件
  // ==========================================

  /**
   * 🆕 自動清理「去年」的事件
   *
   * 執行時機：每年二月初
   * 清理範圍：「去年」的事件（保留「今年」和「未來」）
   *
   * 例：2026 年 2 月執行 → 刪除 2025 年的事件
   */
  function cleanupOldYearEvents() {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1; // 1-12

      // 🛡️ 安全檢查：只在 2 月執行
      if (currentMonth !== 2) {
        Logger.log(`⚠️ 目前是 ${currentMonth} 月，清理功能只在 2 月執行`);
        return { success: false, reason: '非執行月份' };
      }

      const targetYear = currentYear - 1; // 去年

      Logger.log('');
      Logger.log('=== 🗑️ 開始清理過期日曆事件 ===');
      Logger.log(`當前年份：${currentYear} 年 ${currentMonth} 月`);
      Logger.log(`清理目標：${targetYear} 年的事件`);
      Logger.log('');

      // 定義清理範圍
      const startDate = new Date(`${targetYear}-01-01`);
      const endDate = new Date(`${targetYear}-12-31`);

      // 清理公開日曆
      const publicCal = CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
      const publicEvents = publicCal.getEvents(startDate, endDate);

      Logger.log(`📅 公開日曆找到 ${publicEvents.length} 個 ${targetYear} 年事件`);
      publicEvents.forEach((event) => event.deleteEvent());
      Logger.log(`✅ 公開日曆已清理`);

      // 清理房務日曆
      const housekeepingCal = CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
      const housekeepingEvents = housekeepingCal.getEvents(startDate, endDate);

      Logger.log(`🧹 房務日曆找到 ${housekeepingEvents.length} 個 ${targetYear} 年事件`);
      housekeepingEvents.forEach((event) => event.deleteEvent());
      Logger.log(`✅ 房務日曆已清理`);

      const totalDeleted = publicEvents.length + housekeepingEvents.length;

      Logger.log('');
      Logger.log('=== ✅ 清理完成 ===');
      Logger.log(`共刪除 ${totalDeleted} 個 ${targetYear} 年的事件`);
      Logger.log('');

      return {
        success: true,
        year: targetYear,
        deletedCount: totalDeleted,
      };
    } catch (error) {
      Logger.log(`❌ 清理失敗: ${error.message}`);
      if (typeof LoggerService !== 'undefined') {
        LoggerService.logError(error, 'CalendarManager.cleanupOldYearEvents');
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * 🆕 設定自動清理觸發器
   *
   * 執行時間：每天凌晨 3 點檢查，只在 2 月才執行清理
   */
  function setupAutoCleanupTrigger() {
    try {
      // 先刪除舊的觸發器
      const triggers = ScriptApp.getProjectTriggers();
      triggers.forEach((trigger) => {
        if (trigger.getHandlerFunction() === 'cleanupOldYearEvents') {
          ScriptApp.deleteTrigger(trigger);
        }
      });

      // 建立新觸發器：每天執行，函數內會檢查是否為 2 月
      ScriptApp.newTrigger('cleanupOldYearEvents')
        .timeBased()
        .everyDays(1) // 每天執行
        .atHour(3) // 凌晨 3 點
        .inTimezone('Asia/Taipei')
        .create();

      Logger.log('✅ 自動清理觸發器已設定');
      Logger.log('📅 執行時間：每天凌晨 3 點檢查，只在 2 月執行清理');
    } catch (error) {
      Logger.log(`❌ 設定觸發器失敗: ${error.message}`);
      throw error;
    }
  }

  // ==========================================
  // 管理工具：清空、重建、統計
  // ==========================================

  /**
   * 清空所有日曆（測試/重置用）
   * ⚠️ 危險操作，請謹慎使用
   */
  function clearAllCalendars() {
    Logger.log('🗑️ 開始清空所有日曆...');

    try {
      const currentYear = new Date().getFullYear();

      // 清理範圍：過去 3 年到未來 3 年
      const startDate = new Date(currentYear - 3, 0, 1);
      const endDate = new Date(currentYear + 3, 11, 31);

      const publicCal = CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
      const publicEvents = publicCal.getEvents(startDate, endDate);
      publicEvents.forEach((event) => event.deleteEvent());
      Logger.log(`✅ 已清空公開日曆（刪除 ${publicEvents.length} 個事件）`);

      const housekeepingCal = CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
      const housekeepingEvents = housekeepingCal.getEvents(startDate, endDate);
      housekeepingEvents.forEach((event) => event.deleteEvent());
      Logger.log(`✅ 已清空房務日曆（刪除 ${housekeepingEvents.length} 個事件）`);
    } catch (error) {
      Logger.log(`❌ 清空日曆失敗: ${error.message}`);
    }
  }

  /**
   * 重建所有日曆（手動修正用）
   */
  function rebuildAllCalendars() {
    Logger.log('');
    Logger.log('=== 🔄 開始重建所有日曆 ===');
    Logger.log('');

    try {
      // Step 1: 清空
      clearAllCalendars();

      // Step 2: 讀取所有有效訂單
      const orders = DataStore.getOrders();
      const validOrders = orders.filter(
        (order) => order.status === '預定中' || ['已付訂', '已預訂', '已成立'].includes(order.status)
      );

      Logger.log(`找到 ${validOrders.length} 筆有效訂單`);

      // Step 3: 逐筆重建（只重建當年和未來的訂單）
      let successCount = 0;
      let rejectedCount = 0;

      validOrders.forEach((order, index) => {
        Logger.log(`處理第 ${index + 1}/${validOrders.length} 筆: ${order.orderID}`);

        const result = syncOrderToCalendars(order);
        if (result.success) {
          successCount++;
        } else {
          rejectedCount++;
        }

        Utilities.sleep(500);
      });

      Logger.log('');
      Logger.log('=== ✅ 重建完成 ===');
      Logger.log(`成功: ${successCount} 筆`);
      Logger.log(`拒絕（過去年份）: ${rejectedCount} 筆`);
      Logger.log('');
    } catch (error) {
      Logger.log(`❌ 重建失敗: ${error.message}`);
    }
  }

  /**
   * 日曆統計
   */
  function getCalendarStats() {
    try {
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear - 1, 0, 1);
      const endDate = new Date(currentYear + 2, 11, 31);

      const publicCal = CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
      const publicEvents = publicCal.getEvents(startDate, endDate);

      const housekeepingCal = CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
      const housekeepingEvents = housekeepingCal.getEvents(startDate, endDate);

      Logger.log('📊 日曆統計');
      Logger.log('─────────────────────────');
      Logger.log(`📅 公開日曆：${publicEvents.length} 個事件`);
      Logger.log(`🧹 房務日曆：${housekeepingEvents.length} 個事件`);
      Logger.log(`📈 總計：${publicEvents.length + housekeepingEvents.length} 個事件`);

      return {
        publicCount: publicEvents.length,
        housekeepingCount: housekeepingEvents.length,
        total: publicEvents.length + housekeepingEvents.length,
      };
    } catch (error) {
      Logger.log(`❌ 取得統計失敗: ${error.message}`);
      throw error;
    }
  }

  // ==========================================
  // 匯出 API
  // ==========================================

  return {
    // 核心功能
    syncOrderToCalendars,
    deleteCalendarEvents,

    // 自動清理（新增）
    cleanupOldYearEvents,
    setupAutoCleanupTrigger,

    // 管理工具
    clearAllCalendars,
    rebuildAllCalendars,
    getCalendarStats,
  };
})();

// ==========================================
// 向後相容：保留舊名稱
// ==========================================
const CalendarService = CalendarManager;

/**
 * 移除自動清理觸發器
 * ⚠️ 只需要執行一次
 */
function removeAutoCleanupTrigger() {
  Logger.log('🔍 開始檢查觸發器...');

  const triggers = ScriptApp.getProjectTriggers();
  let removed = 0;

  triggers.forEach((trigger) => {
    if (trigger.getHandlerFunction() === 'cleanupOldYearEvents') {
      ScriptApp.deleteTrigger(trigger);
      removed++;
      Logger.log('✅ 已刪除自動清理觸發器');
    }
  });

  if (removed === 0) {
    Logger.log('ℹ️  沒有找到自動清理觸發器（可能已經刪除過了）');
  } else {
    Logger.log(`✅ 共刪除 ${removed} 個觸發器`);
  }

  Logger.log('');
  Logger.log('📋 目前剩餘的觸發器：');
  const remainingTriggers = ScriptApp.getProjectTriggers();

  if (remainingTriggers.length === 0) {
    Logger.log('  （無）');
  } else {
    remainingTriggers.forEach((trigger, index) => {
      Logger.log(`  ${index + 1}. ${trigger.getHandlerFunction()}`);
    });
  }

  Logger.log('');
  Logger.log('✅ 檢查完成');
}

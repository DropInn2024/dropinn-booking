/**
 * main.js
 * 雫旅 DROP INN API 主要入口 (Controller Layer)
 * ✅ 支援：訂房、Admin 後台、房務介面
 * ✅ 新增：updateOrderAndSync API
 * ✅ 新增：getBookedDates API（公開日曆查詢）
 * ✅ 新增：日曆管理 API（rebuildCalendars, clearCalendars, cleanupOldYear）
 */

/**
 * 判斷是否為需 Admin 權限的 action
 * （若之後有新增後台專用 API，請記得一併加進來）
 */
function isAdminAction(action) {
  const adminActions = [
    'getAllOrders',
    'getOrderByID',
    'updateOrder',
    'updateOrderAndSync',
    'markCompletedOrders',
    'generateNotification',
    'sendNotificationEmail',
    'rebuildCalendars',
    'clearCalendars',
    'cleanupOldYear',
  ];
  return adminActions.indexOf(action) !== -1;
}

/**
 * 檢查 Admin 金鑰是否有效
 *
 * 行為說明：
 * - 如果 Script Properties **沒有** 設定 ADMIN_API_KEY → 視為「未啟用金鑰檢查」，一律通過（維持舊行為）
 * - 如果有設定 ADMIN_API_KEY → 僅當傳入的 adminKey 相同時才通過
 */
function isValidAdminKey(adminKey) {
  var configuredKey = Config.ADMIN_API_KEY;
  if (!configuredKey) {
    // 未設定時，為了相容舊部署，不做阻擋
    return true;
  }
  return adminKey && adminKey === configuredKey;
}

/**
 * 處理 POST 請求
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: '請求內容為空，請重試' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const token = requestData.token;

    let result = {};

    // ==========================================
    // Admin 權限檢查（僅針對後台相關 action）
    // ==========================================
    if (isAdminAction(action)) {
      const adminKey = requestData.adminKey;
      if (!isValidAdminKey(adminKey)) {
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: '未授權的存取',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 訂房相關 API
    // ==========================================
    if (action === 'createBooking') {
      // 驗證 reCAPTCHA
      // Admin 後台手動建立訂單時用 ADMIN_BYPASS 跳過驗證
      const isAdminBypass = token === 'ADMIN_BYPASS';
      if (!isAdminBypass && !verifyRecaptcha(token)) {
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: 'reCAPTCHA 驗證失敗，請重新整理頁面再試',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }

      const bookingData = requestData.data;
      result = BookingService.handleCreateOrder(bookingData);
    }

    // ==========================================
    // Admin 後台 API
    // ==========================================
    else if (action === 'getAllOrders') {
      result = DataStore.getOrders();
    } else if (action === 'getOrderByID') {
      const orderID = requestData.orderID;
      const order = DataStore.getOrderByID(orderID);
      result = order ? { success: true, order } : { success: false, error: '找不到訂單' };
    } else if (action === 'updateOrder') {
      const orderID = requestData.orderID;
      const updates = requestData.updates;
      result = DataStore.updateOrder(orderID, updates);
    } else if (action === 'updateOrderAndSync') {
      const orderID = requestData.orderID;
      const updates = requestData.updates;

      // Step 1: 更新 Sheet
      result = DataStore.updateOrder(orderID, updates);

      if (result.success) {
        // Step 2: 處理日曆同步
        try {
          const order = DataStore.getOrderByID(orderID);

          // 如果狀態改為「已取消」，刪除日曆
          if (updates.status === '已取消') {
            if (typeof CalendarService !== 'undefined') {
              CalendarService.deleteCalendarEvents(order);
              Logger.log(`🗑️ 訂單已取消，日曆已清除: ${orderID}`);
            }
          }
          // 如果狀態改為「預定中」（已付訂金），同步日曆
          else if (updates.status === '預定中' || updates.status === '已付訂' || updates.status === '已預訂' || updates.status === '已成立') {
            if (typeof CalendarService !== 'undefined') {
              // 先刪除舊的（如果有）
              if (order.publicCalendarEventID || order.housekeepingCalendarEventID) {
                CalendarService.deleteCalendarEvents(order);
              }
              // 重新建立
              CalendarService.syncOrderToCalendars(order);
              Logger.log(`📅 訂單日曆已更新: ${orderID}`);
            }
          }
          // 如果只是修改日期/房間數，也要重新同步日曆
          else if (updates.checkIn || updates.checkOut || updates.rooms || updates.extraBeds) {
            const paidStatus = order.status === '預定中' || order.status === '已付訂' || order.status === '已預訂' || order.status === '已成立';
            if (typeof CalendarService !== 'undefined' && paidStatus) {
              // 先刪除舊的
              if (order.publicCalendarEventID || order.housekeepingCalendarEventID) {
                CalendarService.deleteCalendarEvents(order);
              }
              // 重新建立（用更新後的資料）
              const updatedOrder = DataStore.getOrderByID(orderID);
              CalendarService.syncOrderToCalendars(updatedOrder);
              Logger.log(`📅 訂單資訊已更新，日曆已同步: ${orderID}`);
            }
          }

          result.message = '訂單已更新並同步日曆';
        } catch (calendarError) {
          Logger.log(`⚠️ 日曆同步失敗但訂單已更新: ${calendarError.message}`);
          result.message = '訂單已更新，但日曆同步失敗';
        }
      }
    } else if (action === 'generateNotification') {
      const orderID = requestData.orderID;
      const changeType = requestData.changeType || '訂單更新';

      const order = DataStore.getOrderByID(orderID);
      if (!order) {
        result = { success: false, error: '找不到訂單' };
      } else {
        result = {
          success: true,
          lineText: generateLineNotification(order, changeType),
          hasEmail: !!order.email,
        };
      }
    } else if (action === 'sendNotificationEmail') {
      const orderID = requestData.orderID;
      const order = DataStore.getOrderByID(orderID);

      if (!order || !order.email) {
        result = { success: false, error: '客人未提供 Email' };
      } else {
        if (typeof EmailService !== 'undefined') {
          result = EmailService.sendConfirmationEmail(order);
        } else {
          result = { success: false, error: 'EmailService 未定義' };
        }
      }
    } else if (action === 'markCompletedOrders') {
      // 1) 舊狀態統一改為「預定中」 2) 退房日已過的預定中改為「已完成」
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const orders = DataStore.getOrders();
      const legacyPaid = ['已付訂', '已預訂', '已成立'];
      let migrated = 0;
      let marked = 0;
      orders.forEach((order) => {
        if (legacyPaid.includes(order.status)) {
          const r = DataStore.updateOrder(order.orderID, { status: '預定中' });
          if (r.success) migrated++;
        }
      });
      // 重新讀取（若有剛被 migrate 的）
      const ordersAfter = migrated > 0 ? DataStore.getOrders() : orders;
      ordersAfter.forEach((order) => {
        if (order.status !== '預定中') return;
        const checkOut = new Date(order.checkOut);
        checkOut.setHours(0, 0, 0, 0);
        if (checkOut < today) {
          const r = DataStore.updateOrder(order.orderID, { status: '已完成' });
          if (r.success) marked++;
        }
      });
      result = { success: true, migrated, marked };
    }

    // ==========================================
    // 🆕 日曆管理 API
    // ==========================================
    else if (action === 'rebuildCalendars') {
      // 重建日曆
      try {
        Logger.log('🔄 開始重建日曆...');

        // Step 1: 清空
        CalendarManager.clearAllCalendars();

        // Step 2: 讀取所有有效訂單
        const orders = DataStore.getOrders();
        const validOrders = orders.filter((order) => order.status === '預定中' || ['已付訂', '已預訂', '已成立'].includes(order.status));

        Logger.log(`找到 ${validOrders.length} 筆有效訂單`);

        // Step 3: 逐筆重建
        let successCount = 0;
        let rejectedCount = 0;

        validOrders.forEach((order, index) => {
          Logger.log(`處理第 ${index + 1}/${validOrders.length} 筆: ${order.orderID}`);

          const syncResult = CalendarManager.syncOrderToCalendars(order);
          if (syncResult.success) {
            successCount++;
          } else {
            rejectedCount++;
          }

          // 每 10 筆暫停一下，避免超時
          if (index % 10 === 0 && index > 0) {
            Utilities.sleep(100);
          }
        });

        Logger.log(`✅ 重建完成：成功 ${successCount} 筆，拒絕 ${rejectedCount} 筆`);

        result = {
          success: true,
          successCount: successCount,
          rejectedCount: rejectedCount,
          total: validOrders.length,
        };
      } catch (error) {
        Logger.log('❌ 重建日曆失敗:', error);
        result = { success: false, error: error.message };
      }
    } else if (action === 'clearCalendars') {
      // 清空日曆
      try {
        Logger.log('🗑️ 開始清空日曆...');

        const currentYear = new Date().getFullYear();
        const startDate = new Date(currentYear - 3, 0, 1);
        const endDate = new Date(currentYear + 3, 11, 31);

        // 清空公開日曆
        const publicCal = CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
        const publicEvents = publicCal.getEvents(startDate, endDate);
        publicEvents.forEach((event) => event.deleteEvent());

        // 清空房務日曆
        const housekeepingCal = CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
        const housekeepingEvents = housekeepingCal.getEvents(startDate, endDate);
        housekeepingEvents.forEach((event) => event.deleteEvent());

        const totalDeleted = publicEvents.length + housekeepingEvents.length;

        Logger.log(`✅ 清空完成：共刪除 ${totalDeleted} 個事件`);

        result = {
          success: true,
          deletedCount: totalDeleted,
        };
      } catch (error) {
        Logger.log('❌ 清空日曆失敗:', error);
        result = { success: false, error: error.message };
      }
    } else if (action === 'cleanupOldYear') {
      // 清理去年的事件
      try {
        result = CalendarManager.cleanupOldYearEvents();
      } catch (error) {
        Logger.log('❌ 清理去年事件失敗:', error);
        result = { success: false, error: error.message };
      }
    }

    // ==========================================
    // 未知操作
    // ==========================================
    else {
      result = { success: false, error: '未知的操作: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (error) {
    Logger.log('❌ doPost 錯誤:', error);
    Logger.log('錯誤堆疊:', error.stack);
    
    if (typeof LoggerService !== 'undefined') {
      LoggerService.logError(error, 'doPost');
    }
    
    // 對外僅回傳一般性錯誤訊息，避免洩漏內部細節
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: '系統忙碌或發生錯誤，請稍後再試或聯繫民宿',
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 處理 GET 請求
 * ✅ 支援：Admin 後台、房務介面
 * ✅ 新增：getBookedDates（公開 API）
 * ✅ 新增：getCalendarStats（日曆統計）
 */
function doGet(e) {
  try {
    const page = e.parameter.page;
    const action = e.parameter.action;

    // 對需要 Admin 權限的 GET API 做金鑰檢查
    // （公開 API：getBookedDates / checkAvailability / 健康檢查則不檢查）
    if (action && isAdminAction(action)) {
      const adminKey = e.parameter.adminKey;
      if (!isValidAdminKey(adminKey)) {
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: '未授權的存取',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 🆕 日曆統計 API
    // ==========================================
    if (action === 'getCalendarStats') {
      try {
        const stats = CalendarManager.getCalendarStats();
        return ContentService.createTextOutput(
          JSON.stringify({
            success: true,
            ...stats,
          })
        ).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        Logger.log('❌ 取得日曆統計失敗:', error);
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: error.message,
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 🆕 公開 API - 取得已訂走的日期
    // ==========================================
    if (action === 'getBookedDates') {
      return getBookedDates();
    }

    // ==========================================
    // 🆕 公開 API - 即時可訂性檢查
    // ==========================================
    if (action === 'checkAvailability') {
      try {
        const checkIn = e.parameter.checkIn;
        const checkOut = e.parameter.checkOut;

        if (!checkIn || !checkOut) {
          return ContentService.createTextOutput(
            JSON.stringify({
              available: true,
              message: '缺少日期參數',
            })
          ).setMimeType(ContentService.MimeType.JSON);
        }

        const existingOrders = DataStore.getOrders();
        const newBooking = { checkIn, checkOut };
        const conflicts = [];

        const newStart = new Date(checkIn).getTime();
        const newEnd = new Date(checkOut).getTime();
        const validStatuses = ['待確認', '預定中', '已付訂', '已預訂', '已成立'];

        for (const order of existingOrders) {
          if (!validStatuses.includes(order.status)) continue;
          const existingStart = new Date(order.checkIn).getTime();
          const existingEnd = new Date(order.checkOut).getTime();
          if (newStart < existingEnd && newEnd > existingStart) {
            conflicts.push({ checkIn: order.checkIn, checkOut: order.checkOut });
          }
        }

        return ContentService.createTextOutput(
          JSON.stringify({
            available: conflicts.length === 0,
            conflicts: conflicts,
          })
        ).setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        return ContentService.createTextOutput(
          JSON.stringify({
            available: true,
            error: error.message,
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 顯示 Admin 後台（由 GAS 注入 API 網址與金鑰，無需 config.js）
    // ==========================================
    if (page === 'admin') {
      var adminTpl = HtmlService.createTemplateFromFile('admin');
      var adminUrl = ScriptApp.getService().getUrl();
      adminTpl.configJson = JSON.stringify({
        API_URL: adminUrl,
        API_URL_ADMIN: adminUrl,
        API_URL_PUBLIC: '',
        ADMIN_API_KEY: Config.ADMIN_API_KEY || '',
      });
      return adminTpl
        .evaluate()
        .setTitle('雫旅訂房管理後台')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // ==========================================
    // 顯示房務介面（由 GAS 注入設定，無需 config.js）
    // ==========================================
    if (page === 'housekeeping') {
      var hkTpl = HtmlService.createTemplateFromFile('housekeeping');
      var hkUrl = ScriptApp.getService().getUrl();
      hkTpl.configJson = JSON.stringify({
        API_URL: hkUrl,
        API_URL_ADMIN: hkUrl,
        API_URL_PUBLIC: '',
        ADMIN_API_KEY: Config.ADMIN_API_KEY || '',
      });
      return hkTpl
        .evaluate()
        .setTitle('雫旅房務日程')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // ==========================================
    // API 請求：取得所有訂單
    // ==========================================
    if (action === 'getAllOrders') {
      try {
        const allOrders = DataStore.getOrders();
        return ContentService.createTextOutput(JSON.stringify(allOrders)).setMimeType(
          ContentService.MimeType.JSON
        );
      } catch (err) {
        Logger.log('❌ getAllOrders 錯誤:', err);
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: err.message || '讀取訂單失敗',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // ==========================================
    // 預設：健康檢查
    // ==========================================
    const status = {
      status: 'Alive',
      message: '雫旅 DROP INN API is running! 🚀',
      time: new Date().toISOString(),
      timestamp: new Date().getTime(),
      endpoints: {
        admin: '?page=admin',
        housekeeping: '?page=housekeeping',
        api: '?action=getAllOrders',
        calendar: '?action=getBookedDates',
        calendarStats: '?action=getCalendarStats',
      },
    };

    return ContentService.createTextOutput(JSON.stringify(status, null, 2)).setMimeType(
      ContentService.MimeType.JSON
    );
  } catch (error) {
    Logger.log('❌ doGet 錯誤:', error);
    Logger.log('錯誤堆疊:', error.stack);
    
    if (typeof LoggerService !== 'undefined') {
      LoggerService.logError(error, 'doGet');
    }
    
    // 對外僅回傳一般性錯誤訊息
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: '系統忙碌或發生錯誤，請稍後再試或聯繫民宿',
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 🆕 取得已訂走的日期列表（公開 API）
 * ⚠️ 注意：只返回日期，不包含任何個人資訊
 */
function getBookedDates() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const currentYear = today.getFullYear();
    const yearEnd = new Date(currentYear, 11, 31);

    // 取得所有已確認的訂單
    const orders = DataStore.getOrders();
    const confirmedOrders = orders.filter((order) => order.status === '預定中' || ['已付訂', '已預訂', '已成立'].includes(order.status));

    // 收集所有已訂走的日期
    const bookedDates = new Set();

    confirmedOrders.forEach((order) => {
      const checkIn = new Date(order.checkIn);
      const checkOut = new Date(order.checkOut);

      // 只包含「今天到年底」的訂單
      if (checkOut < today || checkIn > yearEnd) {
        return; // 跳過
      }

      // 生成該訂單的所有日期
      let currentDate = new Date(checkIn);

      while (currentDate < checkOut) {
        // 只加入「今天到年底」的日期
        if (currentDate >= today && currentDate <= yearEnd) {
          const dateStr = currentDate.toISOString().split('T')[0];
          bookedDates.add(dateStr);
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // 轉換成陣列並排序
    const dates = Array.from(bookedDates).sort();

    Logger.log(`📅 已訂走日期數量: ${dates.length}`);

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        dates: dates,
        count: dates.length,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('❌ getBookedDates 錯誤:', error);
    return ContentService.createTextOutput(
      JSON.stringify({
        success: false,
        error: error.message,
      })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * 生成 LINE 通知文字
 */
function generateLineNotification(order, changeType) {
  try {
    const nights = Math.ceil(
      (new Date(order.checkOut) - new Date(order.checkIn)) / (1000 * 60 * 60 * 24)
    );
    const bedsInfo = order.extraBeds > 0 ? ` + ${order.extraBeds} 加床` : '';

    let notificationText = `Hihi ${order.name} 👋

您的訂單已更新（${changeType}）

📋 訂單編號：${order.orderID}
📅 入住日期：${order.checkIn}
📅 退房日期：${order.checkOut}
🏠 包棟規模：${order.rooms} 間房${bedsInfo}
💰 費用總計：NT$ ${order.totalPrice.toLocaleString()}
`;

    // 如果有訂金資訊
    if (order.paidDeposit && order.paidDeposit > 0) {
      notificationText += `
💳 付款資訊
已付訂金：NT$ ${order.paidDeposit.toLocaleString()}
剩餘尾款：NT$ ${order.remainingBalance.toLocaleString()}
`;
    }

    notificationText += `
期待您的到來 ✨

━━━━━━━━━━━━━
雫旅 Drop Inn | 澎湖包棟民宿`;

    return notificationText.trim();
  } catch (error) {
    Logger.log('❌ 生成 LINE 通知文字失敗:', error);
    return `Hihi ${order.name}，您的訂單 ${order.orderID} 已更新。`;
  }
}

/**
 * 測試 API 端點（開發用）
 */
function testDoGet() {
  const mockEvent = {
    parameter: {},
  };

  const response = doGet(mockEvent);
  const content = response.getContent();

  Logger.log('=== API 健康檢查測試 ===');
  Logger.log(content);
  Logger.log('');

  const parsed = JSON.parse(content);

  if (parsed.status === 'Alive') {
    Logger.log('✅ API 運作正常');
    Logger.log('');
    Logger.log('可用端點：');
    Logger.log('  - Admin 後台: ' + ScriptApp.getService().getUrl() + '?page=admin');
    Logger.log('  - 房務介面: ' + ScriptApp.getService().getUrl() + '?page=housekeeping');
    Logger.log('  - 公開日曆: ' + ScriptApp.getService().getUrl() + '?action=getBookedDates');
    Logger.log('  - 日曆統計: ' + ScriptApp.getService().getUrl() + '?action=getCalendarStats');
  } else {
    Logger.log('❌ API 異常');
  }
}

/**
 * 測試日曆管理 API（開發用）
 */
function testCalendarAPIs() {
  Logger.log('=== 測試日曆管理 API ===');
  Logger.log('');

  // 測試 1: 日曆統計
  Logger.log('📊 測試 1: 日曆統計');
  try {
    const stats = CalendarManager.getCalendarStats();
    Logger.log(`✅ 公開日曆: ${stats.publicCount} 個事件`);
    Logger.log(`✅ 房務日曆: ${stats.housekeepingCount} 個事件`);
  } catch (error) {
    Logger.log('❌ 日曆統計失敗:', error.message);
  }

  Logger.log('');
  Logger.log('✅ 測試完成');
}

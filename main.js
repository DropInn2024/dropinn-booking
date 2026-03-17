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
    'getOrderByID',
    'updateOrder',
    'updateOrderAndSync',
    'markCompletedOrders',
    'generateNotification',
    'sendNotificationEmail',
    'rebuildCalendars',
    'clearCalendars',
    'cleanupOldYear',
    'getFinanceStats',
    'getDetailedFinanceReport',
    'getCostForOrder',
    'getCoupons',
    'saveCoupon',
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
    if (action === 'checkCoupon') {
      const code = requestData.code;
      const originalTotal = Number(requestData.originalTotal) || 0;
      result = typeof checkCoupon === 'function' ? checkCoupon(code, originalTotal) : { valid: false, message: '服務未就緒' };
    } else if (action === 'createBooking') {
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
      result = updateOrderAndSyncInternal(orderID, updates);
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
      result = sendNotificationEmailInternal(orderID);
    } else if (action === 'markCompletedOrders') {
      result = markCompletedOrdersInternal();
    }

    // ==========================================
    // 🆕 日曆管理 API
    // ==========================================
    else if (action === 'rebuildCalendars') {
      // 重建日曆
      result = rebuildCalendarsInternal();
    } else if (action === 'clearCalendars') {
      // 清空日曆
      result = clearCalendarsInternal();
    } else if (action === 'cleanupOldYear') {
      // 清理去年的事件
      result = cleanupOldYearInternal();
    } else if (action === 'getFinanceStats') {
      const year = requestData.year ? Number(requestData.year) : new Date().getFullYear();
      const month = requestData.month != null ? Number(requestData.month) : 0;
      result = getFinanceStatsInternal(year, month);
    } else if (action === 'getCostForOrder') {
      const orderID = requestData.orderID;
      const year = requestData.year != null ? Number(requestData.year) : new Date().getFullYear();
      result = getCostForOrderInternal(orderID, year);
    } else if (action === 'getDetailedFinanceReport') {
      const year = requestData.year ? Number(requestData.year) : new Date().getFullYear();
      const month = requestData.month != null ? Number(requestData.month) : 0;
      result = getDetailedFinanceReportInternal(year, month);
    } else if (action === 'getCoupons') {
      result = { success: true, coupons: DataStore.getCoupons() };
    } else if (action === 'saveCoupon') {
      result = saveCouponInternal(requestData.coupon);
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
    // Admin API：取得所有訂單（GET）
    // ==========================================
    if (action === 'getAllOrders') {
      const adminKey = e && e.parameter && e.parameter.adminKey;
      if (!isValidAdminKey(adminKey)) {
        return ContentService.createTextOutput(
          JSON.stringify({
            success: false,
            error: '未授權的存取',
          })
        ).setMimeType(ContentService.MimeType.JSON);
      }

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
    // 取得所有訂單
    const orders = DataStore.getOrders();

    // 依狀態拆成兩組：預定中（booked）、待確認（pending）
    const bookedSet = new Set();
    const pendingSet = new Set();

    function expandDates(checkIn, checkOut) {
      const dates = [];
      if (!checkIn || !checkOut) return dates;
      let cur = new Date(checkIn);
      const end = new Date(checkOut);
      if (isNaN(cur.getTime()) || isNaN(end.getTime())) return dates;
      cur.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      while (cur < end) {
        dates.push(cur.toISOString().slice(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
      return dates;
    }

    orders.forEach((order) => {
      const dates = expandDates(order.checkIn, order.checkOut);
      if (!dates.length) return;

      if (order.status === '預定中') {
        dates.forEach((d) => bookedSet.add(d));
      } else if (order.status === '待確認') {
        dates.forEach((d) => pendingSet.add(d));
      }
    });

    const booked = Array.from(bookedSet).sort();
    const pending = Array.from(pendingSet).sort();

    Logger.log(`📅 預定中日期數量: ${booked.length}, 待確認日期數量: ${pending.length}`);

    return ContentService.createTextOutput(
      JSON.stringify({
        success: true,
        booked: booked,
        pending: pending,
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
 * ================================
 * Admin 專用內部邏輯（給 doPost & google.script.run 共用）
 * ================================
 */
function updateOrderAndSyncInternal(orderID, updates) {
  const orderBefore = DataStore.getOrderByID(orderID);
  // 成本表欄位不寫入訂單表，稍後單獨寫入支出_YYYY
  const costOnly = {
    rebateAmount: updates.rebateAmount,
    complimentaryAmount: updates.complimentaryAmount,
    otherCost: updates.otherCost,
    note: updates.costNote != null ? updates.costNote : updates.note,
  };
  const orderUpdates = { ...updates };
  delete orderUpdates.rebateAmount;
  delete orderUpdates.complimentaryAmount;
  delete orderUpdates.otherCost;
  delete orderUpdates.costNote;

  let result = DataStore.updateOrder(orderID, orderUpdates);

  if (!result.success) {
    return result;
  }

  // 寫回成本表該列（若有傳成本欄位）
  if (
    costOnly.rebateAmount !== undefined ||
    costOnly.complimentaryAmount !== undefined ||
    costOnly.otherCost !== undefined ||
    costOnly.note !== undefined
  ) {
    const order = DataStore.getOrderByID(orderID);
    const year = order && order.checkIn ? new Date(order.checkIn).getFullYear() : new Date().getFullYear();
    DataStore.updateCostRowByOrderID(orderID, year, costOnly);
  }

  try {
    const order = DataStore.getOrderByID(orderID);
    const prevStatus = orderBefore ? orderBefore.status : '';

    // 狀態改為「已取消」→ 刪除日曆、成本表該列清 0、寄取消信＋管理員信
    if (updates.status === '已取消') {
      if (typeof CalendarService !== 'undefined') {
        CalendarService.deleteCalendarEvents(order);
        Logger.log('🗑️ 訂單已取消，日曆已清除: ' + orderID);
      }
      const year = order.checkIn ? new Date(order.checkIn).getFullYear() : new Date().getFullYear();
      DataStore.clearCostRowForOrder(orderID, year);
      if (typeof EmailService !== 'undefined') {
        try {
          EmailService.sendCancelEmail(order);
          EmailService.sendAdminStatusNotification(order, '已取消');
        } catch (e) {
          Logger.log('⚠️ 取消信發送失敗: ' + e.message);
        }
      }
    }
    // 狀態改為「預定中」或舊的付訂狀態 → 同步日曆、首次變預定中則寄確認信＋管理員信
    else if (
      updates.status === '預定中' ||
      updates.status === '已付訂' ||
      updates.status === '已預訂' ||
      updates.status === '已成立'
    ) {
      if (typeof CalendarService !== 'undefined') {
        if (order.publicCalendarEventID || order.housekeepingCalendarEventID) {
          CalendarService.deleteCalendarEvents(order);
        }
        CalendarService.syncOrderToCalendars(order);
        Logger.log('📅 訂單日曆已更新: ' + orderID);
      }
      if (updates.status === '預定中' && prevStatus !== '預定中' && prevStatus !== '已付訂' && prevStatus !== '已預訂' && prevStatus !== '已成立') {
        if (typeof EmailService !== 'undefined') {
          try {
            EmailService.sendConfirmationEmail(order);
            EmailService.sendAdminStatusNotification(order, '預定中');
          } catch (e) {
            Logger.log('⚠️ 確認信發送失敗: ' + e.message);
          }
        }
      }
    }
    // 只是改日期 / 房數 / 加床 → 若狀態為已付訂類型，也要同步日曆
    else if (updates.checkIn || updates.checkOut || updates.rooms || updates.extraBeds) {
      const paidStatus =
        order.status === '預定中' ||
        order.status === '已付訂' ||
        order.status === '已預訂' ||
        order.status === '已成立';
      if (typeof CalendarService !== 'undefined' && paidStatus) {
        if (order.publicCalendarEventID || order.housekeepingCalendarEventID) {
          CalendarService.deleteCalendarEvents(order);
        }
        const updatedOrder = DataStore.getOrderByID(orderID);
        CalendarService.syncOrderToCalendars(updatedOrder);
        Logger.log('📅 訂單資訊已更新，日曆已同步: ' + orderID);
      }
    }

    result.message = '訂單已更新並同步日曆';
  } catch (calendarError) {
    Logger.log('⚠️ 日曆同步失敗但訂單已更新: ' + calendarError.message);
    result.message = '訂單已更新，但日曆同步失敗';
  }

  return result;
}

function sendNotificationEmailInternal(orderID) {
  const order = DataStore.getOrderByID(orderID);

  if (!order || !order.email) {
    return { success: false, error: '客人未提供 Email' };
  }

  if (typeof EmailService !== 'undefined') {
    return EmailService.sendConfirmationEmail(order);
  }

  return { success: false, error: 'EmailService 未定義' };
}

function markCompletedOrdersInternal() {
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

  return { success: true, migrated, marked };
}

function rebuildCalendarsInternal() {
  try {
    Logger.log('🔄 開始重建日曆...');

    CalendarManager.clearAllCalendars();

    const orders = DataStore.getOrders();
    const validOrders = orders.filter(
      (order) =>
        order.status === '預定中' ||
        ['已付訂', '已預訂', '已成立'].indexOf(order.status) !== -1
    );

    Logger.log('找到 ' + validOrders.length + ' 筆有效訂單');

    let successCount = 0;
    let rejectedCount = 0;

    validOrders.forEach((order, index) => {
      Logger.log('處理第 ' + (index + 1) + '/' + validOrders.length + ' 筆: ' + order.orderID);

      const syncResult = CalendarManager.syncOrderToCalendars(order);
      if (syncResult.success) {
        successCount++;
      } else {
        rejectedCount++;
      }

      if (index % 10 === 0 && index > 0) {
        Utilities.sleep(100);
      }
    });

    Logger.log(
      '✅ 重建完成：成功 ' + successCount + ' 筆，拒絕 ' + rejectedCount + ' 筆'
    );

    return {
      success: true,
      successCount: successCount,
      rejectedCount: rejectedCount,
      total: validOrders.length,
    };
  } catch (error) {
    Logger.log('❌ 重建日曆失敗:', error);
    return { success: false, error: error.message };
  }
}

function clearCalendarsInternal() {
  try {
    Logger.log('🗑️ 開始清空日曆...');

    const currentYear = new Date().getFullYear();
    const startDate = new Date(currentYear - 3, 0, 1);
    const endDate = new Date(currentYear + 3, 11, 31);

    const publicCal = CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
    const publicEvents = publicCal.getEvents(startDate, endDate);
    publicEvents.forEach((event) => event.deleteEvent());

    const housekeepingCal = CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
    const housekeepingEvents = housekeepingCal.getEvents(startDate, endDate);
    housekeepingEvents.forEach((event) => event.deleteEvent());

    const totalDeleted = publicEvents.length + housekeepingEvents.length;

    Logger.log('✅ 清空完成：共刪除 ' + totalDeleted + ' 個事件');

    return {
      success: true,
      deletedCount: totalDeleted,
    };
  } catch (error) {
    Logger.log('❌ 清空日曆失敗:', error);
    return { success: false, error: error.message };
  }
}

function cleanupOldYearInternal() {
  try {
    return CalendarManager.cleanupOldYearEvents();
  } catch (error) {
    Logger.log('❌ 清理去年事件失敗:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 財務報表：依年度（可選月份）彙總
 * @param {number} year - 年份
 * @param {number} [month] - 0 或省略＝全年；1–12＝只算該月入住的訂單
 */
function getFinanceStatsInternal(year, month) {
  try {
    const orders = DataStore.getOrders(null, year);
    let revenueOrders = orders.filter((o) => o.status === '預定中' || o.status === '已完成');
    if (month && month >= 1 && month <= 12) {
      revenueOrders = revenueOrders.filter((o) => {
        if (!o.checkIn) return false;
        const m = new Date(o.checkIn).getMonth() + 1;
        return m === month;
      });
    }
    let revenue = 0;
    let totalDeposit = 0;
    let totalBalance = 0;
    let totalDiscount = 0;
    let orderCount = 0;
    let returningCount = 0;
    let addonTotal = 0;
    let extraIncomeTotal = 0;
    revenueOrders.forEach((o) => {
      revenue += Number(o.totalPrice) || 0;
      totalDeposit += Number(o.paidDeposit) || 0;
      totalBalance += Number(o.remainingBalance) || 0;
      totalDiscount += Number(o.discountAmount) || 0;
      addonTotal += Number(o.addonAmount) || 0;
      extraIncomeTotal += Number(o.extraIncome) || 0;
      orderCount += 1;
      if (o.isReturningGuest) returningCount += 1;
    });
    const costOrderIDs = {};
    revenueOrders.forEach((o) => { costOrderIDs[String(o.orderID)] = true; });
    const costs = DataStore.getCostRows(year);
    let rebateTotal = 0;
    let complimentaryTotal = 0;
    let otherCostTotal = 0;
    costs.forEach((r) => {
      if (!costOrderIDs[String(r.orderID)]) return;
      rebateTotal += Number(r.rebateAmount) || 0;
      complimentaryTotal += Number(r.complimentaryAmount) || 0;
      otherCostTotal += Number(r.otherCost) || 0;
    });
    const costTotal = rebateTotal + complimentaryTotal + otherCostTotal;
    const netIncome = revenue + extraIncomeTotal - costTotal;
    return {
      success: true,
      year: year,
      month: month || null,
      revenue: revenue,
      totalDeposit: totalDeposit,
      totalBalance: totalBalance,
      totalDiscount: totalDiscount,
      addonTotal: addonTotal,
      extraIncomeTotal: extraIncomeTotal,
      orderCount: orderCount,
      returningCount: returningCount,
      rebateTotal: rebateTotal,
      complimentaryTotal: complimentaryTotal,
      otherCostTotal: otherCostTotal,
      costTotal: costTotal,
      netIncome: netIncome,
    };
  } catch (error) {
    Logger.log('❌ getFinanceStats 錯誤:', error);
    return { success: false, error: error.message };
  }
}

function getCostForOrderInternal(orderID, year) {
  try {
    const cost = DataStore.getCostByOrderID(orderID, year || new Date().getFullYear());
    return { success: true, cost: cost };
  } catch (e) {
    Logger.log('❌ getCostForOrder 錯誤:', e);
    return { success: false, error: e.message };
  }
}

/**
 * 詳細財務報表：可選月份；含完整摘要、分月、同業退佣、訂單明細
 * 淨利 = 房間營收 + 其他收入 - 退佣 - 招待 - 其他支出（代訂代收不計入）
 * @param {number} year
 * @param {number} [month] - 0 或省略＝全年；1–12＝只回該月
 */
function getDetailedFinanceReportInternal(year, month) {
  try {
    const y = year || new Date().getFullYear();
    const orders = DataStore.getOrders(null, y);
    let revenueOrders = orders.filter((o) => o.status === '預定中' || o.status === '已完成');
    if (month && month >= 1 && month <= 12) {
      revenueOrders = revenueOrders.filter((o) => {
        if (!o.checkIn) return false;
        return new Date(o.checkIn).getMonth() + 1 === month;
      });
    }
    const costs = DataStore.getCostRows(y);
    const costByOrderID = {};
    costs.forEach((r) => {
      costByOrderID[String(r.orderID)] = r;
    });

    const monthly = {};
    const byAgency = {};
    let summary = {
      revenue: 0,
      totalDeposit: 0,
      totalBalance: 0,
      totalDiscount: 0,
      returningCount: 0,
      addonTotal: 0,
      extraIncomeTotal: 0,
      rebateTotal: 0,
      complimentaryTotal: 0,
      otherCostTotal: 0,
    };

    revenueOrders.forEach((o) => {
      const checkIn = o.checkIn ? new Date(o.checkIn) : new Date();
      const monthKey = checkIn.getFullYear() + '-' + String(checkIn.getMonth() + 1).padStart(2, '0');
      if (!monthly[monthKey]) {
        monthly[monthKey] = {
          month: monthKey,
          revenue: 0,
          totalDeposit: 0,
          totalBalance: 0,
          totalDiscount: 0,
          addonTotal: 0,
          extraIncomeTotal: 0,
          rebateTotal: 0,
          complimentaryTotal: 0,
          otherCostTotal: 0,
        };
      }
      const rev = Number(o.totalPrice) || 0;
      const disc = Number(o.discountAmount) || 0;
      const addon = Number(o.addonAmount) || 0;
      const extra = Number(o.extraIncome) || 0;
      summary.revenue += rev;
      summary.totalDeposit += Number(o.paidDeposit) || 0;
      summary.totalBalance += Number(o.remainingBalance) || 0;
      summary.totalDiscount += disc;
      if (o.isReturningGuest) summary.returningCount += 1;
      summary.addonTotal += addon;
      summary.extraIncomeTotal += extra;
      monthly[monthKey].revenue += rev;
      monthly[monthKey].totalDeposit += Number(o.paidDeposit) || 0;
      monthly[monthKey].totalBalance += Number(o.remainingBalance) || 0;
      monthly[monthKey].totalDiscount += disc;
      monthly[monthKey].addonTotal += addon;
      monthly[monthKey].extraIncomeTotal += extra;
      const c = costByOrderID[String(o.orderID)];
      if (c) {
        const rb = Number(c.rebateAmount) || 0;
        const comp = Number(c.complimentaryAmount) || 0;
        const other = Number(c.otherCost) || 0;
        summary.rebateTotal += rb;
        summary.complimentaryTotal += comp;
        summary.otherCostTotal += other;
        monthly[monthKey].rebateTotal += rb;
        monthly[monthKey].complimentaryTotal += comp;
        monthly[monthKey].otherCostTotal += other;
      }
      const agency = (o.agencyName || '').trim() || '直客';
      if (!byAgency[agency]) byAgency[agency] = { agencyName: agency, totalRebate: 0, orderCount: 0 };
      byAgency[agency].orderCount += 1;
      if (c) byAgency[agency].totalRebate += Number(c.rebateAmount) || 0;
    });

    summary.costTotal = summary.rebateTotal + summary.complimentaryTotal + summary.otherCostTotal;
    summary.netIncome = summary.revenue + summary.extraIncomeTotal - summary.costTotal;
    summary.orderCount = revenueOrders.length;

    const monthlyList = Object.keys(monthly).sort().map((k) => {
      const m = monthly[k];
      const costTotal = m.rebateTotal + m.complimentaryTotal + m.otherCostTotal;
      const netIncome = m.revenue + m.extraIncomeTotal - costTotal;
      return { ...m, costTotal, netIncome };
    });

    const byAgencyList = Object.keys(byAgency).map((k) => byAgency[k]);

    const ordersWithCost = revenueOrders.map((o) => {
      const c = costByOrderID[String(o.orderID)] || {};
      return {
        ...o,
        rebateAmount: c.rebateAmount != null ? c.rebateAmount : 0,
        complimentaryAmount: c.complimentaryAmount != null ? c.complimentaryAmount : 0,
        otherCost: c.otherCost != null ? c.otherCost : 0,
        costNote: c.note != null ? c.note : '',
      };
    });

    return {
      success: true,
      year: y,
      month: month || null,
      summary: summary,
      monthly: monthlyList,
      byAgency: byAgencyList,
      orders: ordersWithCost,
    };
  } catch (error) {
    Logger.log('❌ getDetailedFinanceReport 錯誤:', error);
    return { success: false, error: error.message };
  }
}

function saveCouponInternal(coupon) {
  if (!coupon || !coupon.code) {
    return { success: false, error: '折扣碼代碼不可為空' };
  }
  return DataStore.saveCoupon(coupon);
}

/**
 * ================================
 * Admin 專用：給 google.script.run 呼叫的入口
 * ================================
 */
function adminGetAllOrders() {
  var orders = DataStore.getOrders();
  // 強制轉為純 JSON，避免 GAS 在遇到日期/特殊型別時序列化失敗
  return JSON.parse(JSON.stringify(orders));
}

function adminCreateBooking(data) {
  // 後台人工建立，不需要 reCAPTCHA
  return BookingService.handleCreateOrder(data);
}

function adminUpdateOrderAndSync(orderID, updates) {
  return updateOrderAndSyncInternal(orderID, updates);
}

function adminGenerateNotification(orderID, changeType) {
  const order = DataStore.getOrderByID(orderID);
  if (!order) {
    return { success: false, error: '找不到訂單' };
  }
  return {
    success: true,
    lineText: generateLineNotification(order, changeType || '訂單更新'),
    hasEmail: !!order.email,
  };
}

function adminSendNotificationEmail(orderID) {
  return sendNotificationEmailInternal(orderID);
}

function adminMarkCompletedOrders() {
  return markCompletedOrdersInternal();
}

function adminGetCalendarStats() {
  const stats = CalendarManager.getCalendarStats();
  return {
    success: true,
    ...stats,
  };
}

function adminRebuildCalendars() {
  return rebuildCalendarsInternal();
}

function adminClearCalendars() {
  return clearCalendarsInternal();
}

function adminCleanupOldYear() {
  return cleanupOldYearInternal();
}

function adminGetFinanceStats(year, month) {
  const y = year || new Date().getFullYear();
  const m = month != null ? Number(month) : 0;
  return getFinanceStatsInternal(y, m === 0 ? undefined : m);
}

function adminGetCostForOrder(orderID, year) {
  return getCostForOrderInternal(orderID, year != null ? year : new Date().getFullYear());
}

function adminGetDetailedFinanceReport(year, month) {
  const y = year || new Date().getFullYear();
  const m = month != null ? Number(month) : 0;
  return getDetailedFinanceReportInternal(y, m === 0 ? undefined : m);
}

function adminGetCoupons() {
  return DataStore.getCoupons();
}

function adminSaveCoupon(coupon) {
  return saveCouponInternal(coupon);
}

/**
 * 後台「系統設定」用：一鍵執行日常初始化（建表／補欄、觸發器、狀態統一）
 */
function adminRunSetupSystem() {
  try {
    if (typeof setupSystem !== 'function') {
      return { success: false, error: 'setupSystem 未載入，請確認 setup.js 已加入專案' };
    }
    setupSystem();
    return { success: true, message: '日常初始化已完成' };
  } catch (e) {
    Logger.log('adminRunSetupSystem 錯誤:', e);
    return { success: false, error: (e && e.message) || String(e) };
  }
}

/**
 * 後台「系統設定」用：建立或補齊指定年份訂單表
 */
function adminInitializeYearSheet(year) {
  try {
    if (typeof initializeYearSheet !== 'function') {
      return { success: false, error: 'initializeYearSheet 未載入，請確認 setup.js 已加入專案' };
    }
    initializeYearSheet(year || new Date().getFullYear());
    return { success: true, message: '訂單表已建立或已補齊欄位' };
  } catch (e) {
    Logger.log('adminInitializeYearSheet 錯誤:', e);
    return { success: false, error: (e && e.message) || String(e) };
  }
}

/**
 * 後台「系統設定」用：檢查系統狀態（Properties、日曆、觸發器、工作表），回傳 JSON 供畫面顯示
 */
function adminQuickCheck() {
  try {
    const props = PropertiesService.getScriptProperties();
    const propKeys = ['SHEET_ID', 'RECAPTCHA_SECRET', 'PUBLIC_CALENDAR_ID', 'HOUSEKEEPING_CALENDAR_ID'];
    const properties = {};
    propKeys.forEach(function (k) {
      properties[k] = !!props.getProperty(k);
    });

    let calendars = { public: false, housekeeping: false };
    try {
      if (typeof Config !== 'undefined' && Config.PUBLIC_CALENDAR_ID) {
        CalendarApp.getCalendarById(Config.PUBLIC_CALENDAR_ID);
        calendars.public = true;
      }
    } catch (e) {}
    try {
      if (typeof Config !== 'undefined' && Config.HOUSEKEEPING_CALENDAR_ID) {
        CalendarApp.getCalendarById(Config.HOUSEKEEPING_CALENDAR_ID);
        calendars.housekeeping = true;
      }
    } catch (e) {}

    const triggers = ScriptApp.getProjectTriggers().map(function (t) {
      return { handler: t.getHandlerFunction(), type: (t.getEventType() && t.getEventType().toString()) || '' };
    });

    let sheets = [];
    try {
      const ss = DataStore.getDB();
      const allSheets = ss.getSheets();
      for (var i = 0; i < allSheets.length; i++) {
        var s = allSheets[i];
        sheets.push({ name: s.getName(), rows: s.getLastRow() || 0 });
      }
    } catch (e) {
      sheets = [{ name: '(錯誤)', rows: 0, error: (e && e.message) || String(e) }];
    }

    return {
      success: true,
      properties: properties,
      calendars: calendars,
      triggers: triggers,
      sheets: sheets,
    };
  } catch (e) {
    Logger.log('adminQuickCheck 錯誤:', e);
    return { success: false, error: (e && e.message) || String(e) };
  }
}

/**
 * 臨時測試：檢查 DataStore.getOrders() 回傳格式
 * （用於 debug google.script.run callback 沒觸發的問題）
 */
function testOrdersFormat() {
  var orders = DataStore.getOrders();
  Logger.log('筆數: ' + orders.length);
  if (orders.length > 0) {
    Logger.log('第一筆 keys: ' + Object.keys(orders[0]).join(', '));
    try {
      Logger.log('第一筆 JSON: ' + JSON.stringify(orders[0]));
    } catch (e) {
      Logger.log('第一筆 JSON.stringify 失敗: ' + e.message);
    }
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

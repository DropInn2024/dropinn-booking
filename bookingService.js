/**
 * bookingService.gs
 * 雫旅訂房系統 - 訂單處理服務
 * ✅ 已修復：衝突檢查包含「待確認」狀態
 * ✅ 新增：完整的輸入驗證
 */

/**
 * ========================================
 * 🆕 新增：輸入驗證函數
 * ========================================
 */
function validateBookingData(data) {
  // 1. 檢查必填欄位
  if (!data.checkIn || !data.checkOut) {
    throw new Error('入住和退房日期不能為空');
  }

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    throw new Error('姓名至少需要 2 個字');
  }

  if (!data.phone || !/^09\d{8}$/.test(data.phone)) {
    throw new Error('手機號碼格式不正確（需為 09 開頭的 10 碼數字）');
  }

  // 2. 檢查日期邏輯
  const checkIn = new Date(data.checkIn);
  const checkOut = new Date(data.checkOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
    throw new Error('日期格式不正確');
  }

  if (checkIn < today) {
    throw new Error('入住日期不能早於今天');
  }

  if (checkOut <= checkIn) {
    throw new Error('退房日期必須晚於入住日期');
  }

  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  if (nights < 2) {
    throw new Error('最少需要訂 2 晚');
  }

  if (nights > 30) {
    throw new Error('最多只能訂 30 晚');
  }

  // 3. 檢查房間數量
  if (!data.rooms || typeof data.rooms !== 'number' || data.rooms < 3 || data.rooms > 5) {
    throw new Error('房間數量必須在 3-5 之間');
  }

  // 4. 檢查加床數量
  if (typeof data.extraBeds !== 'number' || data.extraBeds < 0 || data.extraBeds > 2) {
    throw new Error('加床數量必須在 0-2 之間');
  }

  // 5. 檢查價格（防止前端竄改）
  const expectedPackagePrice = { 3: 10000, 4: 12000, 5: 15000 }[data.rooms];
  const expectedExtraBedPrice = data.extraBeds * 1000;
  const expectedTotal = (expectedPackagePrice + expectedExtraBedPrice) * nights;

  if (!data.totalPrice || Math.abs(data.totalPrice - expectedTotal) > 1) {
    throw new Error('價格計算錯誤，請重新整理頁面');
  }

  // 6. 檢查備註長度（防止惡意輸入）
  if (data.notes && data.notes.length > 500) {
    throw new Error('備註不能超過 500 字');
  }

  return true;
}

/**
 * 核心衝突檢查邏輯
 * ✅ 修正：加入「待確認」到檢查範圍
 */
function isConflict(newBooking, existingOrders) {
  const newStart = new Date(newBooking.checkIn).getTime();
  const newEnd = new Date(newBooking.checkOut).getTime();

  for (const order of existingOrders) {
    // ✅ 修正：「待確認」也要參與衝突檢查
    const validStatuses = ['待確認', '預定中', '已付訂', '已預訂', '已成立'];

    if (!validStatuses.includes(order.status)) {
      continue; // 跳過已取消或其他狀態
    }

    const existingStart = new Date(order.checkIn).getTime();
    const existingEnd = new Date(order.checkOut).getTime();

    // 檢查日期是否重疊
    if (newStart < existingEnd && newEnd > existingStart) {
      Logger.log(`🚫 發現衝突:`);
      Logger.log(`   新訂單: ${newBooking.checkIn} ~ ${newBooking.checkOut}`);
      Logger.log(
        `   衝突訂單: ${order.orderID} (${order.checkIn} ~ ${order.checkOut}, 狀態:${order.status})`
      );
      return true;
    }
  }
  return false;
}

const BookingService = {
  handleCreateOrder(bookingData) {
    const lock = LockService.getScriptLock();

    if (!lock.tryLock(10000)) {
      return { success: false, message: '系統忙碌中,請稍後再試' };
    }

    try {
      // ========================================
      // 🆕 新增：輸入驗證
      // ========================================
      try {
        validateBookingData(bookingData);
      } catch (validationError) {
        Logger.log(`⚠️ 輸入驗證失敗: ${validationError.message}`);
        return {
          success: false,
          message: validationError.message,
        };
      }

      Logger.log('📝 開始處理訂單:', bookingData);

      const existingOrders = DataStore.getOrders();
      Logger.log(`📊 目前有 ${existingOrders.length} 筆訂單`);

      // ✅ 衝突檢查
      if (isConflict(bookingData, existingOrders)) {
        return {
          success: false,
          conflict: true,
          message: '哎呀!慢了一步,該時段剛被預訂',
        };
      }

      const dateStr = bookingData.checkIn.replace(/-/g, '');
      const seq = DataStore.getNextSequence(dateStr);
      const orderID = `DROP-${dateStr}-${seq}`;

      const finalOrder = {
        ...bookingData,
        orderID: orderID,
        status: '待確認',
        timestamp: new Date(),
      };

      DataStore.createOrder(finalOrder);
      Logger.log(`✅ 訂單已建立: ${orderID}`);

      // Email 通知
      try {
        EmailService.sendNewOrderNotification(finalOrder);
        Logger.log(`📧 管理員通知已發送: ${orderID}`);
      } catch (emailError) {
        Logger.log(`⚠️ Email 發送失敗但不影響訂單: ${emailError.message}`);
      }

      // 日曆同步
      try {
        if (typeof CalendarService !== 'undefined') {
          CalendarService.syncOrderToCalendars(finalOrder);
          Logger.log(`📅 日曆同步完成: ${orderID}`);
        }
      } catch (calendarError) {
        Logger.log(`⚠️ 日曆同步失敗但不影響訂單: ${calendarError.message}`);
      }

      return {
        success: true,
        orderID: orderID,
        message: '預約成功!我們會盡快透過 LINE 與您聯繫確認',
      };
    } catch (error) {
      Logger.log(`❌ 建立訂單失敗:`, error);
      LoggerService.logError(error, 'handleCreateOrder');
      return {
        success: false,
        message: '系統錯誤,請稍後再試或聯繫客服',
      };
    } finally {
      lock.releaseLock();
    }
  },
};

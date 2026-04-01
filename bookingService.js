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
  // 防止 data 為 null / undefined 或非物件，避免直接讀取屬性時噴錯
  if (!data || typeof data !== 'object') {
    throw new Error('訂單資料格式錯誤，請重新整理頁面再試');
  }

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

  // 5. 檢查價格（支援折扣：原價與折後價一致或為折後價）
  //    與前端 getPackagePrice 保持一致：
  //    3 房 6 人 10,800 / 晚；4 房 8 人 12,800 / 晚；5 房 10 人 14,800 / 晚
  const expectedPackagePrice = { 3: 10800, 4: 12800, 5: 14800 }[data.rooms];
  const expectedExtraBedPrice = (data.extraBeds || 0) * 1000;
  const expectedOriginal = (expectedPackagePrice + expectedExtraBedPrice) * nights;

  const originalTotal = Number(data.originalTotal) || data.totalPrice;
  if (!originalTotal || Math.abs(originalTotal - expectedOriginal) > 1) {
    throw new Error('原價計算錯誤，請重新整理頁面');
  }
  const couponTrim = data.discountCode && String(data.discountCode).trim();
  if (!couponTrim) {
    const totalPrice = Number(data.totalPrice);
    const discountAmount = Number(data.discountAmount) || 0;
    if (!totalPrice || totalPrice < 0 || Math.abs(totalPrice - (originalTotal - discountAmount)) > 1) {
      throw new Error('折後金額錯誤，請重新整理頁面');
    }
    if (discountAmount !== 0) {
      throw new Error('折後金額錯誤，請重新整理頁面');
    }
  }
  // 有輸入優惠碼時，折抵由伺服器以 checkCoupon 計算，不驗證客戶端 totalPrice

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
    const validStatuses = ['洽談中', '已付訂'];

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

      const nights = Math.ceil(
        (new Date(bookingData.checkOut) - new Date(bookingData.checkIn)) / (1000 * 60 * 60 * 24)
      );
      const originalTotalNum = Number(bookingData.originalTotal) || 0;
      const couponTrim = bookingData.discountCode && String(bookingData.discountCode).trim();
      if (couponTrim) {
        if (typeof checkCoupon !== 'function') {
          return { success: false, message: '優惠碼服務未就緒，請稍後再試' };
        }
        const cr = checkCoupon(couponTrim, originalTotalNum, nights);
        if (!cr.valid) {
          return { success: false, message: cr.message || '優惠碼驗證失敗' };
        }
        bookingData.discountAmount = cr.discountAmount;
        bookingData.discountType = cr.discountType || '';
        bookingData.discountValue = cr.discountValue != null ? cr.discountValue : '';
        bookingData.totalPrice = originalTotalNum - cr.discountAmount;
      } else {
        bookingData.discountAmount = 0;
        bookingData.discountType = '';
        bookingData.discountValue = '';
        bookingData.totalPrice = originalTotalNum;
      }
      bookingData.remainingBalance = bookingData.totalPrice;

      Logger.log('📝 開始處理訂單:', bookingData);

      const existingOrders = DataStore.getOrders();
      Logger.log(`📊 目前有 ${existingOrders.length} 筆訂單`);

      // ✅ 衝突檢查
      if (isConflict(bookingData, existingOrders)) {
        return {
          success: false,
          conflict: true,
          message:
            '哎呀！慢了一步，該時段已被預訂。建議加入雫旅官方 LINE 與小幫手確認其他可選日期與房況。',
        };
      }

      const dateStr = bookingData.checkIn.replace(/-/g, '');
      const seq = DataStore.getNextSequence(dateStr);
      const orderID = `DROP-${dateStr}-${seq}`;

      // 老客人：同一手機曾有已付訂或完成的訂單
      const allOrders = DataStore.getOrders();
      const completedOrBooked = allOrders.filter(
        (o) => o.phone === bookingData.phone && (o.status === '已付訂' || o.status === '完成')
      );
      const isReturningGuest = completedOrBooked.length > 0;

      const finalOrder = {
        ...bookingData,
        orderID: orderID,
        status: '洽談中',
        timestamp: new Date(),
        originalTotal: bookingData.originalTotal || bookingData.totalPrice,
        totalPrice: bookingData.totalPrice,
        paidDeposit: 0,
        remainingBalance: bookingData.totalPrice,
        discountCode: bookingData.discountCode || '',
        discountType: bookingData.discountType || '',
        discountValue: bookingData.discountValue != null ? bookingData.discountValue : '',
        discountAmount: bookingData.discountAmount || 0,
        isReturningGuest: isReturningGuest,
        complimentaryNote: isReturningGuest ? '招待仙草冰' : '',
      };

      DataStore.createOrder(finalOrder);
      Logger.log(`✅ 訂單已建立: ${orderID}`);

      // 成本表新增一列（退佣、招待等由後台手動填）
      try {
        DataStore.appendCostRow(orderID, bookingData.name, bookingData.checkIn);
      } catch (costErr) {
        Logger.log(`⚠️ 成本表寫入失敗不影響訂單: ${costErr.message}`);
      }

      // 使用過的折扣碼增加使用次數（內建碼不寫入試算表）
      if (bookingData.discountCode) {
        var skipBuiltin =
          typeof isBuiltinCouponCode === 'function' && isBuiltinCouponCode(bookingData.discountCode);
        if (!skipBuiltin) {
          try {
            DataStore.incrementCouponUsed(bookingData.discountCode);
          } catch (e) {
            Logger.log(`⚠️ 折扣碼使用次數更新失敗: ${e.message}`);
          }
        }
      }

      // Email：客人待確認信 ＋ 管理員通知
      try {
        EmailService.sendPendingConfirmationEmail(finalOrder);
        Logger.log(`📧 待確認信已發送: ${orderID}`);
      } catch (e) {
        Logger.log(`⚠️ 待確認信失敗: ${e.message}`);
      }
      try {
        EmailService.sendNewOrderNotification(finalOrder);
        Logger.log(`📧 管理員通知已發送: ${orderID}`);
      } catch (emailError) {
        Logger.log(`⚠️ 管理員通知失敗: ${emailError.message}`);
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

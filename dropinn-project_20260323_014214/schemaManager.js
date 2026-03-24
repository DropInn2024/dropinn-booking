/**
 * Schema 管理模組
 * ✅ 已擴充：支援日曆、付款、提醒等完整欄位
 */

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const SchemaManager = {
  /**
   * ✅ 完整的 Schema 定義（26 個欄位）
   */
  getSchema() {
    return [
      // === 基本資訊 ===
      { key: 'orderID', header: 'orderID' },
      { key: 'createdAt', header: 'createdAt' },
      { key: 'name', header: 'name' },
      { key: 'phone', header: 'phone' },
      { key: 'email', header: 'email' },

      // === 住宿資訊 ===
      { key: 'checkIn', header: 'checkIn' },
      { key: 'checkOut', header: 'checkOut' },
      { key: 'rooms', header: 'rooms' },
      { key: 'extraBeds', header: 'extraBeds' },

      // === 金額資訊 ===
      { key: 'originalTotal', header: 'originalTotal' },       // 折扣前原價
      { key: 'totalPrice', header: 'totalPrice' },             // 折扣後實收總額
      { key: 'paidDeposit', header: 'paidDeposit' },
      { key: 'remainingBalance', header: 'remainingBalance' },
      { key: 'discountCode', header: 'discountCode' },
      { key: 'discountType', header: 'discountType' },         // fixed | percent | free_nights | free_all
      { key: 'discountValue', header: 'discountValue' },
      { key: 'discountAmount', header: 'discountAmount' },      // 實際折抵金額
      { key: 'isReturningGuest', header: 'isReturningGuest' }, // 老客人
      { key: 'complimentaryNote', header: 'complimentaryNote' }, // 招待備註 ex 仙草冰
      { key: 'sourceType', header: 'sourceType' },               // 來源類型：自家 | 同業推薦
      { key: 'agencyName', header: 'agencyName' },               // 來源同業名稱（選填；sourceType=同業推薦時填）
      { key: 'addonAmount', header: 'addonAmount' },            // 代訂代收金額（行程、租車等，非收入）
      { key: 'extraIncome', header: 'extraIncome' },            // 其他收入（機車行/旅行社回饋等）

      // === 備註 ===
      { key: 'notes', header: 'notes' },
      { key: 'internalNotes', header: 'internalNotes' },       // ✅ 新增

      // === 狀態 ===
      { key: 'status', header: 'status' },
      { key: 'paymentStatus', header: 'paymentStatus' },       // ✅ 新增
      { key: 'cancelReason', header: 'cancelReason' },         // ✅ 新增

      // === Email 相關 ===
      { key: 'emailSent', header: 'emailSent' },
      { key: 'reminderSent', header: 'reminderSent' },         // ✅ 新增
      { key: 'travelGuideSent', header: 'travelGuideSent' },   // ✅ 新增：旅遊手冊已發送
      { key: 'travelGuideSentAt', header: 'travelGuideSentAt' }, // ✅ 新增：旅遊手冊發送時間

      // === 日曆相關 ===
      { key: 'publicCalendarEventID', header: 'publicCalendarEventID' },             // ✅ 新增
      { key: 'housekeepingCalendarEventID', header: 'housekeepingCalendarEventID' }, // ✅ 新增
      { key: 'lastCalendarSync', header: 'lastCalendarSync' },                       // ✅ 新增
      { key: 'calendarSyncStatus', header: 'calendarSyncStatus' },                   // ✅ 新增

      // === 系統欄位 ===
      { key: 'lastUpdated', header: 'lastUpdated' },           // ✅ 新增
      { key: 'updatedBy', header: 'updatedBy' },               // ✅ 新增
      { key: 'timestamp', header: 'timestamp' }
    ];
  },

  /**
   * 取得標題列（用於建立 Sheet）
   */
  getHeaders() {
    return this.getSchema().map(field => field.header);
  },

  /**
   * 將資料物件轉為 Sheet 的一列
   */
  mapDataToRow(data) {
    return this.getSchema().map(field => {
      // 特殊處理：時間戳記
      if (field.key === 'timestamp') {
        return data.timestamp || new Date();
      }

      // 特殊處理：建立時間
      if (field.key === 'createdAt') {
        return data.createdAt || new Date();
      }

      // 特殊處理：原價若未填則與 totalPrice 相同
      if (field.key === 'originalTotal') {
        return data.originalTotal != null && data.originalTotal !== '' ? data.originalTotal : (data.totalPrice || 0);
      }
      // 特殊處理：計算尾款
      if (field.key === 'remainingBalance') {
        const total = data.totalPrice || 0;
        const paid = data.paidDeposit || 0;
        return total - paid;
      }
      // 特殊處理：來源類型未填時預設「自家」
      if (field.key === 'sourceType') {
        const v = (data.sourceType || '').trim();
        return v === '同業推薦' ? '同業推薦' : '自家';
      }

      // 一般欄位
      let value = data[field.key] || '';

      // 清理字串內容
      if (typeof value === 'string') {
        value = sanitizeInput(value);
      }

      return value;
    });
  },

  /**
   * 將 Sheet 的一列轉為資料物件
   * @param {Array} row - 該列資料陣列
   * @param {Array} [headerRow] - 選填，第一列標題；有傳則依欄位名稱對應，避免欄位順序錯亂導致 status 等讀錯
   */
  mapRowToData(row, headerRow) {
    const schema = this.getSchema();
    const data = {};

    schema.forEach((field, index) => {
      let value;
      if (headerRow && Array.isArray(headerRow)) {
        const colIndex = headerRow.indexOf(field.header);
        value = colIndex >= 0 ? row[colIndex] : row[index];
      } else {
        value = row[index];
      }

      // 日期欄位格式化
      if (value instanceof Date) {
        if (field.key === 'checkIn' || field.key === 'checkOut') {
          value = Utilities.formatDate(value, "GMT+8", "yyyy-MM-dd");
        } else if (field.key === 'createdAt' || field.key === 'lastUpdated' || field.key === 'lastCalendarSync') {
          value = Utilities.formatDate(value, "GMT+8", "yyyy-MM-dd HH:mm:ss");
        }
      }

      data[field.key] = value;
    });

    // 狀態只保留四種：洽談中、已付訂、取消、完成（讀取時正規化，避免舊資料或錯字）
    if (data.status !== undefined && data.status !== null) {
      var s = String(data.status).trim();
      if (s === '已付訂' || s === '預定中' || s === '已預訂' || s === '已成立') data.status = '已付訂';
      else if (s === '取消' || s === '已取消') data.status = '取消';
      else if (s === '完成' || s === '已完成') data.status = '完成';
      else if (s === '洽談中' || s === '待確認') data.status = '洽談中';
      else data.status = '洽談中';
    }

    return data;
  }
};

/**
 * 測試 Schema 設定
 */
function testSchema() {
  const headers = SchemaManager.getHeaders();

  Logger.log('=== Schema 測試 ===');
  Logger.log('總共欄位數:', headers.length);
  Logger.log('');
  Logger.log('欄位列表:');
  headers.forEach((header, index) => {
    Logger.log(`${index + 1}. ${header}`);
  });
  Logger.log('');

  if (headers.length === 27) {
    Logger.log('✅ Schema 欄位數量正確（27 個）');
  } else {
    Logger.log(`❌ Schema 欄位數量錯誤，應該是 27 個，目前是 ${headers.length} 個`);
  }
}
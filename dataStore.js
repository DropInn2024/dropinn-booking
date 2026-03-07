/**
 * 資料存取層 (Data Access Object)
 * ✅ 支援年份自動切換
 * ✅ 新增 updateOrder 方法
 */

const DataStore = {
  getDB() {
    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!sheetId) {
      throw new Error('❌ SHEET_ID 未設定！請到「專案設定 → 指令碼屬性」新增 SHEET_ID');
    }
    return SpreadsheetApp.openById(sheetId);
  },

  /**
   * ✅ 新增：自動判斷當前年份的工作表名稱
   */
  getCurrentSheetName() {
    const year = new Date().getFullYear();
    return `訂單_${year}`;
  },

  /**
   * ✅ 新增：確保年度工作表存在（不存在就自動建立）
   */
  ensureYearSheetExists(sheetName) {
    const ss = this.getDB();
    let sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log(`⚠️ 工作表 ${sheetName} 不存在，開始建立...`);

      sheet = ss.insertSheet(sheetName);

      // 設定標題列
      const headers = SchemaManager.getHeaders();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

      // 樣式
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#E5E1DA')
        .setFontColor('#5B5247');

      sheet.setFrozenRows(1);

      Logger.log(`✅ 工作表 ${sheetName} 已建立（${headers.length} 個欄位）`);
    }

    return sheet;
  },

  /**
   * ✅ 修改：讀取訂單（支援年份）
   */
  getOrders(filterStatus = null) {
    const sheetName = this.getCurrentSheetName();
    const sheet = this.ensureYearSheetExists(sheetName);

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log(`ℹ️ 工作表 ${sheetName} 目前沒有訂單`);
      return [];
    }

    const orders = [];
    for (let i = 1; i < data.length; i++) {
      const order = SchemaManager.mapRowToData(data[i]);

      if (!filterStatus || order.status === filterStatus) {
        orders.push(order);
      }
    }

    Logger.log(`✅ 從 ${sheetName} 讀取 ${orders.length} 筆訂單`);
    return orders;
  },

  /**
   * ✅ 修改：建立訂單（支援年份）
   */
  createOrder(orderData) {
    const sheetName = this.getCurrentSheetName();
    const sheet = this.ensureYearSheetExists(sheetName);

    const row = SchemaManager.mapDataToRow(orderData);
    sheet.appendRow(row);

    Logger.log(`✅ 訂單已寫入 ${sheetName}: ${orderData.orderID}`);
    return { success: true, orderID: orderData.orderID };
  },

  /**
   * ✅ 新增：更新訂單（支援部分欄位更新）
   */
  updateOrder(orderID, updates) {
    const sheetName = this.getCurrentSheetName();
    const sheet = this.ensureYearSheetExists(sheetName);

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // 找到訂單
    for (let i = 1; i < data.length; i++) {
      if (data[i][headers.indexOf('orderID')] === orderID) {

        // 更新欄位
        Object.keys(updates).forEach(field => {
          const colIndex = headers.indexOf(field);
          if (colIndex !== -1) {
            sheet.getRange(i + 1, colIndex + 1).setValue(updates[field]);
          } else {
            Logger.log(`⚠️ 欄位 ${field} 不存在，跳過`);
          }
        });

        // 自動更新「最後更新時間」
        const updatedCol = headers.indexOf('lastUpdated');
        if (updatedCol !== -1) {
          sheet.getRange(i + 1, updatedCol + 1).setValue(new Date());
        }

        // 自動計算尾款（如果有更新訂金或總金額）
        if (updates.paidDeposit !== undefined || updates.totalPrice !== undefined) {
          const totalPriceCol = headers.indexOf('totalPrice');
          const paidDepositCol = headers.indexOf('paidDeposit');
          const balanceCol = headers.indexOf('remainingBalance');

          const totalPrice = updates.totalPrice || data[i][totalPriceCol] || 0;
          const paidDeposit = updates.paidDeposit || data[i][paidDepositCol] || 0;
          const balance = totalPrice - paidDeposit;

          if (balanceCol !== -1) {
            sheet.getRange(i + 1, balanceCol + 1).setValue(balance);
            Logger.log(`💰 自動計算尾款: ${totalPrice} - ${paidDeposit} = ${balance}`);
          }
        }

        Logger.log(`✅ 訂單 ${orderID} 已更新: ${JSON.stringify(updates)}`);
        return { success: true };
      }
    }

    Logger.log(`❌ 找不到訂單: ${orderID}`);
    return { success: false, error: '找不到訂單' };
  },

  /**
   * ✅ 新增：依 orderID 取得單筆訂單
   */
  getOrderByID(orderID) {
    const orders = this.getOrders();
    return orders.find(order => order.orderID === orderID);
  },

  /**
   * 取得下一個序號 (Atomic)
   */
  getNextSequence(datePrefix) {
    const lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      const ss = this.getDB();
      let sheet = ss.getSheetByName('系統計數器');

      if (!sheet) {
        sheet = ss.insertSheet('系統計數器');
        sheet.appendRow(['DatePrefix', 'CurrentCount']);
      }

      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;
      let currentCount = 0;

      for (let i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(datePrefix)) {
          rowIndex = i + 1;
          currentCount = Number(data[i][1]);
          break;
        }
      }

      if (rowIndex === -1) {
        sheet.appendRow([datePrefix, 1]);
        return '001';
      } else {
        const newCount = currentCount + 1;
        sheet.getRange(rowIndex, 2).setValue(newCount);
        return String(newCount).padStart(3, '0');
      }
    } catch (e) {
      Logger.log('❌ 取號失敗:', e);
      throw e;
    } finally {
      lock.releaseLock();
    }
  }
};
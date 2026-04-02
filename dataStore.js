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
    } else {
      this.ensureOrderSheetSchema(sheet);
    }

    return sheet;
  },

  /**
   * 若訂單表已存在但缺少新欄位，在 complimentaryNote 右側依序補上：
   * sourceType、agencyName、addonAmount、extraIncome（缺哪補哪，不影響既有資料）。
   */
  ensureOrderSheetSchema(sheet) {
    if (!sheet) return;
    let lastCol = sheet.getLastColumn();
    if (lastCol < 1) return;
    let headerRow = sheet
      .getRange(1, 1, 1, lastCol)
      .getValues()[0]
      .map(function (h) {
        return String(h || '').trim();
      });

    // 舊表常缺 housekeepingNote：讀取時若用欄位序會錯把 status 當房務備註；寫入時也會因無欄被跳過
    if (headerRow.indexOf('housekeepingNote') === -1) {
      const idxInternal = headerRow.indexOf('internalNotes');
      const idxNotes = headerRow.indexOf('notes');
      const insertAfter0 = idxInternal >= 0 ? idxInternal : idxNotes;
      if (insertAfter0 >= 0) {
        sheet.insertColumnsAfter(insertAfter0 + 1, 1);
        const newCol = insertAfter0 + 2;
        sheet.getRange(1, newCol, 1, 1).setValues([['housekeepingNote']]);
        sheet
          .getRange(1, newCol, 1, 1)
          .setFontWeight('bold')
          .setBackground('#E5E1DA')
          .setFontColor('#5B5247');
        Logger.log('✅ 已補上 housekeepingNote 欄（在 internalNotes／notes 右側）');
        lastCol = sheet.getLastColumn();
        headerRow = sheet
          .getRange(1, 1, 1, lastCol)
          .getValues()[0]
          .map(function (h) {
            return String(h || '').trim();
          });
      } else {
        Logger.log('⚠️ ensureOrderSheetSchema: 找不到 notes／internalNotes，無法自動插入 housekeepingNote');
      }
    }

    const hasSourceType = headerRow.indexOf('sourceType') !== -1;
    const hasAgencyName = headerRow.indexOf('agencyName') !== -1;
    if (hasSourceType && hasAgencyName) {
      return;
    }
    const insertAfter = headerRow.indexOf('complimentaryNote');
    if (insertAfter === -1) {
      Logger.log('⚠️ ensureOrderSheetSchema: 找不到 complimentaryNote 欄，略過補 source／agency 欄');
      return;
    }
    const col1Based = insertAfter + 1;
    if (hasAgencyName && !hasSourceType) {
      sheet.insertColumnsAfter(col1Based, 1);
      // getRange(row, column, numRows, numColumns) 第三、四參數是「列數、欄數」
      sheet.getRange(1, col1Based + 1, 1, 1).setValues([['sourceType']]);
      sheet.getRange(1, col1Based + 1, 1, 1).setFontWeight('bold').setBackground('#E5E1DA').setFontColor('#5B5247');
      Logger.log('✅ 已補上 1 欄：sourceType');
      return;
    }
    if (!hasAgencyName) {
      sheet.insertColumnsAfter(col1Based, 4);
      // getRange(row, column, numRows, numColumns) 第三、四參數是「列數、欄數」，故 4 欄 = 1 列 4 欄
      sheet.getRange(1, col1Based + 1, 1, 4).setValues([['sourceType', 'agencyName', 'addonAmount', 'extraIncome']]);
      sheet.getRange(1, col1Based + 1, 1, 4).setFontWeight('bold').setBackground('#E5E1DA').setFontColor('#5B5247');
      Logger.log(`✅ 已補上 4 欄：sourceType, agencyName, addonAmount, extraIncome（位置：第 ${col1Based + 1}～${col1Based + 4} 欄）`);
    }
  },

  /**
   * ✅ 修改：讀取訂單（支援年份、可選篩選狀態）
   */
  getOrders(filterStatus = null, year = null) {
    const sheetName = year ? `訂單_${year}` : this.getCurrentSheetName();
    const sheet = this.ensureYearSheetExists(sheetName);

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log(`ℹ️ 工作表 ${sheetName} 目前沒有訂單`);
      return [];
    }

    const headers = data[0];
    const orders = [];
    for (let i = 1; i < data.length; i++) {
      const order = SchemaManager.mapRowToData(data[i], headers);

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

        // 舊表常見 status 已改「已付訂」但 paymentStatus 仍「洽談中」：未單獨傳 paymentStatus 時與 status 對齊
        if (
          updates.paymentStatus === undefined &&
          updates.status !== undefined &&
          updates.status !== null
        ) {
          const psCol = headers.indexOf('paymentStatus');
          if (psCol !== -1) {
            sheet.getRange(i + 1, psCol + 1).setValue(updates.status);
          }
        }

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
   * 成本表（支出）年度工作表名稱
   */
  getCostSheetName(year) {
    return `支出_${year || new Date().getFullYear()}`;
  },

  /** 成本表標題列 */
  getCostHeaders() {
    return ['orderID', 'name', 'checkIn', 'rebateAmount', 'complimentaryAmount', 'otherCost', 'note'];
  },

  /**
   * 確保年度成本表存在
   */
  ensureCostSheetExists(year) {
    const name = this.getCostSheetName(year);
    const ss = this.getDB();
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, this.getCostHeaders().length).setValues([this.getCostHeaders()]);
      sheet.getRange(1, 1, 1, this.getCostHeaders().length).setFontWeight('bold').setBackground('#E5E1DA');
      sheet.setFrozenRows(1);
    }
    return sheet;
  },

  /**
   * 建立訂單時寫入成本表一列（預設 0，由管理員手動填退佣、招待等）
   */
  appendCostRow(orderID, name, checkIn) {
    const year = new Date(checkIn).getFullYear();
    const sheet = this.ensureCostSheetExists(year);
    sheet.appendRow([orderID, name || '', checkIn || '', 0, 0, 0, '']);
    Logger.log(`✅ 成本表 ${this.getCostSheetName(year)} 已新增一列: ${orderID}`);
  },

  /**
   * 依年度讀取成本表（供財務報表用）
   */
  getCostRows(year) {
    const name = this.getCostSheetName(year);
    const ss = this.getDB();
    const sheet = ss.getSheetByName(name);
    if (!sheet) return [];
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const headers = data[0];
    const rows = [];
    for (let i = 1; i < data.length; i++) {
      const row = {};
      headers.forEach((h, j) => { row[h] = data[i][j]; });
      rows.push(row);
    }
    return rows;
  },

  /**
   * 依 orderID 取得該筆訂單在成本表的那一列（依入住年分查支出_YYYY）
   */
  getCostByOrderID(orderID, year) {
    const rows = this.getCostRows(year || new Date().getFullYear());
    const row = rows.find((r) => String(r.orderID) === String(orderID));
    return row || null;
  },

  /**
   * 依 orderID 更新成本表該列（退佣、招待、其他支出、備註）
   */
  updateCostRowByOrderID(orderID, year, updates) {
    const name = this.getCostSheetName(year || new Date().getFullYear());
    const ss = this.getDB();
    const sheet = ss.getSheetByName(name);
    if (!sheet) return { success: false, error: '成本表不存在' };
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const orderIDCol = headers.indexOf('orderID');
    if (orderIDCol === -1) return { success: false, error: '成本表缺少 orderID 欄位' };
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][orderIDCol]) !== String(orderID)) continue;
      const fields = ['rebateAmount', 'complimentaryAmount', 'otherCost', 'note'];
      fields.forEach((field) => {
        if (updates[field] === undefined) return;
        const col = headers.indexOf(field);
        if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(updates[field] != null ? updates[field] : '');
      });
      Logger.log(`✅ 成本表已更新訂單 ${orderID} 成本欄位`);
      return { success: true };
    }
    Logger.log(`⚠️ 成本表找不到 orderID: ${orderID}`);
    return { success: false, error: '找不到該訂單的成本列' };
  },

  /**
   * 折扣碼工作表名稱
   */
  getCouponSheetName() {
    return '折扣碼';
  },

  getCouponHeaders() {
    return ['code', 'type', 'value', 'description', 'useLimit', 'usedCount', 'validFrom', 'validTo'];
  },

  ensureCouponSheetExists() {
    const name = this.getCouponSheetName();
    const ss = this.getDB();
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      const headers = this.getCouponHeaders();
      // 第 1 列：標題
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E5E1DA');
      // 第 2 列：使用說明（備註）
      sheet
        .getRange(2, 1, 1, headers.length)
        .setValues([
          [
            'code：客人輸入的優惠碼（不分大小寫）',
            'type：fixed = 固定折抵金額；percent = 折扣百分比（例如 10 = 9 折）',
            'value：依 type 填入金額或百分比數值',
            'description：給自己看的備註，例如「新客折抵 1000」',
            'useLimit：使用次數上限（0 = 不限次數）',
            'usedCount：已使用次數（系統會自動加）',
            'validFrom：生效日（可留空）',
            'validTo：到期日（可留空）',
          ],
        ])
        .setFontSize(9)
        .setFontColor('#5B5247');
      sheet.setFrozenRows(1);
    }
    return sheet;
  },

  getCoupons() {
    this.ensureCouponSheetExists();
    const ss = this.getDB();
    const sheet = ss.getSheetByName(this.getCouponSheetName());
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const headers = data[0];
    const list = [];
    for (let i = 1; i < data.length; i++) {
      const row = {};
      headers.forEach((h, j) => { row[h] = data[i][j]; });
      list.push(row);
    }
    return list;
  },

  getCouponByCode(code) {
    if (!code || typeof code !== 'string') return null;
    const list = this.getCoupons();
    const normalized = String(code).trim().toUpperCase();
    return list.find(c => String(c.code || '').trim().toUpperCase() === normalized) || null;
  },

  incrementCouponUsed(code) {
    const ss = this.getDB();
    const sheet = ss.getSheetByName(this.getCouponSheetName());
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const codeCol = headers.indexOf('code');
    const usedCol = headers.indexOf('usedCount');
    if (codeCol === -1 || usedCol === -1) return;
    const normalized = String(code).trim().toUpperCase();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][codeCol] || '').trim().toUpperCase() === normalized) {
        const current = Number(data[i][usedCol]) || 0;
        sheet.getRange(i + 1, usedCol + 1).setValue(current + 1);
        Logger.log(`✅ 折扣碼 ${code} 使用次數 +1`);
        return;
      }
    }
  },

  /** 新增或更新折扣碼（依 code 覆寫該列） */
  saveCoupon(coupon) {
    const sheet = this.ensureCouponSheetExists();
    const headers = this.getCouponHeaders();
    const data = sheet.getDataRange().getValues();
    const codeCol = headers.indexOf('code');
    const normalized = String(coupon.code || '').trim().toUpperCase();
    if (!normalized) return { success: false, error: '折扣碼代碼不可為空' };
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][codeCol] || '').trim().toUpperCase() === normalized) {
        headers.forEach((h, j) => {
          const v = coupon[h];
          sheet.getRange(i + 1, j + 1).setValue(v != null ? v : '');
        });
        Logger.log(`✅ 折扣碼已更新: ${coupon.code}`);
        return { success: true };
      }
    }
    const row = headers.map(h => coupon[h] != null ? coupon[h] : '');
    sheet.appendRow(row);
    Logger.log(`✅ 折扣碼已新增: ${coupon.code}`);
    return { success: true };
  },

  /**
   * 訂單取消時將該筆成本列的支出改為 0（可選：清空備註）
   */
  clearCostRowForOrder(orderID, year) {
    const name = this.getCostSheetName(year || new Date().getFullYear());
    const ss = this.getDB();
    const sheet = ss.getSheetByName(name);
    if (!sheet) return;
    const data = sheet.getDataRange().getValues();
    const orderIDCol = data[0].indexOf('orderID');
    if (orderIDCol === -1) return;
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][orderIDCol]) === String(orderID)) {
        const rebateCol = data[0].indexOf('rebateAmount');
        const compCol = data[0].indexOf('complimentaryAmount');
        const otherCol = data[0].indexOf('otherCost');
        if (rebateCol !== -1) sheet.getRange(i + 1, rebateCol + 1).setValue(0);
        if (compCol !== -1) sheet.getRange(i + 1, compCol + 1).setValue(0);
        if (otherCol !== -1) sheet.getRange(i + 1, otherCol + 1).setValue(0);
        Logger.log(`✅ 成本表已將訂單 ${orderID} 支出清為 0`);
        return;
      }
    }
  },

  // ==========================================
  // 推薦記錄（我推薦給同業的案子，無客人個資；供月報表退佣彙總）
  // ==========================================
  getRecommendationSheetName() {
    return '推薦記錄';
  },
  getRecommendationHeaders() {
    return ['recordID', 'date', 'agencyName', 'rebateAmount', 'notes'];
  },
  ensureRecommendationSheetExists() {
    const name = this.getRecommendationSheetName();
    const ss = this.getDB();
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      const headers = this.getRecommendationHeaders();
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#E5E1DA').setFontColor('#5B5247');
      sheet.setFrozenRows(1);
      Logger.log('✅ 已建立工作表：推薦記錄');
    }
    return sheet;
  },
  getRecommendationRecords() {
    this.ensureRecommendationSheetExists();
    const ss = this.getDB();
    const sheet = ss.getSheetByName(this.getRecommendationSheetName());
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return [];
    const headers = data[0];
    const list = [];
    for (let i = 1; i < data.length; i++) {
      const row = {};
      headers.forEach((h, j) => { row[h] = data[i][j]; });
      list.push(row);
    }
    return list;
  },
  addRecommendationRecord(record) {
    // 先確保當年度訂單表存在且欄位與 Schema 一致（與 initializeYearSheet / 訂單_2026 相同邏輯）
    const orderYear = new Date().getFullYear();
    this.ensureYearSheetExists('訂單_' + orderYear);

    const sheet = this.ensureRecommendationSheetExists();
    const headers = this.getRecommendationHeaders();
    const recordID = 'REC-' + Utilities.formatDate(new Date(), 'GMT+8', 'yyyyMMdd') + '-' + String(Math.random()).slice(2, 8);
    const row = [
      recordID,
      record.date || Utilities.formatDate(new Date(), 'GMT+8', 'yyyy-MM-dd'),
      record.agencyName || '',
      record.rebateAmount != null && record.rebateAmount !== '' ? Number(record.rebateAmount) : '',
      record.notes || ''
    ];
    sheet.appendRow(row);
    Logger.log('✅ 推薦記錄已新增: ' + recordID);
    return { success: true, recordID: recordID };
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
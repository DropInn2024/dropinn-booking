/**
 * postStaySender.gs
 * 雫旅訂房系統 - 退房感謝信（島嶼的餘韻）
 *
 * 功能：
 * - 每天檢查「昨天退房、狀態為完成」的訂單，若有 Email 則寄出退房感謝信
 * - 提供純文字版本，方便後台產生 LINE / IG 文案（之後可在 admin.html 綁定）
 */

/**
 * 每日批次：寄出退房感謝信（島嶼的餘韻）
 * 建議設定觸發器：每天早上 10:00 執行 sendPostStayThankyouBatch
 */
function sendPostStayThankyouBatch() {
  try {
    const orders = DataStore.getOrders();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const yyyy = yesterday.getFullYear();
    const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
    const dd = String(yesterday.getDate()).padStart(2, '0');
    const targetDateStr = `${yyyy}-${mm}-${dd}`;

    Logger.log('=== 📬 退房感謝批次寄送開始 ===');
    Logger.log(`目標退房日：${targetDateStr}`);

    let sentCount = 0;
    let skippedNoEmail = 0;

    orders.forEach(function (order) {
      if (!order || !order.checkOut || !order.status) return;
      if (order.status !== '完成') return;
      if (order.checkOut !== targetDateStr) return;

      if (!order.email || String(order.email).trim() === '') {
        skippedNoEmail++;
        Logger.log(`ℹ️ 訂單 ${order.orderID} 無 Email，略過自動寄送（可改用 LINE 文案）`);
        return;
      }

      if (typeof EmailService === 'undefined' || typeof EmailService.sendPostStayThankyouEmail !== 'function') {
        Logger.log('⚠️ EmailService.sendPostStayThankyouEmail 未定義，略過寄送');
        return;
      }

      const result = EmailService.sendPostStayThankyouEmail(order);
      if (result && result.success) {
        sentCount++;
      }
    });

    Logger.log(`=== ✅ 退房感謝批次結束：成功寄出 ${sentCount} 封，無 Email ${skippedNoEmail} 筆 ===`);
    return {
      success: true,
      sent: sentCount,
      skippedNoEmail: skippedNoEmail,
      targetDate: targetDateStr,
    };
  } catch (error) {
    Logger.log('❌ sendPostStayThankyouBatch 錯誤:', error);
    if (typeof LoggerService !== 'undefined') {
      LoggerService.logError(error, 'sendPostStayThankyouBatch');
    }
    return { success: false, error: error.message };
  }
}

/**
 * 取得退房感謝純文字（方便後台複製到 LINE）
 */
function getPostStayThankyouText(orderID) {
  const order = DataStore.getOrderByID(orderID);
  if (!order) {
    return { success: false, error: '找不到訂單' };
  }
  if (typeof EmailTemplates === 'undefined' || typeof EmailTemplates.getPostStayThankyouPlain !== 'function') {
    return { success: false, error: '退房感謝模板未載入' };
  }
  const text = EmailTemplates.getPostStayThankyouPlain(order);
  return { success: true, text: text };
}


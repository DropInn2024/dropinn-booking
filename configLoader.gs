/**
 * 設定載入器
 * 這個檔案可以安全上傳，因為機密都在 Properties Service
 */

const Config = {
  get SHEET_ID() {
    return PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  },
  get RECAPTCHA_SECRET() {
    return PropertiesService.getScriptProperties().getProperty('RECAPTCHA_SECRET');
  },
  get ADMIN_EMAIL() {
    return PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
  },
  get PUBLIC_CALENDAR_ID() {
    return PropertiesService.getScriptProperties().getProperty('PUBLIC_CALENDAR_ID');
  },
  get HOUSEKEEPING_CALENDAR_ID() {
    return PropertiesService.getScriptProperties().getProperty('HOUSEKEEPING_CALENDAR_ID');
  },
  get ADMIN_API_KEY() {
    return PropertiesService.getScriptProperties().getProperty('ADMIN_API_KEY') || null;
  },

  SYSTEM_NAME: '雫旅訂房系統',
  TIMEZONE: 'GMT+8',
};

/**
 * 驗證 reCAPTCHA
 */
function verifyRecaptcha(token) {
  const TEST_MODE = false; // 暫時跳過 reCAPTCHA 驗證（之後改回 false）

  if (TEST_MODE) {
    Logger.log('⚠️ 測試模式：跳過驗證');
    return true;
  }

  if (!token || !Config.RECAPTCHA_SECRET) {
    Logger.log('❌ reCAPTCHA 驗證失敗');
    return false;
  }

  try {
    const url = 'https://www.google.com/recaptcha/api/siteverify';
    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      payload: {
        secret: Config.RECAPTCHA_SECRET,
        response: token,
      },
      muteHttpExceptions: true,
    });

    const json = JSON.parse(response.getContentText());

    // 先放寬條件：只要 success 為 true 就通過（暫時不看 score）
    if (json.success) {
      Logger.log(`✅ reCAPTCHA 驗證通過 (分數: ${json.score ?? '無'})`);
      return true;
    } else {
      Logger.log(`❌ reCAPTCHA 驗證失敗 (分數: ${json.score ?? '無'})`);
      return false;
    }
  } catch (e) {
    Logger.log(`❌ reCAPTCHA 執行錯誤: ${e.message}`);
    return false;
  }
}

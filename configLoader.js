/**
 * 設定載入器
 * 這個檔案可以安全上傳，因為機密都在 Properties Service
 */

const Config = {
  get SHEET_ID() {
    // Script Properties 內可能會誤貼成完整 URL / 帶空白 / 帶引號，openById() 只接受純 id
    const raw = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!raw) return raw;
    const v = String(raw).trim().replace(/^['"]|['"]$/g, '');
    // 支援貼入 URL 格式（含變體）：.../spreadsheets/d/<ID>/...
    // 或：.../spreadsheets/u/0/d/<ID>/...
    const m = v.match(/spreadsheets\/(?:u\/\d+\/)?d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : v;
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
  get HOUSEKEEPING_KEY() {
    return PropertiesService.getScriptProperties().getProperty('HOUSEKEEPING_KEY') || null;
  },

  SYSTEM_NAME: '雫旅訂房系統',
  TIMEZONE: 'GMT+8',
};

/**
 * 驗證 reCAPTCHA
 */
function verifyRecaptcha(token) {
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

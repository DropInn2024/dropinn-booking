/**
 * 前端設定範本
 * 
 * ⚠️ 使用方式：
 * 1. 複製此檔案為 config.js
 * 2. 填入你的真實資訊
 * 3. config.js 已加入 .gitignore，不會被上傳
 *
 * 使用 window 且僅在未定義時設定，避免 GAS 後台／房務頁注入的 FRONTEND_CONFIG 重複宣告。
 */
if (typeof window.FRONTEND_CONFIG === 'undefined') {
  window.FRONTEND_CONFIG = {
  // ==========================================
  // Google Apps Script API 網址
  // （請在你的 config.js 裡填入真實網址）
  // ==========================================
  API_URL: 'YOUR_API_URL_HERE',
  
  // ==========================================
  // reCAPTCHA Site Key（前端用）
  // （請在你的 config.js 裡填入真實 Site Key）
  // ==========================================
  RECAPTCHA_SITE_KEY: 'YOUR_RECAPTCHA_SITE_KEY_HERE',

  // ==========================================
  // Admin 後台用 API Key（選用）
  // - 若你在 Script Properties 設定了 ADMIN_API_KEY，
  //   請在 config.js 裡填入相同字串，前端會自動帶到 API
  // - 若沒設定 ADMIN_API_KEY，此欄位可留空
  // ==========================================
  ADMIN_API_KEY: '',

  // ==========================================
  // 品牌資訊（可公開）
  // ==========================================
  BRAND_NAME: '雫旅 Drop Inn',
  BRAND_TAGLINE: '花火散落後，回到雫旅',

  // ==========================================
  // 聯絡資訊（可公開）
  // ==========================================
  CONTACT: {
    instagram: 'https://www.instagram.com/dropinn.penghu/',
    facebook: 'https://www.facebook.com/search/top?q=%E9%9B%AB%E6%97%85',
    line: 'https://line.me/ti/p/@dropinn',
    googleMaps: 'https://maps.app.goo.gl/kH3rM5aeYen95VF9',
    album: 'https://photos.app.goo.gl/CXb7wwecEFySxM5Q8'
  };
}

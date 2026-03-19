/**
 * GitHub Pages 用設定（會上傳到 repo，只放訂房頁需要的公開值）
 * 訂房首頁會先載入此檔，若本機有 config.js 則會覆蓋（本地開發／後台用）。
 */
var FRONTEND_CONFIG = {
  // 首頁在 GitHub Pages 打 API 用這個網址（你的新 GAS 部署）
  API_URL:
    'https://script.google.com/macros/s/AKfycbwoAz7sTthlp2cgsy6d0iX-wvC5v7OVA4ivPOckq2SOzt5TvUg773s-VmAofXTRF9YCyQ/exec',
  API_URL_PUBLIC:
    'https://script.google.com/macros/s/AKfycbwoAz7sTthlp2cgsy6d0iX-wvC5v7OVA4ivPOckq2SOzt5TvUg773s-VmAofXTRF9YCyQ/exec',

  // 後台／房務頁（從靜態站開時用）：請填你的 GAS「Admin API」部署網址
  API_URL_ADMIN:
    'https://script.google.com/macros/s/AKfycbz6OYlohDVkAbjci8n4Uk0MCXsjM7V7R3q0GqNgWfIcDbcqjGEEJ7mtTIwrlJSH6ILw8w/exec',
  // 後台通關碼：須與 GAS「專案設定→指令碼屬性」的 ADMIN_API_KEY 相同。
  // 留空時從靜態站開後台／房務頁會無法通過 API 驗證（一旦 GAS 有設 ADMIN_API_KEY 就會被擋）。
  // 請填入與 GAS Script Properties 一致的金鑰，或改從 GAS 部署網址 ?page=admin / ?page=housekeeping 開啟。
  ADMIN_API_KEY: 'DROPINN_ADMIN_0706',

  RECAPTCHA_SITE_KEY: '6LdTR2wsAAAAAI9fy5CuyD42lZ6hGk4ed0bJbqIW',
  BRAND_NAME: '雫旅 Drop Inn',
  BRAND_TAGLINE: '花火散落後，回到雫旅',
  CONTACT: {
    instagram: 'https://www.instagram.com/dropinn.penghu/',
    facebook: 'https://www.facebook.com/search/top?q=%E9%9B%AB%E6%97%85',
    line: 'https://line.me/ti/p/@dropinn',
    googleMaps: 'https://maps.app.goo.gl/kH3rM5aeYen95VF9',
    album:
      'https://drive.google.com/drive/folders/1-6QhYRawcUvmzMfkTFRMzyMRpf53Kuh3?usp=drive_link',
  },
};

/**
 * 前端公開設定檔（無敏感資料，可公開）
 * 載入於 index.html, drift/, notforyou/, handshake/, housekeeping/ 等
 *
 * 後端 API 全部使用相對路徑 /api/*，由 Cloudflare Worker 處理。
 * 此檔不再包含 GAS 或任何第三方 API 網址。
 */
var FRONTEND_CONFIG = {
  // 防機器人灌單：填入 Cloudflare Turnstile 的 Site Key 才會啟用前端驗證（後端另設 TURNSTILE_SECRET）。
  // 留空＝不啟用（下單流程與現狀相同）。
  TURNSTILE_SITE_KEY: '0x4AAAAAADnUh0wNdNFJq2wd',
  RECAPTCHA_SITE_KEY: '6LdTR2wsAAAAAI9fy5CuyD42lZ6hGk4ed0bJbqIW',

  BRAND_NAME: '雫旅 Drop Inn',
  BRAND_TAGLINE: '花火散落後，回到雫旅',

  CONTACT: {
    instagram: 'https://www.instagram.com/dropinn.penghu/',
    facebook:  'https://www.facebook.com/profile.php?id=61560025202726',
    line:      'https://line.me/ti/p/@dropinn',
    googleMaps:'https://maps.app.goo.gl/fjGjjtXbRJ9Qrk9A7',
    album:     'https://photos.app.goo.gl/CXb7wwecEFySxM5Q8',
  },
};

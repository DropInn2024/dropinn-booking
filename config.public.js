/**
 * GitHub Pages 用設定（會上傳到 repo，只放訂房頁需要的公開值）
 * 訂房首頁會先載入此檔，若本機有 config.js 則會覆蓋（本地開發／後台用）。
 */
var FRONTEND_CONFIG = {
  API_URL: '',
  API_URL_PUBLIC:
    'https://script.google.com/macros/s/AKfycbwoAz7sTthlp2cgsy6d0iX-wvC5v7OVA4ivPOckq2SOzt5TvUg773s-VmAofXTRF9YCyQ/exec',
  API_URL_ADMIN: '',
  ADMIN_API_KEY: '',
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

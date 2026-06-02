// 雫旅線條 icon 預覽 — 外置腳本（站台 CSP 為 script-src 'self'，不允許 inline script）
// 每個 icon 的「內部路徑」（共用 24x24 viewBox、stroke=currentColor）
var ICONS = {
  '水滴 / 品牌': '<path d="M12 3C12 8 18 10 18 15a6 6 0 1 1-12 0C6 10 12 8 12 3z"/>',
  '鑰匙 / 登入碼': '<circle cx="8" cy="8" r="3.4"/><path d="M10.4 10.4 19 19M16.6 16.6l2-2M19 19l1.6-1.6"/>',
  '房子 / 入住': '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  '定位 / 導航': '<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z"/><circle cx="12" cy="9" r="2.4"/>',
  '租車': '<path d="M4 13l1.8-5h12.4L20 13"/><rect x="3" y="13" width="18" height="4.5" rx="1.2"/><circle cx="7.5" cy="17.5" r="1.7"/><circle cx="16.5" cy="17.5" r="1.7"/>',
  '日曆 / 日期': '<rect x="4" y="5.5" width="16" height="14.5" rx="2"/><path d="M4 9.5h16M8 3.5V6M16 3.5V6"/>',
  '時鐘 / 期限': '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  '禮物 / 優惠碼': '<rect x="4" y="9" width="16" height="11" rx="1.2"/><path d="M3 9h18M12 9v11"/><path d="M12 9S10.5 4.5 8.5 4.5 6 8.5 8.5 9M12 9s1.5-4.5 3.5-4.5S18 8.5 15.5 9"/>',
  '鈴鐺 / 通知': '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M9.5 21a2.5 2.5 0 0 0 5 0"/>',
  '勾選 / 已付': '<circle cx="12" cy="12" r="8"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  '海浪 / 澎湖': '<path d="M3 11q3-4 6 0t6 0 6 0"/><path d="M3 16q3-4 6 0t6 0 6 0"/>',
  '信封 / 來信': '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3.5 7.5 12 13l8.5-5.5"/>'
};
var ctxRows = [
  ['鑰匙 / 登入碼', '登入碼', '訂單編號即為您的專屬登入碼'],
  ['定位 / 導航', '地址', '澎湖縣湖西鄉港底212號（點此導航）'],
  ['時鐘 / 期限', '提醒', '請於 48 小時內完成訂金付款'],
  ['禮物 / 優惠碼', '優惠', '加入 LINE 即可領取專屬優惠碼']
];

function svg(inner) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' +
    (document.getElementById('thin').checked ? '1.3' : '1.7') +
    '" stroke-linecap="round" stroke-linejoin="round">' + inner + '</svg>';
}
function render() {
  var g = document.getElementById('grid'); g.innerHTML = '';
  Object.keys(ICONS).forEach(function (name) {
    g.insertAdjacentHTML('beforeend', '<div class="ic">' + svg(ICONS[name]) + '<div class="nm">' + name + '</div></div>');
  });
  var c = document.getElementById('ctx'); c.innerHTML = '';
  ctxRows.forEach(function (r) {
    c.insertAdjacentHTML('beforeend', '<div class="row">' + svg(ICONS[r[0]]) + '<span class="lab">' + r[1] + '</span><span>' + r[2] + '</span></div>');
  });
  var col = document.getElementById('col').value;
  document.documentElement.style.setProperty('--accent', col);
  document.querySelectorAll('.ic').forEach(function (e) { e.style.color = col; });
}
document.getElementById('thin').addEventListener('change', render);
document.getElementById('col').addEventListener('change', render);
render();

/* ============================================================
 * 萬鈞租車 · 車種與牌價
 * ------------------------------------------------------------
 * 僅含對客公開的牌價（一天 / 半天 / 超時每小時），可安全部署。
 * 客人看到的就是車行對外牌價。
 * 資料來源：雫旅客報 2026 年車型價目表（5-8 月旺季）。
 * ============================================================ */

window.CARS = [
  // ── 經濟 5 人座 ──
  { id: 'vios',         name: 'VIOS',         seats: 5, year: '2017-2021', tier: '經濟 5 人座',   day: 1600, half: 1000, hourly: 200 },
  { id: 'yaris',        name: 'YARIS',        seats: 5, year: '2017-2021', tier: '經濟 5 人座',   day: 1600, half: 1000, hourly: 200 },
  { id: 'livina',       name: 'LIVINA',       seats: 5, year: '2018-2020', tier: '經濟 5 人座',   day: 1600, half: 1000, hourly: 200 },
  { id: 'altis',        name: 'ALTIS',        seats: 5, year: '2014-2019', tier: '經濟 5 人座',   day: 1600, half: 1000, hourly: 200 },

  // ── 舒適 5 人座 ──
  { id: 'sienta5',      name: 'SIENTA',       seats: 5, year: '2017-2023', tier: '舒適 5 人座',   day: 1800, half: 1100, hourly: 200 },

  // ── 休旅 5 人座 ──
  { id: 'new-altis',    name: 'NEW ALTIS',    seats: 5, year: '2021-2023', tier: '休旅 5 人座',   day: 2000, half: 1500, hourly: 300 },
  { id: 'yaris-cross',  name: 'YARIS CROSS',  seats: 5, year: '2026',      tier: '休旅 5 人座',   day: 2000, half: 1500, hourly: 300 },

  // ── 7 人座 ──
  { id: 'wish',         name: 'WISH',         seats: 7, year: '2014-2016', tier: '7 人座',        day: 2300, half: 1600, hourly: 350 },

  // ── 升級 5 / 7 人座 ──
  { id: 'corolla-cross', name: 'COROLLA CROSS', seats: 5, year: '2023',    tier: '升級 5/7 人座', day: 2500, half: 1800, hourly: 350 },
  { id: 'sienta7',      name: 'SIENTA',       seats: 7, year: '2017-2023', tier: '升級 5/7 人座', day: 2500, half: 1800, hourly: 350 },

  // ── 8-9 人座 ──
  { id: 'starex',       name: 'HYUNDAI STAREX', seats: 9, year: '2015-2018', tier: '8-9 人座',   day: 2800, half: 2000, hourly: 450 },
  { id: 'jspace',       name: 'J SPACE',      seats: 8, year: '2026',      tier: '8-9 人座',      day: 2800, half: 2000, hourly: 450 },

  // ── 9 人座 頂級 ──
  { id: 'caravelle',    name: 'CARAVELLE T6', seats: 9, year: '2021',      tier: '9 人座 頂級',   day: 3500, half: 2300, hourly: 500 },
  { id: 'staria',       name: 'STARIA',       seats: 9, year: '2022-2024', tier: '9 人座 頂級',   day: 3500, half: 2300, hourly: 500 }
];

// 機車：不分車款、依現場調度，統一牌價
window.SCOOTER = {
  id: 'scooter',
  name: '機車（不挑款）',
  day: 350, half: 250, hourly: 50,
  note: '機車不分車款，依現場調度為主',
  models: ['K1 125cc', 'MANY 110cc', '新名流 125cc', 'LIKE 125cc', '新豪邁 125cc', 'GP 125cc']
};

// 分級顯示順序
window.CAR_TIERS = [
  '經濟 5 人座', '舒適 5 人座', '休旅 5 人座',
  '7 人座', '升級 5/7 人座', '8-9 人座', '9 人座 頂級'
];

// 營業時間（owner 確認 08:00-21:00；客報 PDF 印的 19:00 為舊公告）
window.RENTAL_HOURS = { open: 8, close: 21 };

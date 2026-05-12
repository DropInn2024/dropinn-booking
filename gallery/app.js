// ── Photo manifest ──────────────────────────────────────────
const CAT_TOTALS = {
  '101': 8, '201': 15, '202': 4, '203': 5,
  '301': 15, '客廳': 14, '廚房': 2, '戶外': 2,
};

function catPhotos(cat) {
  return Array.from({ length: CAT_TOTALS[cat] }, (_, i) =>
    `/gallery/img/${encodeURIComponent(cat)}/${String(i + 1).padStart(2, '0')}.jpg`
  );
}

// ── Page navigation ─────────────────────────────────────────
const TOTAL_PAGES = 8;
let currentPage   = 0;

const sections = Array.from(document.querySelectorAll('.room-section'));
const navItems  = Array.from(document.querySelectorAll('.nav-item'));

function goToPage(idx) {
  if (idx < 0 || idx >= TOTAL_PAGES) return;
  sections.forEach((s, i) => s.classList.toggle('active', i === idx));
  navItems.forEach((n, i) => n.classList.toggle('active', i === idx));
  currentPage = idx;
  updatePageNav();
  window.scrollTo({ top: 0, behavior: 'instant' });
  // scroll active nav pill into view
  const pill = navItems[idx];
  if (pill) pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
}

function changePage(d) {
  goToPage(currentPage + d);
}

function updatePageNav() {
  document.getElementById('prevBtn').disabled = currentPage === 0;
  document.getElementById('nextBtn').disabled = currentPage === TOTAL_PAGES - 1;
  document.getElementById('pageDots').innerHTML = Array.from({ length: TOTAL_PAGES }, (_, i) =>
    `<span class="dot${i === currentPage ? ' active' : ''}" data-page="${i}"></span>`
  ).join('');
}

// Nav item clicks
navItems.forEach((item, i) => {
  item.addEventListener('click', () => goToPage(i));
});

// Keyboard (left/right when lightbox is closed)
document.addEventListener('keydown', e => {
  if (document.getElementById('lightbox').classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  changePage(-1);
  if (e.key === 'ArrowRight') changePage(1);
});

// Touch swipe on deck
let _startX = 0, _startY = 0;
const deck = document.getElementById('deck');
deck.addEventListener('touchstart', e => {
  _startX = e.touches[0].clientX;
  _startY = e.touches[0].clientY;
}, { passive: true });
deck.addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - _startX;
  const dy = e.changedTouches[0].clientY - _startY;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    changePage(dx < 0 ? 1 : -1);
  }
});

// ── Lightbox ─────────────────────────────────────────────────
let lbPhotos = [];
let lbIdx    = 0;

function openCat(cat, startIdx) {
  lbPhotos = catPhotos(cat);
  lbIdx    = Math.min(startIdx, lbPhotos.length - 1);
  updateLb(cat);
  document.getElementById('lightbox').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updateLb(cat) {
  const img = document.getElementById('lbImg');
  img.src = lbPhotos[lbIdx];
  document.getElementById('lbCounter').textContent =
    `${lbIdx + 1} / ${lbPhotos.length}`;
  if (cat) document.getElementById('lbCat').textContent = cat;
}

function lbStep(d) {
  lbIdx = (lbIdx + d + lbPhotos.length) % lbPhotos.length;
  updateLb();
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('lbImgWrap').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeLightbox();
});

document.addEventListener('keydown', e => {
  if (!document.getElementById('lightbox').classList.contains('open')) return;
  if (e.key === 'ArrowLeft')  lbStep(-1);
  if (e.key === 'ArrowRight') lbStep(1);
  if (e.key === 'Escape')     closeLightbox();
});

let _lbTx = 0;
document.getElementById('lbImg').addEventListener('touchstart', e => {
  _lbTx = e.touches[0].clientX;
}, { passive: true });
document.getElementById('lbImg').addEventListener('touchend', e => {
  const dx = e.changedTouches[0].clientX - _lbTx;
  if (Math.abs(dx) > 36) lbStep(dx < 0 ? 1 : -1);
});

// ── Init ─────────────────────────────────────────────────────
goToPage(0);

// Replaced inline event handlers (CSP compliance)
document.getElementById('prevBtn').addEventListener('click', function() { changePage(-1); });
document.getElementById('nextBtn').addEventListener('click', function() { changePage(1); });
document.getElementById('lbCloseBtn').addEventListener('click', function() { closeLightbox(); });
document.getElementById('lbPrevBtn').addEventListener('click', function() { lbStep(-1); });
document.getElementById('lbNextBtn').addEventListener('click', function() { lbStep(1); });

// Event delegation for .ph and .section-more openCat calls
document.getElementById('deck').addEventListener('click', function(e) {
  var el = e.target.closest('[data-cat]');
  if (el) {
    var cat = el.getAttribute('data-cat');
    var idx = parseInt(el.getAttribute('data-idx'), 10);
    openCat(cat, idx);
  }
});

// Event delegation for page dots
document.getElementById('pageDots').addEventListener('click', function(e) {
  var el = e.target.closest('[data-page]');
  if (el) goToPage(parseInt(el.getAttribute('data-page'), 10));
});

/* 雫旅後台 Service Worker
 *
 * 設計原則：**一律網路優先**，快取只當離線備援。
 * 原因：2026-07 曾發生「瀏覽器拿到舊 HTML＋新 JS」造成整頁空白的事故，
 * 若這裡再做 cache-first，改版會被自己的快取擋住、且問題更難察覺。
 * 所以這支 SW 的職責只有兩件：離線時還能看到最後一次的畫面、接收推播通知。
 */
const CACHE = 'dropinn-admin-v1';
const OFFLINE_URLS = ['/notforyou/home/', '/notforyou/manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();                                   // 新版本立即接手，不等舊分頁關閉
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_URLS)).catch(() => {}));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;                     // 只管 GET，API 寫入一律直通
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;      // 外站資源不插手
  if (url.pathname.startsWith('/api/')) return;         // API 一律走網路，絕不快取（帳目數字不能是舊的）

  event.respondWith(
    fetch(req)
      .then((res) => {
        // 只快取成功的同源頁面/資產，供離線備援
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('/notforyou/home/'))),
  );
});

/* 推播：目前先支援「無酬載」推播（伺服器只送訊號，內容由 SW 決定）。
   之後接上帶內容的推播時，改讀 event.data 即可，其餘不動。 */
self.addEventListener('push', (event) => {
  let title = '雫旅後台', body = '有新的訂單動態，點開查看';
  try {
    if (event.data) {
      const d = event.data.json();
      title = d.title || title;
      body = d.body || body;
    }
  } catch (e) { /* 無酬載或非 JSON → 用預設文案 */ }
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'dropinn-admin',
    renotify: true,
    data: { url: '/notforyou/home/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/notforyou/home/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.includes('/notforyou/') && 'focus' in c) return c.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});

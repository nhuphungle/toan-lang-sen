// Service worker: cache vỏ ứng dụng để chạy offline. Chỉ xử lý GET cùng origin.
const CACHE = 'tls-v4';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest', 'icon.svg', 'data/lop1.json',
  'src/app.js', 'src/dom.js', 'src/audio.js', 'src/rng.js', 'src/content-schema.js', 'src/generator.js',
  'src/adaptive.js', 'src/rewards.js', 'src/storage.js', 'src/avatar.js', 'src/pin.js', 'src/play-clock.js',
  'src/screens/welcome.js', 'src/screens/map.js', 'src/screens/lesson.js', 'src/screens/farm.js', 'src/screens/parent.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
          .catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error())),
    ),
  );
});

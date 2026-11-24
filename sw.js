// Offline-Unterstützung: App-Dateien zwischenspeichern.
// Anfragen an Google (Anmeldung, Drive) werden NIE zwischengespeichert.
const CACHE = 'planer-v2';
const FILES = [
  './', 'index.html', 'style.css', 'config.js', 'sync-core.js', 'drive.js', 'app.js',
  'icon.svg', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Netzwerk zuerst (damit Updates ankommen), sonst Cache – nur für eigene Dateien
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })
        .then(r => r || caches.match('index.html')))
  );
});

/* Service Worker — Financial Daily Report V4.5
   Membuat aplikasi bisa dibuka offline (app shell + library CDN). */

const CACHE_NAME = 'finreport-v4-6-5';

// File inti aplikasi (same-origin) — wajib ter-cache
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './favicon.png',
  './apple-touch-icon.png'
];

// Library dari CDN — di-cache best-effort (boleh gagal saat offline pertama)
const CDN_LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
];

// ===== INSTALL: cache app shell + coba cache CDN =====
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // App shell: cache satu per satu, jangan gagal total kalau salah satu meleset
      await Promise.all(APP_SHELL.map((url) =>
        cache.add(url).catch((err) => console.log('[SW] gagal cache:', url, err))
      ));
      // CDN libs: best-effort (no-cors)
      await Promise.all(CDN_LIBS.map((url) =>
        fetch(url, { mode: 'no-cors' })
          .then((res) => cache.put(url, res))
          .catch(() => { /* abaikan kalau offline */ })
      ));
    })
  );
  // Catatan: skipWaiting TIDAK dipanggil di sini.
  // SW baru menunggu sampai user menekan "Update" (lihat pesan SKIP_WAITING).
});

// Terima perintah dari halaman untuk segera mengaktifkan SW baru
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ===== ACTIVATE: bersihkan cache lama =====
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ===== FETCH: cache-first, fallback ke network =====
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // Simpan salinan respons GET yang berhasil (same-origin & CDN)
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, resClone).catch(() => {});
          });
          return res;
        })
        .catch(() => {
          // Offline & tidak ada di cache → kalau ini navigasi halaman, kembalikan index
          if (req.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});

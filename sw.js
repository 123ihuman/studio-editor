/* Studio X · Service Worker
   Caches the app shell so it works offline.
   Media files and API calls always go to the network.
*/

const CACHE = 'studio-x-v10';
const SHELL = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache API calls or media
  if (e.request.method !== 'GET') return;
  if (url.pathname.includes('/api/') ||
      url.pathname.includes('/tts') ||
      url.pathname.includes('/celebvoice') ||
      url.pathname.includes('/t2v') ||
      url.pathname.includes('/faceswap') ||
      url.pathname.includes('/video/') ||
      url.pathname.includes('/script/')) return;
  if (url.hostname.includes('huggingface.co') ||
      url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('pexels.com') ||
      url.hostname.includes('pixabay.com') ||
      url.hostname.includes('replicate.com') ||
      url.hostname.includes('d-id.com') ||
      url.hostname.includes('heygen.com') ||
      url.hostname.includes('api.groq.com')) return;

  // App shell: cache-first, network fallback
  if (e.request.mode === 'navigate' || SHELL.some(f => url.pathname.endsWith(f.replace('./','')))){
    e.respondWith(
      caches.match(e.request).then(hit =>
        hit || fetch(e.request).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
          return res;
        }).catch(() => caches.match('./index.html'))
      )
    );
    return;
  }

  // Everything else: network-first, cache fallback
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok && url.origin === self.location.origin){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
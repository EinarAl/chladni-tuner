const CACHE = 'chladni-tuner-v1'
const URLS = ['/', '/index.html', '/manifest.json', '/favicon.svg']

self.addEventListener('install', (e: ExtendableEvent) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (e: ExtendableEvent) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  )
})

self.addEventListener('fetch', (e: FetchEvent) => {
  e.respondWith(
    caches.match(e.request).then(r => r ?? fetch(e.request))
  )
})

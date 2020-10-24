const currentCache = 'cache0';
const assetsToCache = [
  '/',
  
  './style.css',
  
  './icon-192.png',
  './icon-512.png',
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open("assets").then(cache => {
      return cache.addAll(assetsToCache);
    })
  );
});


self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(storedCaches => {
      return Promise.all(
        storedCaches.map(cacheName => {
          if(cacheName !== currentCache) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const request = event.request.clone();

        return fetch(request).then((networkResponse) => {
          if(request.method !== 'GET') {
            return networkResponse;
          }
          
          caches.open(currentCache).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse.clone();
        })
        .catch(err => {
          return cachedResponse;
        });
      })
    );
});
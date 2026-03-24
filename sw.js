var CACHE_NAME = 'sl-research-v1';
var urlsToCache = ['/', '/index.html', '/styles.css', '/app.js', '/btr.html', '/btr.css', '/btr.js'];

self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) { return cache.addAll(urlsToCache); }));
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    fetch(event.request).catch(function() { return caches.match(event.request); })
  );
});

// Service Worker：离线缓存应用外壳，让「添加到主屏幕」后可离线打开
// 缓存策略：静态资源 cache-first + 后台同步更新（stale-while-revalidate）
"use strict";
var CACHE = "wm-shell-v1";
var ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/config.js",
  "./js/utils.js",
  "./js/geo.js",
  "./js/camera.js",
  "./js/watermark.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/icon.svg"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE; })
            .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(req).then(function (res) {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      });
    })
  );
});

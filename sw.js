/* 京都小顾问 · 离线缓存
   只有通过 http(s) 打开页面时才会注册本文件；直接双击 index.html（file://）不会用到它。 */
const V = 'jdxgw-v6';
const CORE = ['./', './index.html'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* 页面本身：网络优先，断网回落到缓存的那一份 */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copy = r.clone();
          caches.open(V).then(c => c.put('./index.html', copy));
          return r;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  /* 天气接口、地图瓦片、在线字体：先用缓存，同时后台更新 */
  const fresh = /(^|\.)open-meteo\.com$/.test(url.hostname) || /autonavi\.com$/.test(url.hostname) || /fonts\.loli\.net$/.test(url.hostname);
  if (fresh) {
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => {
        if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
        return r;
      }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});

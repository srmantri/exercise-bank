/* Offline cache. A session reference that fails at 06:00 with no signal is worse
   than the plain text it replaced, so the whole app + every photo is precached. */
'use strict';

/* Bump this on every deploy that changes app.js, styles.css or the data.
   The activate handler deletes every other cache, so a new name is what
   forces an already-installed client onto the new build. */
var CACHE = 'eb-v2';
var CORE = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './data/sessions.json',
  './data/movements.json'
];

self.addEventListener('install', function (e) {
  e.waitUntil((async function () {
    var c = await caches.open(CACHE);
    // core must all succeed
    await c.addAll(CORE);
    // images are derived from the bank so this list can never drift out of sync;
    // allSettled so one bad photo can't fail the whole install
    try {
      var res = await fetch('./data/movements.json', { cache: 'reload' });
      var data = await res.json();
      var imgs = [];
      data.movements.forEach(function (m) {
        (m.images || []).forEach(function (p) { imgs.push(p.replace(/^/, './')); });
      });
      await Promise.allSettled(imgs.map(function (u) { return c.add(u); }));
    } catch (err) { /* app still works online; photos fill in on first view */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) {
      return k === CACHE ? null : caches.delete(k);
    }));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  e.respondWith((async function () {
    var cached = await caches.match(req, { ignoreSearch: true });
    if (cached) {
      // refresh in the background so edits land on the next visit
      fetch(req).then(function (r) {
        if (r && r.ok) caches.open(CACHE).then(function (c) { c.put(req, r.clone()); });
      }).catch(function () { });
      return cached;
    }
    try {
      var fresh = await fetch(req);
      if (fresh && fresh.ok) {
        var c = await caches.open(CACHE);
        c.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      // navigation offline with nothing cached → fall back to the shell
      if (req.mode === 'navigate') {
        var shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});

const CACHE = "deal-board-v9";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // data always live from Supabase
  const req = (e.request.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname.endsWith("sw.js") || url.pathname.endsWith("version.txt")) ? new Request(e.request, { cache: "no-store" }) : e.request;
  e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});

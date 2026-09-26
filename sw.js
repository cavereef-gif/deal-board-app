const CACHE = "deal-board-v17";
const SHELL = ["./", "index.html", "app.css", "ui.js", "directory.js", "directory2.js", "today.js", "task.js", "kitdata.js", "dealkit.js", "board.js", "calc.js", "archive.js", "extras.js", "reader.js", "sections.js", "titanium.css", "manifest.webmanifest", "icon.svg", "icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== "share-inbox").map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  // Android share sheet: WhatsApp > Export chat > Deal Board
  if (e.request.method === "POST" && url.origin === location.origin && url.pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      const fd = await e.request.formData();
      const files = fd.getAll("file").filter(f => f && typeof f !== "string");
      const c = await caches.open("share-inbox");
      await c.put("./shared-meta", new Response(JSON.stringify({ title: fd.get("title") || "", text: fd.get("text") || "", names: files.map(f => f.name), at: Date.now() })));
      if (files[0]) await c.put("./shared-file-0", new Response(files[0], { headers: { "content-type": files[0].type || "text/plain" } }));
      return Response.redirect("./?shared=1", 303);
    })());
    return;
  }
  if (e.request.method !== "GET" || url.origin !== location.origin) return; // data always live from Supabase
  const fresh = e.request.mode === "navigate" || /(index\.html|sw\.js|version\.txt|directory2?\.js|today\.js|task\.js|kitdata\.js|dealkit\.js|app\.css|ui\.js|board\.js|calc\.js|archive\.js|extras\.js|reader\.js|sections\.js|titanium\.css)$/.test(url.pathname);
  const req = fresh ? new Request(e.request, { cache: "no-store" }) : e.request;
  e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

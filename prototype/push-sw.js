// Deal Board – phone reminders (web push). Loaded by sw.js on the live app, and registered on its own for the preview and
// prototype folders (which have no sw.js). It only shows the note and opens the app when tapped – no caching here.
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  const base = self.registration.scope.replace(/(prototype|preview)\/$/, "");
  e.waitUntil(self.registration.showNotification(d.title || "Deal Board", {
    body: d.body || "", tag: d.tag || "deal-board", renotify: true,
    icon: base + "icon-192.png", badge: base + "icon-192.png", data: { url: d.url || self.registration.scope },
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const scope = self.registration.scope;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.indexOf(scope) === 0 && "focus" in c) return c.focus();
    return clients.openWindow(scope);
  }));
});

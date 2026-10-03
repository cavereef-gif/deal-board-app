// Deal Board – phone reminders (web push). Loaded by sw.js on the live app, and registered on its own for the preview and
// prototype folders (which have no sw.js). It only shows the note and opens the app when tapped – no caching here.
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  const base = self.registration.scope.replace(/(prototype|preview)\/$/, "");
  const jobs = [self.registration.showNotification(d.title || "Deal Board", {
    body: d.body || "", tag: d.tag || "deal-board", renotify: true,
    icon: base + "icon-192.png", badge: base + "icon-192.png", data: { url: d.url || self.registration.scope },
  })];
  // 3 Oct 2026 (prototype): the 07:00 note carries the number of late tasks for the app icon, so it is right before the app is
  // opened. Only where the phone has the badge (iPhone home-screen app, iOS 16.4+); elsewhere nothing happens.
  const nav = self.navigator;
  if (typeof d.badge === "number" && nav && "setAppBadge" in nav) jobs.push((d.badge > 0 ? nav.setAppBadge(d.badge) : nav.clearAppBadge()).catch(() => {}));
  e.waitUntil(Promise.all(jobs));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const scope = self.registration.scope;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.indexOf(scope) === 0 && "focus" in c) return c.focus();
    return clients.openWindow(scope);
  }));
});

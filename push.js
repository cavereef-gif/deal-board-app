// Deal Board v17 – phone reminders (26 Sep 2026, approved in the "build the complete app" scope; free).
// More › Settings › Phone reminders: turn on for this phone, send a test, turn off. The server sends one short note at 07:00
// on weekdays ("2 late · 3 due today · 1 suggested to check"). iPhone: iOS 16.4 or newer, and the app must be opened from the
// Home Screen (Share › Add to Home Screen) – Apple allows web push only there.
const pushSub = /\/(prototype|preview)\//.test(location.pathname);   // those folders have no sw.js of their own
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
// 3 Oct 2026: a phone that runs the prototype is labelled "· prototype", so the 07:00 note can send it the content-free wording
// ("1 deal needs you") and the number for the app icon; phones on the live app keep their note exactly as it is.
const isProto = /\/prototype\//.test(location.pathname);
const devName = () => (isIOS ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android phone" : "Computer") + " · " + new Date().toISOString().slice(0, 10) + (isProto ? " · prototype" : "");
window.pushDevName = devName;
const pushOK = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
function b64uBytes(s) { const p = "=".repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); const out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; }
async function pushReg() {
  if (!pushSub) { const r = await navigator.serviceWorker.getRegistration(); if (r) return r; }
  const reg = await navigator.serviceWorker.register(pushSub ? "push-sw.js" : "sw.js", { scope: "./" });
  if (!reg.active) await new Promise(ok => { const w = reg.installing || reg.waiting; if (!w) return ok(); w.addEventListener("statechange", () => { if (w.state === "activated") ok(); }); setTimeout(ok, 5000); });
  return reg;
}
async function pushLoad() {
  const st = window._push = window._push || {};
  st.ok = pushOK(); st.perm = st.ok ? Notification.permission : "unsupported";
  if (DEMO) { st.phones = st.phones || 0; return; }
  try { const { data } = await sb.rpc("push_status"); if (data) { st.phones = data.phones; st.key = data.public_key; } } catch (e) {}
  try { if (st.ok) { const r = await navigator.serviceWorker.getRegistration(pushSub ? "./" : undefined); const s = r && await r.pushManager.getSubscription(); st.here = !!s; st.endpoint = s ? s.endpoint : ""; } } catch (e) {}
}
window.pushSettingsHtml = () => {
  const st = window._push || {};
  let h = `<div class="card setc"><div class="lbl" style="margin-top:0">Phone reminders</div>
    <div class="quiet">${isProto ? "One short note at 07:00 on weekdays that says only how many things need you – e.g. “1 deal needs you”, never a name, amount or person – and puts the number of late tasks on the app icon (iPhone). Tap it to open the app." : "One short note at 07:00 on weekdays: what is late, what is due today and what is suggested. Tap it to open the app."}</div>`;
  if (!st.ok) {
    h += `<div class="quiet">${isIOS ? "On iPhone: update to iOS 16.4 or newer, then in Safari tap Share › Add to Home Screen and open Deal Board from the Home Screen. The button appears there." : "This browser can't show reminders. Use Chrome on Android."}</div>`;
    return h + `</div>`;
  }
  h += `<div class="kv"><span class="k">This phone</span><span class="v">${st.here ? "On" : st.perm === "denied" ? "Blocked in the phone's settings" : "Off"}</span></div>`;
  if (st.phones) h += `<div class="kv"><span class="k">Your phones with reminders</span><span class="v">${st.phones}</span></div>`;
  h += st.here
    ? `<div class="acts0"><button data-pushtest="1">${ic("send")}Send a test</button><button data-pushoff="1">${ic("drop")}Turn off here</button></div>`
    : st.perm === "denied" ? `<div class="quiet">Reminders are blocked for this site. Open the phone's Settings › Apps › Chrome › Notifications (or tap the lock by the web address) and allow them, then come back.</div>`
    : `<button class="primary wide" data-pushon="1">${ic("clock")}Turn on reminders on this phone</button>`;
  return h + `</div>`;
};
document.addEventListener("click", async e => {
  const on = e.target.closest("button[data-pushon]"), test = e.target.closest("button[data-pushtest]"), off = e.target.closest("button[data-pushoff]");
  if (!on && !test && !off) return;
  const st = window._push = window._push || {};
  if (DEMO) { if (on) { st.here = true; st.phones = 1; toast("Reminders on (demo – nothing saved)."); } if (off) { st.here = false; st.phones = 0; toast("Reminders off (demo)."); } if (test) toast("Test sent (demo)."); render(); return; }
  try {
    if (on) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { st.perm = perm; toast("Reminders need your OK – the phone said no."); render(); return; }
      let key = st.key;
      if (!key) { const { data } = await sb.functions.invoke("tools", { body: { action: "push_key" } }); key = data && data.public_key; }
      if (!key) throw new Error("the server key is missing");
      const reg = await pushReg();
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(key) });
      const dev = devName();
      const { error } = await sb.rpc("push_subscribe", { p_sub: sub.toJSON(), p_device: dev });
      if (error) throw error;
      toast("Reminders are on for this phone. Tap Send a test to see one.");
    } else if (test) {
      const { data, error } = await sb.functions.invoke("tools", { body: { action: "push_test" } });
      if (error || !data || !data.ok) throw new Error((data && data.error) || (error && error.message) || "no answer");
      toast(data.sent ? `Test sent to ${data.sent} phone${data.sent === 1 ? "" : "s"} – it should appear in a few seconds.` : "No phone answered – turn reminders off and on again.", 6000);
    } else if (off) {
      const reg = await navigator.serviceWorker.getRegistration(pushSub ? "./" : undefined), sub = reg && await reg.pushManager.getSubscription();
      if (sub) { await sb.rpc("push_unsubscribe", { p_endpoint: sub.endpoint }); await sub.unsubscribe(); }
      toast("Reminders are off for this phone.");
    }
  } catch (err) { toast("Couldn't do that: " + (err.message || err), 6000); }
  await pushLoad(); render();
});
(window._after ||= []).push(() => { if (view === "settings" && !window._pushAt) { window._pushAt = 1; pushLoad().then(() => { if (view === "settings") render(); }); } });
// reminders already on in the prototype (before the label existed): label that phone once – the same subscription, saved again
(window._after ||= []).push(() => {
  if (!isProto || DEMO || !me || window._pushTagged || !pushOK() || Notification.permission !== "granted") return;
  window._pushTagged = 1;
  navigator.serviceWorker.getRegistration("./").then(r => r && r.pushManager.getSubscription()).then(s => {
    if (!s) return; let done = ""; try { done = localStorage.getItem("pushTag") || ""; } catch (e) {}
    if (done === s.endpoint) return;
    return sb.rpc("push_subscribe", { p_sub: s.toJSON(), p_device: devName() }).then(({ error }) => { if (!error) { try { localStorage.setItem("pushTag", s.endpoint); } catch (e) {} } });
  }).catch(() => {});
});

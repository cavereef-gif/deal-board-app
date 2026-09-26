// Deal Board v17 – the Google link (26 Sep 2026, approved in the "build the complete app" scope).
// A small script runs in Chris's own Google account (free, no card). It keeps a shared "Deal Board" calendar of task dates,
// shows his meetings on Today, puts the saved contacts in Google Contacts (names show when they call), makes a Drive folder
// per deal, turns emails he labels "Deal Board" into SUGGESTED tasks, and sends a short morning email on weekdays.
// It talks to the database with a link code made here (shown once; only its fingerprint is kept) – see docs/db/006.

// ---------- the script text (copied to the clipboard with the code already filled in) ----------
function googleScriptText(code) {
  const APP = "https://cavereef-gif.github.io/deal-board-app/";
  return `// Deal Board – Google link. Runs in your own Google account. Made ${new Date().toISOString().slice(0, 10)}.
// What it does: a shared "Deal Board" calendar of task dates · your meetings on the app's Today · saved contacts into
// Google Contacts · a Drive folder per deal · emails you label "Deal Board" become suggested tasks · a weekday morning email.
// First time: pick "setup" at the top and tap Run, then allow it. After that it runs by itself.
const LINK_CODE = '${code}';
const SB_URL = '${SB_URL}';
const SB_KEY = '${SB_KEY}';   // the app's public key (the same one the web page uses)
const APP_URL = '${APP}';
const TZ = 'Africa/Johannesburg';
const CAL_NAME = 'Deal Board', LABEL = 'Deal Board', LABEL_DONE = 'Deal Board/added', FOLDER = 'Deal Board';

function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('hourly').timeBased().everyHours(1).create();
  ScriptApp.newTrigger('morning').timeBased().atHour(6).nearMinute(30).everyDays(1).inTimezone(TZ).create();
  GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  GmailApp.getUserLabelByName(LABEL_DONE) || GmailApp.createLabel(LABEL_DONE);
  hourly();
  Logger.log('Done. The Deal Board link is running. You can close this page.');
}

function api(fn, body) {
  const r = UrlFetchApp.fetch(SB_URL + '/rest/v1/rpc/' + fn, { method: 'post', contentType: 'application/json',
    headers: { apikey: SB_KEY }, payload: JSON.stringify(Object.assign({ p_token: LINK_CODE }, body || {})), muteHttpExceptions: true });
  const code = r.getResponseCode(), text = r.getContentText();
  if (code >= 300) throw new Error('Deal Board answered ' + code + ': ' + text.slice(0, 200));
  return text ? JSON.parse(text) : null;
}
const props = PropertiesService.getScriptProperties();
const getMap = k => JSON.parse(props.getProperty(k) || '{}');
const setMap = (k, m) => props.setProperty(k, JSON.stringify(m));
function myName(data) {
  const me = Session.getEffectiveUser().getEmail().toLowerCase();
  const o = (data.owners || []).find(x => String(x.email || '').toLowerCase() === me);
  return o ? o.name : 'Chris';
}
function others(data) {
  const me = Session.getEffectiveUser().getEmail().toLowerCase();
  return (data.owners || []).filter(x => x.email && x.email.toLowerCase() !== me);
}

function hourly() {
  const data = api('gs_pull');
  const steps = [['calendar', () => syncCalendar(data)], ['meetings', () => pushMeetings(data)], ['folders', () => syncFolders(data)],
    ['email', () => emailIn(data)], ['contacts', () => syncContacts(data)]];
  steps.forEach(([name, f]) => { try { f(); } catch (e) { Logger.log(name + ': ' + e.message); } });
}

// ---- the shared calendar: one entry per task date, 08:30 with a reminder; removed when the task is done ----
function dealCalendar(data) {
  let cal = CalendarApp.getCalendarsByName(CAL_NAME)[0];
  if (!cal) {
    cal = CalendarApp.createCalendar(CAL_NAME, { summary: 'Task dates from the Deal Board app', timeZone: TZ });
    if (typeof Calendar !== 'undefined') others(data).forEach(o => { try { Calendar.Acl.insert({ role: 'writer', scope: { type: 'user', value: o.email } }, cal.getId()); } catch (e) { Logger.log('share: ' + e.message); } });
  }
  return cal;
}
function syncCalendar(data) {
  const cal = dealCalendar(data), map = getMap('events'), seen = {};
  const today = data.today;
  for (const t of data.tasks || []) {
    if (!t.has_date || t.suggested || t.due < addDays(today, -7) || t.due > addDays(today, 90)) continue;   // suggested tasks wait for Accept
    const title = (t.owner && t.owner !== 'Chris' ? t.owner + ' · ' : '') + (t.who === 'Me' ? t.title : 'Chase ' + t.who + ': ' + t.title) + (t.urgent ? ' (urgent)' : '');
    const start = new Date(t.due + 'T08:30:00+02:00'), end = new Date(t.due + 'T08:45:00+02:00');
    const desc = (t.deal ? 'Deal: ' + t.deal + '\\n' : '') + 'Open the app: ' + APP_URL;
    seen[t.id] = 1;
    let ev = map[t.id] ? cal.getEventById(map[t.id]) : null;
    if (ev) { if (ev.getTitle() !== title) ev.setTitle(title); if (ev.getStartTime().getTime() !== start.getTime()) ev.setTime(start, end); }
    else { ev = cal.createEvent(title, start, end, { description: desc }); ev.removeAllReminders(); ev.addPopupReminder(0); map[t.id] = ev.getId(); }
  }
  for (const id of Object.keys(map)) if (!seen[id]) { try { const ev = cal.getEventById(map[id]); if (ev && ev.getStartTime() > new Date()) ev.deleteEvent(); } catch (e) {} delete map[id]; }
  setMap('events', map);
}
function addDays(k, n) { const d = new Date(k + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

// ---- your meetings for the next 7 days, for the app's Today (the Deal Board calendar itself is left out) ----
function pushMeetings(data) {
  const now = new Date(), until = new Date(now.getTime() + 7 * 864e5), from = new Date(now.getTime() - 12 * 3600e3);
  const hidden = [CalendarApp.Visibility.PRIVATE, CalendarApp.Visibility.CONFIDENTIAL];   // private appointments stay private
  const evs = CalendarApp.getDefaultCalendar().getEvents(from, until).filter(e => e.getMyStatus() !== CalendarApp.GuestStatus.NO && hidden.indexOf(e.getVisibility()) < 0);
  const list = evs.slice(0, 150).map(e => ({ id: e.getId() + '@' + e.getStartTime().getTime(), title: e.getTitle() || '(no title)', starts: e.getStartTime().toISOString(),
    ends: e.getEndTime().toISOString(), all_day: e.isAllDayEvent(), location: e.getLocation() || '' }));
  api('gs_put_events', { p_owner: myName(data), p_events: list });
}

// ---- a Drive folder per live deal, shared with your partner ----
function syncFolders(data) {
  const it = DriveApp.getFoldersByName(FOLDER);
  let root = it.hasNext() ? it.next() : null;
  if (!root) { root = DriveApp.createFolder(FOLDER); others(data).forEach(o => { try { root.addEditor(o.email); } catch (e) {} }); }
  const out = [];
  for (const d of data.deals || []) {
    if (d.folder) continue;
    const name = String(d.name || 'Deal').replace(/[\\\\/:*?"<>|]/g, '-').slice(0, 100);
    const f = root.getFoldersByName(name); const folder = f.hasNext() ? f.next() : root.createFolder(name);
    out.push({ deal_id: d.id, url: folder.getUrl() });
  }
  if (out.length) api('gs_put_folders', { p_folders: out });
}

// ---- emails you label "Deal Board" become suggested tasks in the app (Accept or Drop there) ----
function emailIn(data) {
  const label = GmailApp.getUserLabelByName(LABEL), done = GmailApp.getUserLabelByName(LABEL_DONE) || GmailApp.createLabel(LABEL_DONE);
  if (!label) return;
  const threads = label.getThreads(0, 20); if (!threads.length) return;
  const me = myName(data), msgs = [];
  for (const th of threads) {
    const m = th.getMessages()[0], fromRaw = m.getFrom(), name = (fromRaw.match(/^\\s*"?([^"<]+?)"?\\s*</) || [null, fromRaw])[1].trim();
    msgs.push({ id: m.getId(), from: name, subject: th.getFirstMessageSubject(), snippet: m.getPlainBody().replace(/\\s+/g, ' ').slice(0, 280),
      link: 'https://mail.google.com/mail/u/0/#all/' + th.getId(), owner: me });
  }
  api('gs_email_in', { p_msgs: msgs });
  threads.forEach(th => { th.removeLabel(label); th.addLabel(done); });
}

// ---- saved contacts into Google Contacts (needs the People API service – see the steps in the app) ----
function syncContacts(data) {
  if (typeof People === 'undefined') return;
  const map = getMap('contacts');
  let group = props.getProperty('group');
  if (!group) {
    const g = People.ContactGroups.list({ pageSize: 200 }).contactGroups || [], hit = g.find(x => x.name === 'Deal Board');
    group = hit ? hit.resourceName : People.ContactGroups.create({ contactGroup: { name: 'Deal Board' } }).resourceName;
    props.setProperty('group', group);
  }
  for (const c of data.contacts || []) {
    if (map[c.id]) continue;   // made once; later changes are done in Google Contacts or the app
    const body = { names: [{ unstructuredName: c.name }], memberships: [{ contactGroupMembership: { contactGroupResourceName: group } }] };
    const phones = [c.phone, c.whatsapp].filter((v, i, a) => v && a.indexOf(v) === i).map(v => ({ value: v }));
    if (phones.length) body.phoneNumbers = phones;
    if (c.email) body.emailAddresses = [{ value: c.email }];
    if (c.company || c.role) body.organizations = [{ name: c.company || '', title: c.role || '' }];
    map[c.id] = People.People.createContact(body).resourceName;
  }
  setMap('contacts', map);
}

// ---- the weekday morning email (06:30): what is late, what is due today, today's meetings, the border note ----
function morning() {
  const day = Number(Utilities.formatDate(new Date(), TZ, 'u'));   // 1 = Monday … 7 = Sunday
  if (day > 5) return;
  const data = api('gs_pull'), today = data.today, me = myName(data);
  const meet = CalendarApp.getDefaultCalendar().getEventsForDay(new Date()).filter(e => !e.isAllDayEvent());
  for (const o of data.owners || []) {
    const mine = (data.tasks || []).filter(t => (t.owner || 'Chris') === o.name && !t.suggested);
    const late = mine.filter(t => t.due < today), due = mine.filter(t => t.due === today), sugg = (data.tasks || []).filter(t => t.suggested).length;
    const line = t => '<li>' + esc(t.who === 'Me' ? t.title : t.who + ': ' + t.title) + (t.urgent ? ' – urgent' : '') + (t.deal ? ' <span style="color:#5F646B">(' + esc(t.deal) + ')</span>' : '') + '</li>';
    let h = '<div style="font:16px/1.5 Arial,sans-serif;color:#1C1E21;max-width:560px">';
    h += '<p>Good morning ' + esc(o.name) + ',</p>';
    if (late.length) h += '<p><b style="font-weight:600">Late (' + late.length + ')</b></p><ul>' + late.slice(0, 12).map(line).join('') + '</ul>';
    if (due.length) h += '<p><b style="font-weight:600">Due today (' + due.length + ')</b></p><ul>' + due.slice(0, 12).map(line).join('') + '</ul>';
    if (!late.length && !due.length) h += '<p>Nothing late and nothing due today.</p>';
    if (sugg) h += '<p>' + sugg + ' suggested task' + (sugg === 1 ? '' : 's') + ' waiting for Accept or Drop.</p>';
    if (o.name === me && meet.length) h += '<p><b style="font-weight:600">Meetings today</b></p><ul>' + meet.map(e => '<li>' + Utilities.formatDate(e.getStartTime(), TZ, 'HH:mm') + ' ' + esc(e.getTitle()) + '</li>').join('') + '</ul>';
    if (data.borders) h += '<p><b style="font-weight:600">Borders</b><br>' + esc(data.borders) + '</p>';
    if (data.diesel && data.diesel.status === 'suggested' && data.diesel.inland) h += '<p>New diesel price to check in the app: R' + Number(data.diesel.inland).toFixed(2) + ' a litre (inland).</p>';
    h += '<p><a href="' + APP_URL + '" style="color:#1C1E21">Open Deal Board</a></p></div>';
    const subject = 'Deal Board – ' + Utilities.formatDate(new Date(), TZ, 'EEE d MMM') + ': ' + late.length + ' late, ' + due.length + ' today';
    if (o.email) MailApp.sendEmail({ to: o.email, subject: subject, htmlBody: h, name: 'Deal Board' });
  }
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
`;
}

// ---------- Settings › Google link ----------
window.googleSettingsHtml = () => {
  const st = window._gStatus || {}, fresh = window._gScript;
  const when = s => s ? new Date(s).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Johannesburg" }) : "";
  let h = `<div class="card setc"><div class="lbl" style="margin-top:0">Google link</div>
    <div class="quiet">Links your Google account (free): a shared "Deal Board" calendar with task dates, your meetings on Today, saved contacts in Google Contacts, a Drive folder per deal, emails you label "Deal Board" as suggested tasks, and a short email at 06:30 on weekdays.</div>`;
  h += `<div class="kv"><span class="k">Status</span><span class="v">${st.linked ? (st.seen ? "Working – last heard " + esc(when(st.seen)) : "Code made " + esc(when(st.made)) + " – waiting for the script") : "Not linked"}</span></div>`;
  if (fresh) h += `<div class="gsteps"><div class="lbl">Do this once on a computer (about 10 minutes)</div><ol>
      <li>Easiest: open this app on the computer (same link), sign in, go to More › Settings › Google link and tap the button there – the script is copied straight away. Or tap <b>Share the script</b> below and email it to yourself; <b>delete that email after pasting</b> (the script holds the secret code).</li>
      <li>On the computer open <a href="https://script.google.com/create" target="_blank" rel="noopener">script.google.com/create</a> while signed in to your Google account.</li>
      <li>Select everything in the page's text box, delete it, and paste (Ctrl+V).</li>
      <li>At the left, next to Services, tap <b>+</b>, pick <b>People API</b>, tap Add. Do the same for <b>Google Calendar API</b>.</li>
      <li>Tap the save icon. At the top, pick <b>setup</b> and tap <b>Run</b>. Allow it (Advanced › Go to project, if Google warns – it is your own script).</li>
      <li>Done. Come back here: the status says "Working" within a minute.</li></ol>
      <div class="acts0"><button data-gshare="1">${ic("send")}Share the script</button><button data-gcopy="1">${ic("copy")}Copy it again</button></div></div>`;
  h += st.linked
    ? `<div class="acts0"><button data-gnew="1">${ic("refresh")}Make a new code</button><button data-gdrop="1">${ic("drop")}Remove the link</button></div>`
    : `<button class="primary wide" data-gnew="1">${ic("link")}Make the link code and copy the script</button>`;
  return h + `<div class="quiet">The code is shown only inside the script. "Remove the link" stops it at once.</div></div>`;
};
async function gStatus() {
  if (DEMO) { window._gStatus = window._gStatus || { linked: false }; return; }
  try { const { data } = await sb.rpc("google_link_status"); window._gStatus = data || { linked: false }; } catch (e) {}
}
document.addEventListener("click", async e => {
  if (e.target.closest("button[data-gnew]")) {
    if (window._gStatus && window._gStatus.linked && !confirmTap(e.target.closest("button"), "Tap again: the old code stops working")) return;
    let code;
    if (DEMO) code = "demo-code-not-real-0000000000000000";
    else { const { data, error } = await sb.rpc("google_link_new"); if (error) { toast("Could not make the code: " + error.message, 6000); return; } code = data; }
    window._gScript = googleScriptText(code);
    try { await navigator.clipboard.writeText(window._gScript); toast("Script copied – the steps are below."); } catch (x) { toast("The steps are below – use Share the script."); }
    window._gStatus = DEMO ? { linked: true, made: new Date().toISOString() } : window._gStatus; await gStatus(); render(); return;
  }
  if (e.target.closest("button[data-gshare]")) { const how = await shareFile(new Blob([window._gScript || ""], { type: "text/plain" }), "deal-board-google-script.txt", "Deal Board – Google script"); if (how === "saved") toast("Saved to your downloads."); return; }
  if (e.target.closest("button[data-gcopy]")) { try { await navigator.clipboard.writeText(window._gScript || ""); toast("Script copied."); } catch (x) { toast("Copy not allowed here."); } return; }
  if (e.target.closest("button[data-gdrop]")) {
    if (!confirmTap(e.target.closest("button"), "Tap again to remove the Google link")) return;
    if (!DEMO) { const { error } = await sb.rpc("google_link_drop"); if (error) { toast("Could not remove: " + error.message); return; } }
    window._gStatus = { linked: false }; window._gScript = null; toast("Google link removed."); render(); return;
  }
});
// two taps for anything that can't be undone by one more tap: the first arms the button for 4 seconds
function confirmTap(btn, msg) {
  if (btn.dataset.armed === "1") { btn.dataset.armed = ""; return true; }
  btn.dataset.armed = "1"; toast(msg); setTimeout(() => { btn.dataset.armed = ""; }, 4000); return false;
}

// ---------- meetings on Today and the Drive folder on a deal ----------
async function loadGoogleBits(force) {
  if (!force && window._gAt && Date.now() - window._gAt < 600e3) return;
  window._gAt = Date.now();
  if (DEMO) {
    const t = saDayPlus(0);
    window._meetings = [{ owner: "Chris", title: "Call with the transporter", starts: t + "T09:00:00+02:00", all_day: false }, { owner: "Chris", title: "Site visit – stockpile", starts: t + "T14:30:00+02:00", all_day: false }];
    window._folders = { dm1: "https://drive.google.com/drive/folders/demo" };
    return;
  }
  gStatus();
  try {
    const from = new Date(Date.now() - 12 * 3600e3).toISOString();
    const [m, f] = await Promise.all([sb.from("calendar_events").select("owner,title,starts,ends,all_day,location").gte("starts", from).order("starts").limit(200), sb.from("deal_folders").select("deal_id,url")]);
    window._meetings = m.data || []; window._folders = {}; for (const x of f.data || []) window._folders[x.deal_id] = x.url;
  } catch (e) {}
  if (view === "worklist") render();
}
window.meetingsHtml = target => {
  const t = saDayPlus(0), who = target === "All" ? null : target;
  const list = (window._meetings || []).filter(m => (!who || m.owner === who) && saDayKey(m.starts) === t && !m.all_day);
  if (!list.length) return "";
  const hm = s => new Date(s).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Johannesburg" });
  return `<div class="meets"><div class="mt-h">${ic("calendar")}Meetings today</div>${list.slice(0, 6).map(m => `<div class="mt-r"><span class="mt-t">${hm(m.starts)}</span><span class="mt-n">${esc(m.title)}${who ? "" : ` <small>· ${esc(m.owner)}</small>`}</span></div>`).join("")}</div>`;
};
window.driveLinkHtml = d => { const u = (window._folders || {})[d.id]; return u ? `<a class="btnlink wide" target="_blank" rel="noopener" href="${esc(u)}">${ic("open")}Open the deal's Google Drive folder</a>` : ""; };
(window._after ||= []).push(() => { if (["worklist", "deal", "more", "settings"].includes(view) || document.querySelector("[data-gnew]")) loadGoogleBits(); });

// Deal Board v15 — Velvet design: icon set and small UI helpers (loaded before the app scripts).
const ICON = {
  chat: '<path d="M20.5 11.6a8.4 8.4 0 0 1-12.2 7.5L3.5 20.5l1.4-4.6a8.4 8.4 0 1 1 15.6-4.3z"/><path d="M8.6 10.6h.01M12 10.6h.01M15.4 10.6h.01" stroke-width="2.8"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7.5 8.5 6 8.5-6"/>',
  phone: '<path d="M6.6 3.5h2.6l1.5 4-1.9 1.3a11 11 0 0 0 6.4 6.4l1.3-1.9 4 1.5v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>',
  me: '<path d="M13 19H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5"/><path d="m3.5 7.5 8.5 6 8.5-6"/><path d="M16 19h6M19 16l3 3-3 3"/>',
  chatin: '<path d="M20.5 11.6a8.4 8.4 0 0 1-12.2 7.5L3.5 20.5l1.4-4.6a8.4 8.4 0 1 1 15.6-4.3z"/><path d="M12 7.2v6.3M9.2 10.8 12 13.6l2.8-2.8"/>',
  bot: '<path d="M11 3.5l1.7 4.6 4.6 1.7-4.6 1.7L11 16.1l-1.7-4.6L4.7 9.8l4.6-1.7z"/><path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  note: '<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5M8.5 9h7M8.5 12.5h4"/>',
  clip: '<path d="M20 11.5 12.2 19.3a5 5 0 0 1-7.1-7.1l8.1-8.1a3.3 3.3 0 0 1 4.7 4.7l-8.1 8.1a1.7 1.7 0 0 1-2.4-2.4l7.4-7.4"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14.5 7.5l3 3"/>',
  check: '<path d="M5 12.5 10 17.5 19.5 7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  flag: '<path d="M5.5 21V4.5M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
  assign: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20c.7-3.4 3-5.5 6-5.5 1.6 0 3 .5 4 1.5"/><path d="M15 17h6M18.5 14.5 21 17l-2.5 2.5"/>',
  drop: '<circle cx="12" cy="12" r="8.5"/><path d="m9 9 6 6m0-6-6 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  import: '<path d="M12 3.5v11M7.5 10l4.5 4.5 4.5-4.5"/><path d="M4.5 16v2.5A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5V16"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  back: '<path d="M15 5 8 12l7 7"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 8.5M4 4v4.5h4.5"/><path d="M4 13a8 8 0 0 0 14.3 4.3l1.7-1.8M20 20v-4.5h-4.5"/>',
  out: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16.5 5.5 12 10 7.5M5.5 12H15"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5z"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20c.8-3.8 3.8-6 7.5-6s6.7 2.2 7.5 6"/>',
  userplus: '<circle cx="10" cy="8" r="3.6"/><path d="M3.5 20c.8-3.6 3.4-5.6 6.5-5.6 1.4 0 2.6.4 3.6 1"/><path d="M18 13v6M15 16h6"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  pause: '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6M14 9v6"/>',
  list: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.4 2.6 3.4 5.4 3.4 8.5s-1 5.9-3.4 8.5c-2.4-2.6-3.4-5.4-3.4-8.5s1-5.9 3.4-8.5z"/>',
  book: '<path d="M4 5.5A2 2 0 0 1 6 3.5h14v14H6a2 2 0 0 0-2 2z"/><path d="M4 19.5a2 2 0 0 0 2 2h14v-4"/>',
  brief: '<path d="M4 6h16M4 11h16M4 16h10"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5"/><path d="M12 8v4l3 2"/>',
  terms: '<path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M15 3.5V8h4M8.5 12h7M8.5 15.5h7"/>',
  wait: '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4 4 5 4 8.5S8 16.5 8 20.5M16 3.5c0 4-4 5-4 8.5s4 4.5 4 8.5"/>',
  guide: '<circle cx="12" cy="12" r="8.5"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01" stroke-width="2.4"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z"/>',
  deals: '<rect x="3.5" y="7" width="17" height="12.5" rx="2.5"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17"/>',
  board: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v10a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17H5.5A1.5 1.5 0 0 1 4 15.5z"/><path d="M8 9h8M8 12.5h5"/>',
  people: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9.5" r="2.4"/><path d="M16 14.2c2.3.2 3.9 1.8 4.5 4.3"/>',
  truck: '<path d="M3 6.5h10.5v9H3zM13.5 10h4l3 3v2.5h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  gem: '<path d="M6.5 4h11L21 9l-9 11L3 9z"/><path d="M3 9h18M9.5 4 8 9l4 11 4-11-1.5-5"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8.5 7h7M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h3.5" stroke-width="2.2"/>',
  archive: '<rect x="3.5" y="4" width="17" height="4.5" rx="1.2"/><path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5M10 12.5h4"/>',
  pin: '<path d="M9 3.5h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 13.5V20.5"/>',
  checkbox: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
};
const ic = (n, cls) => `<svg class="i${cls ? " " + cls : ""}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n] || ""}</svg>`;
// Icon button. tone: wa | mail | call | me | bot | note | file | ok | warn | bad | link | mute
// Every icon button also shows one short word (Chris reads words, not pictures).
const IB_WORD = { copy: "Copy", check: "Done", undo: "Reopen", chatin: "Add chat", edit: "Edit", phone: "Call", chat: "WhatsApp", mail: "Email", me: "Email me", drop: "Drop", clock: "Chased", flag: "Urgent", note: "Notes", bot: "Ask", clip: "Files", refresh: "Refresh", send: "Send", pin: "Pin" };
const ibWord = (n, label) => /^Close/.test(label) ? "Close" : /^Remove/.test(label) ? "Remove" : /^Unpin/.test(label) ? "Unpin" : IB_WORD[n] || label;
const ib = (n, tone, attrs, label, badge) => { let a = attrs || "", on = ""; if (a.includes(' class="on"')) { a = a.replace(' class="on"', ""); on = " on"; }
  return `<button type="button" class="ib t-${tone}${on}" ${a} aria-label="${label}" title="${label}">${ic(n)}<span class="ibw">${ibWord(n, label)}</span>${badge ? `<span class="bdg">${badge}</span>` : ""}</button>`; };
// Big icon tile with a small caption (quick-action rows)
const tile = (n, tone, attrs, label) => `<button type="button" class="qa t-${tone}" ${attrs || ""} aria-label="${label}"><span class="qi">${ic(n)}</span><span class="ql">${label}</span></button>`;
// Progress ring for a deal
function ring(done, total) {
  const pct = total ? Math.round(done / total * 100) : 0, c = 2 * Math.PI * 15.5;
  return `<span class="ring" role="img" aria-label="${done} of ${total} steps done"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.5" class="rt"/><circle cx="18" cy="18" r="15.5" class="rv" stroke-dasharray="${(pct * c / 100).toFixed(1)} ${c.toFixed(1)}"/></svg><span class="rn">${pct}<small>%</small></span></span>`;
}
function fillIcons(root) { (root || document).querySelectorAll("[data-ico]").forEach(el => { if (!el.querySelector("svg.i")) el.insertAdjacentHTML("afterbegin", ic(el.dataset.ico)); }); }

// ---------- Dates in words (South African time) ----------
const WDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const saDate = d => new Date(new Date(d).getTime() + 2 * 3600e3);
const saDayKey = d => saDate(d).toISOString().slice(0, 10);
// Whole days from today to d (0 = today, 1 = tomorrow, -1 = yesterday)
const dayDiff = d => Math.round((Date.parse(saDayKey(d)) - Date.parse(saDayKey(Date.now()))) / 864e5);
// "Sat 26 Sep"
const dayName = d => { const x = saDate(d); return `${WDAY[x.getUTCDay()]} ${x.getUTCDate()} ${MON[x.getUTCMonth()]}`; };
// "today" · "tomorrow" · "yesterday" · "Sat 26 Sep"
const dayWords = d => { const n = dayDiff(d); return n === 0 ? "today" : n === 1 ? "tomorrow" : n === -1 ? "yesterday" : dayName(d); };
// "Asked today" · "Asked yesterday" · "Asked 4 days ago"
const agoWords = (d, verb) => { const n = -dayDiff(d); return `${verb} ${n <= 0 ? "today" : n === 1 ? "yesterday" : n + " days ago"}`; };
// When a task is next due: last asked (or added) + the nudge days
const dueDate = it => new Date(new Date(it.last_chased || it.created_at).getTime() + (it.nudge_after_days || 3) * 864e5);
// "Overdue" · "Due today" · "Due tomorrow" · "Due Sat 26 Sep"
const dueWords = it => { const n = dayDiff(dueDate(it)); return n < 0 ? "Overdue" : n === 0 ? "Due today" : n === 1 ? "Due tomorrow" : "Due " + dayName(dueDate(it)); };
// What kind of task, in words: "Suggested" · "Our job" · "Waiting on them"
const kindWords = it => it.state === "Proposed" ? "Suggested" : it._me ? "Our job" : "Waiting on them";
// "Asked 4 days ago" for waits, "Added today" for our own jobs
const sinceWords = it => it._me ? agoWords(it.created_at, "Added") : agoWords(it.last_chased || it.created_at, "Asked");
// Buyer-search task kinds in plain words (the data stores GATE, BUYER, SUPPLY, SEND-Mn …)
const kindName = k => { const u = String(k || "").toUpperCase(); return u === "GATE" ? "Check first" : u === "BUYER" ? "Buyer" : u === "SUPPLY" ? "Supplier" : u.startsWith("SEND") ? "Send" : String(k || "").charAt(0) + String(k || "").slice(1).toLowerCase(); };

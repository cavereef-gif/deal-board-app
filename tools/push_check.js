#!/usr/bin/env node
// Phone reminders, checked without a phone (3 Oct 2026). Usage: node tools/push_check.js   (prints PASS / FAIL lines)
// 1 push-sw.js: the 07:00 note is always shown; a number in it goes on the app icon (0 clears it); no number, no change.
// 2 the server's note for prototype phones (supabase/functions/tools/index.ts, between PROTO-NOTE-START/END): counts only –
//   never a name, amount or person – and the late count for the icon; only phones labelled "· prototype" get it.
const fs = require("fs"), path = require("path"), vm = require("vm");
const ROOT = path.join(__dirname, ".."), res = [];
const check = (name, ok, info) => res.push(`${ok ? "PASS" : "FAIL"} ${name}${info ? "  " + info : ""}`);
async function sw(payload, badge) {
  const calls = [], on = {};
  const self = { addEventListener: (t, f) => { on[t] = f; }, registration: { scope: "https://example.org/deal-board-app/prototype/", showNotification: (t, o) => { calls.push(`note ${t}: ${o.body}`); return Promise.resolve(); } },
    navigator: badge ? { setAppBadge: n => { calls.push("set " + n); return Promise.resolve(); }, clearAppBadge: () => { calls.push("clear"); return Promise.resolve(); } } : {} };
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, "push-sw.js"), "utf8"), { self, clients: {} });
  let wait = null; on.push({ data: { json: () => payload, text: () => JSON.stringify(payload) }, waitUntil: p => { wait = p; } });
  await wait; return calls.join(" | ");
}
function protoFns() {
  const src = fs.readFileSync(path.join(ROOT, "supabase/functions/tools/index.ts"), "utf8");
  let js = src.split("// PROTO-NOTE-START")[1].split("// PROTO-NOTE-END")[0];
  js = js.replace(/: \(i: any\) => string/g, "").replace(/: any\[\]/g, "").replace(/: string\[\]/g, "").replace(/\((\w+): (?:any|number|string)\)/g, "($1)").replace(/(\w+): (?:any|number|string)(?=[,)=])/g, "$1");
  return vm.runInNewContext(js + "; ({ protoNote, isProtoPhone })", {});
}
(async () => {
  check("A note with a number puts it on the app icon", (await sw({ title: "Deal Board", body: "1 deal needs you", badge: 3 }, true)) === "note Deal Board: 1 deal needs you | set 3");
  check("A note with 0 clears the app icon", (await sw({ body: "1 task needs you", badge: 0 }, true)) === "note Deal Board: 1 task needs you | clear");
  check("A note without a number (the live app's note) leaves the icon alone", (await sw({ body: "2 late · 3 due today" }, true)) === "note Deal Board: 2 late · 3 due today");
  check("A phone without the badge just shows the note", (await sw({ body: "1 deal needs you", badge: 2 }, false)) === "note Deal Board: 1 deal needs you");
  const { protoNote, isProtoPhone } = protoFns(), today = "2026-10-05", due = i => i.due_on;
  const mine = [
    { deal_id: "d1", due_on: today, waiting_for: "NCNDA from Pat", waiting_on: "Pat" },
    { deal_id: "d1", due_on: today, waiting_for: "R350/t VAT question", waiting_on: "Sam & Lee" },
    { deal_id: "d2", due_on: "2026-10-01", waiting_for: "LOI from Dana", waiting_on: "Dana" },
    { deal_id: null, due_on: "2026-10-02", waiting_for: "Logo file", waiting_on: "Me" },
    { deal_id: "d3", due_on: "2026-10-09", waiting_for: "Later", waiting_on: "X" }];
  const fu = [{ not_before: today, outcome: "No reply yet" }, { not_before: "2026-10-20", outcome: "Later" }];
  const a = protoNote(mine, fu, 1, today, due);
  check("Prototype note: deals and other tasks that need you today, suggestions to check; the late count for the icon", a.body === "2 deals need you · 2 other tasks · 1 suggestion to check" && a.badge === 2, JSON.stringify(a));
  check("Prototype note carries no names, amounts or people", !/Pat|Dana|Sam|Lee|R350|VAT|NCNDA|LOI|Logo/.test(a.body) && /^[0-9a-z ·]+$/i.test(a.body), a.body);
  const b = protoNote([mine[0]], [], 0, today, due);
  check("One deal reads '1 deal needs you'", b.body === "1 deal needs you" && b.badge === 0, JSON.stringify(b));
  const c = protoNote([mine[4]], [], 0, today, due);
  check("Nothing due: no note (the icon number comes with the next note or when the app opens)", c.body === "" && c.badge === 0, JSON.stringify(c));
  const d = protoNote([mine[3]], [], 0, today, due);
  check("Only our own late job: '1 task needs you', icon 1", d.body === "1 task needs you" && d.badge === 1, JSON.stringify(d));
  check("Only phones labelled '· prototype' get the new note", isProtoPhone({ device: "iPhone · 2026-10-03 · prototype" }) && !isProtoPhone({ device: "iPhone · 2026-09-26" }) && !isProtoPhone({}));
  console.log(res.join("\n")); process.exit(res.some(r => r.startsWith("FAIL")) ? 1 : 0);
})();

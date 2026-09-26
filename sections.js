// Deal Board v17 — Sections (26 Sep 2026, asked by Chris): Chrome · Manganese · Transport, each with its own colour.
// One switch at the top of Today, Deals, Contacts and Board (All · Chrome · Manganese · Transport · any added section).
// A section is simply the deal's Area (or a task's Area when it has no deal). "+ Add a section" in the new-deal form
// creates one: the first deal saved with a new Area makes that section appear in the switch – no extra table.
const SEC_CORE = ["Chrome", "Manganese", "Transport"];
const SEC_NOT = ["", "Other", "Verve admin", "Buyer search"];          // areas that are not sections of their own
const SEC_KIND = { Chrome: "mineral", Manganese: "mineral", Transport: "transport", Other: "general" };
let section = "All"; try { section = localStorage.getItem("section") || "All"; } catch (e) {}

function sectionsList() {
  const extra = [];
  for (const d of window._deals || []) if (d.area && !SEC_CORE.includes(d.area) && !SEC_NOT.includes(d.area) && !extra.includes(d.area)) extra.push(d.area);
  return [...SEC_CORE, ...extra.sort()];
}
// colours come from the stylesheets (--s-chrome, --s-manganese, --s-transport; added sections take --s-x1..x3 in turn)
function secColor(s) {
  if (!s || s === "All") return "var(--s-all)";
  const i = SEC_CORE.indexOf(s); if (i >= 0) return `var(--s-${s.toLowerCase()})`;
  const x = sectionsList().filter(n => !SEC_CORE.includes(n)).indexOf(s);
  return x >= 0 ? `var(--s-x${(x % 3) + 1})` : "var(--s-other)";
}
// which sections a thing belongs to (a list: buyer-search work counts for both Chrome and Manganese)
const MN_RX = /manganese|\bmn\b|-mn\b/i, CR_RX = /chrome|chromite/i, TR_RX = /transport|truck|haul|\bloads?\b|maize|freight/i;
function secsOfText(t) { const s = []; if (CR_RX.test(t || "")) s.push("Chrome"); if (MN_RX.test(t || "")) s.push("Manganese"); if (TR_RX.test(t || "")) s.push("Transport"); return s; }
function secsOfItem(it) {
  const d = it.deal_id && window.dealById ? dealById(it.deal_id) : null;
  const a = d ? d.area : it.project;
  if (a === "Buyer search") return ["Chrome", "Manganese"];
  if (a && !SEC_NOT.includes(a)) return [a];
  return secsOfText([it.waiting_for, it.waiting_on, it.blocks].join(" "));
}
function secsOfLead(l) { const s = secsOfText([l.commodity, l.grade].join(" ")); return s.length ? s : ["Chrome", "Manganese"]; }
function secsOfLTask(t) {
  const ls = (t.lead_ids || []).map(id => (window._leads || []).find(l => l.id === id)).filter(Boolean);
  const s = new Set(ls.flatMap(secsOfLead)); secsOfText(t.task + " " + (t.kind || "")).forEach(x => s.add(x));
  return s.size ? [...s] : ["Chrome", "Manganese"];
}
function secsOfPost(p) { const d = p.deal_id && window.dealById ? dealById(p.deal_id) : null; return d && d.area && !SEC_NOT.includes(d.area) ? [d.area] : secsOfText(p.body); }
// (function declarations, so the other scripts can check window.inSecItem etc.)
function inSec(secs) { return section === "All" || secs.includes(section); }
function inSecItem(it) { return inSec(secsOfItem(it)); }
function inSecDeal(d) { return section === "All" || d.area === section; }
function inSecLead(l) { return inSec(secsOfLead(l)); }
function inSecLTask(t) { return inSec(secsOfLTask(t)); }
function inSecPost(p) { return inSec(secsOfPost(p)); }
// the main section of an item, for its colour (first match) – "" when it has none
function secOfItem(it) { const s = secsOfItem(it); return s.length === 1 ? s[0] : ""; }

// the switch
function secBarHtml() {
  const list = ["All", ...sectionsList()];
  if (!list.includes(section)) section = "All";
  return `<div class="secbar${list.length > 4 ? " many" : ""}" role="group" aria-label="Section">${list.map(s => `<button type="button" data-sec="${esc(s)}" class="${section === s ? "on" : ""}" aria-pressed="${section === s}" style="--sc:${secColor(s)}">${esc(s)}</button>`).join("")}</div>`;
}
document.addEventListener("click", e => {
  const b = e.target.closest(".secbar button[data-sec]"); if (!b) return;
  section = b.dataset.sec; try { localStorage.setItem("section", section); } catch (x) {}
  if (typeof homeFilter !== "undefined") homeFilter = null;
  render(); window.scrollTo(0, 0);
});

// ---------- one Section choice for a new deal (replaces the Type and Area lists) ----------
// Chrome · Manganese · Transport · (added sections) · Other · + Add a section. The checklist follows the section:
// Chrome and Manganese get the mineral kit, Transport the transport kit, Other none; a new section asks which.
function secPickHtml(p, dflt) {
  const cur = dflt || (section !== "All" ? section : "Chrome"), list = [...sectionsList(), "Other"];
  const kind = SEC_KIND[cur] || kindOfSection(cur);
  return `<div class="fld"><span>Section</span></div>
    <div class="secpick" role="group" aria-label="Section" data-secp="${p}">${list.map(s => `<button type="button" data-secpick="${esc(s)}" class="${s === cur ? "on" : ""}" aria-pressed="${s === cur}" style="--sc:${secColor(s)}">${esc(s)}</button>`).join("")}<button type="button" data-secpick="+" class="secadd" aria-pressed="false">${ic("plus")}Add a section</button></div>
    <div class="secnew hidden" id="${p}NewSec"><label class="fld"><span>Name of the new section</span><input id="${p}SecName" maxlength="40" autocomplete="off" placeholder="e.g. Coal"></label>
      <div class="fld"><span>Checklist for its deals</span></div>
      <div class="segbar" role="group" aria-label="Checklist"><button type="button" data-seckind="mineral" class="on" aria-pressed="true">Mineral</button><button type="button" data-seckind="transport" aria-pressed="false">Transport</button><button type="button" data-seckind="general" aria-pressed="false">None</button></div></div>
    <input type="hidden" id="${p}Area" value="${esc(cur)}"><input type="hidden" id="${p}Kind" value="${kind}">`;
}
function kindOfSection(s) { const d = (window._deals || []).find(x => x.area === s); return d ? d.kind : "general"; }
function secPickSync(p) {
  const box = document.querySelector(`.secpick[data-secp="${p}"]`); if (!box) return;
  const on = box.querySelector("button.on"), adding = on && on.dataset.secpick === "+";
  const nb = $(p + "NewSec"); if (nb) nb.classList.toggle("hidden", !adding);
  if (adding) {
    const k = document.querySelector(`#${p}NewSec [data-seckind].on`);
    $(p + "Area").value = ($(p + "SecName").value || "").trim(); $(p + "Kind").value = k ? k.dataset.seckind : "general";
  } else if (on) { $(p + "Area").value = on.dataset.secpick; $(p + "Kind").value = SEC_KIND[on.dataset.secpick] || kindOfSection(on.dataset.secpick); }
  const rb = p === "nd" ? $("ndRouteBox") : null; if (rb) rb.classList.toggle("hidden", $(p + "Kind").value !== "mineral");
}
document.addEventListener("click", e => {
  const b = e.target.closest("button[data-secpick]");
  if (b) {
    const box = b.closest(".secpick"); box.querySelectorAll("button").forEach(x => { const on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); });
    secPickSync(box.dataset.secp); if (b.dataset.secpick === "+") { const i = $(box.dataset.secp + "SecName"); if (i) i.focus(); } return;
  }
  const k = e.target.closest("button[data-seckind]");
  if (k) { const bar = k.parentElement; bar.querySelectorAll("button").forEach(x => { const on = x === k; x.classList.toggle("on", on); x.setAttribute("aria-pressed", on); }); const nb = k.closest(".secnew"); if (nb) secPickSync(nb.id.replace("NewSec", "")); }
});
document.addEventListener("input", e => { if (e.target.id && /SecName$/.test(e.target.id)) secPickSync(e.target.id.replace("SecName", "")); });
// a new section needs a name before the deal can be saved
function secPickReady(p) { secPickSync(p); if ($(p + "Area") && !$(p + "Area").value) { const i = $(p + "SecName"); if (i) i.focus(); return false; } return true; }

// Deal Board v13 — South African deal kit: route choice, switch to the kit, deal guide, kit playbook.
// Step content lives in the kit_templates table (seeded per deal); kitdata.js carries the same content for demo mode and the guide.
const KIT_SHORT = { local: "Local sale by truck", bulk: "Export – bulk ship", container: "Export – containers", road: "Export – by road" };
let kitAsk = null;              // deal id whose switch/route form is open
const kitRoutePick = {};        // deal id -> route picked in that form

function kitRouteOpts(sel) {
  return Object.entries(KIT.routes).map(([k, v]) => `<option value="${k}"${sel === k ? " selected" : ""}>${esc(v)}</option>`).join("");
}
function kitUntouched(id) { return stepsOf(id).filter(s => s.status === "open" && !s.custom && !(s.evidence || "").trim()).length; }
function kitCount(kind, route, dealId) {
  const kept = new Set(stepsOf(dealId).filter(s => s.code && !(s.status === "open" && !s.custom && !(s.evidence || "").trim())).map(s => s.code));
  return (KIT.tpl[kind] || []).filter(r => (kind !== "mineral" || r[2].includes(route)) && !kept.has(r[0])).length;
}

// Top of the deal body: old-checklist banner, or the kit line with "Change route"
function kitSecHtml(d) {
  if (!window.KIT || !(d.kind === "mineral" || d.kind === "transport")) return "";
  const route = kitRoutePick[d.id] || d.kit_route || "local";
  const asking = kitAsk === d.id;
  const form = () => `${d.kind === "mineral" ? `<div class="lbl">Route</div><select data-kitroute="${d.id}">${kitRouteOpts(route)}</select>` : ""}
    <div class="ks">${kitUntouched(d.id)} untouched steps will be replaced by ${kitCount(d.kind, route, d.id)} kit steps${d.kind === "mineral" ? " for this route" : ""}. Ticked steps, steps with a note and your own steps are kept.</div>
    <div class="acts0"><button class="primary" data-kitgo="${d.id}">${ic("check")}Yes, ${d.kit ? "change the route" : "switch this deal"}</button><button data-kitno="${d.id}">Cancel</button></div>`;
  if (!d.kit) {
    return `<div class="kitban"><div class="kh"><i class="dot d-prop"></i><span>This deal still has the old short checklist</span></div>
      <div class="ks">The South African deal kit gives ${d.kind === "mineral" ? "40–50 specific steps for the route you pick" : "19 specific steps"} – each with what good looks like, who does it and the document that closes it${d.kind === "mineral" ? ", plus when each assay happens" : ""}.</div>
      ${asking ? form() : `<div class="acts0"><button class="primary" data-kitask="${d.id}">Switch to the SA deal kit</button></div>`}</div>`;
  }
  if (d.kind !== "mineral") return `<div class="kitline"><i class="dot d-ok"></i><span>SA transport kit</span></div>`;
  return `<div class="kitline"><i class="dot d-ok"></i><span>SA deal kit · ${esc(KIT_SHORT[d.kit_route] || d.kit_route || "")}</span>${asking ? "" : `<button data-kitask="${d.id}">Change route</button>`}</div>${asking ? `<div class="kitban">${form()}</div>` : ""}`;
}

// Guide section: Incoterms, when the assays happen, red flags – for this deal's route
function kitGuideHtml(d) {
  const r = d.kit_route || "local", g = KIT.guide[r]; if (!g) return "";
  const li = t => `<li>${esc(t)}</li>`;
  return `<div class="kg"><div class="lbl" style="margin-top:0">Delivery terms – ${esc(KIT.routes[r])}</div><ul>${g.terms.map(li).join("")}</ul>
    <div class="lbl">When the assays happen</div><ol>${g.tests.map(li).join("")}</ol>
    <div class="lbl">Stop and check if you see</div><ul>${[...KIT.watch, ...(r === "local" ? [] : KIT.watchExport)].map(li).join("")}</ul>
    <div class="acts0"><button data-kitplay="1">${ic("book")}Full deal kit playbook</button></div></div>`;
}

// Kit playbook card (bottom of Deals, and inside the Directory playbook)
function kitLibHtml() {
  const L = (window._library || []).filter(x => x.kind === "kit").sort((a, b) => a.sort - b.sort);
  const itac = (window._library || []).find(x => x.kind === "rule" && /^Chrome export permit/.test(x.title));
  const arr = itac ? [...L, itac] : L; if (!arr.length) return "";
  const k = "lib:kit", o = isOpen(k, false);
  return `<div class="deal libx" id="kitlib"><div class="deal-h" role="button" tabindex="0" data-tog="${k}" data-dflt="0" aria-expanded="${o}"><i class="dot d-ok"></i><div class="dh"><div class="dn">Deal kit – the South African way</div><div class="ds">Procedure, Incoterms, when to test, documents, red flags, chrome permit status</div></div><span class="chev"></span></div>
    ${o ? `<div class="sec-b">${arr.map(x => `<details class="libi"><summary>${esc(x.title)}</summary><div class="about">${esc(x.body)}</div></details>`).join("")}</div>` : ""}</div>`;
}
window.kitSecHtml = kitSecHtml; window.kitGuideHtml = kitGuideHtml; window.kitLibHtml = kitLibHtml;

// Demo mode: build steps from the kit copy
function kitDemoSteps(dealId, kind, route, keep) {
  const now = Date.now();
  return (KIT.tpl[kind] || []).filter(r => kind !== "mineral" || r[2].includes(route)).filter(r => !(keep || []).some(s => s.code === r[0]))
    .map(([code, stage, routes, title, detail, who, closes]) => { const [a, b] = code.replace("t", "").split("."); return { id: `${dealId}-${code}-${now}`, deal_id: dealId, stage, sort: +a * 100 + +b, title, detail, who, closes_with: closes, code, status: "open", custom: false, evidence: null, done_by: null, done_at: null }; });
}
window.kitDemoSteps = kitDemoSteps;

$("list").addEventListener("click", async e => {
  const a = e.target.closest("button[data-kitask]");
  if (a) { kitAsk = a.dataset.kitask; render(); return; }
  const n = e.target.closest("button[data-kitno]");
  if (n) { kitAsk = null; delete kitRoutePick[n.dataset.kitno]; render(); return; }
  const p = e.target.closest("button[data-kitplay]");
  if (p) { if (window.navPush) navPush(); openKeys.delete("-lib:kit"); openKeys.add("+lib:kit"); saveOpen(); render(); setTimeout(() => { const el = $("kitlib"); if (el) el.scrollIntoView({ block: "start", behavior: "smooth" }); }, 30); return; }
  const g = e.target.closest("button[data-kitgo]");
  if (!g) return;
  const d = dealById(g.dataset.kitgo); if (!d) return;
  const route = d.kind === "mineral" ? (kitRoutePick[d.id] || d.kit_route || "local") : null;
  if (DEMO) {
    const all = window._steps || [];
    const keep = all.filter(s => s.deal_id === d.id && !(s.status === "open" && !s.custom && !(s.evidence || "").trim()));
    const removed = all.filter(s => s.deal_id === d.id).length - keep.length;
    const stages = new Set((KIT.tpl[d.kind] || []).map(r => r[1]));
    keep.forEach((s, i) => { if (!stages.has(s.stage)) { if (s.custom) { s.stage = "Extra steps"; s.sort = 5001 + i; } else { s.stage = "0. Earlier checklist (kept)"; s.sort = i + 1; } } });
    const add = kitDemoSteps(d.id, d.kind, route, keep);
    window._steps = [...all.filter(s => s.deal_id !== d.id), ...keep, ...add];
    Object.assign(d, { kit: "sa1", kit_route: route }); kitAsk = null; delete kitRoutePick[d.id];
    toast(`Demo: ${removed} replaced, ${keep.length} kept, ${add.length} added.`); render(); return;
  }
  g.disabled = true; g.textContent = "…";
  const { data, error } = await sb.rpc("upgrade_deal_kit", { p_deal: d.id, p_route: route });
  if (error) { toast("Could not switch: " + error.message, 6000); g.disabled = false; g.textContent = "Try again"; return; }
  kitAsk = null; delete kitRoutePick[d.id];
  openKeys.delete(`-sec:${d.id}:check`); saveOpen();
  toast(`Checklist updated: ${data.removed} replaced, ${data.kept} kept, ${data.added} added.`, 5000); load();
});
$("list").addEventListener("change", e => {
  const r = e.target.closest("select[data-kitroute]");
  if (r) { kitRoutePick[r.dataset.kitroute] = r.value; render(); return; }
  if (e.target.id === "ndKind") { const b = $("ndRouteBox"); if (b) b.classList.toggle("hidden", e.target.value !== "mineral"); }
});

// Deal Board – the load register (28 Sep 2026 night; database change 015). Once a deal moves material it stops being a sales
// deal and becomes operations: Truck 1, Truck 2 … each with its tons at loading and delivery, moisture, tested grade, the
// weighbridge ticket and the POD (files on the load), invoiced and paid. Totals add up per deal.
window.loadsLoad = function () {
  if (DEMO) { window._loads = window._loads || []; return; }
  sb.from("loads").select("*").order("n").then(r => { window._loads = r.error ? null : (r.data || []); if (r.error && !/does not exist|schema cache/i.test(r.error.message)) (window._loadErr ||= []).push("loads"); if (view === "deal") render(); });
};
const LD = { edit: null, f: null, rm: null };
const loadsOf = id => (window._loads || []).filter(l => l.deal_id === id).sort((a, b) => a.n - b.n);
window.loadsOf = loadsOf;
const nz = v => { const x = parseFloat(String(v == null ? "" : v).replace(",", ".")); return isFinite(x) ? x : null; };
const t3 = v => v == null ? "–" : (Math.round(v * 100) / 100).toLocaleString("en-ZA", { maximumFractionDigits: 2 }).replace(/[  ,]/g, " ");
const dmtOf = l => { const t = nz(l.t_delivered) != null ? nz(l.t_delivered) : nz(l.t_loaded); return t == null ? null : t * (1 - (nz(l.moisture) || 0) / 100); };
function loadTotals(id) {
  const L = loadsOf(id), sum = f => L.reduce((a, l) => a + (f(l) || 0), 0);
  const tl = sum(l => nz(l.t_loaded)), td = sum(l => nz(l.t_delivered)), dm = sum(dmtOf);
  return { n: L.length, tl, td, dm, short: L.some(l => nz(l.t_delivered) != null) ? tl - td : null, inv: L.filter(l => l.invoiced).length, paid: L.filter(l => l.paid).length };
}
window.loadTotals = loadTotals;
window.loadsLine = function (d) { const t = loadTotals(d.id); if (!t.n) return ""; return `${t.n} load${t.n === 1 ? "" : "s"} · ${t3(t.td || t.tl)} t${d.kind === "mineral" ? ` · ${t3(t.dm)} DMT` : ""} · ${t.paid} paid`; };
window.loadsHtml = function (d) {
  if (window._loads === null) return rplain("loads", "") + `<div class="quiet">Database change 015 is not applied yet.</div>`;
  const L = loadsOf(d.id), t = loadTotals(d.id), mn = d.kind === "mineral";
  let h = rplain("loads", t.n ? `${t.n} · ${t3(t.td || t.tl)} t${t.short ? ` · short ${t3(t.short)} t` : ""}` : "none yet");
  for (const l of L) {
    if (LD.edit === l.id) { h += loadFormHtml(d); continue; }
    const tk = attsFor("load", l.id), files = tk.map(a => `<a href="${esc((window._urls || {})[a.path] || "#")}" target="_blank" rel="noopener">${ic("clip")}${esc(a.name)}</a>`).join("");
    const bits = [l.load_date ? shortDate(l.load_date) : "", l.truck_reg, l.driver].filter(Boolean).join(" · ");
    const tons = `${t3(nz(l.t_loaded))} t loaded${nz(l.t_delivered) != null ? ` → ${t3(nz(l.t_delivered))} t delivered` : ""}${mn && nz(l.moisture) != null ? ` · ${l.moisture}% moisture · ${t3(dmtOf(l))} DMT` : ""}${l.grade ? ` · ${l.grade}` : ""}`;
    h += `<div class="trow ldrow${l.paid ? " in" : ""}"><div class="k"><b>Load ${l.n}</b><span>${[l.invoiced ? "invoiced" : "", l.paid ? "paid" : ""].filter(Boolean).join(" · ") || "open"}</span></div>
      <div class="sub quiet">${esc(bits || "no date or truck yet")}</div><div class="sub">${esc(tons)}</div>${files ? `<div class="pa ldfiles">${files}</div>` : ""}
      <div class="acts0"><button type="button" data-ldedit="${l.id}">${ic("edit")}Change</button><button type="button" data-attach="load:${l.id}">${ic("clip")}Ticket or POD</button></div></div>`;
  }
  if (LD.edit === "new" && LD.f && LD.f.deal_id === d.id) h += loadFormHtml(d);
  else h += `<div class="acts0"><button type="button" data-ldnew="${d.id}">${ic("plus")}Log a load</button></div>`;
  if (t.n) h += `<div class="tplfrom"><div class="kv"><span class="k">Loaded</span><span class="v">${t3(t.tl)} t</span></div><div class="kv"><span class="k">Delivered</span><span class="v">${t3(t.td)} t</span></div>${mn ? `<div class="kv"><span class="k">Dry tons</span><span class="v">${t3(t.dm)} DMT</span></div>` : ""}${t.short != null ? `<div class="kv"><span class="k">Short</span><span class="v">${t3(t.short)} t</span></div>` : ""}<div class="kv"><span class="k">Invoiced · paid</span><span class="v">${t.inv} · ${t.paid} of ${t.n}</span></div></div>`;
  return h;
};
function loadFormHtml(d) {
  const f = LD.f, mn = d.kind === "mineral";
  const box = (k, l, ph, type) => `<label class="fld"><span>${l}</span><input data-ldf="${k}"${type ? ` type="${type}"` : ""}${type === "num" ? ' inputmode="decimal"' : ""} value="${esc(f[k] == null ? "" : String(f[k]))}" placeholder="${esc(ph || "")}" autocomplete="off"></label>`;
  const chip = (k, w) => `<button type="button" data-ldchip="${k}" class="${f[k] ? "on" : ""}" aria-pressed="${!!f[k]}">${w}</button>`;
  return `<div class="card suform"><div class="lbl" style="margin-top:0">${LD.edit === "new" ? "Load " + f.n : "Change load " + f.n}</div>
    <div class="calc">${box("load_date", "Date", "", "date")}${box("truck_reg", "Truck registration", "e.g. ND 123-456")}</div>
    ${box("driver", "Driver", "name and phone (optional)")}
    <div class="calc">${box("t_loaded", "Tons at loading", "weighbridge ticket", "num")}${box("t_delivered", "Tons delivered", "at the receiver", "num")}</div>
    ${mn ? `<div class="calc">${box("moisture", "Moisture %", "from the test", "num")}${box("grade", "Tested grade", "e.g. 41.5% Cr2O3")}</div>` : ""}
    ${box("notes", "Notes", "e.g. delayed at the weighbridge")}
    <div class="tchips">${chip("invoiced", "Invoiced")}${chip("paid", "Paid")}</div>
    <div class="acts0"><button type="button" class="primary" data-ldsave="1">${ic("check")}Save</button><button type="button" data-ldcancel="1">Cancel</button>${LD.edit !== "new" ? `<button type="button" data-ldrm="${LD.edit}">${LD.rm === LD.edit ? "Tap again to remove" : "Remove"}</button>` : ""}</div></div>`;
}
document.addEventListener("input", e => { const i = e.target.closest && e.target.closest("input[data-ldf]"); if (i && LD.f) LD.f[i.dataset.ldf] = i.value; });
document.addEventListener("click", async e => {
  const q = s => e.target.closest && e.target.closest(s);
  const nw = q("button[data-ldnew]");
  if (nw) { const id = nw.dataset.ldnew, L = loadsOf(id), last = L[L.length - 1] || {}; LD.edit = "new"; LD.f = { deal_id: id, n: (last.n || 0) + 1, load_date: saDayPlus(0), truck_reg: "", driver: last.driver || "", t_loaded: "", t_delivered: "", moisture: "", grade: "", notes: "", invoiced: false, paid: false }; render(); return; }
  const ed = q("button[data-ldedit]"); if (ed) { const l = (window._loads || []).find(x => x.id === ed.dataset.ldedit); if (l) { LD.edit = l.id; LD.f = Object.assign({}, l); render(); } return; }
  const ch = q("button[data-ldchip]"); if (ch && LD.f) { LD.f[ch.dataset.ldchip] = !LD.f[ch.dataset.ldchip]; render(); return; }
  if (q("button[data-ldcancel]")) { LD.edit = null; LD.f = null; LD.rm = null; render(); return; }
  const rm = q("button[data-ldrm]");
  if (rm) {
    const id = rm.dataset.ldrm; if (LD.rm !== id) { LD.rm = id; render(); return; }
    if (!DEMO) { const { error } = await sb.from("loads").delete().eq("id", id); if (error) { toast("Could not remove: " + error.message, 6000); return; } }
    window._loads = (window._loads || []).filter(x => x.id !== id); LD.edit = null; LD.f = null; LD.rm = null; toast("Load removed."); render(); return;
  }
  if (q("button[data-ldsave]") && LD.f) {
    const f = LD.f, row = { deal_id: f.deal_id, n: +f.n || 1, load_date: f.load_date || null, truck_reg: String(f.truck_reg || "").trim().toUpperCase(), driver: String(f.driver || "").trim(), t_loaded: nz(f.t_loaded), t_delivered: nz(f.t_delivered), moisture: nz(f.moisture), grade: String(f.grade || "").trim(), notes: String(f.notes || "").trim(), invoiced: !!f.invoiced, paid: !!f.paid, updated_by: me || "", updated_at: new Date().toISOString() };
    if (row.t_loaded == null && row.t_delivered == null) { toast("Type the tons from the weighbridge ticket."); return; }
    const d = dealById(row.deal_id), miss = d ? DealControls.loadingMissing(d, controlState()) : ["Deal not found"];
    if (miss.length) { toast("Cannot log mineral loading: " + miss.join(", "), 8000); return; }
    const isNew = LD.edit === "new";
    if (DEMO) { if (isNew) (window._loads ||= []).push(Object.assign({ id: "ld" + Date.now() }, row)); else Object.assign((window._loads || []).find(x => x.id === LD.edit) || {}, row); }
    else {
      const r = isNew ? await sb.from("loads").insert(row).select("*").single() : await sb.from("loads").update(row).eq("id", LD.edit).select("*").single();
      if (r.error) { toast(/loads/.test(r.error.message) ? "Database change 015 is needed for the load register." : "Could not save: " + r.error.message, 6000); return; }
      if (isNew) (window._loads ||= []).push(r.data); else Object.assign((window._loads || []).find(x => x.id === LD.edit) || {}, r.data);
    }
    LD.edit = null; LD.f = null; toast(isNew ? `Load ${row.n} logged.` : "Saved."); render();
  }
});

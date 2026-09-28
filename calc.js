// Deal Board v17 — Deal calculator: mineral commission (WMT → DMT, per-DMT commission, cuts, share, VAT) and transport margin
// (per ton, load, month). Ion Rail (27 Sep 2026): the money flows down one rail – the figures you type are outlined cards, what
// the app works out are plain cards, the answer is the ion card (docs/ION-GEOMETRY.md).
window._calc = window._calc || {};
let calcDeal = ""; try { calcDeal = localStorage.getItem("calcDeal") || ""; } catch (e) {}
const numIn = s => { const m = String(s || "").replace(/(\d)[ ,](?=\d{3}\b)/g, "$1").match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : ""; };
const sumR = s => { const a = [...String(s || "").matchAll(/R\s?(\d+(?:[.,]\d+)?)/g)].map(m => +m[1].replace(",", ".")); return a.length ? a.reduce((x, y) => x + y, 0) : ""; };
const perMonth = s => { const m = String(s || "").match(/(\d+)\s*\/\s*month/i); return m ? +m[1] : numIn(s); };
const fR = n => (n < 0 ? "−" : "") + "R " + Math.round(Math.abs(n)).toLocaleString("en-ZA");
const fU = n => "US$ " + Math.round(n).toLocaleString("en-ZA");
const fN = (n, d) => (+n).toLocaleString("en-ZA", { maximumFractionDigits: d == null ? 1 : d });
// fields: key · label · placeholder or choices · the small line under the label · the group it belongs to
const MIN_F = [["wmt", "Wet tonnes", "e.g. 1000", "as weighed", 1], ["moist", "Moisture %", "e.g. 6", "inspector's certificate", 1], ["price", "Price per DMT", "e.g. 2400", "per dry ton", 2], ["cur", "Currency", ["R", "US$"], "the price is in", 2], ["fx", "Rand per US$", "e.g. 17.50", "today's rate", 2],
  ["comm", "Our cut per DMT (R)", "e.g. 40", "agreed in writing", 3], ["cuts", "Others per DMT (R)", "e.g. 10", "mandates, brokers", 3], ["share", "Our share %", "100", "of the commission", 3], ["vat", "Add 15% VAT?", ["No", "Yes"], "on our invoice", 4]];
const TR_F = [["rate", "Client rate per ton (R)", "e.g. 350", "what the client pays", 1], ["vatin", "Rate incl. VAT?", ["No", "Yes", "Not agreed"], "is VAT in that rate", 1], ["tpl", "Tons per load", "34", "34 t side tipper", 1], ["haul", "Transporter per ton (R)", "e.g. 200", "what the truck costs", 2], ["cuts", "Others per ton (R)", "e.g. 40", "mandates, brokers", 2],
  ["loads", "Loads per month", "e.g. 20", "how many trips", 3], ["share", "Our share %", "100", "of the margin", 3]];
function calcState(key, d, kind) {
  if (window._calc[key] && window._calc[key]._kind === kind) return window._calc[key];
  const p = (d && d.params) || {};
  const st = kind === "transport"
    ? { _kind: kind, rate: numIn(p.client_rate), vatin: /incl/i.test(p.vat || "") ? "Yes" : /excl/i.test(p.vat || "") ? "No" : "Not agreed", haul: numIn(p.haulier_rate), cuts: sumR(p.cuts || p.other_cuts), tpl: 34, loads: perMonth(p.loads), share: 100 }
    : { _kind: kind, wmt: numIn(p.volume), moist: "", price: numIn(p.price || p.asking_price), cur: /\$|usd/i.test(p.price || p.asking_price || "") ? "US$" : "R", fx: "", comm: /not agreed/i.test(p.commission || "") ? "" : numIn(p.commission), cuts: sumR(p.other_cuts), share: 100, vat: "No" };
  st._src = kind === "transport" ? [p.client_rate && "Client rate: " + p.client_rate, p.vat && "VAT: " + p.vat, p.haulier_rate && "Transporter: " + p.haulier_rate, (p.cuts || p.other_cuts) && "Cuts: " + (p.cuts || p.other_cuts), p.loads && "Loads: " + p.loads].filter(Boolean)
    : [p.volume && "Volume: " + p.volume, p.price ? "Agreed price: " + p.price : p.asking_price && "Asking price: " + p.asking_price, p.commission && "Commission: " + p.commission, p.other_cuts && "Cuts: " + p.other_cuts].filter(Boolean);
  return (window._calc[key] = st);
}
// rows: { k (label), v (figure), s (small line), g (group), out (the answer), ask (a figure still missing) }
function calcCompute(st) {
  const v = k => +(String(st[k] || "").replace(",", ".")) || 0, out = [];
  const row = (g, k, val, s, o) => out.push(Object.assign({ g, k, v: val, s: s || "" }, o || {}));
  if (st._kind === "transport") {
    const gross = v("rate"), ex = st.vatin === "Yes" ? gross / 1.15 : gross, m = ex - v("haul") - v("cuts"), share = (st.share === "" ? 100 : v("share")) / 100;
    const tpl = v("tpl") || 34, perLoad = m * tpl, perMonthV = perLoad * v("loads");
    if (!gross) { row(1, "Client rate excl. VAT", "?", "type the client rate per ton", { ask: 1 }); return out; }
    row(1, "Client rate excl. VAT", fR(ex) + "/t", st.vatin === "Not agreed" ? "VAT not agreed – check" : st.vatin === "Yes" ? "rate ÷ 1.15" : "as typed");
    if (!v("haul")) { row(2, "Margin per ton", "?", "type the transporter rate", { ask: 1 }); return out; }
    row(2, "Margin per ton", fR(m) + "/t", "rate − transporter − others");
    row(2, "Margin", ex ? fN(m / ex * 100) + " %" : "—", "of the client rate");
    row(2, "Per load", fR(perLoad), `${fN(tpl, 0)} t × margin`);
    row(2, "Our share per load", fR(perLoad * share), `${fN(share * 100, 0)} % of the load`, v("loads") ? {} : { out: 1 });
    if (v("loads")) { row(3, "Per month", fR(perMonthV), `${fN(v("loads"), 0)} loads`); row(3, "Our share per month", fR(perMonthV * share), `${fN(share * 100, 0)} % of the month`, { out: 1 }); }
    else row(3, "Per month", "?", "type the loads per month", { ask: 1 });
    if (m < 0) row(3, "Warning", "−", "the costs are higher than the client rate", { ask: 1 });
    return out;
  }
  if (!v("wmt")) { row(1, "Dry tonnes", "?", "type the tonnes, wet as weighed", { ask: 1 }); return out; }
  const dmt = v("wmt") * (1 - v("moist") / 100), share = (st.share === "" ? 100 : v("share")) / 100;
  const value = dmt * v("price"), valueR = st.cur === "US$" ? (v("fx") ? value * v("fx") : null) : value;
  const gross = dmt * v("comm"), less = dmt * v("cuts"), ours = (gross - less) * share, vat = st.vat === "Yes" ? ours * 0.15 : 0;
  row(1, "Dry tonnes", fN(dmt, 1) + " t", "wet × (1 − moisture)");
  if (!v("price")) row(2, "Deal value", "?", "type the price per DMT", { ask: 1 });
  else row(2, "Deal value", st.cur === "US$" ? fU(value) + (valueR != null ? " ≈ " + fR(valueR) : "") : fR(value), st.cur === "US$" && valueR == null ? "add the rand rate" : `${fN(dmt, 0)} × ${fN(v("price"), 0)}`);
  if (v("comm")) { row(3, "Commission pool", fR(gross), `${fN(dmt, 0)} t × ${fN(v("comm"), 0)}`); row(3, "Less others' cuts", fR(-less), `${fN(dmt, 0)} t × ${fN(v("cuts"), 0)}`); row(3, "Our commission", fR(ours), share < 1 ? `${fN(share * 100, 0)} % of the pool` : "pool − cuts", vat ? {} : { out: 1 }); }
  else row(3, "Our commission", "?", "type our commission per DMT", { ask: 1 });
  if (vat) { row(4, "Plus 15 % VAT", fR(vat), "on our invoice"); row(4, "Invoice total", fR(ours + vat), "commission + VAT", { out: 1 }); }
  const truck = 34 * (1 - v("moist") / 100) * (v("comm") - v("cuts")) * share;
  if (v("comm")) row(4, "Per 34 t truck", fR(truck), "our commission a load");
  return out;
}
// one card on the rail for a figure the app worked out
const wfRow = r => `<div class="irow${r.out ? " out" : r.ask ? " ask" : ""}"><i class="in${r.out ? " big" : ""}" aria-hidden="true"></i><div class="icard${r.out ? " ion" : r.ask ? " ask" : ""}"><span class="t">${esc(r.k)}${r.s ? `<small class="mono">${esc(r.s)}</small>` : ""}</span><span class="v">${esc(r.v)}</span></div></div>`;
window.wfRow = wfRow;
// one card for a figure you type
function wfInput(key, st, [k, label, opt, sub]) {
  const box = Array.isArray(opt) ? `<select class="v" data-calc="${key}" data-k="${k}" aria-label="${esc(label)}">${opt.map(o => `<option${String(st[k]) === o ? " selected" : ""}>${o}</option>`).join("")}</select>`
    : `<input class="v" data-calc="${key}" data-k="${k}" inputmode="decimal" value="${esc(st[k] === "" || st[k] == null ? "" : String(st[k]))}" placeholder="${esc(opt)}" aria-label="${esc(label)}">`;
  return `<label class="irow"><i class="in" aria-hidden="true"></i><span class="icard typed"><span class="t">${esc(label)}${sub ? `<small class="mono">${esc(sub)}</small>` : ""}</span>${box}</span></label>`;
}
function calcHtml(key, d, kind) {
  const st = calcState(key, d, kind), F = kind === "transport" ? TR_F : MIN_F, rows = calcCompute(st);
  const groups = [...new Set(F.map(f => f[4]))];
  const first = F[0], last = rows.length ? rows[rows.length - 1] : null;
  let h = rplain(`rail · ${kind === "transport" ? "rate → our share" : "tonnes → invoice"}`, st._src.length ? "from the terms" : "outlined = typed") + railOpen(0);
  for (const g of groups) {
    const ins = F.filter(f => f[4] === g && !(f[0] === "fx" && st.cur !== "US$"));
    h += `<section class="iblk${g === groups[groups.length - 1] ? " deep" : ""}">${ins.map(f => wfInput(key, st, f)).join("")}<div class="ibody" data-cout="${key}:${g}">${rows.filter(r => r.g === g).map(wfRow).join("")}</div></section>`;
  }
  h += railClose();
  if (st._src.length) h += rfoot(`filled in from the deal terms – check and adjust: ${esc(st._src.join(" · "))}`);
  h += `<div class="calcacts">${d ? `<button class="primary" data-calcsave="${key}" data-deal="${d.id}">${ic("note")}Save to notes</button>` : `<button class="primary" data-calcsave="${key}">${ic("board")}Post to board</button>`}<button type="button" data-calccopy="${key}">${ic("copy")}Copy</button>${kind !== "transport" && window.openDocSheet ? `<button type="button" data-commpdf="${key}">${ic("file")}Statement PDF</button>` : `<span></span>`}</div>`;
  return h;
}
function calcRefresh(key) {
  const st = window._calc[key]; if (!st) return;
  const rows = calcCompute(st);
  document.querySelectorAll(`[data-cout^="${key}:"]`).forEach(box => { const g = +box.dataset.cout.split(":")[1]; box.innerHTML = rows.filter(r => r.g === g).map(wfRow).join(""); });
}
const calcText = (key, d) => { const st = window._calc[key]; const F = st._kind === "transport" ? TR_F : MIN_F;
  return `Calculator${d ? " – " + d.name : ""} (${fmtWhen(new Date())})\n` + F.filter(([k]) => st[k] !== "" && st[k] != null).map(([k, l]) => `${l}: ${st[k]}`).join("\n") + "\n—\n" + calcCompute(st).map(r => `${r.k}: ${r.v}${r.s ? " (" + r.s + ")" : ""}`).join("\n"); };
window.calcHtml = calcHtml;
function calcPageHtml() {
  const all = window._deals || [], d = calcDeal ? all.find(x => x.id === calcDeal) : null;
  const kind = d ? (d.kind === "transport" ? "transport" : "mineral") : ((window._calc.free || {})._kind || "mineral");
  let h = `<label class="fld" style="margin-top:0"><span>Deal</span><select id="calcDealSel"><option value="">No deal – free calculation</option>${all.map(x => `<option value="${x.id}"${x.id === calcDeal ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>`;
  if (!d) h += `<div class="calcseg" role="group" aria-label="Kind">${[["mineral", "Mineral"], ["transport", "Transport"]].map(([k, t]) => `<button type="button" data-calckind="${k}" class="${kind === k ? "on" : ""}" aria-pressed="${kind === k}">${t}</button>`).join("")}</div>`;
  return h + calcHtml(d ? d.id : "free", d, kind);
}
window.calcPageHtml = calcPageHtml;

$("list").addEventListener("input", e => {
  const el = e.target.closest("[data-calc]"); if (!el) return;
  const st = window._calc[el.dataset.calc]; if (!st) return; st[el.dataset.k] = el.value;
  calcRefresh(el.dataset.calc);
});
$("list").addEventListener("change", e => {
  const el = e.target.closest("select[data-calc]");
  if (el) { const st = window._calc[el.dataset.calc]; if (st) { st[el.dataset.k] = el.value; if (el.dataset.k === "cur") render(); else calcRefresh(el.dataset.calc); } return; }
  if (e.target.id === "calcDealSel") { calcDeal = e.target.value; try { localStorage.setItem("calcDeal", calcDeal); } catch (x) {} render(); }
});
$("list").addEventListener("click", async e => {
  const k = e.target.closest("button[data-calckind]"); if (k) { delete window._calc.free; window._calc.free = null; calcState("free", null, k.dataset.calckind); render(); return; }
  const cp = e.target.closest("button[data-calccopy]");
  if (cp) { const key = cp.dataset.calccopy; try { await navigator.clipboard.writeText(calcText(key, dealById(key))); toast("Copied."); } catch (x) { toast("Copy not allowed here."); } return; }
  const sv = e.target.closest("button[data-calcsave]"); if (!sv) return;
  const key = sv.dataset.calcsave, d = sv.dataset.deal ? dealById(sv.dataset.deal) : null, text = calcText(key, d);
  if (DEMO) { toast("Demo mode — nothing saved"); return; }
  sv.disabled = true;
  const { error } = d ? await sb.from("events").insert({ field: "note", deal_id: d.id, new_value: text, source: "app" }) : await sb.rpc("add_post", { p_body: text, p_deal: null, p_kind: "check" });
  sv.disabled = false;
  if (error) { toast("Could not save: " + error.message, 6000); return; }
  toast(d ? "Saved to the deal notes." : "Posted to the board."); load();
});

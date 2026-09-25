// Deal Board v16 — Deal calculator: mineral commission (WMT → DMT, per-DMT commission, cuts, share, VAT) and transport margin (per ton, load, month).
window._calc = window._calc || {};
let calcDeal = ""; try { calcDeal = localStorage.getItem("calcDeal") || ""; } catch (e) {}
const numIn = s => { const m = String(s || "").replace(/(\d)[ ,](?=\d{3}\b)/g, "$1").match(/-?\d+(?:\.\d+)?/); return m ? +m[0] : ""; };
const sumR = s => { const a = [...String(s || "").matchAll(/R\s?(\d+(?:[.,]\d+)?)/g)].map(m => +m[1].replace(",", ".")); return a.length ? a.reduce((x, y) => x + y, 0) : ""; };
const perMonth = s => { const m = String(s || "").match(/(\d+)\s*\/\s*month/i); return m ? +m[1] : numIn(s); };
const fR = n => (n < 0 ? "−" : "") + "R " + Math.round(Math.abs(n)).toLocaleString("en-ZA");
const fU = n => "US$ " + Math.round(n).toLocaleString("en-ZA");
const fN = (n, d) => (+n).toLocaleString("en-ZA", { maximumFractionDigits: d == null ? 1 : d });
const MIN_F = [["wmt", "Tonnes (wet, as weighed)", "e.g. 1000"], ["moist", "Moisture %", "e.g. 6"], ["price", "Price per dry ton (DMT)", "e.g. 2400"], ["cur", "Price currency", ["R", "US$"]], ["fx", "Rand per US$ (only if US$)", "e.g. 17.50"],
  ["comm", "Our commission per DMT (R)", "e.g. 40"], ["cuts", "Other parties' cuts per DMT (R)", "e.g. 10"], ["share", "Our share of what is left %", "100"], ["vat", "Add 15% VAT on our invoice?", ["No", "Yes"]]];
const TR_F = [["rate", "Client rate per ton (R)", "e.g. 350"], ["vatin", "Client rate includes VAT?", ["No", "Yes", "Not agreed"]], ["haul", "Transporter rate per ton (R)", "e.g. 200"], ["cuts", "Other parties' cuts per ton (R)", "e.g. 40"],
  ["tpl", "Tons per load", "34"], ["loads", "Loads per month", "e.g. 20"], ["share", "Our share of the margin %", "100"]];
function calcState(key, d, kind) {
  if (window._calc[key] && window._calc[key]._kind === kind) return window._calc[key];
  const p = (d && d.params) || {};
  const st = kind === "transport"
    ? { _kind: kind, rate: numIn(p.client_rate), vatin: /incl/i.test(p.vat || "") ? "Yes" : /excl/i.test(p.vat || "") ? "No" : "Not agreed", haul: numIn(p.haulier_rate), cuts: sumR(p.cuts || p.other_cuts), tpl: 34, loads: perMonth(p.loads), share: 100 }
    : { _kind: kind, wmt: numIn(p.volume), moist: "", price: numIn(p.price), cur: /\$|usd/i.test(p.price || "") ? "US$" : "R", fx: "", comm: /not agreed/i.test(p.commission || "") ? "" : numIn(p.commission), cuts: sumR(p.other_cuts), share: 100, vat: "No" };
  st._src = kind === "transport" ? [p.client_rate && "Client rate: " + p.client_rate, p.vat && "VAT: " + p.vat, p.haulier_rate && "Transporter: " + p.haulier_rate, (p.cuts || p.other_cuts) && "Cuts: " + (p.cuts || p.other_cuts), p.loads && "Loads: " + p.loads].filter(Boolean)
    : [p.volume && "Volume: " + p.volume, p.price && "Price: " + p.price, p.commission && "Commission: " + p.commission, p.other_cuts && "Cuts: " + p.other_cuts].filter(Boolean);
  return (window._calc[key] = st);
}
function calcCompute(st) {
  const v = k => +(String(st[k] || "").replace(",", ".")) || 0, out = [];
  if (st._kind === "transport") {
    const gross = v("rate"), ex = st.vatin === "Yes" ? gross / 1.15 : gross, m = ex - v("haul") - v("cuts"), share = (st.share === "" ? 100 : v("share")) / 100;
    const tpl = v("tpl") || 34, perLoad = m * tpl, perMonthV = perLoad * v("loads");
    if (!gross) return [["Start here", "Type the client rate per ton"]];
    out.push(["Client rate excl. VAT", fR(ex) + "/t" + (st.vatin === "Not agreed" ? " (VAT not agreed – check!)" : "")]);
    if (!v("haul")) return out.concat([["Margin", "Type the transporter rate"]]);
    out.push(["Margin per ton (before our share)", fR(m) + "/t"], ["Margin %", ex ? fN(m / ex * 100) + "%" : "—"], ["Per load (" + fN(tpl, 0) + " t)", fR(perLoad)], ["Our share per load", fR(perLoad * share), v("loads") ? 0 : 1]);
    if (v("loads")) out.push(["Per month (" + fN(v("loads"), 0) + " loads)", fR(perMonthV)], ["Our share per month", fR(perMonthV * share), 1]);
    else out.push(["Per month", "Type the loads per month"]);
    if (m < 0) out.push(["Warning", "The costs are higher than the client rate", 0]);
    return out;
  }
  if (!v("wmt")) return [["Start here", "Type the tonnes (wet, as weighed)"]];
  const dmt = v("wmt") * (1 - v("moist") / 100), share = (st.share === "" ? 100 : v("share")) / 100;
  const value = dmt * v("price"), valueR = st.cur === "US$" ? (v("fx") ? value * v("fx") : null) : value;
  const gross = dmt * v("comm"), less = dmt * v("cuts"), ours = (gross - less) * share, vat = st.vat === "Yes" ? ours * 0.15 : 0;
  out.push(["Dry tons (DMT) = wet × (1 − moisture)", fN(dmt, 1) + " t"], ["Deal value", !v("price") ? "Type the price per DMT" : st.cur === "US$" ? fU(value) + (valueR != null ? " ≈ " + fR(valueR) : " (add the rand rate)") : fR(value)],
    ...(v("comm") ? [["Commission pool (DMT × rate)", fR(gross)], ["Less other parties' cuts", fR(-less)], ["Our commission", fR(ours), 1]] : [["Our commission", "Type our commission per DMT"]]));
  if (vat) out.push(["Plus 15% VAT on our invoice", fR(vat)], ["Invoice total", fR(ours + vat), 1]);
  const truck = 34 * (1 - v("moist") / 100) * (v("comm") - v("cuts")) * share;
  if (v("comm")) out.push(["Our commission per 34 t truck", fR(truck)]);
  return out;
}
function calcHtml(key, d, kind) {
  const st = calcState(key, d, kind), F = kind === "transport" ? TR_F : MIN_F;
  const f = ([k, label, opt]) => `<label class="fld${k === "vat" || k === "vatin" ? " full" : ""}"><span>${label}</span>${Array.isArray(opt) ? `<select data-calc="${key}" data-k="${k}">${opt.map(o => `<option${String(st[k]) === o ? " selected" : ""}>${o}</option>`).join("")}</select>` : `<input data-calc="${key}" data-k="${k}" inputmode="decimal" value="${esc(st[k] === "" || st[k] == null ? "" : String(st[k]))}" placeholder="${esc(opt)}">`}</label>`;
  return `<div class="calc">${F.map(f).join("")}</div>${st._src.length ? `<div class="csrc">Filled in from the deal terms – check and adjust: ${esc(st._src.join(" · "))}</div>` : ""}
    <div class="cres" id="cres-${key}">${calcResHtml(st)}</div>
    <div class="acts0">${d ? `<button class="primary" data-calcsave="${key}" data-deal="${d.id}">${ic("note")}Save to deal notes</button>` : `<button class="primary" data-calcsave="${key}">${ic("board")}Post to the board</button>`}${ib("copy", "file", `data-calccopy="${key}"`, "Copy the result")}</div>`;
}
const calcResHtml = st => calcCompute(st).map(([k, v, big]) => `<div class="kv${big ? " big" : ""}"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("");
const calcText = (key, d) => { const st = window._calc[key]; const F = st._kind === "transport" ? TR_F : MIN_F;
  return `Calculator${d ? " – " + d.name : ""} (${fmtWhen(new Date())})\n` + F.filter(([k]) => st[k] !== "" && st[k] != null).map(([k, l]) => `${l}: ${st[k]}`).join("\n") + "\n—\n" + calcCompute(st).map(([k, v]) => `${k}: ${v}`).join("\n"); };
window.calcHtml = calcHtml;
function calcPageHtml() {
  const all = window._deals || [], d = calcDeal ? all.find(x => x.id === calcDeal) : null;
  const kind = d ? (d.kind === "transport" ? "transport" : "mineral") : ((window._calc.free || {})._kind || "mineral");
  let h = `<div class="card" style="padding:16px"><label class="fld" style="margin-top:0"><span>Deal</span><select id="calcDealSel"><option value="">No deal – free calculation</option>${all.map(x => `<option value="${x.id}"${x.id === calcDeal ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>`;
  if (!d) h += `<div class="chips" style="margin-top:12px">${[["mineral", "Mineral"], ["transport", "Transport"]].map(([k, t]) => `<button data-calckind="${k}" class="${kind === k ? "on" : ""}">${t}</button>`).join("")}</div>`;
  return h + `<div style="height:12px"></div>${calcHtml(d ? d.id : "free", d, kind)}</div>`;
}
window.calcPageHtml = calcPageHtml;

$("list").addEventListener("input", e => {
  const el = e.target.closest("[data-calc]"); if (!el) return;
  const st = window._calc[el.dataset.calc]; if (!st) return; st[el.dataset.k] = el.value;
  const box = document.getElementById("cres-" + el.dataset.calc); if (box) box.innerHTML = calcResHtml(st);
});
$("list").addEventListener("change", e => {
  const el = e.target.closest("select[data-calc]");
  if (el) { const st = window._calc[el.dataset.calc]; if (st) { st[el.dataset.k] = el.value; const box = document.getElementById("cres-" + el.dataset.calc); if (box) box.innerHTML = calcResHtml(st); } return; }
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

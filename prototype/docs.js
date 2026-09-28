// Deal Board – documents per deal, templates that fill themselves, and the deal status to send (28 Sep 2026).
// Chris: "I want a section to store all documents in each deal. Deals and transport separate. This is for contracts etc." ·
// "I want the deal status as a copy or a PDF that is orderly like a quote that I can send off." · "I want a generic LOI, NCNDA,
// ICPO, SPA etc with the ability to just punch in names in the app and it automatically fills the documents in I must send."
// Documents: requested / received or signed / not needed; a requested one gets a follow-up task by itself, which closes when
// it comes in. The status never carries the private target or walk-away limit; our commission, other parties' cuts and the
// other side's names go on only when ticked (names only after the NCNDA is signed).

// ---------- the lists (minerals and transport kept apart) ----------
const DOCS = {
  mineral: [
    { k: "ncnda", l: "NCNDA", sub: "non-circumvention, non-disclosure", kind: "sign", side: "both", tpl: 1 },
    { k: "imfpa", l: "IMFPA", sub: "our commission agreement", kind: "sign", side: "both", tpl: 1 },
    { k: "loi", l: "LOI", sub: "buyer's letter of intent", kind: "get", side: "buyer", tpl: 1 },
    { k: "icpo", l: "ICPO", sub: "buyer's purchase order", kind: "get", side: "buyer", tpl: 1 },
    { k: "fco", l: "FCO", sub: "seller's full offer", kind: "get", side: "seller", tpl: 1 },
    { k: "spa", l: "SPA", sub: "sale and purchase agreement", kind: "sign", side: "both", tpl: 1 },
    { k: "poo", l: "Proof of ownership", sub: "the seller owns the material", kind: "get", side: "seller" },
    { k: "assay", l: "Assay", sub: "lab certificate", kind: "get", side: "seller" },
    { k: "pof", l: "Proof of funds", sub: "buyer's bank letter – before any LC", kind: "get", side: "buyer" },
    { k: "kyc", l: "KYC", sub: "company papers, both sides", kind: "get", side: "both", tpl: 1 },
  ],
  transport: [
    { k: "quote", l: "Accepted quote", sub: "the client signs our quote", kind: "sign", side: "client", make: "quote" },
    { k: "contract", l: "Transport contract", sub: "signed with the client", kind: "sign", side: "client" },
    { k: "insurance", l: "Insurance certificate", sub: "goods in transit (GIT)", kind: "get", side: "transporter" },
    { k: "tickets", l: "Weighbridge tickets", sub: "every load", kind: "get", side: "transporter" },
    { k: "pod", l: "POD", sub: "proof of delivery", kind: "get", side: "transporter" },
    { k: "invoices", l: "Invoices", sub: "per load or month", kind: "get", side: "transporter" },
  ],
};
window.DOCS = DOCS;
const docDef = (kind, k) => (DOCS[kind] || []).find(x => x.k === k);
window.docDef = docDef;
const DOC_WORD = { draft: "draft made", requested: "requested", received: "received", signed: "signed", na: "not needed" };
const docIn = r => !!r && (r.status === "received" || r.status === "signed");
function docParty(d, x) {
  const p = leanP(d), raw = x.side === "seller" ? p.seller : x.side === "buyer" ? p.buyer : x.side === "client" ? (p.client || p.buyer) : x.side === "transporter" ? p.transporter : "";
  const n = String(raw || "").split(/[(,;]/)[0].trim().slice(0, 40);
  return n || ({ seller: "Seller", buyer: "Buyer", client: "Client", transporter: "Transporter", both: "Both sides" }[x.side] || "Them");
}
const docAtt = r => r && r.att_id ? (window._atts || []).find(a => String(a.id) === String(r.att_id)) : null;
function docState(r, it) {
  if (!r) return "not yet";
  const w = `${DOC_WORD[r.status] || r.status} ${shortDate(saDayKey(r.updated_at || Date.now()))}`;
  return r.status === "requested" && it ? `${w} · follow up ${shortDate(saDayKey(dueDate(it)))}` : w;
}
// the chips and the file line of one document (the Docs tab card, and the step panel)
function docControls(d, x) {
  const r = docRow(d.id, x.k), st = r ? r.status : "", done = x.kind === "sign" ? "signed" : "received", att = docAtt(r);
  const chip = (v, w) => `<button type="button" data-doc="${d.id}:${x.k}" data-v="${v}" class="${st === v ? "on" : ""}" aria-pressed="${st === v}">${w}</button>`;
  const url = att && window._urls && window._urls[att.path];
  return `<div class="tchips">${chip("requested", "Requested")}${chip(done, done === "signed" ? "Signed" : "Received")}${chip("na", "Not needed")}</div>
    <div class="tchips dfile">${att ? `<span class="dfn">${ic("clip")}${url && url !== "#" ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(att.name)}</a>` : esc(att.name)}</span>` : ""}<button type="button" data-docup="${d.id}:${x.k}">${ic("clip")}${att ? "Replace" : "Upload"}</button>${x.tpl ? `<button type="button" data-tpl="${d.id}:${x.k}">${ic("file")}Make it</button>` : x.make === "quote" ? `<button type="button" data-dquote="${d.id}">${ic("file")}Make the quote</button>` : ""}</div>`;
}
function docCardHtml(d, x) {
  const r = docRow(d.id, x.k), it = r && r.item_id ? (window._items || []).find(i => i.id === r.item_id) : null;
  return `<div class="trow docrow${docIn(r) ? " in" : ""}${r && r.status === "na" ? " na" : ""}" data-docrow="${x.k}"><div class="k"><b>${esc(x.l)}<small>${esc(x.sub || "")}</small></b><span>${esc(docState(r, it))}</span></div>${docControls(d, x)}</div>`;
}
window.docsTabHtml = function (d) {
  const list = DOCS[d.kind] || [];
  let h = "";
  if (list.length) {
    const inN = list.filter(x => docIn(docRow(d.id, x.k))).length, reqN = list.filter(x => (docRow(d.id, x.k) || {}).status === "requested").length;
    h += rplain(`documents · ${d.kind === "transport" ? "transport" : "minerals"}`, `${inN} of ${list.length} in${reqN ? ` · ${reqN} asked` : ""}`, true);
    h += list.map(x => docCardHtml(d, x)).join("");
    if (list.some(x => x.tpl)) h += rfoot("Make it fills a generic draft from this deal and our company details – have an SA commercial attorney check the NCNDA, IMFPA and SPA once before first use");
  }
  const linked = new Set((window._docs || []).filter(r => r.deal_id === d.id && r.att_id).map(r => String(r.att_id)));
  const other = attsFor("deal", d.id).filter(a => !linked.has(String(a.id)));
  h += rplain("other files", `${other.length}`) + (window.driveLinkHtml ? driveLinkHtml(d) : "") + otherFilesHtml(d, other);
  return h;
};
function otherFilesHtml(d, arr) {
  return `<div class="files">${arr.map(a => `<div class="file">${ic("clip")}<span class="fn">${window._urls[a.path] ? `<a href="${esc(window._urls[a.path])}" target="_blank" rel="noopener">${esc(a.name)}</a>` : esc(a.name)}</span><span class="fm">${fmtSize(a.size)} · ${esc(firstName(a.uploaded_by))} ${fmtDay(a.created_at)}</span>${ib("drop", "bad", `data-rmfile="${a.id}"`, "Remove file")}</div>`).join("") || `<div class="quiet">No other files.</div>`}
    <div class="acts0"><button data-attach="deal:${esc(String(d.id))}">${ic("clip")}Attach file or photo</button></div></div>`;
}
// the step panel: the document that closes the step
window.docMiniHtml = function (d, keys) {
  return keys.map(k => docDef(d.kind, k)).filter(Boolean).map(x => `<div class="lbl">${esc(x.l)} · ${esc(docState(docRow(d.id, x.k)))}</div>${docControls(d, x)}`).join("");
};

// ---------- saving a document's state ----------
async function saveDocRow(d, key, status, o) {
  o = o || {};
  const rows = (window._docs ||= []), i = rows.findIndex(r => r.deal_id === d.id && r.doc === key), now = new Date().toISOString();
  const apply = id => {
    if (!status) { if (i >= 0) rows.splice(i, 1); return; }
    const cur = i >= 0 ? rows[i] : { id: id || "dd" + Date.now(), deal_id: d.id, doc: key, created_at: now };
    Object.assign(cur, { status, updated_at: now, updated_by: me, item_id: o.item || cur.item_id || null, att_id: o.att || cur.att_id || null, note: o.note || cur.note || null });
    if (i < 0) rows.push(cur);
  };
  if (DEMO) { apply(); return true; }
  const { data, error } = await sb.rpc("set_deal_doc", { p_deal: d.id, p_doc: key, p_status: status || "", p_note: o.note || null, p_item: o.item || null, p_att: o.att || null });
  if (error) { toast(/set_deal_doc|function/i.test(error.message) ? "Database change 010 is needed for documents." : "Could not save: " + error.message, 6000); return false; }
  apply(data); return true;
}
window.saveDocRow = saveDocRow;
async function setDoc(d, key, st) {
  const x = docDef(d.kind, key); if (!x) return;
  const r = docRow(d.id, key), cur = r ? r.status : "", next = cur === st ? "" : st;
  let item = r && r.item_id && (window._items || []).some(i => i.id === r.item_id) ? r.item_id : null;
  try {
    if (next === "requested" && !item) item = await leanNewItem({ deal: d, on: docParty(d, x), what: `${x.l} (${dealHandle(d)})`, next: "Follow up", due: workDayPlus(2) });
    else if (next !== "requested" && item) { await leanItemAct(item, "done"); }
    if (!(await saveDocRow(d, key, next, { item: next === "requested" ? item : null }))) return;
    let msg = next === "requested" ? `${x.l}: requested – follow-up on ${dayName(new Date(workDayPlus(2) + "T08:00:00+02:00"))}.` : next ? `${x.l}: ${DOC_WORD[next]}.` : `${x.l}: back to not yet.`;
    if (next === "received" || next === "signed") { const n = await leanTickFromDoc(d, key, `${x.l} ${next}`); if (n) msg += " Its step is ticked."; if (item) msg += " Follow-up closed."; }
    toast(msg + (DEMO ? " (demo)" : ""));
  } catch (e) { toast("Could not save: " + (e.message || e), 6000); }
  if (DEMO) render(); else load();
}
window.setDoc = setDoc;
document.addEventListener("click", e => {
  const b = e.target.closest("button[data-doc]"); if (!b) return;
  const [id, k] = b.dataset.doc.split(":"), d = dealById(id); if (d) setDoc(d, k, b.dataset.v);
});
// upload a file for a document: the same upload as Notes › Files, linked to the document row
document.addEventListener("click", e => {
  const b = e.target.closest("button[data-docup]"); if (!b) return;
  const [id, k] = b.dataset.docup.split(":");
  pendingAttach = { type: "deal", id, doc: k }; $("fileInput").value = ""; $("fileInput").click();
});
// called by the file picker once the file is stored (or straight away in the demo)
window.docFileSaved = async function (dealId, key, att) {
  const d = dealById(dealId), x = d && docDef(d.kind, key); if (!x) return;
  const r = docRow(dealId, key), cur = r ? r.status : "", got = x.kind === "sign" ? "signed" : "received";
  const next = cur === "requested" ? got : cur || (x.kind === "sign" ? "draft" : "received");
  if (cur === "requested" && r.item_id) { try { await leanItemAct(r.item_id, "done"); } catch (e) {} }
  await saveDocRow(d, key, next, { att: att.id });
  if (next === "received" || next === "signed") await leanTickFromDoc(d, key, `${x.l} ${next}`);
  toast(`${x.l} saved – marked ${DOC_WORD[next]}.${next === "draft" ? " Tap Signed when it comes back signed." : ""}`, 5000);
};
async function loadDocs() {
  if (DEMO) { if (!window._docs) window._docs = [{ id: "dd1", deal_id: "dm1", doc: "loi", status: "received", updated_at: new Date(Date.now() - 2 * 864e5).toISOString(), updated_by: "Chris" }]; return; }
  const { data, error } = await sb.from("deal_docs").select("*");
  window._docs = error ? [] : (data || []);
}
window.loadDocs = loadDocs;

// ---------- templates that fill themselves ----------
const TPL = {
  ncnda: { l: "NCNDA", title: "Non-circumvention, non-disclosure and working agreement", head: true, parties: [["a", "First party (seller side)", "seller"], ["b", "Second party (buyer side)", "buyer"]], extra: [["years", "How long it holds", ["2", "3", "5"], "5", "years"]] },
  imfpa: { l: "IMFPA", title: "Irrevocable master fee protection agreement", head: true, parties: [["payer", "Paying party (pays the commission)", "seller"], ["other", "Other principal", "buyer"]], extra: [["days", "Paid within (banking days after each lot is paid)", ["3", "5", "7"], "5", "days"]] },
  loi: { l: "LOI", title: "Letter of intent to purchase", parties: [["buyer", "Buyer (issues the letter)", "buyer"], ["seller", "Seller (addressed to)", "seller"]], extra: [["valid", "Valid for", ["7", "14", "30"], "14", "days"]] },
  icpo: { l: "ICPO", title: "Irrevocable corporate purchase order", parties: [["buyer", "Buyer (issues the order)", "buyer"], ["seller", "Seller (addressed to)", "seller"]], extra: [["valid", "Valid for (banking days)", ["5", "10", "15"], "10", "days"]] },
  fco: { l: "FCO", title: "Full corporate offer", parties: [["seller", "Seller (makes the offer)", "seller"], ["buyer", "Buyer (addressed to)", "buyer"]], extra: [["valid", "Valid for", ["5", "7", "14"], "7", "days"]] },
  spa: { l: "SPA", title: "Sale and purchase agreement", parties: [["seller", "Seller", "seller"], ["buyer", "Buyer", "buyer"]], extra: [["months", "Contract length", ["1", "3", "6", "12"], "12", "months"]] },
  kyc: { l: "KYC", title: "Company information sheet (KYC)", head: true, parties: [["directors", "Directors (full names)", ""], ["contact", "Contact person and role", ""]], extra: [["business", "What we do", null, "Broking of chrome and manganese ore, and road freight"]] },
};
let TPLS = null;   // { dealId, key, f: {…} } while the sheet is open
function tplSheetEl() {
  let el = $("tplSheet"); if (el) return el;
  document.body.insertAdjacentHTML("beforeend", `<div id="tplSheet" class="sheet hidden" role="dialog" aria-modal="true" aria-labelledby="tplTitle"><div class="sheet-b"><div class="sheet-h"><span id="tplTitle">Make a document</span><button id="tplClose" type="button">Close</button></div><div id="tplBody"></div></div></div>`);
  return $("tplSheet");
}
function tplTerms(d) {
  const p = leanP(d), v = k => isUnset(p[k]) ? "" : String(p[k]);
  const place = [v("basis"), v("port")].filter(Boolean).join(" ");
  return { commodity: v("commodity") || d.area || "", form: v("form"), grade: v("grade"), volume: v("volume"), basis: place, price: v("price") ? `${v("price")} ${v("unit")}`.trim() : "", asking: v("asking_price") ? `${v("asking_price")} ${v("unit")}`.trim() : "",
    payment: v("instrument"), vat: v("vat"), term: v("term"), trial: v("trial"), inspector: v("inspector"), weights: v("weights"), final: v("final_assay"), umpire: v("umpire"), commission: v("commission"), unit: v("unit") || "per t" };
}
function openTpl(d, key) {
  const t = TPL[key]; if (!t) return;
  const p = leanP(d), f = {};
  for (const [k, , from] of t.parties) f[k] = from ? String(p[from] || "").trim() : "";
  for (const [k, , , dflt] of t.extra || []) f[k] = dflt;
  if (key === "kyc") { const c = window._company || {}; f.contact = me ? `${me}` : ""; }
  TPLS = { dealId: d.id, key, f };
  const el = tplSheetEl(); $("tplTitle").textContent = "Make the " + t.l; $("tplBody").innerHTML = tplSheetHtml(); el.classList.remove("hidden");
}
window.openTpl = openTpl;
function tplSheetHtml() {
  const d = dealById(TPLS.dealId), t = TPL[TPLS.key], f = TPLS.f, T = tplTerms(d), co = window._company || {};
  const missCo = ["legal_name", "reg_no", "address"].filter(k => !co[k]);
  const fromDeal = TPLS.key === "kyc" ? [["Company", co.legal_name], ["Registration", co.reg_no], ["VAT", co.vat_no], ["Address", co.address], ["Phone", co.phone], ["Email", co.email]]
    : [["Product", [T.commodity, T.form].filter(Boolean).join(" ")], ["Grade", T.grade], ["Quantity", T.volume], ["Delivery", T.basis], ["Price", T.price || (T.asking ? "asking " + T.asking : "")], ["Payment", T.payment], ...(TPLS.key === "imfpa" ? [["Commission", T.commission], ["Split", ((leanP(d)._split) || []).map(r => `${r.n} ${r.p}%`).join(", ")]] : [])];
  const box = (k, label, ph) => `<label class="fld"><span>${esc(label)}</span><input data-tplf="${k}" value="${esc(f[k] || "")}" placeholder="${esc(ph || "Company name – and who signs")}" autocomplete="off"></label>`;
  return `<div class="quiet" style="margin:0 0 6px">Type the names; the rest comes from the deal${t.head ? " and our company details" : ""}. Anything not agreed yet prints as "to be agreed".</div>
    ${t.parties.map(([k, label]) => box(k, label, TPLS.key === "kyc" ? "" : undefined)).join("")}
    ${(t.extra || []).map(([k, label, opts, , unit]) => opts ? `<div class="fld"><span>${esc(label)}</span></div><div class="seg2" role="group" aria-label="${esc(label)}">${opts.map(o => `<button type="button" data-tplx="${k}" data-v="${o}" class="${f[k] === o ? "on" : ""}">${o}${unit ? " " + esc(o === "1" ? unit.replace(/s$/, "") : unit) : ""}</button>`).join("")}</div>` : box(k, label, "")).join("")}
    <div class="lbl">From the ${TPLS.key === "kyc" ? "company details" : "deal"}</div><div class="tplfrom">${fromDeal.map(([k, v]) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v || "to be agreed")}</span></div>`).join("")}</div>
    ${missCo.length && (t.head || TPLS.key !== "kyc") ? `<div class="quiet tpln">Our company details are missing (${missCo.map(k => ({ legal_name: "name", reg_no: "registration number", address: "address" }[k])).join(", ")}) – Settings › Company details.</div>` : ""}
    ${TPLS.key === "imfpa" && !((leanP(d)._split) || []).length ? `<div class="quiet tpln">No commission split yet – the IMFPA lists Verve alone. Split it on Numbers › Private first if others share.</div>` : ""}
    <div class="quiet tpln">A generic draft for the parties to check${/ncnda|imfpa|spa/.test(TPLS.key) ? " – have an SA commercial attorney check this one once before first use" : ""}.</div>
    <button type="button" class="primary wide" id="tplMake">${ic("file")}Make the PDF and save it to the deal</button>`;
}
document.addEventListener("click", e => {
  if (e.target.id === "tplSheet" || e.target.closest("#tplClose")) { $("tplSheet").classList.add("hidden"); TPLS = null; return; }
  const b = e.target.closest("button[data-tpl]");
  if (b) { const [id, k] = b.dataset.tpl.split(":"), d = dealById(id); if (d) openTpl(d, k); return; }
  const x = e.target.closest("button[data-tplx]");
  if (x && TPLS) { TPLS.f[x.dataset.tplx] = x.dataset.v; $("tplBody").innerHTML = tplSheetHtml(); return; }
  if (e.target.closest("#tplMake") && TPLS) tplMake();
});
document.addEventListener("input", e => { const i = e.target.closest && e.target.closest("input[data-tplf]"); if (i && TPLS) TPLS.f[i.dataset.tplf] = i.value; });
const tba = v => v && String(v).trim() ? String(v).trim() : "to be agreed";
// the words of each document
function tplDoc(d, key, f) {
  const T = tplTerms(d), co = window._company || {}, us = co.legal_name || "Verve South Africa (Pty) Ltd", ref = `${dealRef(d)}-${key.toUpperCase()}`;
  const usLine = [us, co.reg_no && "Reg. no. " + co.reg_no, co.address].filter(Boolean).join(", ");
  const product = [T.commodity, T.form].filter(Boolean).join(" ") || "the product", spec = T.grade || "as agreed in writing";
  const terms = [["Product", product], ["Grade / specification", tba(T.grade)], ["Quantity", tba(T.volume)], ["Contract length", tba(T.term)], ["Trial", T.trial || "as agreed"], ["Delivery", T.basis ? T.basis + " (Incoterms 2020 where it is an Incoterm)" : "to be agreed"], ["Price", tba(T.price || T.asking)], ["Payment", tba(T.payment)], ["Inspection", tba(T.inspector)], ["VAT", tba(T.vat)]];
  const law = "This agreement is governed by the law of the Republic of South Africa. A dispute that the parties cannot settle within 14 days goes to arbitration in Johannesburg under the rules of the Arbitration Foundation of Southern Africa (AFSA).";
  const sign = "Signed copies sent by email or signed electronically count as originals (Electronic Communications and Transactions Act 25 of 2002). The agreement may be signed in counterparts.";
  const party = (k, fallback) => tba(f[k] || fallback);
  if (key === "ncnda") return { ref, head: true, title: TPL.ncnda.title + " (NCNDA)", parties: [["First party", party("a")], ["Second party", party("b")], ["Facilitator", usLine]],
    blocks: [{ h: "The deal" }, { p: `The parties are working together on the sale of ${product} (${spec}; ${tba(T.volume)}), reference ${dealRef(d)} ("the transaction"), and on any repeat, extension or similar business with the people introduced for it.` },
      { h: "What the parties agree" }, { ol: [
        "Confidential information. Each party keeps secret everything it learns about the transaction and the other parties – their buyers, sellers, mandates, contacts, prices, products, banking and procedures – and uses it only for the transaction. This does not cover information that is already public or that the law requires a party to disclose.",
        "No going around. No party will contact, deal with or do business with a buyer, seller, mandate, intermediary, bank or funder introduced by another party, directly or through someone else, without that party's written consent.",
        "Fees are protected. Each party's commission or fee, as set out in the fee protection agreement (IMFPA) for the transaction, is protected. A party that goes around another pays the other party the full fee it would have earned, plus reasonable legal costs.",
        `How long it holds. This agreement holds for ${f.years || 5} years from the last signature, for the transaction and for every renewal, extension or repeat order with the parties introduced.`,
        "No partnership. Nothing here makes the parties partners or agents of each other. Each party pays its own costs.",
        law, sign] }],
    sign: [party("a"), party("b"), us] };
  if (key === "imfpa") {
    const split = (leanP(d)._split || []).length ? leanP(d)._split : [{ n: us, p: 100 }], per = numIn(T.commission);
    return { ref, head: true, title: TPL.imfpa.title + " (IMFPA)", parties: [["Paying party", party("payer")], ["Other principal", party("other")], ["Payees", split.map(r => r.n).join(", ")]],
      blocks: [{ h: "The deal" }, { p: `Sale of ${product} (${spec}; ${tba(T.volume)}; delivery ${tba(T.basis)}), reference ${dealRef(d)}, and every extension, renewal or repeat order of it ("the transaction").` },
        { h: "The fees" }, { kv: [["Total fee", per ? `R ${per.toFixed(2)} ${T.unit} delivered and paid` : tba(T.commission)], ...split.map(r => [r.n, `${r.p}%${per ? ` = R ${(per * r.p / 100).toFixed(2)} ${T.unit}` : ""}`])] },
        { h: "What the paying party agrees" }, { ol: [
          `The paying party irrevocably agrees to pay the fees above on every lot delivered and paid under the transaction, for as long as the transaction and its renewals run.`,
          `Each fee is paid within ${f.days || 5} banking days after the paying party is paid for a lot, by electronic transfer to each payee's own bank account as confirmed in writing on the payee's letterhead. Bank account numbers are not written in this agreement.`,
          "With each payment the paying party sends a short statement: the lot, the weighbridge tonnage, the assay and the invoice it was paid on. A payee may ask to see these papers.",
          "The fees stay due if the deal goes ahead through another company, a new contract or a different route that the transaction led to.",
          "The paying party does not deduct its own costs or taxes from the fees, other than as the law requires; VAT is added where a payee is a registered VAT vendor.",
          law, sign] }],
      sign: [party("payer"), ...split.map(r => r.n)] };
  }
  if (key === "loi") return { ref, title: TPL.loi.title + " (LOI)", parties: [["From (buyer)", party("buyer")], ["To (seller)", party("seller")]],
    blocks: [{ p: `We confirm our intention to buy the product below, subject to the checks listed and a signed sale and purchase agreement (SPA).` }, { kv: terms },
      { h: "Procedure we propose" }, { ol: ["This letter of intent.", "The seller's full corporate offer (FCO).", "NCNDA and fee protection agreement signed by all parties.", "Proof of ownership of the material from the seller; proof of funds from us.", "Site visit and assay by an independent inspector.", "SPA signed.", "Payment security in place (a letter of credit only after proof of funds), then loading."] },
      { p: `This letter is valid for ${f.valid || 14} days. It is not a binding offer to buy; the SPA sets the binding terms.` }],
    sign: [party("buyer")] };
  if (key === "icpo") return { ref, title: TPL.icpo.title + " (ICPO)", parties: [["From (buyer)", party("buyer")], ["To (seller)", party("seller")]],
    blocks: [{ p: `We confirm, with full corporate authority, that we are ready, willing and able to buy the product below on the terms shown, subject to the procedure below and a signed sale and purchase agreement (SPA).` }, { kv: terms },
      { h: "Procedure" }, { ol: ["The seller issues its full corporate offer (FCO) and proof of ownership of the material.", "Both sides sign the NCNDA and the fee protection agreement.", "We show proof of funds; the independent inspector samples the material.", "The SPA is signed.", "We put the agreed payment security in place (a letter of credit only after proof of funds) before the first loading."] },
      { p: `This order is valid for ${f.valid || 10} banking days from the date above. Our banking details are given only between the banks, on request.` }],
    sign: [party("buyer")] };
  if (key === "fco") return { ref, title: TPL.fco.title + " (FCO)", parties: [["From (seller)", party("seller")], ["To (buyer)", party("buyer")]],
    blocks: [{ p: `We offer to sell the product below on the terms shown, subject to a signed sale and purchase agreement (SPA).` }, { kv: terms },
      { h: "With every lot we supply" }, { ol: ["Commercial or tax invoice.", "Weighbridge tickets at loading (and at delivery where agreed).", "Assay certificate from the agreed independent inspector.", "Delivery note, and the papers the law requires for the transport of the material.", "Proof of ownership and legal origin of the material, on request."] },
      { p: `This offer is valid for ${f.valid || 7} days. The price and quantity hold only once the SPA is signed.` }],
    sign: [party("seller")] };
  if (key === "spa") return { ref, title: TPL.spa.title + " (SPA)", parties: [["Seller", party("seller")], ["Buyer", party("buyer")]],
    blocks: [{ h: "1. The product and the terms" }, { kv: terms },
      { h: "2. What the parties agree" }, { ol: [
        `Product and specification. The seller sells and the buyer buys ${product} to the specification above. Material that falls outside the specification may be rejected by the buyer, or taken at a price reduced in proportion, as the parties agree in writing for that lot.`,
        `Quantity and schedule. ${tba(T.volume)} over ${f.months || 12} months, delivered on a schedule agreed in writing each month.`,
        `Delivery, risk and ownership. Delivery is ${tba(T.basis)}. Risk and ownership pass to the buyer when the lot is delivered at that place and weighed.`,
        `Price. ${tba(T.price)}${T.vat ? `; VAT ${T.vat}` : ""}. Any price adjustment for grade or moisture is set out in writing before the first lot.`,
        `Payment. ${tba(T.payment)}. Where a letter of credit is used, it is issued only after the buyer's proof of funds has been accepted, and before the first loading.`,
        `Weight and quality. ${T.weights ? T.weights + ". " : "The loading weighbridge ticket counts, unless agreed otherwise in writing. "}The independent inspector is ${tba(T.inspector)}. ${T.final ? "Final assay: " + T.final + ". " : ""}${T.umpire ? "Umpire laboratory: " + T.umpire + "." : "If the two results differ by more than the agreed splitting limit, an umpire laboratory decides."}`,
        "Papers with every lot. Tax invoice, weighbridge tickets, assay certificate, delivery note and the transport papers the law requires.",
        "Legal origin. The seller warrants that it owns the material and may sell it, that it comes from a holder of a valid mining right or permit, and that it will show the chain of custody on request.",
        "Change in law. If a new law, permit rule, export tax or quota changes what a party must do or pay, the parties agree new terms in good faith; if they cannot agree within 30 days, either party may end the agreement for the lots not yet delivered.",
        "Force majeure. A party is excused while events beyond its control (for example floods, strikes or road closures) stop it from performing, if it tells the other party promptly and does its best to limit the delay.",
        "Intermediary fees. The fees in the fee protection agreement (IMFPA) for this deal are paid as that agreement says.",
        "Breach. If a party breaks this agreement and does not put it right within 7 days of written notice, the other party may claim its damages or end the agreement.",
        law, "The whole agreement is in this document and the papers it names; changes count only in writing, signed by both parties. " + sign] }],
    sign: [party("seller"), party("buyer")] };
  if (key === "kyc") return { ref, head: true, title: TPL.kyc.title, parties: [],
    blocks: [{ h: "Our company" }, { kv: [["Registered name", tba(co.legal_name)], ["Trading as", co.trading_as || "–"], ["Registration number (CIPC)", tba(co.reg_no)], ["VAT number", co.vat_no || "–"], ["Physical address", tba(co.address)], ["Phone", tba(co.phone)], ["Email", tba(co.email)], ["Website", co.website || "–"], ["What we do", tba(f.business)], ["Directors", tba(f.directors)], ["Contact person", tba(f.contact)]] },
      { h: "Papers available on request" }, { ol: ["Company registration certificate (CIPC).", "Tax compliance status (SARS TCS PIN).", "B-BBEE affidavit or certificate.", "Directors' identity documents and proof of address.", "A letter from our bank confirming the account – bank details are given only on the bank's letter, never in an email body."] },
      { p: "We confirm that the information above is correct on the date shown." }],
    sign: [us] };
  return null;
}
function tplPdf(doc) {
  return makePdf(P => {
    const L = 56, R = 539, W = R - L;
    if (doc.head && typeof coOn === "function" && coOn()) letterhead(P, L, R);
    for (const l of pdfWrap(doc.title, 16, W - 120)) { P.text(L, P.y, l, 16, true); P.y -= 19; }
    P.right(R, P.y + 19, doc.ref, 9.5, false, true);
    P.text(L, P.y, "Draft · " + longDay(saDayPlus(0)), 10, false, true); P.y -= 20;
    const kv = (k, v) => { const lines = pdfWrap(v, 10.5, W - 160); P.need(lines.length * 13 + 4); P.text(L, P.y, k, 10.5, false, true); lines.forEach((l, i) => P.text(L + 160, P.y - i * 13, l, 10.5)); P.y -= lines.length * 13 + 4; };
    for (const [k, v] of doc.parties) kv(k, v);
    if (doc.parties.length) P.y -= 6;
    for (const b of doc.blocks) {
      if (b.h) { P.need(40); P.y -= 4; P.box(L - 6, P.y - 5, W + 12, 19); P.text(L, P.y, b.h, 10.5, true); P.y -= 21; }
      if (b.p) { for (const l of pdfWrap(b.p, 10.5, W)) { P.need(15); P.text(L, P.y, l, 10.5); P.y -= 13.5; } P.y -= 6; }
      if (b.kv) { for (const [k, v] of b.kv) kv(k, v); P.y -= 4; }
      if (b.ol) b.ol.forEach((t, i) => { const lines = pdfWrap(t, 10, W - 18); P.need(lines.length * 12.5 + 4); P.text(L, P.y, `${i + 1}.`, 10); lines.forEach((l, j) => P.text(L + 18, P.y - j * 12.5, l, 10)); P.y -= lines.length * 12.5 + 5; });
    }
    P.y -= 8; P.need(40); P.text(L, P.y, "Signed for and on behalf of", 10, true); P.y -= 26;
    for (const s of doc.sign) {
      P.need(62);
      P.text(L, P.y, s, 10.5, true); P.y -= 26;
      const ln = (x, w, lab) => { P.line(x, P.y, x + w, P.y); P.text(x, P.y - 11, lab, 8.5, false, true); };
      ln(L, 150, "Name of the person signing"); ln(L + 164, 150, "Signature"); ln(L + 328, 70, "Date"); ln(L + 412, 71, "Place"); P.y -= 34;
    }
    const co = window._company || {};
    P.need(24); P.text(L, P.y, `Prepared with Deal Board by ${co.legal_name || "Verve"} · reference ${doc.ref} · a generic draft – each party checks it before signing.`, 8, false, true);
  });
}
async function tplMake() {
  const d = dealById(TPLS.dealId), key = TPLS.key, t = TPL[key], doc = tplDoc(d, key, TPLS.f); if (!doc) return;
  const blob = tplPdf(doc), name = `${t.l} ${dealRef(d)} ${saDayPlus(0)}.pdf`;
  const btn = $("tplMake"); if (btn) btn.disabled = true;
  let att = null;
  try {
    if (DEMO) { att = { id: "a" + Date.now(), target_type: "deal", target_id: d.id, path: "demo", name, size: blob.size, uploaded_by: me, created_at: new Date().toISOString() }; (window._atts ||= []).unshift(att); }
    else {
      const path = `deal/${d.id}/${Date.now()}-${name.replace(/[^\w.\-]+/g, "_")}`;
      const up = await sb.storage.from("files").upload(path, blob, { contentType: "application/pdf", upsert: false }); if (up.error) throw up.error;
      const { data, error } = await sb.from("attachments").insert({ target_type: "deal", target_id: String(d.id), path, name, size: blob.size, mime: "application/pdf" }).select("*").single(); if (error) throw error;
      att = data; (window._atts ||= []).unshift(att);
    }
    const r = docRow(d.id, key); await saveDocRow(d, key, r ? r.status : "draft", { att: att.id });
  } catch (e) { toast("The PDF is made but could not be saved to the deal: " + (e.message || e), 6000); }
  if (btn) btn.disabled = false;
  const how = await shareFile(blob, name, t.l);
  $("tplSheet").classList.add("hidden"); TPLS = null;
  toast((how === "shared" ? "Shared" : "PDF saved to your downloads") + (att ? " and to the deal's Documents." : "."), 5000);
  if (DEMO) render(); else load();
}

// ---------- the deal status: a PDF like the quote, or a copy for WhatsApp ----------
const statusOpt = {};   // deal id -> { comm, cuts, names }
const ncndaSigned = d => { const r = docRow(d.id, "ncnda"); if (r && r.status === "signed") return true; return leanSteps(d, stepsOf(d.id)).some(s => s._lean && (s._lean.doc || []).includes("ncnda") && s.status === "done"); };
function statusModel(d, o) {
  const p = leanP(d), pg = dealProgress(d.id), T = tplTerms(d), mn = d.kind === "mineral", names = !!(o.names && ncndaSigned(d));
  const party = w => names ? w : w === "Me" ? "us" : "";
  const role = k => { const t = leanDef(d.kind, k); return ({ seller: "the seller", buyer: "the buyer", client: "the client", transporter: "the transporter" }[t.side] || "the other side"); };
  const ci = pg.cur ? pg.stages.indexOf(pg.cur) + 1 : pg.stages.length;
  const title = names ? d.name : `${[p.commodity || d.area, d.kind === "transport" ? "transport" : "deal"].filter(Boolean).join(" ")}${mn && T.volume ? " – " + T.volume.replace(/\s*\(.*\)\s*$/, "") : d.kind === "transport" && p.route && names ? " – " + p.route : ""}`;
  const done = pg.stages.flatMap(g => g.steps).filter(s => s.status === "done").map(s => `${s.title}${s.done_at ? " – " + shortDate(saDayKey(s.done_at)) : ""}`);
  const next = pg.stages.flatMap(g => g.steps).filter(s => s.status === "open").slice(0, 3).map(s => {
    const who = s.owner ? (/^(Chris|Annemarie|Both)$/.test(s.owner) ? (names ? s.owner : "us") : s.owner.toLowerCase()) : "";
    return `${s.title}${who ? " – " + who : ""}${s.due_on ? ", by " + keyDay(s.due_on) : ""}`;
  });
  const waiting = [];
  for (const [k, q] of Object.entries(p._q || {})) { const t = leanDef(d.kind, k); if (!isUnset(p[k])) continue; waiting.push(`${t.l} – ${Q_WORDS[q.s] || q.s}${q.s !== "notyet" ? " (asked " + shortDate(q.on) + ", " + (names && q.who ? q.who : role(k)) + ")" : ""}`); }
  for (const x of DOCS[d.kind] || []) { const r = docRow(d.id, x.k); if (r && r.status === "requested") waiting.push(`${x.l} – requested ${shortDate(saDayKey(r.updated_at || Date.now()))}`); }
  const terms = mn ? [["Volume", T.volume], ["Grade", T.grade], ["Form", T.form], ["Delivery", T.basis], ["Asking price", T.asking], ["Agreed price", T.price], ["Payment", T.payment ? T.payment + (isLC(T.payment) ? " (only after proof of funds)" : "") : ""], ["VAT", T.vat]]
    : [["Cargo", p.cargo], ["Route", p.route], ["Trucks", [p.trucks, p.truck_type].filter(x => !isUnset(x)).join(" × ")], ["Loads", p.loads], ["Rate", p.client_rate], ["Payment", p.payment], ["VAT", p.vat]];
  if (mn && d.kind === "mineral") { const s = p._src; if (s) terms.unshift(["Sourced", s.s === "ok" ? "yes – confirmed" : s.s === "yes" ? "yes – being confirmed" : "not yet"]); }
  if (o.comm) terms.push([mn ? "Our commission" : "Our margin", isUnset(p.commission) ? "" : p.commission]);
  if (o.cuts) terms.push(["Other parties' cuts", isUnset(p.other_cuts || p.cuts) ? "" : (p.other_cuts || p.cuts)]);
  if (names && mn) terms.push(["Seller", isUnset(p.seller) ? "" : p.seller], ["Buyer", isUnset(p.buyer) ? "" : p.buyer]);
  const docsIn = (DOCS[d.kind] || []).map(x => [x, docRow(d.id, x.k)]).filter(([, r]) => docIn(r)).map(([x, r]) => `${x.l} – ${DOC_WORD[r.status]} ${shortDate(saDayKey(r.updated_at || Date.now()))}`);
  return { title, ref: dealRef(d), date: longDay(saDayPlus(0)), stage: pg.stages.length ? `Stage ${ci} of ${pg.stages.length}${pg.cur ? " – " + pg.cur.name.replace(/^\d+\.\s*/, "") : " – all steps done"} · ${pg.done} of ${pg.total} steps done` : d.status,
    done, next, waiting, terms: terms.filter(([, v]) => v && String(v).trim()), missing: terms.filter(([, v]) => !v || !String(v).trim()).map(([k]) => k), docsIn, status: d.status };
}
function statusText(m) {
  const L = [`*Deal status – ${m.title}*`, `Ref ${m.ref} · ${m.date}`, m.stage];
  if (m.done.length) L.push("", "*Done*", ...m.done.map(x => "✓ " + x));
  if (m.next.length) L.push("", "*Next*", ...m.next.map(x => "• " + x));
  if (m.waiting.length) L.push("", "*Waiting on*", ...m.waiting.map(x => "• " + x));
  if (m.terms.length) L.push("", "*Terms*", ...m.terms.map(([k, v]) => `${k}: ${v}`));
  if (m.missing.length) L.push(`Still to confirm: ${m.missing.join(", ").toLowerCase()}`);
  if (m.docsIn.length) L.push("", "*Documents in*", ...m.docsIn.map(x => "• " + x));
  return L.join("\n");
}
function statusPdf(m) {
  return makePdf(P => {
    const L = 56, R = 539, W = R - L;
    if (typeof coOn === "function" && coOn()) letterhead(P, L, R);
    P.text(L, P.y, "Deal status", 20, true); P.right(R, P.y, m.ref, 11, false, true); P.y -= 18;
    for (const l of pdfWrap(m.title, 13, W)) { P.text(L, P.y, l, 13, true); P.y -= 16; }
    P.text(L, P.y, m.date, 10, false, true); P.y -= 20;
    const section = t => { P.need(40); P.box(L - 6, P.y - 5, W + 12, 19); P.text(L, P.y, t, 10.5, true); P.y -= 21; };
    const list = (arr, mark) => arr.forEach(t => { const lines = pdfWrap(t, 10.5, W - 16); P.need(lines.length * 13 + 3); P.text(L, P.y, mark, 10.5); lines.forEach((l, i) => P.text(L + 16, P.y - i * 13, l, 10.5)); P.y -= lines.length * 13 + 3; });
    section("Where it stands"); list([m.stage], "•"); P.y -= 4;
    if (m.done.length) { section("Done"); list(m.done, "•"); P.y -= 4; }
    if (m.next.length) { section("Next"); list(m.next, "•"); P.y -= 4; }
    if (m.waiting.length) { section("Waiting on"); list(m.waiting, "•"); P.y -= 4; }
    section("Terms");
    for (const [k, v] of m.terms) { const lines = pdfWrap(v, 10.5, W - 170); P.need(lines.length * 13 + 3); P.text(L, P.y, k, 10.5, false, true); lines.forEach((l, i) => P.text(L + 170, P.y - i * 13, l, 10.5)); P.y -= lines.length * 13 + 3; }
    if (m.missing.length) { const lines = pdfWrap("Still to confirm: " + m.missing.join(", ").toLowerCase(), 10, W); lines.forEach(l => { P.need(14); P.text(L, P.y, l, 10, false, true); P.y -= 13; }); }
    P.y -= 4;
    if (m.docsIn.length) { section("Documents in"); list(m.docsIn, "•"); }
    const co = window._company || {};
    P.y -= 14; P.need(20); P.text(L, P.y, [co.legal_name, co.reg_no && "Reg. no. " + co.reg_no, "confidential – for the parties to this deal"].filter(Boolean).join("  ·  "), 8.5, false, true);
  });
}
function stSheetEl() {
  let el = $("stSheet"); if (el) return el;
  document.body.insertAdjacentHTML("beforeend", `<div id="stSheet" class="sheet hidden" role="dialog" aria-modal="true" aria-labelledby="stTitle"><div class="sheet-b"><div class="sheet-h"><span id="stTitle">Send the deal status</span><button id="stClose" type="button">Close</button></div><div id="stBody"></div></div></div>`);
  return $("stSheet");
}
let stDeal = null;
function stSheetHtml() {
  const d = dealById(stDeal), o = statusOpt[stDeal] ||= {}, nc = ncndaSigned(d), m = statusModel(d, o);
  const tick = (k, label, dis, note) => `<label class="tick${dis ? " off" : ""}"><input type="checkbox" data-sto="${k}"${o[k] && !dis ? " checked" : ""}${dis ? " disabled" : ""}><span>${label}${note ? `<small>${note}</small>` : ""}</span></label>`;
  return `<div class="quiet" style="margin:0 0 6px">Never on it: the private target and walk-away numbers.</div>
    ${tick("comm", d.kind === "transport" ? "Our margin" : "Our commission")}${tick("cuts", "Other parties' cuts")}${tick("names", "The other side's names", !nc, nc ? "" : "only after the NCNDA is signed")}
    <div class="lbl">What goes out</div><pre class="stprev">${esc(statusText(m))}</pre>
    <div class="stacts"><button type="button" class="primary" id="stPdf">${ic("file")}Status PDF</button><button type="button" id="stCopy">${ic("copy")}Copy for WhatsApp</button></div>`;
}
window.openStatus = function (id) { stDeal = id; stSheetEl(); $("stBody").innerHTML = stSheetHtml(); $("stSheet").classList.remove("hidden"); };
document.addEventListener("click", async e => {
  if (e.target.id === "stSheet" || e.target.closest("#stClose")) { $("stSheet").classList.add("hidden"); return; }
  const b = e.target.closest("button[data-dstatus]"); if (b) { openStatus(b.dataset.dstatus); return; }
  if (!stDeal) return;
  const d = dealById(stDeal); if (!d) return;
  if (e.target.closest("#stPdf")) {
    const m = statusModel(d, statusOpt[stDeal] || {}), blob = statusPdf(m);
    const how = await shareFile(blob, `Deal status ${m.ref} ${saDayPlus(0)}.pdf`, "Deal status");
    if (how !== "cancel") toast(how === "shared" ? "Shared." : "PDF saved to your downloads.");
    return;
  }
  if (e.target.closest("#stCopy")) {
    const t = statusText(statusModel(d, statusOpt[stDeal] || {})); window._lastCopy = t;
    try { await navigator.clipboard.writeText(t); toast("Copied – paste it in WhatsApp."); }
    catch (er) { const pre = document.querySelector("#stBody .stprev"); if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast("Copy was blocked – the text is selected: tap Copy on the menu."); }
  }
});
document.addEventListener("change", e => {
  const c = e.target.closest && e.target.closest("input[data-sto]"); if (!c || !stDeal) return;
  (statusOpt[stDeal] ||= {})[c.dataset.sto] = c.checked; $("stBody").innerHTML = stSheetHtml();
});

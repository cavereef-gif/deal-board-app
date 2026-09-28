// Deal Board – the office (28 Sep 2026). Chris: "can i have a signature block where i can sign things" · "need a storage place for
// all the ncnda per job and other documents" · "i signed up for trade key and theres no way to record it on the app".
// 1. My signature (Settings): drawn once with a finger, kept in the database (change 012, only the two of you can read it),
//    placed on a document only when "Sign it as …" is tapped on that document.
// 2. Documents (More › Documents): every deal's papers in one place – NCNDA, IMFPA, contracts, proofs, load papers, other files –
//    what is still to come, and our own company papers.
// 3. Sign-ups (More › Sign-ups): the trade sites and services we joined (Tradekey …) – link, login name, dates, cost, renewal.
//    Never a password.

// ---------- loading ----------
window.officeLoad = function () {
  if (DEMO) {
    window._sigs = window._sigs || {};
    window._platforms = window._platforms || [{ id: "pf1", name: "Example trade site", url: "https://example.com", login: "you@example.com", joined_on: saDayPlus(-20), status: "Active", plan: "Free", cost: "", renews_on: null, owner: "Chris", use_for: "Find chrome buyers", notes: "Demo row", updated_at: new Date().toISOString() }];
    return;
  }
  sb.from("signatures").select("*").then(r => { if (r.error) { window._sigs = null; return; } window._sigs = Object.fromEntries((r.data || []).map(x => [x.person, x])); if (view === "settings") render(); });
  sb.from("platforms").select("*").order("name").then(r => { window._platforms = r.error ? null : (r.data || []); if (view === "signups") render(); });
};

// ---------- 1. my signature ----------
const SIG = { draw: false, draft: "", f: null };
const sigOf = who => { const s = window._sigs && window._sigs[who]; return s && s.png ? s : null; };
window.sigOf = sigOf;
window._sigOn = window._sigOn || {};
// the signature to put on a document made now ("doc" = quote/statement sheet, "tpl" = template sheet)
window.sigToUse = key => (window._sigOn[key] && me ? sigOf(me) : null);
window.sigToggleHtml = function (key) {
  if (!me) return "";
  const s = sigOf(me);
  if (!s) return `<div class="quiet signo">To sign documents here, draw your signature once in Settings › My signature.</div>`;
  const on = !!window._sigOn[key];
  return `<div class="tchips sigt"><button type="button" data-sigon="${key}" class="${on ? "on" : ""}" aria-pressed="${on}">${ic("edit")}Sign it as ${esc(me)}</button></div>`;
};
window.sigSettingsHtml = function () {
  if (!me) return "";
  if (window._sigs === null) return `<div class="card setc"><div class="lbl" style="margin-top:0">My signature</div><div class="quiet">Database change 012 is not applied yet.</div></div>`;
  const s = sigOf(me), cur = (window._sigs || {})[me] || {}, drawing = SIG.draw || !s;
  const f = SIG.f || (SIG.f = { full_name: cur.full_name || "", title: cur.title || "" });
  return `<details class="card setc sigdet"${SIG.draw ? " open" : ""}><summary>My signature – ${s ? "saved" : "not drawn yet"}</summary>
    <div class="quiet">Draw it once with your finger. It goes only on documents you make here, and only when you tap "Sign it as ${esc(me)}" on that document. Only you two can see it.</div>
    ${drawing ? `<div class="sigpad"><canvas id="sigPad" aria-label="Draw your signature here"></canvas><span class="sigl">sign above the line</span></div>
      <div class="acts0"><button type="button" data-sig="clear">${ic("undo")}Clear</button>${s ? `<button type="button" data-sig="cancel">Cancel</button>` : ""}</div>`
    : `<div class="sigview"><img src="${esc(s.png)}" alt="Your saved signature"></div><div class="acts0"><button type="button" data-sig="redraw">${ic("edit")}Draw again</button><button type="button" data-sig="remove">${SIG.rm ? "Tap again to remove" : "Remove"}</button></div>`}
    <label class="fld"><span>Name under the signature</span><input data-sigf="full_name" value="${esc(f.full_name)}" placeholder="Your full name" autocomplete="name"></label>
    <label class="fld"><span>Title</span><input data-sigf="title" value="${esc(f.title)}" placeholder="e.g. Director" autocomplete="off"></label>
    <button type="button" class="primary wide" data-sig="save">${ic("check")}Save signature</button>
    <div class="quiet">A drawn signature counts as an ordinary electronic signature in South Africa (ECTA) – fine for NCNDAs, quotes and most business agreements. A few papers still need ink or a certified signature, for example the sale of land or a will.</div>
  </details>`;
};
function sigPadInit() {
  const c = document.getElementById("sigPad"); if (!c || c._on) return; c._on = true;
  const k = 2, x = c.getContext("2d");
  // size the drawing surface once the box is on screen (it has no width while Settings' fold is closed)
  const fit = () => {
    const r = c.getBoundingClientRect(); if (!r.width || c._w === Math.round(r.width * k)) return;
    c._w = c.width = Math.round(r.width * k); c.height = Math.round(r.height * k);
    x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, c.width, c.height);
    x.lineCap = "round"; x.lineJoin = "round"; x.strokeStyle = "#1B2530"; x.lineWidth = 2.4 * k;
    if (SIG.draft) { const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, c.width, c.height); im.src = SIG.draft; }
  };
  fit(); const det = c.closest("details"); if (det) det.addEventListener("toggle", () => setTimeout(fit, 0));
  let down = false, lx = 0, ly = 0;
  const pos = e => { const b = c.getBoundingClientRect(); return [(e.clientX - b.left) * k, (e.clientY - b.top) * k]; };
  c.addEventListener("pointerdown", e => { fit(); down = true; c.setPointerCapture(e.pointerId); [lx, ly] = pos(e); x.beginPath(); x.arc(lx, ly, x.lineWidth / 2, 0, 7); x.fillStyle = "#1B2530"; x.fill(); e.preventDefault(); });
  c.addEventListener("pointermove", e => { if (!down) return; const [nx, ny] = pos(e); x.beginPath(); x.moveTo(lx, ly); x.lineTo(nx, ny); x.stroke(); lx = nx; ly = ny; SIG.ink = true; e.preventDefault(); });
  const up = () => { if (!down) return; down = false; SIG.draft = c.toDataURL("image/png"); };
  c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up); c.addEventListener("pointerleave", up);
}
(window._after ||= []).push(() => { if (view === "settings") sigPadInit(); });
// the saved picture: 600 × 200, white behind the ink, as a JPEG (the PDF maker places JPEGs as they are)
function sigExport() {
  const c = document.getElementById("sigPad"); if (!c || !SIG.ink) return "";
  const o = document.createElement("canvas"); o.width = 600; o.height = 200;
  const x = o.getContext("2d"); x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, 600, 200); x.drawImage(c, 0, 0, 600, 200);
  return o.toDataURL("image/jpeg", 0.88);
}
async function sigSave(row) {
  if (DEMO) { window._sigs = window._sigs || {}; window._sigs[me] = Object.assign({}, window._sigs[me] || {}, row); return null; }
  const { error } = await sb.from("signatures").upsert(Object.assign({ person: me, updated_at: new Date().toISOString() }, row));
  if (!error) { window._sigs = window._sigs || {}; window._sigs[me] = Object.assign({}, window._sigs[me] || {}, row); }
  return error;
}
document.addEventListener("input", e => { const i = e.target.closest && e.target.closest("input[data-sigf]"); if (i && SIG.f) SIG.f[i.dataset.sigf] = i.value; });
document.addEventListener("click", async e => {
  const t = e.target.closest && e.target.closest("button[data-sigon]");
  if (t) { const k = t.dataset.sigon, on = !window._sigOn[k]; window._sigOn[k] = on; t.classList.toggle("on", on); t.setAttribute("aria-pressed", on); return; }
  const b = e.target.closest && e.target.closest("button[data-sig]"); if (!b) return;
  const a = b.dataset.sig;
  if (a === "clear") { SIG.draft = ""; SIG.ink = false; const c = document.getElementById("sigPad"); if (c) { const x = c.getContext("2d"); x.fillStyle = "#FFFFFF"; x.fillRect(0, 0, c.width, c.height); } return; }
  if (a === "redraw") { SIG.draw = true; SIG.draft = ""; SIG.ink = false; render(); return; }
  if (a === "cancel") { SIG.draw = false; SIG.draft = ""; SIG.ink = false; render(); return; }
  if (a === "remove") {
    if (!SIG.rm) { SIG.rm = true; render(); setTimeout(() => { SIG.rm = false; }, 5000); return; }
    SIG.rm = false; const err = await sigSave({ png: "" }); toast(err ? "Could not remove: " + err.message : "Signature removed."); render(); return;
  }
  if (a === "save") {
    const drawing = SIG.draw || !sigOf(me), png = drawing ? sigExport() : null;
    if (drawing && !png) { toast("Draw your signature in the box first."); return; }
    const row = { full_name: (SIG.f && SIG.f.full_name || "").trim(), title: (SIG.f && SIG.f.title || "").trim() }; if (png) row.png = png;
    b.disabled = true; const err = await sigSave(row); b.disabled = false;
    if (err) { toast("Could not save: " + err.message, 6000); return; }
    SIG.draw = false; SIG.draft = ""; SIG.ink = false; toast(DEMO ? "Saved for this demo only." : "Signature saved."); render();
  }
});

// ---------- 2. documents: every deal's papers in one place ----------
const FILES = { t: "all", deal: "" };
const FILE_TYPES = [["all", "All"], ["ncnda", "NCNDA"], ["imfpa", "IMFPA"], ["contract", "Contracts and offers"], ["proof", "Proofs and KYC"], ["loads", "Load papers"], ["files", "Other files"], ["company", "Company papers"]];
const fileGroup = k => k === "ncnda" ? "ncnda" : k === "imfpa" ? "imfpa" : /^(spa|contract|quote|loi|icpo|fco)$/.test(k) ? "contract" : /^(poo|pof|assay|insurance|kyc)$/.test(k) ? "proof" : /^(tickets|pod|invoices)$/.test(k) ? "loads" : "files";
const COMPANY_PAPERS = ["Company registration (CIPC certificate)", "Tax compliance status (SARS PIN)", "VAT registration letter", "B-BBEE affidavit or certificate", "Bank confirmation letter", "Directors' IDs and proof of address"];
const fDay = iso => iso ? shortDate(saDayKey(iso)) : "";
function fileLink(a) {
  const u = a && window._urls && window._urls[a.path];
  return a ? (u && u !== "#" ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(a.name)}</a>` : esc(a.name)) : "";
}
// every document with a status or a file, and every other file, per deal
function fileRows() {
  const out = [], deals = (window._deals || []).filter(d => d.kind === "mineral" || d.kind === "transport");
  for (const d of deals) {
    const list = (window.DOCS && DOCS[d.kind]) || [], linked = new Set();
    for (const x of list) {
      const r = (window._docs || []).find(z => z.deal_id === d.id && z.doc === x.k);
      const a = r && r.att_id ? (window._atts || []).find(z => String(z.id) === String(r.att_id)) : null;
      if (a) linked.add(String(a.id));
      if (!r && !a) continue;
      out.push({ d, k: x.k, g: fileGroup(x.k), l: x.l, st: r ? r.status : "", on: r ? r.updated_at : a.created_at, a });
    }
    for (const a of (window._atts || []).filter(z => z.target_type === "deal" && String(z.target_id) === String(d.id) && !linked.has(String(z.id))))
      out.push({ d, k: "", g: "files", l: "File", st: "", on: a.created_at, a });
  }
  return out;
}
const ST_WORD = { draft: "draft", requested: "asked for", received: "received", signed: "signed", na: "not needed" };
window.filesHtml = function () {
  const rows = fileRows(), deals = [...new Set(rows.map(r => r.d))];
  const comp = (window._atts || []).filter(a => a.target_type === "company");
  const pick = r => (FILES.t === "all" || r.g === FILES.t) && (!FILES.deal || r.d.id === FILES.deal);
  const cnt = t => t === "company" ? comp.length : t === "all" ? rows.length : rows.filter(r => r.g === t).length;
  const nf = rows.filter(r => r.a).length, ns = rows.filter(r => r.st === "signed").length;
  let h = rplain("all deals", `${nf} file${nf === 1 ? "" : "s"} · ${ns} signed`, true);
  h += `<div class="fchips" role="group" aria-label="Show">${FILE_TYPES.map(([k, w]) => `<button type="button" data-fft="${k}" class="${FILES.t === k ? "on" : ""}" aria-pressed="${FILES.t === k}">${esc(w)}<small>${cnt(k)}</small></button>`).join("")}</div>`;
  if (FILES.t !== "company") h += `<label class="fld"><span>Deal</span><select id="filesDeal"><option value="">All deals</option>${(window._deals || []).filter(d => d.kind === "mineral" || d.kind === "transport").map(d => `<option value="${d.id}"${FILES.deal === d.id ? " selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label>`;
  if (FILES.t === "company") {
    h += rplain("our company papers", `${comp.length}`);
    h += rfoot("keep the papers buyers and sellers ask for in the KYC here, so they are one tap away");
    h += `<div class="files">${comp.map(a => `<div class="file">${ic("clip")}<span class="fn">${fileLink(a)}</span><span class="fm">${fmtSize(a.size)} · ${esc(firstName(a.uploaded_by))} · ${esc(fDay(a.created_at))}</span></div>`).join("") || `<div class="quiet">None yet.</div>`}
      <div class="acts0"><button type="button" data-attach="company:papers">${ic("clip")}Add a company paper</button></div></div>`;
    h += `<div class="lbl">Usually asked for</div><div class="tplfrom cpl">${COMPANY_PAPERS.map(p => { const has = comp.some(a => new RegExp(p.split(/[ (]/)[0].slice(0, 5), "i").test(a.name)); return `<div class="kv"><span class="k">${esc(p)}</span><span class="v">${has ? "in" : "–"}</span></div>`; }).join("")}</div>`;
    return h;
  }
  // what is still to come: documents asked for and not in yet
  const wait = rows.filter(r => r.st === "requested" && pick(r));
  const noNda = (window._deals || []).filter(d => d.status !== "Won" && d.status !== "Lost" && (window.DOCS && (DOCS[d.kind] || []).some(x => x.k === "ncnda")) && (!FILES.deal || d.id === FILES.deal) && !(window._docs || []).some(z => z.deal_id === d.id && z.doc === "ncnda" && (z.status === "signed" || z.status === "na")));
  if (wait.length || ((FILES.t === "all" || FILES.t === "ncnda") && noNda.length)) {
    h += rplain("still to come", `${wait.length + ((FILES.t === "all" || FILES.t === "ncnda") ? noNda.length : 0)}`);
    h += `<div class="fwait">${wait.map(r => `<button type="button" class="fw" data-fopen="${r.d.id}"><b>${esc(r.l)}</b><span>${esc(r.d.name)} · asked ${esc(fDay(r.on))}</span></button>`).join("")}${(FILES.t === "all" || FILES.t === "ncnda") ? noNda.filter(d => !wait.some(r => r.d === d && r.k === "ncnda")).map(d => `<button type="button" class="fw" data-fopen="${d.id}"><b>NCNDA not signed yet</b><span>${esc(d.name)}</span></button>`).join("") : ""}</div>`;
  }
  const shown = deals.filter(d => rows.some(r => r.d === d && pick(r)));
  if (!shown.length) h += `<div class="quiet" style="margin-top:12px">${rows.length ? "Nothing of this kind yet." : "No documents yet. Open a deal › Docs to mark what was asked for or signed, make a template, or upload a file."}</div>`;
  for (const d of shown) {
    const mine = rows.filter(r => r.d === d && pick(r));
    h += `<div class="lsec fdeal"><div class="lsh"><b>${esc(d.name)}</b><button type="button" class="linkb" data-fopen="${d.id}">Open Docs</button></div>`;
    h += mine.map(r => `<div class="frow${r.st === "signed" || r.st === "received" ? " in" : ""}"><div class="fk"><b>${esc(r.l)}</b><span>${esc([ST_WORD[r.st] || "", fDay(r.on)].filter(Boolean).join(" · "))}</span></div>${r.a ? `<div class="ff">${ic("clip")}<span>${fileLink(r.a)}</span></div>` : `<div class="ff quiet">no file yet</div>`}</div>`).join("");
    h += `</div>`;
  }
  return h;
};
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("button[data-fft]");
  if (t) { FILES.t = t.dataset.fft; render(); return; }
  const o = e.target.closest && e.target.closest("button[data-fopen]");
  if (o) { const id = o.dataset.fopen; if (window.openDealPage) { openDealPage(id); if (window.setDealTab) setDealTab(id, "docs"); goView("deal"); } }
});
document.addEventListener("change", e => { if (e.target.id === "filesDeal") { FILES.deal = e.target.value; render(); } });

// ---------- 3. sign-ups: trade sites and services we joined ----------
const SU = { edit: null, f: null, rm: null };
const SU_KNOWN = [["Tradekey", "https://www.tradekey.com"], ["Alibaba.com", "https://www.alibaba.com"], ["go4WorldBusiness", "https://www.go4worldbusiness.com"], ["EC21", "https://www.ec21.com"], ["Metalbook", "https://metalbook.com"], ["SMM (Shanghai Metals Market)", "https://www.metal.com"], ["LinkedIn", "https://www.linkedin.com"]];
const suBlank = name => { const k = SU_KNOWN.find(x => x[0] === name); return { name: name || "", url: k ? k[1] : "", login: "", joined_on: saDayPlus(0), status: "Active", plan: "Free", cost: "", renews_on: "", owner: me || "Both", use_for: "", notes: "", remind: true }; };
const suOrder = { Active: 0, Trial: 1, Lapsed: 2, Cancelled: 3 };
window.signupsHtml = function () {
  const P = window._platforms;
  if (P === null) return `<div class="quiet">Database change 012 is not applied yet.</div>`;
  const list = (P || []).slice().sort((a, b) => (suOrder[a.status] - suOrder[b.status]) || a.name.localeCompare(b.name));
  const paid = list.filter(p => p.plan === "Paid" && p.status !== "Cancelled");
  let h = rplain("sites we joined", `${list.filter(p => p.status === "Active" || p.status === "Trial").length} active${paid.length ? ` · ${paid.length} paid` : ""}`, true);
  h += rfoot("login name and renewal date – never a password; keep those in your phone's password manager");
  if (SU.edit === "new") h += suFormHtml();
  else h += `<div class="acts0"><button type="button" class="primary" data-sunew="">${ic("plus")}Add a sign-up</button>${list.some(p => /tradekey/i.test(p.name)) ? "" : `<button type="button" data-sunew="Tradekey">${ic("plus")}Add Tradekey</button>`}</div>`;
  const soon = list.filter(p => p.renews_on && p.status !== "Cancelled" && dayDiff(new Date(p.renews_on + "T12:00:00")) <= 14);
  if (soon.length) h += `<div class="warn"><i class="dot d-due"></i><div>Renewing soon: ${soon.map(p => `${esc(p.name)} (${esc(shortDate(p.renews_on))})`).join(", ")}</div></div>`;
  for (const p of list) {
    if (SU.edit === p.id) { h += suFormHtml(); continue; }
    const bits = [p.login && "login " + p.login, p.joined_on && "joined " + shortDate(p.joined_on), p.renews_on && "renews " + shortDate(p.renews_on), p.plan === "Paid" ? (p.cost ? "paid · " + p.cost : "paid") : "free", p.owner && p.owner !== "Both" ? p.owner + "'s" : ""].filter(Boolean);
    h += `<div class="trow surow${p.status === "Cancelled" || p.status === "Lapsed" ? " na" : ""}"><div class="k"><b>${esc(p.name)}${p.use_for ? `<small>${esc(p.use_for)}</small>` : ""}</b><span>${esc(p.status.toLowerCase())}</span></div>
      <div class="sub quiet">${esc(bits.join(" · "))}</div>${p.notes ? `<div class="sub quiet">${esc(p.notes)}</div>` : ""}
      <div class="acts0">${p.url ? `<a class="abtn" href="${esc(/^https?:/i.test(p.url) ? p.url : "https://" + p.url)}" target="_blank" rel="noopener">${ic("open")}Open the site</a>` : ""}<button type="button" data-suedit="${p.id}">${ic("edit")}Change</button></div></div>`;
  }
  if (!list.length && SU.edit !== "new") h += `<div class="quiet" style="margin-top:12px">Nothing recorded yet.</div>`;
  return h;
};
function suFormHtml() {
  const f = SU.f, seg = (k, opts) => `<div class="seg2" role="group" aria-label="${k}">${opts.map(o => `<button type="button" data-suseg="${k}" data-v="${o}" class="${f[k] === o ? "on" : ""}" aria-pressed="${f[k] === o}">${o}</button>`).join("")}</div>`;
  const box = (k, l, ph, type) => `<label class="fld"><span>${l}</span><input data-suf="${k}"${type ? ` type="${type}"` : ""} value="${esc(f[k] || "")}" placeholder="${esc(ph || "")}" autocomplete="off"${type === "url" ? ' inputmode="url"' : ""}></label>`;
  return `<div class="card suform"><div class="lbl" style="margin-top:0">${SU.edit === "new" ? "New sign-up" : "Change " + esc(f.name)}</div>
    <label class="fld"><span>Site or service</span><input data-suf="name" list="suKnown" value="${esc(f.name)}" placeholder="e.g. Tradekey" autocomplete="off"></label><datalist id="suKnown">${SU_KNOWN.map(([n]) => `<option value="${esc(n)}">`).join("")}</datalist>
    ${box("url", "Link", "https://…", "url")}${box("login", "Login name or email – never the password", "e.g. the email you signed up with")}
    ${box("use_for", "What we use it for", "e.g. find chrome buyers · post loads")}
    <div class="fld"><span>Status</span></div>${seg("status", ["Active", "Trial", "Lapsed", "Cancelled"])}
    <div class="fld"><span>Plan</span></div>${seg("plan", ["Free", "Paid"])}
    ${f.plan === "Paid" ? box("cost", "Cost", "e.g. US$ 99 a year") : ""}
    <div class="calc">${box("joined_on", "Joined", "", "date")}${box("renews_on", "Renews", "", "date")}</div>
    ${f.renews_on && SU.edit === "new" ? `<label class="chk"><input type="checkbox" data-suchk="remind"${f.remind ? " checked" : ""}> Remind ${esc(f.owner === "Both" ? "us both" : f.owner)} 7 days before it renews</label>` : ""}
    <div class="fld"><span>Whose account</span></div>${seg("owner", ["Chris", "Annemarie", "Both"])}
    <label class="fld"><span>Notes</span><textarea data-suf="notes" rows="2" placeholder="e.g. membership number, who to contact, what we posted">${esc(f.notes || "")}</textarea></label>
    <div class="acts0"><button type="button" class="primary" data-susave="1">${ic("check")}Save</button><button type="button" data-sucancel="1">Cancel</button>${SU.edit !== "new" ? `<button type="button" data-surm="${SU.edit}">${SU.rm === SU.edit ? "Tap again to remove" : "Remove"}</button>` : ""}</div></div>`;
}
async function suRemind(p) {
  const due = saDayKey(Math.max(Date.now(), new Date(p.renews_on + "T12:00:00").getTime() - 7 * 864e5));
  const body = { p_project: "Verve admin", p_waiting_on: "Me", p_waiting_for: `Renew or cancel ${p.name} (renews ${shortDate(p.renews_on)})`, p_blocks: "", p_next: p.url || "", p_priority: 2, p_owner: p.owner || me || "Chris", p_deal: null, p_due: due };
  if (DEMO) { toast("Demo: the reminder would be on " + shortDate(due) + "."); return; }
  const { error } = await sb.rpc("add_item", body); if (error) toast("Saved, but the reminder could not be made: " + error.message, 6000);
}
document.addEventListener("input", e => {
  const i = e.target.closest && e.target.closest("[data-suf]"); if (!i || !SU.f) return;
  SU.f[i.dataset.suf] = i.value;
  if (i.dataset.suf === "name" && !SU.f.url) { const k = SU_KNOWN.find(x => x[0].toLowerCase() === i.value.trim().toLowerCase()); if (k) { SU.f.url = k[1]; const u = document.querySelector('[data-suf="url"]'); if (u) u.value = k[1]; } }
});
document.addEventListener("change", e => {
  const i = e.target.closest && e.target.closest("[data-suf]"); if (i && SU.f && i.type === "date") { SU.f[i.dataset.suf] = i.value; render(); return; }
  const c = e.target.closest && e.target.closest("input[data-suchk]"); if (c && SU.f) SU.f[c.dataset.suchk] = c.checked;
});
document.addEventListener("click", async e => {
  const q = s => e.target.closest && e.target.closest(s);
  const n = q("button[data-sunew]"); if (n) { SU.edit = "new"; SU.f = suBlank(n.dataset.sunew); render(); return; }
  const ed = q("button[data-suedit]"); if (ed) { const p = (window._platforms || []).find(x => x.id === ed.dataset.suedit); if (p) { SU.edit = p.id; SU.f = Object.assign({}, p, { renews_on: p.renews_on || "", joined_on: p.joined_on || "" }); render(); } return; }
  const sg = q("button[data-suseg]"); if (sg && SU.f) { SU.f[sg.dataset.suseg] = sg.dataset.v; render(); return; }
  if (q("button[data-sucancel]")) { SU.edit = null; SU.f = null; SU.rm = null; render(); return; }
  const rm = q("button[data-surm]");
  if (rm) {
    const id = rm.dataset.surm; if (SU.rm !== id) { SU.rm = id; render(); return; }
    if (!DEMO) { const { error } = await sb.from("platforms").delete().eq("id", id); if (error) { toast("Could not remove: " + error.message, 6000); return; } }
    window._platforms = (window._platforms || []).filter(x => x.id !== id); SU.edit = null; SU.f = null; SU.rm = null; toast("Removed."); render(); return;
  }
  const sv = q("button[data-susave]");
  if (sv && SU.f) {
    const f = SU.f, name = String(f.name || "").trim(); if (!name) { toast("Type the site's name."); return; }
    if (/password|passwd|wagwoord|pwd\s*[:=]/i.test((f.notes || "") + " " + (f.login || ""))) { toast("Please don't keep passwords here – use your phone's password manager.", 6000); return; }
    const row = { name, url: String(f.url || "").trim(), login: String(f.login || "").trim(), joined_on: f.joined_on || null, status: f.status, plan: f.plan, cost: f.plan === "Paid" ? String(f.cost || "").trim() : "", renews_on: f.renews_on || null, owner: f.owner, use_for: String(f.use_for || "").trim(), notes: String(f.notes || "").trim(), updated_by: me || "", updated_at: new Date().toISOString() };
    const isNew = SU.edit === "new";
    sv.disabled = true;
    if (DEMO) { if (isNew) (window._platforms ||= []).push(Object.assign({ id: "pf" + Date.now() }, row)); else Object.assign((window._platforms || []).find(x => x.id === SU.edit) || {}, row); }
    else {
      const r = isNew ? await sb.from("platforms").insert(row).select("*").single() : await sb.from("platforms").update(row).eq("id", SU.edit).select("*").single();
      sv.disabled = false; if (r.error) { toast("Could not save: " + r.error.message, 6000); return; }
      if (isNew) (window._platforms ||= []).push(r.data); else Object.assign((window._platforms || []).find(x => x.id === SU.edit) || {}, r.data);
    }
    if (isNew && row.renews_on && f.remind) await suRemind(row);
    SU.edit = null; SU.f = null; toast(DEMO ? "Demo mode – kept until you reload." : "Saved."); render();
  }
});

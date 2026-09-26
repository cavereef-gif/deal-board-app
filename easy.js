// Deal Board v17 – less typing (26 Sep 2026, Chris: "least input, max output"):
//   · Add to calendar – a task's date as a calendar entry with a reminder (.ics file: Google Calendar on Android, Calendar on iPhone)
//   · Booking link – your own booking page (Google Calendar or Calendly) sent on WhatsApp in one tap; the link is set in Settings
//   · PDF quote (Transport calculator) and PDF commission statement (Chrome & ore calculator) – filled in from the calculator,
//     checked in a short sheet, then shared straight to WhatsApp or email. Only client-facing numbers go on a document: never our
//     costs, margins or the private walk-away target and limit.
// The PDF is written by a small maker below (no outside library), so it works offline and on Safari 16.

// ---------- a very small PDF maker (A4, Helvetica, text, lines and shaded boxes) ----------
const PDF_MAP = { "–": "\x96", "—": "\x97", "‘": "\x91", "’": "\x92", "“": "\x93", "”": "\x94", "•": "\x95", "…": "\x85", "€": "\x80", "−": "-", "→": "->", " ": " ", " ": " " };
const pdfEnc = s => String(s == null ? "" : s).replace(/[\s\S]/g, ch => PDF_MAP[ch] || (ch.charCodeAt(0) < 256 ? ch : "?")).replace(/[\\()]/g, m => "\\" + m);
// Helvetica widths (per 1000): most small letters are 556 wide – counting them as 500 let long lines run past the margin
const PDF_W = { a: 556, b: 556, d: 556, e: 556, g: 556, h: 556, n: 556, o: 556, p: 556, q: 556, u: 556, c: 500, k: 500, s: 500, v: 500, x: 500, y: 500, z: 500,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, J: 500, K: 667, L: 556, N: 722, O: 778, P: 667, Q: 778, T: 611, V: 667, X: 667, Y: 667, Z: 611, " ": 278, ".": 278, ",": 278, "-": 333, "/": 278, ":": 278, "%": 889, "(": 333, ")": 333, "R": 722, "U": 722, "S": 667, "$": 556, "t": 278, "i": 222, "l": 222, "f": 278, "j": 222, "r": 333, "m": 833, "w": 722, "I": 278, "M": 833, "W": 944 };
function pdfWidth(s, size) { let w = 0; for (const ch of String(s)) w += PDF_W[ch] || (/[0-9]/.test(ch) ? 556 : /[A-Z]/.test(ch) ? 667 : 500); return w / 1000 * size; }
function pdfWrap(s, size, maxW) {
  const out = [];
  for (const para of String(s || "").split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) { const t = line ? line + " " + word : word; if (pdfWidth(t, size) > maxW && line) { out.push(line); line = word; } else line = t; }
    out.push(line);
  }
  return out;
}
function makePdf(draw) {
  const pages = [];
  let ops = [], y = 800;
  const P = {
    get y() { return y; }, set y(v) { y = v; },
    text(x, yy, s, size, bold, grey) { ops.push(`BT ${grey ? "0.38 0.40 0.44" : "0.11 0.12 0.14"} rg /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${pdfEnc(s)}) Tj ET`); },
    right(xr, yy, s, size, bold, grey) { P.text(xr - pdfWidth(s, size), yy, s, size, bold, grey); },
    line(x1, y1, x2, y2) { ops.push(`0.80 0.82 0.85 RG 0.6 w ${x1} ${y1.toFixed(1)} m ${x2} ${y2.toFixed(1)} l S`); },
    box(x, yy, w, h) { ops.push(`0.94 0.95 0.96 rg ${x} ${yy.toFixed(1)} ${w} ${h.toFixed(1)} re f`); },
    need(h) { if (y - h < 60) { pages.push(ops.join("\n")); ops = []; y = 800; } },
  };
  draw(P);
  pages.push(ops.join("\n"));
  const objs = [], add = s => { objs.push(s); return objs.length; };
  const cat = add(""), pagesId = add(""), f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"), f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids = [];
  for (const c of pages) {
    const cs = add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${cs} 0 R >>`));
  }
  objs[cat - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
  return new Blob([bytes], { type: "application/pdf" });
}
// one layout for both documents: title and our name, number and dates on the right, "To", a table, notes, a footer
function docPdf(d) {
  return makePdf(P => {
    const L = 56, R = 539;
    P.text(L, P.y, d.title, 22, true); P.right(R, P.y, d.number, 11, false, true);
    P.y -= 20; if (d.from) P.text(L, P.y, d.from, 12, false);
    let ry = P.y; for (const [k, v] of d.meta) { P.right(R, ry, `${k}: ${v}`, 10, false, true); ry -= 14; }
    P.y = Math.min(P.y, ry) - 26;
    P.text(L, P.y, "To", 10, false, true); P.y -= 16;
    for (const l of pdfWrap(d.to, 13, 300)) { P.text(L, P.y, l, 13, true); P.y -= 17; }
    P.y -= 14; P.box(L - 6, P.y - 6, R - L + 12, 22); P.text(L, P.y, "Item", 10, true); P.right(R, P.y, "Amount", 10, true); P.y -= 26;
    for (const [k, v, big] of d.rows) {
      const lines = pdfWrap(k, 11, 300); P.need(lines.length * 15 + 12);
      lines.forEach((l, i) => P.text(L, P.y - i * 15, l, 11, !!big));
      P.right(R, P.y, v, big ? 12 : 11, !!big);
      P.y -= lines.length * 15 + 4; P.line(L - 6, P.y, R + 6, P.y); P.y -= 14;
    }
    if (d.notes) { P.y -= 8; P.need(40); P.text(L, P.y, "Notes", 10, true); P.y -= 15; for (const l of pdfWrap(d.notes, 10.5, R - L)) { P.need(16); P.text(L, P.y, l, 10.5); P.y -= 14; } }
    P.y -= 18; P.need(20); P.text(L, P.y, d.footer || "", 9, false, true);
  });
}
async function shareFile(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title }); return "shared"; } }
  catch (e) { if (e && e.name === "AbortError") return "cancel"; }
  const u = URL.createObjectURL(blob), a = document.createElement("a");
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
  return "saved";
}
window.makePdf = makePdf; window.docPdf = docPdf;

// ---------- remembered on this phone only: the name on documents and your booking link ----------
const easyGet = k => { try { return localStorage.getItem(k + ":" + (me || "")) || ""; } catch (e) { return ""; } };
const easySet = (k, v) => { try { localStorage.setItem(k + ":" + (me || ""), v); } catch (e) {} };
const randR = n => (n < 0 ? "-" : "") + "R " + Math.round(Math.abs(n)).toLocaleString("en-ZA").replace(/[  ,]/g, " ");
const randR2 = n => "R " + (Math.round(n * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const docNo = p => { const d = new Date(Date.now() + 2 * 3600e3); return p + "-" + d.toISOString().slice(2, 10).replace(/-/g, "") + "-" + d.toISOString().slice(11, 16).replace(":", ""); };
const longDay = k => new Date(k + "T08:00:00+02:00").toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Johannesburg" });

// ---------- the document sheet ----------
const QUOTE_EX = "Excl. VAT", QUOTE_IN = "Incl. VAT", QUOTE_ZERO = "0% VAT";   // short so all three fit on a small phone
const CROSS_BORDER = /ressano|maputo|matola|mozambi|beira|nacala|komatipoort border|zimbabwe|harare|bulawayo|botswana|gaborone|francistown|zambia|lusaka|ndola|kitwe|copperbelt|namibia|windhoek|walvis|lesotho|maseru|eswatini|swaziland|mbabane|manzini|malawi|lilongwe|blantyre|\bdrc\b|congo|lubumbashi|kolwezi|tanzania|dar es salaam/i;
let DOC = null;   // { kind: "quote" | "comm", f: {...} }
function docField(k, label, ph, opts) {
  const v = DOC.f[k] == null ? "" : String(DOC.f[k]);
  if (opts === "area") return `<label class="fld"><span>${label}</span><textarea data-docf="${k}" rows="3" placeholder="${esc(ph)}">${esc(v)}</textarea></label>`;
  if (Array.isArray(opts)) return `<div class="fld"><span>${label}</span></div><div class="seg2" role="group" aria-label="${esc(label)}">${opts.map(o => `<button type="button" data-docseg="${k}" data-v="${esc(o)}" class="${v === o ? "on" : ""}" aria-pressed="${v === o}">${esc(o)}</button>`).join("")}</div>`;
  return `<label class="fld"><span>${label}</span><input data-docf="${k}"${opts === "date" ? ' type="date"' : ""} value="${esc(v)}" placeholder="${esc(ph)}" ${opts === "num" ? 'inputmode="decimal"' : ""} autocomplete="off"></label>`;
}
function docRows() {
  const f = DOC.f, n = k => num(f[k]);
  if (DOC.kind === "quote") {
    // 27 Sep 2026: transport from South Africa to another country is zero-rated (VAT Act s11(2)(a)) – "0% VAT (cross-border)"
    const zero = f.vat === QUOTE_ZERO, incl = f.vat === QUOTE_IN, tag = zero ? " (0% VAT)" : incl ? " (incl. VAT)" : " (excl. VAT)";
    const rate = n("rate"), ex = incl ? rate / 1.15 : rate, tpl = n("tpl") || 34, rows = [];
    rows.push([`Road transport ${f.fromPlace || "?"} to ${f.toPlace || "?"}${n("km") ? ` (about ${Math.round(n("km"))} km one way)` : ""}`, ""]);
    rows.push(["Rate per ton" + (zero ? " (0% VAT – transport to another country)" : incl ? " (including 15% VAT)" : " (excluding VAT)"), randR2(rate), 1]);
    if (!zero && !incl) rows.push(["Rate per ton including 15% VAT", randR2(rate * 1.15)]);
    rows.push([`Per load of ${tpl} tons` + tag, randR(rate * tpl)]);
    if (n("loads")) rows.push([`${n("loads")} loads a month` + tag, randR(rate * tpl * n("loads"))]);
    return { rows, ok: rate > 0, ex };
  }
  const q = n("qty"), rate = n("rate"), sub = q * rate, vat = f.vat === "Add 15% VAT" ? sub * 0.15 : 0;
  const rows = [[`Commission${f.deal ? " – " + f.deal : ""}: ${q.toLocaleString("en-ZA", { maximumFractionDigits: 2 }).replace(/[  ,]/g, " ")} DMT at ${randR2(rate)} per DMT`, randR2(sub)]];
  if (vat) rows.push(["VAT 15%", randR2(vat)]);
  rows.push(["Total due", randR2(sub + vat), 1]);
  return { rows, ok: q > 0 && rate > 0 };
}
function docSheetHtml() {
  const q = DOC.kind === "quote", r = docRows();
  return (q
    ? docField("to", "Quote to (client)", "Company or person") + docField("from", "From (your name – remembered)", "e.g. your trading name") +
      `<div class="calc">${docField("rate", "Rate per ton (R)", "e.g. 420", "num")}${docField("tpl", "Tons per load", "34", "num")}</div>` +
      docField("vat", "The rate is", "", [QUOTE_EX, QUOTE_IN, QUOTE_ZERO]) +
      (DOC.f.vat === QUOTE_ZERO ? `<div class="quiet">0% VAT is for transport from South Africa to another country (zero-rated, VAT Act section 11(2)(a)). Keep the delivery note, transport papers and proof of payment.</div>` : "") +
      `<div class="calc">${docField("loads", "Loads a month", "optional", "num")}${docField("valid", "Valid (days)", "7", "num")}</div>` +
      docField("notes", "Notes on the quote", "e.g. Payment 30 days from POD. Weighbridge at loading counts.", "area")
    : docField("to", "Statement to (who pays the commission)", "Company") + docField("from", "From (your name – remembered)", "e.g. your trading name") +
      docField("deal", "Deal or reference", "e.g. Chrome lumpy – August") +
      `<div class="calc">${docField("qty", "Dry tons (DMT)", "e.g. 940", "num")}${docField("rate", "Rate per DMT (R)", "e.g. 40", "num")}</div>` +
      docField("vat", "VAT", "", ["No VAT", "Add 15% VAT"]) + docField("due", "Payment due", "", "date") +
      docField("notes", "Payment details and notes", "e.g. Pay by EFT, reference as above. Bank details as on our invoice.", "area"))
    + `<div class="lbl">On the document</div><div class="cres">${r.rows.filter(x => x[1]).map(([k, v, b]) => `<div class="kv${b ? " big" : ""}"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("")}</div>`
    + `<div class="quiet">${q ? "Only the client's price goes on the quote – never our costs or margin." : "Check the tons and rate against the weighbridge and the signed commission agreement."}</div>`
    + `<button class="primary wide" data-docmake="1"${r.ok ? "" : " disabled"}>${ic("file")}Make the PDF and share it</button>`;
}
function openDocSheet(kind, f) {
  DOC = { kind, f: Object.assign({ from: easyGet("docFrom"), valid: "7", tpl: "34", vat: kind === "quote" ? (CROSS_BORDER.test((f && f.toPlace) || "") ? QUOTE_ZERO : QUOTE_EX) : "No VAT" }, f) };
  $("docTitle").textContent = kind === "quote" ? "Quote PDF" : "Commission statement PDF";
  $("docBody").innerHTML = docSheetHtml(); $("docSheet").classList.remove("hidden");
}
window.openDocSheet = openDocSheet;
function docRefresh() { const b = $("docBody"); const a = document.activeElement, k = a && a.dataset && a.dataset.docf, pos = a && a.selectionStart; b.innerHTML = docSheetHtml(); if (k) { const el = b.querySelector(`[data-docf="${k}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } } }
async function docMake() {
  const f = DOC.f, q = DOC.kind === "quote", r = docRows(); if (!r.ok) return;
  if (f.from) easySet("docFrom", f.from);
  const number = docNo(q ? "Q" : "CS"), today = saDayPlus(0);
  const meta = [["Date", longDay(today)]];
  if (q) meta.push(["Valid until", longDay(saDayKey(Date.now() + (num(f.valid) || 7) * 864e5))]); else if (/^\d{4}-\d{2}-\d{2}$/.test(f.due || "")) meta.push(["Payment due", longDay(f.due)]);
  const blob = docPdf({ title: q ? "Transport quote" : "Commission statement", number, from: f.from || me || "", to: f.to || "", meta, rows: r.rows, notes: f.notes || "",
    footer: q ? "Prices in South African rand. Subject to truck availability on the day of loading." : "This statement is for the commission agreed in writing for the deal above." });
  const name = (q ? "Quote " : "Commission statement ") + (f.to || "").replace(/[^\w\- ]+/g, "").trim().slice(0, 40) + " " + number + ".pdf";
  const how = await shareFile(blob, name.replace(/\s+/g, " "), q ? "Transport quote" : "Commission statement");
  if (how === "cancel") return;
  $("docSheet").classList.add("hidden");
  toast(how === "shared" ? "Shared." : "PDF saved to your downloads.");
}
document.addEventListener("input", e => {
  const el = e.target.closest && e.target.closest("[data-docf]"); if (!el || !DOC) return;
  DOC.f[el.dataset.docf] = el.value;
  const res = $("docBody").querySelector(".cres"), btn = $("docBody").querySelector("[data-docmake]"), r = docRows();
  if (res) res.innerHTML = r.rows.filter(x => x[1]).map(([k, v, b]) => `<div class="kv${b ? " big" : ""}"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("");
  if (btn) btn.disabled = !r.ok;
});
document.addEventListener("click", async e => {
  if (e.target.id === "docSheet" || e.target.closest("#docClose")) { $("docSheet").classList.add("hidden"); return; }
  const sg = e.target.closest("button[data-docseg]"); if (sg && DOC) { DOC.f[sg.dataset.docseg] = sg.dataset.v; docRefresh(); return; }
  if (e.target.closest("button[data-docmake]")) { docMake(); return; }
  // from the Transport calculator
  if (e.target.closest("button[data-trquote]")) {
    const TRp = window._trip || {}, d = TRp.deal && dealById(TRp.deal);
    openDocSheet("quote", { to: d ? (d.params && (d.params.client || d.params.buyer)) || "" : "", rate: TRp.client || "", tpl: String(TRp.tpl || 34), loads: TRp.loads || "", km: TRp.km || "", fromPlace: TRp.from || "", toPlace: TRp.to || "" });
    return;
  }
  // from the Chrome & ore calculator
  const cs = e.target.closest("button[data-commpdf]");
  if (cs) {
    const key = cs.dataset.commpdf, st = (window._calc || {})[key] || {}, d = dealById(key), v = k => +(String(st[k] || "").replace(",", ".")) || 0;
    const dmt = v("wmt") * (1 - v("moist") / 100), share = (st.share === "" || st.share == null ? 100 : v("share")) / 100, rate = (v("comm") - v("cuts")) * share;
    openDocSheet("comm", { deal: d ? d.name : "", qty: dmt ? String(Math.round(dmt * 100) / 100) : "", rate: rate ? String(Math.round(rate * 100) / 100) : "", vat: st.vat === "Yes" ? "Add 15% VAT" : "No VAT", due: workDayPlus(7) });
    return;
  }
});

// ---------- Add to calendar (.ics) ----------
function icsFor(title, dayKey, details) {
  const d = dayKey.replace(/-/g, ""), stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const esc2 = s => String(s || "").replace(/[\\;,]/g, m => "\\" + m).replace(/\r?\n|\r/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Deal Board//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${Date.now()}-${Math.random().toString(36).slice(2)}@deal-board`, `DTSTAMP:${stamp}`,
    `DTSTART:${d}T063000Z`, `DTEND:${d}T064500Z`,   // 08:30–08:45 South African time (UTC+2 all year)
    `SUMMARY:${esc2(title)}`, `DESCRIPTION:${esc2(details)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc2(title)}`, "TRIGGER:-PT0M", "END:VALARM", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
window.calBtn = it => ib("calendar", "file", `data-ics="${esc(it.id)}"`, "Calendar");
document.addEventListener("click", async e => {
  const b = e.target.closest("button[data-ics]"); if (!b) return;
  const it = (window._items || []).find(x => String(x.id) === b.dataset.ics); if (!it) return;
  const day = it.due_on || saDayKey(dueDate(it)), title = it._me ? it.waiting_for : `Chase ${it.waiting_on}: ${it.waiting_for}`;
  const deal = it.deal_id && dealById(it.deal_id);
  const blob = new Blob([icsFor(title, day, [deal ? "Deal: " + deal.name : "", "From Deal Board"].filter(Boolean).join("\n"))], { type: "text/calendar" });
  const how = await shareFile(blob, "deal-board-" + day + ".ics", title);
  if (how !== "cancel") toast("Calendar entry made for " + dayName(new Date(day + "T08:00:00+02:00")) + " at 08:30 – open it to add it.");
});

// ---------- Booking link ----------
window.bookingBtn = name => ib("calendar", "wa", `data-book="${esc(name)}"`, "Send booking link");
document.addEventListener("click", e => {
  const b = e.target.closest("button[data-book]"); if (!b) return;
  const link = easyGet("bookLink");
  if (!link) { toast("Add your booking link first: More › Settings › Booking link.", 5000); return; }
  const name = b.dataset.book, cs = (window.contactsFor ? contactsFor(name) : []).filter(c => c.whatsapp || c.phone);
  const numb = cs.length === 1 ? (cs[0].whatsapp || toWa(cs[0].phone)) : "";
  location.href = `https://wa.me/${numb}?text=` + encodeURIComponent(`Hi ${firstName(name)}, please pick a time that suits you here: ${link}\nThanks, ${me || ""}`.trim());
});
window.bookingSettingsHtml = () => `<div class="card setc"><div class="lbl" style="margin-top:0">Booking link</div>
  <div class="quiet">Your own booking page (a free Google Calendar booking page or Calendly). "Send booking link" on People sends it on WhatsApp. Kept on this phone only.</div>
  <label class="fld"><span>Your booking page link</span><input id="bookLink" type="url" inputmode="url" value="${esc(easyGet("bookLink"))}" placeholder="https://calendar.app.google/…" autocomplete="off"></label>
  <button class="wide" data-booksave="1">${ic("check")}Save link</button></div>`;
document.addEventListener("click", e => {
  if (!e.target.closest("button[data-booksave]")) return;
  const v = ($("bookLink") || {}).value || "";
  if (v && !/^https:\/\/\S+$/.test(v.trim())) { toast("That doesn't look like a web link (it should start with https://)."); return; }
  easySet("bookLink", v.trim()); toast(v ? "Booking link saved." : "Booking link removed.");
});

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
// a JPEG (data URL) for makePdf: the bytes as a binary string and the size read from the JPEG's own header
function jpegFrom(url) {
  const m = String(url || "").match(/^data:image\/jpe?g;base64,(.+)$/); if (!m) return null;
  const b = atob(m[1]); let i = 2;
  while (i < b.length) {
    if (b.charCodeAt(i) !== 0xFF) return null;
    const mk = b.charCodeAt(i + 1), len = b.charCodeAt(i + 2) * 256 + b.charCodeAt(i + 3);
    if (mk >= 0xC0 && mk <= 0xC3) return { bin: b, h: b.charCodeAt(i + 5) * 256 + b.charCodeAt(i + 6), w: b.charCodeAt(i + 7) * 256 + b.charCodeAt(i + 8) };
    i += 2 + len;
  }
  return null;
}
function makePdf(draw) {
  const pages = [], imgs = [];
  let ops = [], y = 800;
  const P = {
    get y() { return y; }, set y(v) { y = v; },
    text(x, yy, s, size, bold, grey) { ops.push(`BT ${grey ? "0.38 0.40 0.44" : "0.11 0.12 0.14"} rg /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td (${pdfEnc(s)}) Tj ET`); },
    right(xr, yy, s, size, bold, grey) { P.text(xr - pdfWidth(s, size), yy, s, size, bold, grey); },
    line(x1, y1, x2, y2) { ops.push(`0.80 0.82 0.85 RG 0.6 w ${x1} ${y1.toFixed(1)} m ${x2} ${y2.toFixed(1)} l S`); },
    box(x, yy, w, h) { ops.push(`0.94 0.95 0.96 rg ${x} ${yy.toFixed(1)} ${w} ${h.toFixed(1)} re f`); },
    need(h) { if (y - h < 40) { pages.push(ops.join("\n")); ops = []; y = 800; } },
    // 28 Sep 2026: a signature (JPEG) placed at x, y (bottom left), w × h points
    image(x, yy, w, h, url) { const j = jpegFrom(url); if (!j) return false; imgs.push(j); ops.push(`q ${w.toFixed(1)} 0 0 ${h.toFixed(1)} ${x.toFixed(1)} ${yy.toFixed(1)} cm /Im${imgs.length} Do Q`); return true; },
  };
  draw(P);
  pages.push(ops.join("\n"));
  const objs = [], add = s => { objs.push(s); return objs.length; };
  const cat = add(""), pagesId = add(""), f1 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"), f2 = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
  const kids = [], imIds = imgs.map(j => add(`<< /Type /XObject /Subtype /Image /Width ${j.w} /Height ${j.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${j.bin.length} >>\nstream\n${j.bin}\nendstream`));
  const xo = imIds.length ? ` /XObject << ${imIds.map((id, i) => `/Im${i + 1} ${id} 0 R`).join(" ")} >>` : "";
  for (const c of pages) {
    const cs = add(`<< /Length ${c.length} >>\nstream\n${c}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${xo} >> /Contents ${cs} 0 R >>`));
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
// our signature on a document (28 Sep 2026): the drawn signature over a line, the name and title under it, and the date
function sigBlock(P, L, sig) {
  P.need(84); P.y -= 4;
  const base = P.y - 46;
  P.image(L, base + 1, 138, 46, sig.png);
  P.line(L, base, L + 176, base); P.text(L, base - 12, [sig.full_name || sig.person, sig.title].filter(Boolean).join(", "), 9.5);
  P.text(L + 196, base + 3, longDay(saDayPlus(0)), 10); P.line(L + 192, base, L + 320, base); P.text(L + 196, base - 12, "Date", 8.5, false, true);
  P.y = base - 30;
}
window.sigBlock = sigBlock;
// one layout for both documents: title and our name, number and dates on the right, "To", a table, notes, a footer
function docPdf(d) {
  return makePdf(P => {
    const L = 56, R = 539;
    if (coOn()) { letterhead(P, L, R); d = Object.assign({}, d, { from: "" }); }
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
    if (d.sig) { P.y -= 10; P.need(100); P.text(L, P.y, "Signed", 10, true); P.y -= 6; sigBlock(P, L, d.sig); }
    P.y -= 18; P.need(20); P.text(L, P.y, d.footer || "", 9, false, true);
  });
}
// Our letterhead (27 Sep 2026): registered name, trading name, registration and VAT numbers, address and contacts – from
// Settings › Company details. The Companies Act asks for the full name and registration number on a company's documents.
function coOn() { const c = window._company; return !!(c && c.legal_name && c.show_on_docs !== false); }
function letterhead(P, L, R) {
  const c = window._company || {};
  P.text(L, P.y, c.legal_name, 16, true);
  let y2 = P.y - 15;
  if (c.trading_as) { P.text(L, y2, "trading as " + c.trading_as, 10, false, true); y2 -= 13; }
  const ids = [c.reg_no ? "Reg. no. " + c.reg_no : "", c.vat_no ? "VAT no. " + c.vat_no : ""].filter(Boolean).join("   ·   ");
  if (ids) { P.text(L, y2, ids, 9.5, false, true); y2 -= 13; }
  let ry = P.y;
  for (const l of [...pdfWrap(c.address || "", 9.5, 200), c.phone, c.email, c.website].filter(Boolean)) { P.right(R, ry, l, 9.5, false, true); ry -= 13; }
  P.y = Math.min(y2, ry) - 6; P.line(L - 6, P.y, R + 6, P.y); P.y -= 22;
}
// the transport quotation, laid out the way South African hauliers quote: who and when, the job, the price with VAT shown,
// what is included and excluded, the terms, and a place for the client to accept
function quotePdf(d) {
  return makePdf(P => {
    const L = 56, R = 539, W = R - L;
    if (coOn()) letterhead(P, L, R);
    P.text(L, P.y, "Transport quotation", 20, true); P.right(R, P.y, d.number, 11, false, true); P.y -= 18;
    let ry = P.y; for (const [k, v] of d.meta) { P.right(R, ry, `${k}: ${v}`, 10, false, true); ry -= 14; }
    if (!coOn() && d.from) P.text(L, P.y, d.from, 12, false);
    P.y = Math.min(P.y - 6, ry) - 8;
    P.text(L, P.y, "Quote to", 10, false, true); P.y -= 15;
    for (const l of pdfWrap(d.to || "–", 13, 300)) { P.text(L, P.y, l, 13, true); P.y -= 16; }
    if (d.attn) { P.text(L, P.y, "Attention: " + d.attn, 10.5, false); P.y -= 14; }
    P.y -= 10;
    const section = t => { P.need(40); P.box(L - 6, P.y - 5, W + 12, 19); P.text(L, P.y, t, 10.5, true); P.y -= 21; };
    const kv = (k, v) => { if (!v) return; const lines = pdfWrap(v, 10.5, W - 170); P.need(lines.length * 13 + 3); P.text(L, P.y, k, 10.5, false, true); lines.forEach((l, i) => P.text(L + 170, P.y - i * 13, l, 10.5)); P.y -= lines.length * 13 + 3; };
    section("The job");
    for (const [k, v] of d.job) kv(k, v);
    P.y -= 4; section("Price (South African rand)");
    for (const [k, v, big] of d.rows) {
      const lines = pdfWrap(k, 10.5, 330); P.need(lines.length * 14 + 12);
      lines.forEach((l, i) => P.text(L, P.y - i * 14, l, 10.5, !!big)); P.right(R, P.y, v, big ? 12 : 10.5, !!big);
      P.y -= lines.length * 14 + 1; P.line(L - 6, P.y, R + 6, P.y); P.y -= 12;
    }
    const list = (t, arr) => { if (!arr.length) return; P.y -= 4; section(t); for (const a of arr) { const lines = pdfWrap(a, 9.5, W - 14); P.need(lines.length * 12 + 2); P.text(L, P.y, "•", 9.5); lines.forEach((l, i) => P.text(L + 12, P.y - i * 12, l, 9.5)); P.y -= lines.length * 12 + 2; } };
    list("Included", d.incl); list("Not included (charged separately if they apply)", d.excl); list("Terms", d.terms);
    if (d.notes) { P.y -= 6; section("Notes"); for (const l of pdfWrap(d.notes, 10, W)) { P.need(14); P.text(L, P.y, l, 10); P.y -= 13; } }
    if (d.sig) { P.y -= 6; P.need(110); section("For " + ((window._company && coOn() && window._company.legal_name) || d.from || "us")); sigBlock(P, L, d.sig); }
    P.y -= 6; P.need(76); section("Acceptance – we accept this quotation and its terms");
    P.y -= 18;
    const ln = (x, w, lab) => { P.line(x, P.y, x + w, P.y); P.text(x, P.y - 11, lab, 8.5, false, true); };
    ln(L, 110, "Name"); ln(L + 122, 120, "Signature"); ln(L + 254, 90, "Date"); ln(L + 356, 127, "Order number (if any)"); P.y -= 28;
    P.need(24); P.text(L, P.y, d.footer || "", 8.5, false, true);
  });
}
window.quotePdf = quotePdf;
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
const fmtT = t => (Math.round(t * 100) / 100).toLocaleString("en-ZA").replace(/[  ,]/g, " ");
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
    // 27 Sep 2026: transport from South Africa to another country is zero-rated (VAT Act s11(2)(a)) – "0% VAT (cross-border)".
    // Industry layout: rate excl. VAT, the VAT, the rate incl. VAT, then per load and the month's estimate.
    const zero = f.vat === QUOTE_ZERO, incl = f.vat === QUOTE_IN;
    const rate = n("rate"), ex = incl ? rate / 1.15 : rate, vat = zero ? 0 : ex * 0.15, tpl = n("tpl") || 34, rows = [], b = quoteBasis(f);
    const vatRow = [zero ? "VAT at 0% (zero-rated – transport to another country)" : "VAT at 15%", randR2(vat)];
    if (b === "job") {   // 28 Sep 2026: one flat amount for the whole job
      rows.push(["Price for the whole job, excluding VAT", randR2(ex)], vatRow, ["Price for the whole job" + (zero ? "" : ", including VAT"), randR2(ex + vat), 1]);
    } else if (b === "load") {   // a flat rate per load, whatever the tons
      rows.push(["Flat rate per load, excluding VAT", randR2(ex)], vatRow, ["Flat rate per load" + (zero ? "" : ", including VAT"), randR2(ex + vat), 1]);
      if (n("loads")) rows.push([`Estimate for ${n("loads")} loads${zero ? "" : ", including VAT"}`, randR((ex + vat) * n("loads"))]);
    } else {
      rows.push(["Rate per ton, excluding VAT", randR2(ex)], vatRow, ["Rate per ton" + (zero ? "" : ", including VAT"), randR2(ex + vat), 1]);
      rows.push([`Per load of ${fmtT(tpl)} tons, excluding VAT`, randR(ex * tpl)]);
      if (!zero) rows.push([`Per load of ${fmtT(tpl)} tons, including VAT`, randR((ex + vat) * tpl)]);
      if (n("loads")) rows.push([`Estimate for ${n("loads")} loads (${fmtT(tpl * n("loads"))} tons)${zero ? "" : ", including VAT"}`, randR((ex + vat) * tpl * n("loads"))]);
    }
    return { rows, ok: rate > 0, ex };
  }
  if (DOC.kind === "inv") {
    // 28 Sep 2026 night: proforma invoice (before loading) and final invoice (after the test) from the deal's own numbers
    const fin = f.stage === "Final", unit = f.unit || "per t", dmtBasis = /DMT/i.test(unit);
    const wmt = n("qty"), moist = n("moist"), dmt = moist ? wmt * (1 - moist / 100) : wmt, qty = fin && dmtBasis ? dmt : wmt;
    const price = n("price"), line = qty * price, adj = fin ? n("adj") * qty : 0, paid = fin ? n("paid") : 0;
    const sub = line + adj, zero = /zero/i.test(f.vat || ""), vat = /15%/.test(f.vat || "") ? sub * 0.15 : 0, rows = [];
    const qtyTxt = `${qty.toLocaleString("en-ZA", { maximumFractionDigits: 3 }).replace(/[  ,]/g, " ")} ${fin && dmtBasis ? "DMT" : "t"}`;
    rows.push([`${[f.product, f.grade].filter(Boolean).join(", ") || "Material"}${f.basis ? " – " + f.basis : ""}: ${qtyTxt} at ${randR2(price)} ${unit.replace(/^per /, "per ")}`, randR2(line)]);
    if (fin && moist) rows.push([`Weighed ${wmt.toLocaleString("en-ZA", { maximumFractionDigits: 3 }).replace(/[  ,]/g, " ")} WMT, moisture ${moist}% → ${dmt.toLocaleString("en-ZA", { maximumFractionDigits: 3 }).replace(/[  ,]/g, " ")} DMT${f.tested ? ", tested grade " + f.tested : ""}`, ""]);
    else if (fin && f.tested) rows.push([`Tested grade ${f.tested}`, ""]);
    const sR = v => (v < 0 ? "−" : "") + randR2(Math.abs(v));
    if (adj) rows.push([`Grade/price adjustment (${sR(n("adj"))} per ${fin && dmtBasis ? "DMT" : "t"})`, sR(adj)]);
    rows.push([zero ? "VAT at 0% (zero-rated export)" : vat ? "VAT at 15%" : "VAT", randR2(vat)]);
    rows.push([fin ? "Invoice total" : "Proforma total", randR2(sub + vat), paid ? 0 : 1]);
    if (paid) { rows.push(["Less paid against the proforma", "−" + randR2(paid)]); rows.push(["Balance due", randR2(sub + vat - paid), 1]); }
    return { rows, ok: qty > 0 && price > 0 };
  }
  const q = n("qty"), rate = n("rate"), sub = q * rate, vat = f.vat === "Add 15% VAT" ? sub * 0.15 : 0;
  const rows = [[`Commission${f.deal ? " – " + f.deal : ""}: ${q.toLocaleString("en-ZA", { maximumFractionDigits: 2 }).replace(/[  ,]/g, " ")} DMT at ${randR2(rate)} per DMT`, randR2(sub)]];
  if (vat) rows.push(["VAT 15%", randR2(vat)]);
  rows.push(["Total due", randR2(sub + vat), 1]);
  return { rows, ok: q > 0 && rate > 0 };
}
const quoteBasis = f => /whole/i.test(f.basis || "") ? "job" : /load/i.test(f.basis || "") ? "load" : "ton";
function invSheetHtml() {
  const fin = DOC.f.stage === "Final";
  return `<div class="coline">${ic(coOn() ? "file" : "info")}<span>${coOn() ? "On our letterhead: " + esc(window._company.legal_name) + (window._company.vat_no ? " · VAT " + esc(window._company.vat_no) : " – no VAT number: it prints as an Invoice, not a Tax invoice") : "No company details yet – Settings › Company details"}</span></div>` +
    docField("stage", "Which invoice", "", ["Proforma", "Final"]) +
    docField("to", "Invoice to (buyer company)", "Company") + docField("tovat", "Buyer's VAT number", "needed on a tax invoice above R5,000") +
    `<div class="calc">${docField("product", "Product", "e.g. Chrome concentrate")}${docField("grade", fin ? "Contract grade" : "Grade", "e.g. 40–42% Cr2O3")}</div>` +
    docField("basis", "Delivery basis and place", "e.g. FOT Mooinooi plant") +
    `<div class="calc">${docField("qty", fin ? "Weighed tons (WMT)" : "Tons", "e.g. 1000", "num")}${docField("price", "Price (R)", "e.g. 2250", "num")}</div>` +
    docField("unit", "Price is", "", ["per t", "per DMT", "per WMT"]) +
    (fin ? `<div class="calc">${docField("moist", "Moisture %", "from the test", "num")}${docField("tested", "Tested grade", "e.g. 41.2% Cr2O3")}</div>` +
      `<div class="calc">${docField("adj", "Adjustment per t (R, − for a penalty)", "0", "num")}${docField("paid", "Paid against the proforma (R)", "0", "num")}</div>` : "") +
    docField("vat", "VAT", "", ["Add 15% VAT", "Zero-rated export", "No VAT"]) +
    `<div class="calc">${docField("due", "Payment due", "", "date")}${docField("ref", "Order / PO number", "optional")}</div>` +
    docField("notes", "Payment details and notes", "e.g. Pay by EFT; bank details as on our letter", "area");
}
function docSheetHtml() {
  const q = DOC.kind === "quote", r = docRows();
  return (q
    ? (coOn() ? `<div class="coline">${ic("file")}<span>On our letterhead: ${esc(window._company.legal_name)}${window._company.reg_no ? "" : " – registration number missing (Settings › Company details)"}</span></div>` : `<div class="coline">${ic("info")}<span>No company details yet – add them in Settings › Company details so the quote carries our registration and VAT numbers.</span></div>` + docField("from", "From (your name – remembered)", "e.g. your trading name")) +
      docField("to", "Quote to (client company)", "Company") + docField("attn", "Attention", "optional – the person") +
      `<div class="calc">${docField("fromPlace", "Collection point", "e.g. Mooinooi plant")}${docField("toPlace", "Delivery point", "e.g. Richards Bay")}</div>` +
      `<div class="calc">${docField("cargo", "Cargo", "e.g. chrome ore, ROM")}${docField("km", "Km one way", "optional", "num")}</div>` +
      `<div class="calc">${docField("vehicle", "Vehicle", "34 t side tipper")}${docField("tpl", "Tons per load", "34", "num")}</div>` +
      `<div class="calc">${docField("loads", "Loads", "optional", "num")}${docField("start", "First loading", "", "date")}</div>` +
      docField("basis", "Rate type", "", ["Per ton", "Flat per load", "Flat – whole job"]) +
      `<div class="calc">${docField("rate", ({ ton: "Rate per ton (R)", load: "Rate per load (R)", job: "Price for the job (R)" })[quoteBasis(DOC.f)], ({ ton: "e.g. 420", load: "e.g. 12000", job: "e.g. 150000" })[quoteBasis(DOC.f)], "num")}${docField("valid", "Valid (days)", "7", "num")}</div>` +
      docField("vat", "The rate is", "", [QUOTE_EX, QUOTE_IN, QUOTE_ZERO]) +
      (DOC.f.vat === QUOTE_ZERO ? `<div class="quiet">0% VAT is for transport from South Africa to another country (zero-rated, VAT Act section 11(2)(a)). Keep the delivery note, transport papers and proof of payment.</div>` : "") +
      `<div class="fld"><span>Included in the rate</span></div><div class="chips docinc">${QUOTE_INC.map(([k, t]) => `<button type="button" data-docinc="${k}" class="${DOC.f["inc_" + k] ? "on" : ""}" aria-pressed="${!!DOC.f["inc_" + k]}">${t}</button>`).join("")}</div>` +
      docField("diesel", "Rate based on diesel at (R a litre)", "e.g. 22.50 – the fuel clause uses it", "num") +
      docField("pay", "Payment terms", "e.g. 30 days from statement") + docField("standing", "Standing time", "e.g. 4 hours free, then R650 an hour") +
      docField("notes", "Anything else for the client", "optional", "area")
    : DOC.kind === "inv" ? invSheetHtml()
    : docField("to", "Statement to (who pays the commission)", "Company") + docField("from", "From (your name – remembered)", "e.g. your trading name") +
      docField("deal", "Deal or reference", "e.g. Chrome lumpy – August") +
      `<div class="calc">${docField("qty", "Dry tons (DMT)", "e.g. 940", "num")}${docField("rate", "Rate per DMT (R)", "e.g. 40", "num")}</div>` +
      docField("vat", "VAT", "", ["No VAT", "Add 15% VAT"]) + docField("due", "Payment due", "", "date") +
      docField("notes", "Payment details and notes", "e.g. Pay by EFT, reference as above. Bank details as on our invoice.", "area"))
    + `<div class="lbl">On the document</div><div class="cres">${r.rows.filter(x => x[1]).map(([k, v, b]) => `<div class="kv${b ? " big" : ""}"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("")}</div>`
    + `<div class="quiet">${q ? "Only the client's price goes on the quote – never our costs, the transporter's rate or our margin." : "Check the tons and rate against the weighbridge and the signed commission agreement."}</div>`
    + `<div class="acts0 trclr"><button type="button" data-docclear="1">${ic("undo")}Clear the form</button></div>`
    + (window.sigToggleHtml ? sigToggleHtml("doc") : "")
    + `<button class="primary wide" data-docmake="1"${r.ok ? "" : " disabled"}>${ic("file")}Make the PDF and share it</button>`;
}
const QUOTE_INC = [["diesel", "Diesel"], ["tolls", "Tolls"], ["driver", "Driver"], ["tracking", "Tracking"], ["git", "Goods-in-transit cover"]];
function openDocSheet(kind, f) {
  const co = window._company || {};
  DOC = { kind, f: Object.assign({ basis: "Per ton", from: easyGet("docFrom"), valid: "7", tpl: "34", vehicle: "34 t side tipper", pay: co.payment_terms || "", standing: co.standing_rate || "", inc_diesel: true, inc_tolls: true, inc_driver: true, inc_tracking: true, inc_git: false,
    diesel: (() => { const t = window._trip || {}, fu = (window._fuel || [])[0]; return t.diesel ? String(t.diesel) : fu && (fu.inland || fu.coastal) ? String(fu.inland || fu.coastal) : ""; })(), vat: kind === "quote" ? (CROSS_BORDER.test((f && f.toPlace) || "") ? QUOTE_ZERO : QUOTE_EX) : "No VAT" }, f) };
  $("docTitle").textContent = kind === "quote" ? "Quote PDF" : kind === "inv" ? (DOC.f.stage === "Final" ? "Final invoice" : "Proforma invoice") : "Commission statement PDF";
  $("docBody").innerHTML = docSheetHtml(); $("docSheet").classList.remove("hidden");
}
window.openDocSheet = openDocSheet;
function docRefresh() { if (DOC && DOC.kind === "inv") $("docTitle").textContent = DOC.f.stage === "Final" ? "Final invoice" : "Proforma invoice"; const b = $("docBody"); const a = document.activeElement, k = a && a.dataset && a.dataset.docf, pos = a && a.selectionStart; b.innerHTML = docSheetHtml(); if (k) { const el = b.querySelector(`[data-docf="${k}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} } } }
async function docMake() {
  const f = DOC.f, q = DOC.kind === "quote", r = docRows(); if (!r.ok) return;
  if (f.from) easySet("docFrom", f.from);
  const number = docNo(q ? "Q" : DOC.kind === "inv" ? (f.stage === "Final" ? "INV" : "PF") : "CS"), today = saDayPlus(0);
  const meta = [["Date", longDay(today)]];
  if (q) meta.push(["Valid until", longDay(saDayKey(Date.now() + (num(f.valid) || 7) * 864e5))]); else if (/^\d{4}-\d{2}-\d{2}$/.test(f.due || "")) meta.push(["Payment due", longDay(f.due)]);
  let blob;
  if (q) {
    const cross = f.vat === QUOTE_ZERO || CROSS_BORDER.test(f.toPlace || ""), inc = QUOTE_INC.filter(([k]) => f["inc_" + k]).map(([, t]) => t), out = QUOTE_INC.filter(([k]) => !f["inc_" + k]).map(([, t]) => t);
    const job = [["Collection", f.fromPlace], ["Delivery", f.toPlace], ["Distance", num(f.km) ? `about ${Math.round(num(f.km))} km one way` : ""], ["Cargo", f.cargo], ["Vehicle", f.vehicle],
      ["Tons per load", fmtT(num(f.tpl) || 34) + " t (payload)"], ["Loads", num(f.loads) ? String(num(f.loads)) : ""], ["First loading", /^\d{4}-\d{2}-\d{2}$/.test(f.start || "") ? longDay(f.start) : ""]];
    const qb = quoteBasis(f), incl = inc.length ? [inc.join(", ") + (qb === "ton" ? " – included in the rate per ton." : qb === "load" ? " – included in the rate per load." : " – included in the price.")] : [];
    const excl = [...(out.length ? [out.join(", ") + "."] : []), f.standing ? `Standing time: ${f.standing}.` : "Standing time beyond 4 hours at loading or offloading, at our standing rate.",
      "Loading and offloading equipment, and any site or gate fees.", ...(cross ? ["Border, clearing and agent fees, import duties and permits.", "Delays at the border beyond 24 hours."] : [])];
    const terms = [
      qb === "load" ? "The rate is a flat rate per load, whatever the tons, within the vehicle's legal payload." : qb === "job" ? "The price is a fixed amount for the whole job described above; extra loads or changes are quoted separately." : "Rates are per ton on the loading weighbridge ticket, unless agreed otherwise in writing.",
      f.diesel ? `Fuel: the rate is based on diesel at R${num(f.diesel).toFixed(2)} a litre (inland wholesale price). If the official price moves by more than 5%, the rate is adjusted in proportion to the diesel part of the cost.` : "Fuel: the rate may be adjusted if the official diesel price moves by more than 5% before loading.",
      `Payment: ${f.pay || "as agreed in writing before the first load"}. Banking details are on our tax invoice.`,
      "Subject to truck availability on the day of loading, and to safe, legal loading within the vehicle's permitted mass.",
      "Claims for loss or damage must reach us in writing within 7 days of delivery, noted on the delivery note.",
      `This quote is valid for ${num(f.valid) || 7} days. Prices are in South African rand.`];
    blob = quotePdf({ sig: window.sigToUse ? sigToUse("doc") : null, number, from: f.from || me || "", to: f.to || "", attn: f.attn || "", meta, job, rows: r.rows, incl, excl, terms, notes: f.notes || "",
      footer: coOn() ? [window._company.legal_name, window._company.reg_no && "Reg. no. " + window._company.reg_no, window._company.vat_no && "VAT no. " + window._company.vat_no].filter(Boolean).join("  ·  ") : "Prices in South African rand." });
  } else if (DOC.kind === "inv") {
    const fin = f.stage === "Final", co = window._company || {};
    const title = fin ? (co.vat_no && /15%/.test(f.vat || "") ? "Tax invoice" : "Invoice") : "Proforma invoice";
    const m2 = [...meta]; if (f.ref) m2.push(["Order", f.ref]); if (f.deal_ref) m2.push(["Deal", f.deal_ref]);
    blob = docPdf({ sig: window.sigToUse ? sigToUse("doc") : null, title, number, from: f.from || me || "", to: [f.to || "", f.tovat ? "VAT no. " + f.tovat : ""].filter(Boolean).join("\n"), meta: m2, rows: r.rows, notes: f.notes || "",
      footer: fin ? "Amounts on the tested grade and the weighed tons. Banking details as on our letterhead or bank letter." : "Proforma only – not a tax invoice. The final invoice follows the test and the weighbridge." });
  } else blob = docPdf({ sig: window.sigToUse ? sigToUse("doc") : null, title: "Commission statement", number, from: f.from || me || "", to: f.to || "", meta, rows: r.rows, notes: f.notes || "",
    footer: "This statement is for the commission agreed in writing for the deal above. Banking details are on our tax invoice." });
  const name = (q ? "Quote " : DOC.kind === "inv" ? (f.stage === "Final" ? "Invoice " : "Proforma invoice ") : "Commission statement ") + (f.to || "").replace(/[^\w\- ]+/g, "").trim().slice(0, 40) + " " + number + ".pdf";
  // an invoice made from a deal is saved to that deal's Documents (Proforma invoice / Final invoice)
  if (DOC.kind === "inv" && f.deal_id && window.saveDocRow) {
    const d = dealById(f.deal_id), key = f.stage === "Final" ? "invoice" : "proforma", fname = name.replace(/\s+/g, " ");
    try {
      let att;
      if (DEMO) { att = { id: "a" + Date.now(), target_type: "deal", target_id: String(d.id), path: "demo", name: fname, size: blob.size, uploaded_by: me, created_at: new Date().toISOString() }; (window._atts ||= []).unshift(att); }
      else {
        const path = `deal/${d.id}/${Date.now()}-${fname.replace(/[^\w.\-]+/g, "_")}`;
        const up = await sb.storage.from("files").upload(path, blob, { contentType: "application/pdf", upsert: false }); if (up.error) throw up.error;
        const r2 = await sb.from("attachments").insert({ target_type: "deal", target_id: String(d.id), path, name: fname, size: blob.size, mime: "application/pdf" }).select("*").single(); if (r2.error) throw r2.error;
        att = r2.data; (window._atts ||= []).unshift(att);
      }
      const cur = window.docRow && docRow(d.id, key); await saveDocRow(d, key, cur && cur.status !== "draft" ? cur.status : "draft", { att: att.id });
    } catch (e) { toast("The PDF is made but could not be saved to the deal: " + (e.message || e), 6000); }
  }
  const how = await shareFile(blob, name.replace(/\s+/g, " "), q ? "Transport quote" : DOC.kind === "inv" ? "Invoice" : "Commission statement");
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
  const di = e.target.closest("button[data-docinc]"); if (di && DOC) { const k = "inc_" + di.dataset.docinc; DOC.f[k] = !DOC.f[k]; docRefresh(); return; }
  // from a transport deal's Numbers tab (a deal reloaded from WhatsApp carries its terms)
  const dq = e.target.closest("button[data-dquote]");
  if (dq) {
    const d = dealById(dq.dataset.dquote), p = (d && d.params) || {}, rt = String(p.route || "").split(/\s*(?:→|->|–| to )\s*/);
    openDocSheet("quote", { to: p.client || p.buyer || "", basis: window.basisWord ? basisWord(rateBasis(p)) : "Per ton", rate: String(numIn(p.client_rate) || ""), cargo: p.cargo || "", km: String(numIn(p.distance) || ""), fromPlace: rt[0] || "", toPlace: rt[1] || "", loads: String(numIn(p.loads) || ""), vat: /incl/i.test(p.vat || "") ? QUOTE_IN : undefined });
    if (!DOC.f.vat) DOC.f.vat = CROSS_BORDER.test(DOC.f.toPlace || "") ? QUOTE_ZERO : QUOTE_EX;
    docRefresh(); return;
  }
  if (e.target.closest("button[data-docmake]")) { docMake(); return; }
  const iv = e.target.closest("button[data-dinv]");
  if (iv) {
    const [id, stage] = iv.dataset.dinv.split(":"), d = dealById(id), p = (window.leanP ? leanP(d) : d.params) || {};
    const clean = v => v && !/^(not agreed|to discuss|to be agreed)$/i.test(v) ? String(v) : "";
    openDocSheet("inv", { deal_id: id, deal_ref: window.dealRef ? dealRef(d) : "", stage, to: clean(p.buyer).split(/[(,;]/)[0].trim(), product: [clean(p.commodity), clean(p.form)].filter(Boolean).join(" "), grade: clean(p.grade), basis: [clean(p.basis), clean(p.port)].filter(Boolean).join(" "),
      qty: String(numIn(p.volume) || ""), price: String(numIn(p.price || p.asking_price) || ""), unit: /dmt/i.test(p.unit || "") ? "per DMT" : /wmt/i.test(p.unit || "") ? "per WMT" : "per t",
      vat: /zero/i.test(p.vat || "") ? "Zero-rated export" : /excl|incl/i.test(p.vat || "") ? "Add 15% VAT" : "Add 15% VAT", due: workDayPlus(stage === "Final" ? 7 : 3), moist: "", tested: "", adj: "", paid: "" });
    return;
  }
  if (e.target.closest("button[data-docclear]") && DOC) { const k = DOC.kind; openDocSheet(k, { deal_id: DOC.f.deal_id, deal_ref: DOC.f.deal_ref, stage: DOC.f.stage }); Object.keys(DOC.f).forEach(x => { if (!/^(from|valid|tpl|vehicle|pay|standing|vat|basis|inc_\w+|diesel|deal_id|deal_ref|stage|unit)$/.test(x)) DOC.f[x] = ""; }); docRefresh(); toast("Form cleared."); return; }
  // from the Transport calculator
  if (e.target.closest("button[data-trquote]")) {
    const TRp = window._trip || {}, d = TRp.deal && dealById(TRp.deal);
    openDocSheet("quote", { to: d ? (d.params && (d.params.client || d.params.buyer)) || "" : "", rate: TRp.client || "", tpl: String(TRp.tpl || 34), loads: TRp.loads || "", km: TRp.km || "", fromPlace: TRp.from || "", toPlace: TRp.to || "", cargo: d && d.params ? d.params.cargo || "" : "" });
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

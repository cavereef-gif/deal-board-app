// Deal Board v17 prototype – step 1 extras: easy-to-read guides, "+ New deal" in every deal list,
// three calculators (Transport with route costing, Chrome and ore, Everyday), speaking into text boxes,
// the voice-note sheet, and company / sanctions check links. Everything here is free (no new supplier).

// ---------- Easy-to-read text: long paragraphs become short points ----------
// One idea per line: "Head: a, b; c. D." becomes a heading with short points under it.
function ezPoints(s) {
  let parts = splitSentences(s).flatMap(p => p.split(/;\s+/)).map(x => x.trim()).filter(Boolean);
  // split a long point on commas only when every piece still makes sense on its own (3+ words each)
  parts = parts.flatMap(p => {
    if (p.length <= 90 || !/,\s/.test(p) || /\[|:|'[^']*,[^']*'|"[^"]*,[^"]*"/.test(p)) return [p];
    const bits = p.split(/,\s+(?![^()]*\))/);
    return bits.length >= 3 && bits.every(b => b.trim().split(/\s+/).length >= 3) ? bits : [p];
  });
  return parts.map(p => p.replace(/[;,]\s*$/, "").replace(/\.\s*$/, "").trim()).filter(Boolean).map(p => ezCap(p));
}
function ezHead(text) {
  const ci = text.indexOf(":"); if (ci <= 0 || ci > 60) return null;
  const before = text.slice(0, ci), after = text.slice(ci + 1);
  if (/https?$/i.test(before) || (/\d$/.test(before) && /^\d/.test(after))) return null;   // a link or a time, not a heading
  let head = before.trim(), when = "";
  const tm = head.match(/^(.*?)\s*\(([^)]*\d[^)]*)\)\s*$/); if (tm && tm[1]) { head = tm[1]; when = tm[2]; }
  return { head, when, tail: after.trim() };
}
const ezCap = p => /^[a-z]/.test(p) && !/^(e\.g|i\.e)/.test(p) ? p[0].toUpperCase() + p.slice(1) : p;
const ezUl = arr => arr.length ? `<ul class="ez-ul">${arr.map(b => `<li>${esc(b)}</li>`).join("")}</ul>` : "";
function ezBlock(text, n) {
  const h = ezHead(text);
  if (!h && !n) return text.length > 140 ? ezUl(ezPoints(text)) : `<p class="ez-p">${esc(text)}</p>`;
  const head = h ? h.head : text, tail = h ? h.tail : "";
  return `<div class="ez-step${n ? " n" : ""}"><div class="ez-t">${n ? `<span class="ez-n">${esc(n)}</span>` : ""}<span>${esc(head)}</span></div>${h && h.when ? `<div class="ez-m">${esc(h.when)}</div>` : ""}${tail ? (tail.length <= 90 && !/[.;]\s+\S/.test(tail) ? `<p class="ez-p">${esc(ezCap(tail))}</p>` : ezUl(ezPoints(tail))) : ""}</div>`;
}
function easyText(body) {
  const txt = String(body || "").replace(/\r/g, "").trim(); if (!txt) return "";
  const out = [];
  for (const para of txt.split(/\n\s*\n/)) {
    const lines = para.split(/\n/).map(l => l.trim()).filter(Boolean);
    let list = [];
    const flush = () => { if (list.length) { out.push(ezUl(list)); list = []; } };
    for (const line of lines) {
      const num = line.match(/^(\d{1,2})[.)]\s+(.+)$/);
      const bul = line.match(/^[-•·*]\s+(.+)$/);
      if (num) { flush(); out.push(ezBlock(num[2], num[1])); }
      else if (bul && bul[1].length <= 140) list.push(bul[1]);
      else if (bul) { flush(); out.push(ezBlock(bul[1])); }
      else if (line.length <= 60 && !/[.!?]$/.test(line)) { flush(); out.push(`<div class="ez-h">${esc(line.replace(/:$/, ""))}</div>`); }
      else { flush(); out.push(ezBlock(line)); }
    }
    flush();
  }
  return `<div class="easy">${out.join("")}</div>`;
}
// Split into sentences without look-behind (iPhone 8 / Safari 16 has no RegExp look-behind)
function splitSentences(s) {
  const res = []; let cur = "";
  for (let i = 0; i < s.length; i++) {
    cur += s[i];
    if (/[.!?]/.test(s[i]) && s[i + 1] === " " && /[A-Z0-9“"(]/.test(s[i + 2] || "") && !/\b(e\.g|i\.e|no|vs|approx|min|max|incl|excl|mr|mrs|dr|st|pty|ltd|co)\.$/i.test(cur)) { res.push(cur.trim()); cur = ""; i++; }
  }
  if (cur.trim()) res.push(cur.trim());
  return res;
}
window.easyText = easyText;

// ---------- "+ New deal" in every deal list ----------
// Picking "+ New deal…" opens a small sheet on top; the form you were in stays open and gets the new deal.
const NEW_DEAL = "__newdeal";
function addNewDealOption(sel) {
  if (!sel || sel.querySelector(`option[value="${NEW_DEAL}"]`)) return;
  const o = document.createElement("option"); o.value = NEW_DEAL; o.textContent = "+ New deal…"; sel.appendChild(o);
}
function sweepDealSelects(root) {
  (root || document).querySelectorAll("#tsDeal, #cDeal, #calcDealSel, select[data-dealsel], select[data-dleaddeal]").forEach(addNewDealOption);
}
(window._after ||= []).push(() => sweepDealSelects());
let ndFrom = null;
document.addEventListener("focusin", e => { const s = e.target; if (s && s.tagName === "SELECT") s.dataset.prev = s.value === NEW_DEAL ? (s.dataset.prev || "") : s.value; }, true);
document.addEventListener("change", e => {
  const s = e.target; if (!s || s.tagName !== "SELECT" || s.value !== NEW_DEAL) return;
  e.stopImmediatePropagation();   // the list's own handler must not see "+ New deal" as a deal
  const def = [...s.options].find(o => o.defaultSelected && o.value !== NEW_DEAL);
  s.value = s.dataset.prev != null ? s.dataset.prev : def ? def.value : "";
  ndFrom = { id: s.id, dealsel: s.dataset.dealsel || "", leaddeal: s.dataset.dleaddeal || "" };
  $("ndsName").value = ""; $("ndsMsg").textContent = "";
  $("ndsSecBox").innerHTML = secPickHtml("nds");   // one Section choice: Chrome · Manganese · Transport · … · Other · + Add a section
  $("ndSheet").classList.remove("hidden"); setTimeout(() => $("ndsName").focus(), 60);
}, true);
function ndTarget() {
  if (!ndFrom) return null;
  if (ndFrom.id) return $(ndFrom.id);
  if (ndFrom.dealsel) return document.querySelector(`select[data-dealsel="${ndFrom.dealsel}"]`);
  if (ndFrom.leaddeal) return document.querySelector(`select[data-dleaddeal="${ndFrom.leaddeal}"]`);
  return null;
}
function ndApply(id, name) {
  const sel = ndTarget(); ndFrom = null; if (!sel) return;
  if (!sel.querySelector(`option[value="${id}"]`)) { const o = document.createElement("option"); o.value = id; o.textContent = name; sel.insertBefore(o, sel.querySelector(`option[value="${NEW_DEAL}"]`)); }
  sel.value = id; sel.dataset.prev = id;
  if (sel.id !== "cDeal") sel.dispatchEvent(new Event("change", { bubbles: true }));   // task, calculator and lead lists save the choice
}
$("ndsClose").onclick = () => { ndFrom = null; $("ndSheet").classList.add("hidden"); };
$("ndSheet").addEventListener("click", e => { if (e.target.id === "ndSheet") { ndFrom = null; $("ndSheet").classList.add("hidden"); } });
$("ndsAdd").onclick = async () => {
  const name = $("ndsName").value.trim();
  if (!name) { $("ndsMsg").textContent = "Give the deal a name."; $("ndsName").focus(); return; }
  if (!secPickReady("nds")) { $("ndsMsg").textContent = "Give the new section a name."; return; }
  const kind = $("ndsKind").value, area = $("ndsArea").value;
  if (DEMO) {
    const id = "nd" + Date.now(), now = new Date().toISOString();
    (window._deals ||= []).push({ id, name, kind, area, status: "Active", summary: "", stage: "", key_facts: "", contacts: "", next_milestone: "", params: {}, sort: 99, created_at: now, updated_at: now, updated_by: me, kit: kind !== "general", kit_route: kind === "mineral" ? "local" : null });
    if (kind !== "general" && window.kitDemoSteps) (window._steps ||= []).push(...kitDemoSteps(id, kind, "local"));
    $("ndSheet").classList.add("hidden"); render(); ndApply(id, name); toast("Deal added (demo – not saved)."); return;
  }
  $("ndsAdd").disabled = true; $("ndsMsg").textContent = "Saving…";
  const { data, error } = await sb.rpc("save_deal", { p_id: null, p_name: name, p_kind: kind, p_area: area, p_route: kind === "mineral" ? "local" : null });
  $("ndsAdd").disabled = false;
  if (error) { $("ndsMsg").textContent = "Could not save: " + error.message; return; }
  $("ndSheet").classList.add("hidden"); toast("Deal added with its checklist.");
  await load(); ndApply(data, name);
};

// ---------- Speaking into text boxes (free: the phone's own speech recognition) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let micRec = null, micBtn = null;
function micStop() { try { micRec && micRec.stop(); } catch (e) {} micRec = null; if (micBtn) { micBtn.classList.remove("on"); micBtn.querySelector(".ibw").textContent = "Speak"; } micBtn = null; }
function micStart(btn, field) {
  if (!SR) { toast("Tap the box, then the mic on your keyboard to speak.", 5000); field.focus(); return; }
  if (micBtn === btn) { micStop(); return; }
  micStop();
  // One sentence per tap (continuous mode repeats words on Android phones); tap Speak again to add more.
  const r = new SR(); r.lang = "en-ZA"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  const base = field.value ? field.value.replace(/\s*$/, " ") : "";
  r.onresult = ev => { let all = ""; for (let i = 0; i < ev.results.length; i++) all += ev.results[i][0].transcript;
    field.value = (base + all).replace(/\s+/g, " ").trimStart(); field.dispatchEvent(new Event("input", { bubbles: true })); };
  r.onerror = ev => {
    if (ev.error === "not-allowed") toast("Allow the microphone for this app, or use the mic on your keyboard.", 6000);
    else if (ev.error === "no-speech") toast("Didn't hear anything – tap Speak and try again.", 4000);
    else if (ev.error !== "aborted") { toast("Speaking isn't working here – tap the box and use the mic on your keyboard.", 6000); field.focus(); }
    micStop(); };
  r.onend = () => { if (micRec === r) micStop(); };
  try { r.start(); } catch (e) { toast("Speaking isn't available here – use the mic on your keyboard.", 5000); return; }
  micRec = r; micBtn = btn; btn.classList.add("on"); btn.querySelector(".ibw").textContent = "Stop"; toast("Listening – speak now. Tap Stop when done.", 4000);
}
function micButton(forSel) { return `<button type="button" class="ib t-bot mic" data-mic="${esc(forSel)}" aria-label="Speak instead of typing">${ic("mic")}<span class="ibw">Speak</span></button>`; }
// The Speak button sits beside the box (same row), so forms do not get longer.
function addMics(root) {
  (root || document).querySelectorAll("#tsWhat, #tsFrom, #tsNext, #cText, #q, #vnText, input[data-noteinput], input[data-evid]").forEach(f => {
    if (f.dataset.micAdded) return; f.dataset.micAdded = "1";
    if (f.id === "vnText") { f.closest(".fld").insertAdjacentHTML("beforebegin", `<button type="button" class="wide primary mic bigmic" data-mic="#vnText" aria-label="Speak – the words appear in the box">${ic("mic")}<span class="ibw">Speak</span></button>`); return; }
    if (f.id === "q") { const send = document.querySelector('.ask button[data-bot="ask"]'); if (send) { send.insertAdjacentHTML("beforebegin", micButton("#q")); return; } }
    if (f.id === "cText") { $("cSend").insertAdjacentHTML("beforebegin", micButton("#cText")); return; }   // board: box on its own line, File · Speak · Send under it
    const key = f.id ? "#" + f.id : f.dataset.noteinput ? `input[data-noteinput="${f.dataset.noteinput}"]` : `input[data-evid="${f.dataset.evid}"]`;
    const wrap = document.createElement("div"); wrap.className = "micwrap" + (f.tagName === "TEXTAREA" ? " ta" : "");
    f.parentNode.insertBefore(wrap, f); wrap.appendChild(f); wrap.insertAdjacentHTML("beforeend", micButton(key));
  });
}
(window._after ||= []).push(() => addMics());
document.addEventListener("click", e => {
  const b = e.target.closest("button[data-mic]"); if (!b) return;
  const f = document.querySelector(b.dataset.mic); if (f) micStart(b, f);
});

// ---------- Voice note sheet (+ › Voice note) ----------
let vnRec = null, vnChunks = [], vnBlob = null, vnTimer = null;
function vnTargets() {
  return `<option value="">The notice board</option>` + liveDeals().map(d => `<option value="deal:${d.id}">Deal: ${esc(d.name)}</option>`).join("") +
    (window._contacts || []).map(c => `<option value="contact:${c.id}">Contact: ${esc(c.name)}</option>`).join("");
}
function openVoiceNote() {
  vnSavedKey = ""; $("vnText").value = ""; vnBlob = null; $("vnAudio").innerHTML = ""; $("vnMsg").textContent = "";
  $("vnFor").innerHTML = vnTargets();
  $("vnSpeakHint").textContent = SR ? "Tap Speak and talk – the words appear below. Or record the sound to keep it as a file." : "On this phone: tap the box and use the mic on your keyboard. Or record the sound to keep it as a file.";
  $("vnSheet").classList.remove("hidden"); addMics($("vnSheet"));
}
window.openVoiceNote = openVoiceNote;
async function vnRecordToggle() {
  const b = $("vnRecBtn");
  if (vnRec) { vnRec.stop(); return; }
  if (!navigator.mediaDevices || !window.MediaRecorder) { toast("Recording sound isn't available on this phone – use Speak or the keyboard mic.", 6000); return; }
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { toast("Allow the microphone for this app to record.", 6000); return; }
  vnChunks = []; vnRec = new MediaRecorder(stream);
  vnRec.ondataavailable = ev => { if (ev.data && ev.data.size) vnChunks.push(ev.data); };
  vnRec.onstop = () => { stream.getTracks().forEach(t => t.stop()); clearInterval(vnTimer); vnBlob = new Blob(vnChunks, { type: vnRec.mimeType || "audio/webm" }); vnRec = null;
    b.innerHTML = ic("mic") + "Record again (replaces this recording)"; $("vnAudio").innerHTML = `<audio controls src="${URL.createObjectURL(vnBlob)}"></audio><div class="quiet">Recording ready – it is saved with the note.</div>`; };
  vnRec.start(); const t0 = Date.now();
  vnTimer = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); b.innerHTML = ic("pause") + `Stop recording (${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")})`; }, 500);
}
let vnSavedKey = "";   // stops a second tap (e.g. after a failed read) saving the same note twice
async function vnSave(makeTasks) {
  const text = $("vnText").value.trim(), target = $("vnFor").value;
  if (!text && !vnBlob) { $("vnMsg").textContent = "Say or type something first, or record the sound."; return; }
  if (makeTasks && !text) { $("vnMsg").textContent = "Tap Speak (or type) first – the reader reads the words, not the recording."; return; }
  const label = "Voice note from " + (me || "us") + (text ? ": " + text : " (recording attached)");
  const key = target + "|" + text + "|" + (vnBlob ? vnBlob.size : 0);
  const read = () => runReader({ kind: "voice", text, about: target }, $("vnMsg"), () => $("vnSheet").classList.add("hidden"));
  if (DEMO) { if (makeTasks) return read(); $("vnSheet").classList.add("hidden"); toast("Saved (demo – not saved)."); return; }
  if (vnSavedKey !== key) {
    $("vnMsg").textContent = "Saving…";
    let postId = null, err = null;
    const [type, id] = target ? target.split(":") : ["post", null];
    if (!target) { const r = await sb.rpc("add_post", { p_body: label, p_deal: null, p_kind: "check" }); err = r.error; postId = r.data; }
    else { const row = { field: "note", new_value: label, source: "app" }; row[type + "_id"] = id; const r = await sb.from("events").insert(row); err = r.error; }
    if (!err && vnBlob) {
      const ext = /mp4|m4a|aac/.test(vnBlob.type) ? "m4a" : /ogg/.test(vnBlob.type) ? "ogg" : "webm";
      const path = `${target ? type : "post"}/${target ? id : postId}/${Date.now()}-voice-note.${ext}`;   // same folders as other files
      const up = await sb.storage.from("files").upload(path, vnBlob, { contentType: vnBlob.type || "audio/webm", upsert: false });
      if (up.error) err = up.error;
      else { const r = await sb.from("attachments").insert({ target_type: target ? type : "post", target_id: String(target ? id : postId), path, name: "Voice note " + dayName(Date.now()) + "." + ext, size: vnBlob.size, mime: vnBlob.type || "" }); err = r.error; }
    }
    if (err) { $("vnMsg").textContent = "Could not save: " + err.message; return; }
    vnSavedKey = key;
  }
  if (makeTasks) { await read(); load(); return; }   // the review sheet opens; the note is already saved
  $("vnSheet").classList.add("hidden"); toast("Voice note saved."); load();
}
document.addEventListener("click", e => {
  if (e.target.id === "vnSheet" || e.target.closest("#vnClose")) { if (vnRec) vnRec.stop(); micStop(); $("vnSheet").classList.add("hidden"); return; }
  if (e.target.closest("#vnRecBtn")) { vnRecordToggle(); return; }
  if (e.target.closest("#vnSave")) { vnSave(false); return; }
  if (e.target.closest("#vnTasks")) { vnSave(true); return; }
});

// ---------- Company and sanctions checks (free look-ups; the result is saved as a note) ----------
// The sheet (#ckSheet in index.html) is one of the app's sheets, so the phone's Back closes it.
function openChecks(name, target) {
  const q = encodeURIComponent(name || "");
  const L = (href, t, sub) => `<a class="pkrow" href="${href}" target="_blank" rel="noopener"><span class="pk-n">${t}</span><span class="pk-s">${sub}</span></a>`;
  $("ckTitle").textContent = "Check " + (name || "");
  $("ckBody").innerHTML = `<div class="quiet">Free look-ups. Each opens in a new tab; the name is filled in where the site allows it.</div>
    <div class="pkres">${L(`https://www.opensanctions.org/search/?q=${q}`, "Sanctions and politically exposed people", "OpenSanctions – UN, US, EU, UK, South Africa and more")}
    ${L("https://sanctionssearch.ofac.treas.gov/", "US sanctions list (OFAC)", "Type the name on the page")}
    ${L("https://tfs.fic.gov.za/Pages/Search", "South Africa – FIC sanctions list", "Type the name on the page")}
    ${L(`https://www.google.com/search?q=${encodeURIComponent('"' + (name || "") + '" fraud OR scam OR sanctions OR court')}`, "Bad news check", "Web search for fraud, scam, sanctions or court")}
    ${L("https://www.bizportal.gov.za/", "Company registration (CIPC BizPortal)", "Free BizPortal login needed; directors need a paid check")}</div>
    ${target ? `<div class="lbl">What did you find?</div><div class="seg2 wrap"><button type="button" data-ckres="No match found">No match found</button><button type="button" data-ckres="Possible match – check further">Possible match</button></div><div class="quiet">Saves a dated note on ${esc(name)}, so you both see it was checked.</div>` : ""}`;
  $("ckSheet").dataset.target = target || ""; $("ckSheet").dataset.name = name || "";
  $("ckSheet").classList.remove("hidden");
}
window.openChecks = openChecks;
document.addEventListener("click", async e => {
  const o = e.target.closest("button[data-checks]");
  if (o) { const i = o.dataset.checks.lastIndexOf("|"); openChecks(o.dataset.checks.slice(0, i), o.dataset.checks.slice(i + 1)); return; }
  if (e.target.id === "ckSheet" || e.target.closest("#ckClose")) { $("ckSheet").classList.add("hidden"); return; }
  const r = e.target.closest("#ckSheet button[data-ckres]"); if (!r) return;
  const sh = $("ckSheet"), [type, id] = (sh.dataset.target || "").split(":"); if (!id) return;
  const text = `Checked ${sh.dataset.name} (sanctions and bad news${type === "lead" ? ", company" : ""}) on ${dayName(Date.now())}: ${r.dataset.ckres}.`;
  sh.classList.add("hidden");
  if (DEMO) { toast("Saved (demo – not saved)."); return; }
  const row = { field: "note", new_value: text, source: "app" }; row[type + "_id"] = id;
  const { error } = await sb.from("events").insert(row);
  if (error) { toast("Could not save: " + error.message, 6000); return; }
  toast("Check saved as a note."); load();
});
window.checksButton = (name, target) => ib("shield", "file", `data-checks="${esc(name || "")}|${esc(target || "")}"`, "Checks – sanctions and bad news");

// ---------- Calculators: Transport (distance to money) · Chrome and ore · Everyday ----------
let calcTab = "transport"; try { calcTab = localStorage.getItem("calcTab") || "transport"; } catch (e) {}
const TR = window._trip = window._trip || { from: "", to: "", km: null, mins: null, geo: null, ret: "Yes", tpl: 34, rkm: "", toll: "", client: "", loads: "", lp100: "", diesel: "",
  cls: "4", plazas: [], tollAuto: true, provider: "", checkKm: null, wx: null, busy: false, err: "" };
function num(v) { const n = parseFloat(String(v || "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; }
// Numbers the same on every phone: space between thousands, a point for decimals (R 39 720 · 12.5)
function nfmt(n, dp) { const neg = n < 0, s = Math.abs(n).toFixed(dp || 0).replace(/\.?0+$/, m => dp ? "" : m); const [a, b] = s.split("."); return (neg ? "−" : "") + a.replace(/\B(?=(\d{3})+$)/g, "\u00a0") + (b ? "." + b : ""); }
const fRand = n => (n < 0 ? "−" : "") + "R\u00a0" + nfmt(Math.round(Math.abs(n)));
// Transport calculator (26 Sep, Chris: "gets confusing with all the ticks and sections"): the answer first (three lines with a
// colour rail), then three numbered steps – 1 Route · 2 Truck · 3 Client – with no drop-down lists; diesel folded away as optional.
function tripCalc() {
  const kmTrip = TR.km ? TR.km * (TR.ret === "Yes" ? 2 : 1) : 0, tpl = num(TR.tpl) || 34;
  const byKm = TR.km && num(TR.rkm) ? kmTrip * num(TR.rkm) + num(TR.toll) : null;
  const perTon = byKm != null ? byKm / tpl : null;
  const left = perTon != null && num(TR.client) ? num(TR.client) - perTon : null;
  const month = left != null && num(TR.loads) ? left * tpl * num(TR.loads) : null;
  const fuel = TR.km && num(TR.lp100) && num(TR.diesel) ? kmTrip * num(TR.lp100) / 100 * num(TR.diesel) : null;
  return { kmTrip, tpl, byKm, perTon, left, month, fuel };
}
function tripTop() {
  const c = tripCalc(), tone = v => v == null ? "" : v < 0 ? " t-bad" : " t-ok";
  const r = (tn, k, v, unit, sub) => `<div class="trr${tn} irow${v == null ? " ask" : tn === " t-cost" ? "" : " out"}"><i class="in${v == null || tn === " t-cost" ? "" : " big"}" aria-hidden="true"></i><div class="icard${v == null ? " ask" : tn === " t-cost" ? "" : " ion"}"><span class="t">${k}<small class="mono">${sub}</small></span><span class="v">${v == null ? "?" : fRand(v) + unit}</span></div></div>`;
  return `<div class="irail" style="--col:0px"><section class="iblk deep">` + r(" t-cost", "Transport cost", c.perTon, " a ton", "road + tolls, per ton") + r(tone(c.left), "Left for you", c.left, " a ton", "client rate − transport") + r(tone(c.month), "Left a month", c.month, "", num(TR.loads) ? `${num(TR.loads)} loads` : "type the loads") + `</section></div>`
    + (c.left != null && c.left < 0 ? `<div class="trwarn"><i class="dot" style="background:var(--bad)"></i>Transport costs more than the client pays.</div>` : "")
    + (c.perTon == null ? `<div class="rfoot">fill in steps 1 to 3 below</div>` : "");
}
function tripResults() {
  if (!TR.km) return `<div class="rfoot">type where from and where to, then tap Work it out – or type the kilometres yourself</div>`;
  const c = tripCalc(), rows = [];
  const truckRoute = /truck/i.test(TR.provider || "");
  rows.push(["Road distance", `${nfmt(Math.round(TR.km))} km one way${TR.mins ? ` · about ${Math.floor(TR.mins / 60)} h ${Math.round(TR.mins % 60)} min ${truckRoute ? "driving (truck route)" : "by car (trucks are slower)"}` : ""}`]);
  if (num(TR.toll)) rows.push(["Tolls per trip", fRand(num(TR.toll)) + (TR.tollAuto && TR.plazas.length ? ` (class ${TR.cls}${TR.ret === "Yes" ? ", both ways" : ""})` : "")]);
  rows.push(["Kilometres per trip", `${nfmt(Math.round(c.kmTrip))} km${TR.ret === "Yes" ? " (there and back)" : " (one way)"}`]);
  if (c.fuel != null) rows.push(["Diesel for the trip", `${fRand(c.fuel)} (${Math.round(c.kmTrip * num(TR.lp100) / 100)} litres)`]);
  if (c.byKm != null) {
    rows.push(["Trip cost at R" + num(TR.rkm) + " a km" + (num(TR.toll) ? " + tolls" : ""), fRand(c.byKm), 1]);
    rows.push(["Cost per ton (" + c.tpl + " t load)", fRand(c.perTon) + " a ton", 1]);
  } else rows.push(["Trip cost", "Type the rate per km in step 2"]);
  // 27 Sep 2026: what the client's rate can pay a transporter per km (after tolls, before our margin)
  if (num(TR.client) && c.kmTrip) { const be = (num(TR.client) * c.tpl - num(TR.toll)) / c.kmTrip; rows.push(["Most a transporter can cost", (be < 0 ? "-" : "") + "R" + Math.abs(be).toFixed(2) + " a km (after tolls, before your margin)", 1]); }
  if (c.left != null) {
    rows.push(["Client pays", fRand(num(TR.client)) + " a ton"], ["Left per ton after transport", fRand(c.left) + " a ton", 1], ["Left per load", fRand(c.left * c.tpl)]);
    if (c.month != null) rows.push([`Left per month (${num(TR.loads)} loads)`, fRand(c.month), 1]);
    if (c.left < 0) rows.push(["Warning", "Transport costs more than the client pays"]);
  }
  // Ion Rail: the working shown as one rail – every line a card, the ones that matter in blue
  const wf = window.wfRow || (r => `<div class="kv${r.out ? " big" : ""}"><span class="k">${esc(r.k)}</span><span class="v">${esc(r.v)}</span></div>`);
  const lastBig = rows.map(r => !!r[2]).lastIndexOf(true);
  return `<div class="irail" style="--col:0px"><section class="iblk">${rows.map(([k, v, big], i) => wf({ k, v, out: i === lastBig, ask: /^Warning$/.test(k) || /^Type /.test(v) })).join("")}</section></div>`;
}
// Route part (26 Sep 2026, free services): the server works out the truck distance and time, the toll gates on the way and
// the weather at both ends; the official diesel price arrives as "Suggested" and is used only when a person taps Use it.
function tollOneWay() { return TR.plazas.filter(z => z.pick).reduce((a, z) => a + (+z["c" + TR.cls] || 0), 0); }
function tollAutoFill() { if (TR.tollAuto && TR.plazas.length) TR.toll = String(Math.round(tollOneWay() * (TR.ret === "Yes" ? 2 : 1))); }
function tollsHtml() {
  if (!TR.plazas.length) return TR.km && /truck|car/i.test(TR.provider || "") ? `<div class="quiet">No toll gates found on this route.</div>` : "";
  const one = tollOneWay();
  return `<div class="fld"><span>Toll gates on the way (${TR.plazas.length})</span></div>
    <div class="segbar" role="group" aria-label="Toll class"><button type="button" data-trcls="3" class="${TR.cls === "3" ? "on" : ""}" aria-pressed="${TR.cls === "3"}">Class 3 · 3–4 axles</button><button type="button" data-trcls="4" class="${TR.cls === "4" ? "on" : ""}" aria-pressed="${TR.cls === "4"}">Class 4 · 5+ axles</button></div>
    <div class="trtolls">${TR.plazas.map((z, i) => `<label class="trtoll"><input type="checkbox" data-trplaza="${i}"${z.pick ? " checked" : ""}><span class="tt-n">${esc(z.name)}<small>${esc(z.road || "")}${z.ramp ? " · side ramp – tick only if you use it" : ""}</small></span><span class="tt-v">${fRand(+z["c" + TR.cls] || 0)}</span></label>`).join("")}</div>
    <div class="trtsum"><span>Ticked gates, one way</span><span>${fRand(one)}</span></div>
    <div class="quiet">SANRAL toll table from 1 March 2026. ${TR.tollAuto ? "The tolls box below fills itself" + (TR.ret === "Yes" ? " (both ways)" : "") + "; type over it to use your own." : "You typed your own tolls."}</div>${TR.tollAuto ? "" : `<button type="button" class="wide" data-trtollauto="1">Use the ticked gates again</button>`}`;
}
function fuelHtml() {
  const f = (window._fuel || [])[0];
  if (!f || !(f.inland || f.coastal)) return "";
  const price = f.inland || f.coastal, where = f.inland ? "inland" : "coast", when = new Date(f.effective + "T00:00:00");
  const d = when.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });
  const using = num(TR.diesel) && Math.abs(num(TR.diesel) - price) < 0.005;
  return `<div class="trfuel${f.status === "suggested" ? " sug" : ""}"><i class="dot" style="background:${f.status === "suggested" ? "var(--prop)" : "var(--ok)"}"></i>
    <div class="tf-t"><b>${f.status === "suggested" ? "Suggested diesel" : "Official diesel"}: R${price.toFixed(2)} a litre</b><small>50ppm wholesale, ${where}, from ${esc(d)} (government price list)</small></div>
    ${using ? `<span class="tf-ok">In use</span>` : `<button type="button" class="ib" data-trfuel="${f.id}">${ic("check")}<span class="ibw">Use it</span></button>`}</div>`;
}
function weatherHtml() {
  const w = TR.wx; if (!w || !w.length) return "";
  const day = s => new Date(s + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "short" });
  return `<div class="fld"><span>Weather at both ends (next 3 days)</span></div>${w.map(p => {
    const bad = p.days.some(d => d.rain >= 10 || d.wind >= 50);
    return `<div class="trwx"><i class="dot" style="background:${bad ? "var(--warn)" : "var(--muted)"}"></i><div><b>${esc(p.name)}</b><small>${p.days.map(d => `${day(d.date)} ${d.rain} mm${d.wind >= 40 ? `, wind ${d.wind} km/h` : ""}`).join(" · ")}</small></div></div>`; }).join("")}
    <div class="quiet">Weather: MET Norway.</div>`;
}
function transportCalcHtml() {
  const f = (k, label, ph, type) => `<label class="fld"><span>${label}</span><input data-tr="${k}" ${type === "text" ? 'list="trPlaces" enterkeyhint="next"' : 'inputmode="decimal"'} value="${esc(TR[k] == null ? "" : String(TR[k]))}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
  const step = (n, t) => `<div class="trs"><span class="trs-n">${n}</span><span class="trs-t">${t}</span></div>`;
  const tdeals = liveDeals().filter(d => d.kind === "transport" && d.params && d.params.route);
  const dOn = TR.deal && dealById(TR.deal), dieselOpen = isOpen("calc:diesel", !!(TR.lp100 || TR.diesel || (window._fuel || []).length));
  const credit = /geoapify/i.test(TR.provider || "") ? "Route: Powered by Geoapify · © OpenStreetMap contributors." : TR.provider ? "Route: © OpenStreetMap contributors (car route – add the Geoapify key in Settings for truck routes)." : "";
  return `<div class="card calcc trc">
    <div class="trtop" id="trTop">${tripTop()}</div>
    ${step(1, "Route")}
    ${tdeals.length ? `<div class="fld"><span>Fill in from a deal</span></div><div class="tools trdeals">${tdeals.map(d => `<button type="button" class="ib${TR.deal === d.id ? " on" : ""}" data-trdeal="${d.id}" aria-pressed="${TR.deal === d.id}">${ic("truck")}<span class="ibw">${esc(d.name)}</span></button>`).join("")}</div>` : ""}
    ${f("from", "From", "e.g. Middelburg", "text")}${f("to", "To", "e.g. City Deep, Johannesburg", "text")}<datalist id="trPlaces"></datalist>
    <button class="primary wide trfind" data-trgo="1"${TR.busy ? " disabled" : ""}>${ic("globe")}${TR.busy ? "Working it out…" : "Work it out"}</button>
    ${TR.err ? `<div class="trwarn"><i class="dot" style="background:var(--warn)"></i>${esc(TR.err)}</div>` : ""}
    <div id="trMap" class="trmap${TR.geo ? "" : " hidden"}"></div>
    ${TR.checkKm ? `<div class="quiet">Check: TomTom's truck route is ${nfmt(Math.round(TR.checkKm))} km.</div>` : ""}
    ${TR.km && TR.from && TR.to ? `<a class="btnlink wide trmaps" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(TR.from)}&destination=${encodeURIComponent(TR.to)}">${ic("open")}Open the route in Google Maps</a>` : ""}
    ${f("km", "Km one way", "worked out above, or type it")}
    <div class="fld"><span>The truck is paid for</span></div>
    <div class="segbar" role="group" aria-label="The truck is paid for"><button type="button" data-trret="Yes" class="${TR.ret === "Yes" ? "on" : ""}" aria-pressed="${TR.ret === "Yes"}">There and back</button><button type="button" data-trret="No" class="${TR.ret === "No" ? "on" : ""}" aria-pressed="${TR.ret === "No"}">One way only</button></div>
    <div id="trTolls">${tollsHtml()}</div>
    <div id="trWx">${weatherHtml()}</div>
    ${step(2, "Truck")}
    <div class="calc">${f("rkm", "Rate per km (R)", "e.g. 28")}${f("toll", "Tolls per trip (R)", "e.g. 450")}</div>
    ${f("tpl", "Tons per load", "34")}
    <button type="button" class="trfold" data-tog="calc:diesel" data-dflt="${dieselOpen ? 1 : 0}" aria-expanded="${dieselOpen}"><span>Diesel check (optional)</span><span class="chev"></span></button>
    ${dieselOpen ? `${fuelHtml()}<div class="calc">${f("lp100", "Litres per 100 km", "e.g. 45")}${f("diesel", "Diesel price (R/litre)", "e.g. 22.50")}</div>` : ""}
    ${step(3, "Client")}
    <div class="calc">${f("client", "Client per ton (R)", "e.g. 350")}${f("loads", "Loads a month", "e.g. 20")}</div>
    <div class="trs trs-plain"><span class="trs-t">How it adds up</span></div>
    <div class="cres" id="trRes">${tripResults()}</div>
    <div class="tools trsave"><button type="button" class="ib" data-trsave="1">${ic("note")}<span class="ibw">Save</span></button><button type="button" class="ib" data-trcopy="1">${ic("copy")}<span class="ibw">Copy</span></button><button type="button" class="ib" data-trquote="1">${ic("file")}<span class="ibw">Quote PDF</span></button></div>
    <div class="quiet">${dOn ? `Save puts it in the notes of ${esc(dOn.name)}.` : "Save puts it on the notice board."} ${credit}</div></div>`;
}
const EK_NAME = { "C": "Clear", "⌫": "Delete last", "%": "Percent", "÷": "Divide", "×": "Times", "−": "Minus", "+": "Plus", "=": "Equals", ".": "Point", "+VAT": "Add 15% VAT" };
function everydayCalcHtml() {
  const keys = ["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "+VAT", "="];
  return `<div class="card calcc"><div class="ecd" id="ecExpr">${esc(window._ecExpr || "")}</div><div class="ecv" id="ecVal">${esc(window._ecVal || "0")}</div>
    <div class="ecgrid">${keys.map(k => `<button type="button" data-ek="${esc(k)}" aria-label="${EK_NAME[k] || k}" class="${k === "=" ? "primary" : /^[÷×−+]$/.test(k) ? "op" : ""}">${esc(k)}</button>`).join("")}</div>
    <div class="acts0"><button data-ek="-VAT">Remove 15% VAT</button><button data-ek="copy">${ic("copy")}Copy</button></div>
    ${(window._ecHist || []).length ? `<div class="lbl">Earlier</div>${window._ecHist.slice(0, 6).map(h => `<div class="kv"><span class="k">${esc(h[0])}</span><span class="v">${esc(h[1])}</span></div>`).join("")}` : ""}</div>`;
}
function calcTabsPage() {
  const tabs = [["transport", "truck", "Transport"], ["chrome", "gem", "Chrome & ore"], ["everyday", "calc", "Everyday"]];
  const dOn = calcTab === "transport" ? (TR.deal && dealById(TR.deal)) : calcTab === "chrome" ? (calcDeal && dealById(calcDeal)) : null;
  let h = stRow(`calc <span class="live"><i></i>live</span>`, `${calcTab === "chrome" ? "chrome & ore" : calcTab}${dOn ? " · deal" : ""}`);
  h += plateHtml("Calculator", dOn ? `Deal: ${esc(dOn.name)} · filled from its terms` : calcTab === "everyday" ? "Plus, minus, VAT on and off" : "Deal: none – free calculation");
  h += `<div class="dtabs4 calctabs">${tabs.map(([k, icn, t]) => `<button class="dtab${calcTab === k ? " on" : ""}" data-calctab="${k}">${ic(icn)}${t}</button>`).join("")}</div>`;
  const strip = calcTab === "transport" ? ["calc · transport", TR.km ? `${nfmt(Math.round(TR.km))} km one way` : "no route yet"] : calcTab === "chrome" ? ["calc · chrome & ore", dOn ? "from the terms" : "example figures"] : ["calc · everyday", "tap or type"];
  h += sheetOpen(strip[0], strip[1]);
  if (calcTab === "transport") h += transportCalcHtml();
  else if (calcTab === "everyday") h += everydayCalcHtml();
  else h += window._origCalcPage ? window._origCalcPage() : "";
  return h + sheetClose();
}
if (window.calcPageHtml && !window._origCalcPage) { window._origCalcPage = window.calcPageHtml; window.calcPageHtml = calcTabsPage; }
// everyday calculator: safe arithmetic without eval (+ − × ÷ with normal precedence)
function ecEval(expr) {
  const t = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").match(/(\d+\.?\d*|\.\d+|[-+*/])/g) || [];
  const vals = [], ops = []; let expectNum = true, neg = false;
  const prec = o => (o === "*" || o === "/") ? 2 : 1;
  const apply = () => { const b = vals.pop(), a = vals.pop(), o = ops.pop(); vals.push(o === "+" ? a + b : o === "-" ? a - b : o === "*" ? a * b : b === 0 ? NaN : a / b); };
  for (const tok of t) {
    if (/[-+*/]/.test(tok)) { if (expectNum && tok === "-") { neg = !neg; continue; } if (expectNum) continue; while (ops.length && prec(ops[ops.length - 1]) >= prec(tok)) apply(); ops.push(tok); expectNum = true; }
    else { vals.push((neg ? -1 : 1) * parseFloat(tok)); neg = false; expectNum = false; }
  }
  if (expectNum && ops.length) ops.pop();
  while (ops.length && vals.length > 1) apply();
  return vals.length ? vals[0] : 0;
}
const ecFmt = n => isFinite(n) ? nfmt(Math.round(n * 100) / 100, 2) : "Can't divide by 0";
document.addEventListener("click", async e => {
  const tb = e.target.closest("button[data-calctab]"); if (tb) { calcTab = tb.dataset.calctab; try { localStorage.setItem("calcTab", calcTab); } catch (x) {} render(); return; }
  const k = e.target.closest("button[data-ek]");
  if (k) {
    let x = window._ecExpr || ""; const key = k.dataset.ek;
    if (key === "C") { x = ""; window._ecVal = "0"; }
    else if (key === "⌫") x = x.slice(0, -1);
    else if (key === "=") { const v = ecEval(x); (window._ecHist ||= []).unshift([x, ecFmt(v)]); window._ecVal = ecFmt(v); x = isFinite(v) ? String(Math.round(v * 100) / 100) : ""; }
    else if (key === "+VAT" || key === "-VAT") { const v = ecEval(x) * (key === "+VAT" ? 1.15 : 1 / 1.15); (window._ecHist ||= []).unshift([`${x} ${key === "+VAT" ? "plus" : "less"} 15% VAT`, ecFmt(v)]); window._ecVal = ecFmt(v); x = String(Math.round(v * 100) / 100); }
    else if (key === "%") { const m = x.match(/(\d+\.?\d*)$/); if (m) { const base = ecEval(x.slice(0, -m[1].length).replace(/[-+×÷−]$/, "")); const pctv = /[+−]$/.test(x.slice(0, -m[1].length)) ? base * num(m[1]) / 100 : num(m[1]) / 100; x = x.slice(0, -m[1].length) + String(Math.round(pctv * 10000) / 10000); } }
    else if (key === "copy") { try { await navigator.clipboard.writeText(String(window._ecVal || "0").replace(/\s/g, "")); toast("Copied."); } catch (er) { toast("Copy not allowed here."); } return; }
    else x += key;
    window._ecExpr = x; if (key !== "=" && !/VAT/.test(key) && key !== "C") window._ecVal = x ? ecFmt(ecEval(x)) : "0";
    const d = $("ecExpr"), v = $("ecVal"); if (d && v && key !== "=" && !/VAT/.test(key)) { d.textContent = x; v.textContent = window._ecVal; } else render();
    return;
  }
  if (e.target.closest("button[data-trgo]")) { tripFind(); return; }
  const tc = e.target.closest("button[data-trcls]");
  if (tc) { TR.cls = tc.dataset.trcls; tollAutoFill(); render(); return; }
  if (e.target.closest("button[data-trtollauto]")) { TR.tollAuto = true; tollAutoFill(); render(); return; }
  const tf = e.target.closest("button[data-trfuel]");
  if (tf) {
    const f = (window._fuel || []).find(x => String(x.id) === tf.dataset.trfuel); if (!f) return;
    TR.diesel = String(f.inland || f.coastal);
    if (f.status === "suggested" && !DEMO) { const r = await sb.rpc("fuel_price_decide", { p_id: f.id, p_status: "accepted" }); if (!r.error) f.status = "accepted"; }
    else if (DEMO) f.status = "accepted";
    toast("Diesel price filled in."); render(); return;
  }
  const rt = e.target.closest("button[data-trret]");
  if (rt) { TR.ret = rt.dataset.trret; tollAutoFill(); render(); return; }
  const td = e.target.closest("button[data-trdeal]");
  if (td) {
    if (TR.deal === td.dataset.trdeal) { TR.deal = ""; render(); return; }   // tap again = not linked to a deal
    const d = dealById(td.dataset.trdeal); const route = ((d && d.params && d.params.route) || "").split(/→|->| to /);
    if (route.length >= 2) { TR.from = route[0].replace(/\(.*?\)/g, "").trim(); TR.to = route[1].split("/")[0].replace(/\(.*?\)/g, "").trim(); }
    const p = (d && d.params) || {}; const cr = String(p.client_rate || "").match(/\d+(?:[.,]\d+)?/); if (cr) TR.client = cr[0];
    TR.deal = td.dataset.trdeal; tripClearRoute(); render(); return;
  }
  if (e.target.closest("button[data-trcopy]")) { try { await navigator.clipboard.writeText(tripText()); toast("Copied."); } catch (er) { toast("Copy not allowed here."); } return; }
  if (e.target.closest("button[data-trsave]")) {
    // saves where the user chose: the deal picked under "Save on", or the notice board
    const pick = TR.deal ? dealById(TR.deal) : null;
    if (DEMO) { toast("Saved (demo – not saved)."); return; }
    const r = pick ? await sb.from("events").insert({ field: "note", deal_id: pick.id, new_value: tripText(), source: "app" })
                   : await sb.rpc("add_post", { p_body: tripText(), p_deal: null, p_kind: "check" });
    toast(r.error ? "Could not save: " + r.error.message : pick ? "Saved to the notes of " + pick.name + "." : "Saved on the notice board."); if (!r.error) load(); return;
  }
});
document.addEventListener("input", e => {
  const el = e.target.closest && e.target.closest("[data-tr]"); if (!el) return;
  const k = el.dataset.tr; TR[k] = el.value;
  if (k === "km") { TR.km = num(el.value) || null; TR.mins = null; TR.plazas = []; TR.provider = ""; tollAutoFill(); }
  if (k === "toll") TR.tollAuto = false;
  if (k === "from" || k === "to") placeSuggest(el.value);
  tripRefresh();
});
document.addEventListener("change", e => {
  const cb = e.target.closest && e.target.closest("input[data-trplaza]"); if (!cb) return;
  const z = TR.plazas[+cb.dataset.trplaza]; if (!z) return;
  z.pick = cb.checked; TR.tollAuto = true; tollAutoFill();
  const t = $("trTolls"); if (t) t.innerHTML = tollsHtml();
  const inp = document.querySelector('[data-tr="toll"]'); if (inp) inp.value = TR.toll;
  tripRefresh();
});
function tripRefresh() { const r = $("trRes"), t = $("trTop"); if (r) r.innerHTML = tripResults(); if (t) t.innerHTML = tripTop(); }
function tripClearRoute() { Object.assign(TR, { km: null, mins: null, geo: null, plazas: [], provider: "", checkKm: null, wx: null, err: "" }); if (TR.tollAuto) TR.toll = ""; }
function tripText() {
  const lines = [`Transport costing – ${TR.from || "?"} to ${TR.to || "?"} (${fmtWhen(new Date())})`];
  document.querySelectorAll("#trRes .kv").forEach(r => lines.push(r.querySelector(".k").textContent + ": " + r.querySelector(".v").textContent));
  const picked = TR.plazas.filter(z => z.pick);
  if (picked.length) lines.push(`Toll gates (class ${TR.cls}): ` + picked.map(z => `${z.name} ${fRand(+z["c" + TR.cls] || 0)}`).join(", "));
  return lines.join("\n");
}
// place suggestions while typing: pinned places first, then the map service (one request after a short pause)
let _plT = 0;
function placeSuggest(q) {
  clearTimeout(_plT); q = String(q || "").trim(); if (q.length < 2) return;
  _plT = setTimeout(async () => {
    let list = [];
    if (DEMO) list = ["City Deep, Johannesburg", "Durban Harbour", "Richards Bay", "Middelburg", "Steelpoort", "Rustenburg", "Maputo"].filter(n => n.toLowerCase().includes(q.toLowerCase())).map(name => ({ name }));
    else { try { const { data } = await sb.functions.invoke("tools", { body: { action: "places", q } }); list = (data && data.places) || []; } catch (x) { return; } }
    const dl = $("trPlaces"); if (dl) dl.innerHTML = list.map(p => `<option value="${esc(p.name)}">${esc(p.label || "")}</option>`).join("");
  }, 350);
}
// demo: a made-up but realistic answer (the real toll figures for these five N3 gates, class 4 = R1 274 one way)
const DEMO_ROUTE = { km: 564.8, minutes: 402, provider: "Geoapify truck route (demo)", check_km: null,
  a: { lat: -26.2167, lon: 28.0936 }, b: { lat: -29.8716, lon: 31.0262 },
  line: { type: "LineString", coordinates: [[28.0936, -26.2167], [28.38982, -26.66395], [28.6261, -27.04055], [29.56166, -28.46228], [30.0036, -29.21807], [30.3794, -29.6006], [30.80277, -29.82305], [31.0262, -29.8716]] },
  plazas: [["de-hoek", "De Hoek", 160, 230], ["wilge", "Wilge", 215, 304], ["tugela", "Tugela", 260, 359], ["mooi", "Mooi River", 240, 324], ["mariannhill", "Mariannhill", 37, 57]]
    .map(([id, name, c3, c4], i) => ({ id, name, road: "N3", c3, c4, pick: true, ramp: false, lat: [-26.66395, -27.04055, -28.46228, -29.21807, -29.82305][i], lon: [28.38982, 28.6261, 29.56166, 30.0036, 30.80277][i] })) };
async function tripFind() {
  if (!TR.from || !TR.to) { toast("Type where from and where to first."); return; }
  tripClearRoute(); TR.busy = true; render();
  try {
    let j;
    if (DEMO) { await new Promise(r => setTimeout(r, 400)); j = JSON.parse(JSON.stringify(DEMO_ROUTE)); }
    else {
      const { data, error } = await sb.functions.invoke("tools", { body: { action: "route", from: TR.from, to: TR.to } });
      if (error || !data || !data.ok) throw new Error((data && data.error) || (error && error.message) || "the route service didn't answer");
      j = data;
    }
    TR.km = j.km; TR.mins = j.minutes; TR.provider = j.provider || ""; TR.checkKm = j.check_km || null;
    TR.geo = { a: j.a, b: j.b, line: j.line }; TR.plazas = (j.plazas || []).map(z => Object.assign({}, z));
    tollAutoFill();
    tripWeather(j.a, j.b);
  } catch (err) {
    // the server is the main way; the browser's own free lookup is the spare (car route, no tolls)
    try { await tripFindInBrowser(); TR.err = "Used the spare car route – toll gates not checked (" + String(err.message || err).replace(/^need_key: /, "") + ")."; }
    catch (e2) { TR.err = "Couldn't work out the distance (" + String(err.message || err).replace(/^need_key: /, "") + "). Check the place names, or type the kilometres yourself."; }
  }
  TR.busy = false; render(); if (TR.geo) drawTrip();
}
async function tripWeather(a, b) {
  const pts = [{ name: TR.from, lat: a.lat, lon: a.lon }, { name: TR.to, lat: b.lat, lon: b.lon }];
  try {
    if (DEMO) { const t = new Date(); const d = n => { const x = new Date(t); x.setDate(t.getDate() + n); return x.toISOString().slice(0, 10); };
      TR.wx = [{ name: TR.from, days: [{ date: d(0), rain: 0, wind: 18 }, { date: d(1), rain: 2.1, wind: 22 }, { date: d(2), rain: 0, wind: 15 }] }, { name: TR.to, days: [{ date: d(0), rain: 0.4, wind: 30 }, { date: d(1), rain: 14.2, wind: 52 }, { date: d(2), rain: 3, wind: 28 }] }]; }
    else { const { data } = await sb.functions.invoke("tools", { body: { action: "weather", points: pts } }); TR.wx = (data && data.weather) || null; }
  } catch (x) { TR.wx = null; }
  const w = $("trWx"); if (w) w.innerHTML = weatherHtml();
}
async function geocode(q) {
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=za,mz,bw,zw,na,sz,ls&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { "Accept-Language": "en" } }); if (!r.ok) throw new Error("place search failed");
  const j = await r.json(); if (!j.length) throw new Error(`couldn't find "${q}"`);
  return { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name };
}
async function tripFindInBrowser() {
  const a = await geocode(TR.from); await new Promise(res => setTimeout(res, 1100)); const b = await geocode(TR.to);
  const u = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=simplified&geometries=geojson`;
  const j = await (await fetch(u)).json(); if (!j.routes || !j.routes.length) throw new Error("no road route found");
  TR.km = j.routes[0].distance / 1000; TR.mins = j.routes[0].duration / 60; TR.geo = { a, b, line: j.routes[0].geometry }; TR.provider = "OpenStreetMap car route";
}
// the official diesel price (suggested until a person uses or accepts it)
async function loadFuel() {
  if (window._fuelAt && Date.now() - window._fuelAt < 3600e3) return;
  window._fuelAt = Date.now();
  if (DEMO) { window._fuel = [{ id: 1, effective: "2026-09-02", inland: 29.5551, coastal: null, status: "suggested" }]; return; }
  try { const { data } = await sb.from("fuel_prices").select("id,effective,inland,coastal,status").neq("status", "dropped").order("effective", { ascending: false }).limit(1); window._fuel = data || []; } catch (x) { window._fuel = []; }
  if (view === "calc" && calcTab === "transport") render();
}
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return new Promise((ok, bad) => {
    const c = document.createElement("link"); c.rel = "stylesheet"; c.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(c);
    const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"; s.onload = ok; s.onerror = bad; document.head.appendChild(s);
  });
}
async function drawTrip() {
  const el = $("trMap"); if (!el || !TR.geo) return;
  try { await loadLeaflet(); } catch (e) { el.classList.add("hidden"); return; }
  el.classList.remove("hidden"); el.innerHTML = "";
  const m = L.map(el, { zoomControl: true, attributionControl: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(m);
  const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();   // map colours follow the palette
  const line = L.geoJSON(TR.geo.line, { style: { color: cv("--route") || "#3A3F46", weight: 5 } }).addTo(m);
  for (const z of TR.plazas) L.circleMarker([z.lat, z.lon], { radius: 5, color: cv("--route-a") || "#1B1D20", weight: 2, fillColor: z.pick ? (cv("--warn") || "#D6A55A") : "#FFFFFF", fillOpacity: 1 }).bindTooltip(z.name).addTo(m);
  L.circleMarker([TR.geo.a.lat, TR.geo.a.lon], { radius: 7, color: cv("--route-a") || "#1B1D20", fillOpacity: 1 }).addTo(m);
  L.circleMarker([TR.geo.b.lat, TR.geo.b.lon], { radius: 7, color: cv("--route-b") || "#8E959E", fillOpacity: 1 }).addTo(m);
  m.fitBounds(line.getBounds(), { padding: [20, 20] });
}
(window._after ||= []).push(() => { if (view === "calc" && calcTab === "transport") { loadFuel(); if (TR.geo) drawTrip(); } });

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
  $("ndsKind").innerHTML = Object.entries(DEAL_KINDS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  $("ndsArea").innerHTML = AREAS.map(a => `<option>${esc(a)}</option>`).join(""); $("ndsArea").value = "Chrome";
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
$("ndsKind").addEventListener("change", () => { const k = $("ndsKind").value, a = $("ndsArea");
  if (k === "transport") a.value = "Transport"; else if (k === "mineral" && a.value === "Transport") a.value = "Chrome"; });
$("ndsAdd").onclick = async () => {
  const name = $("ndsName").value.trim(), kind = $("ndsKind").value, area = $("ndsArea").value;
  if (!name) { $("ndsMsg").textContent = "Give the deal a name."; $("ndsName").focus(); return; }
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
  $("vnText").value = ""; vnBlob = null; $("vnAudio").innerHTML = ""; $("vnMsg").textContent = "";
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
async function vnSave(makeTasks) {
  const text = $("vnText").value.trim(), target = $("vnFor").value;
  if (!text && !vnBlob) { $("vnMsg").textContent = "Say or type something first, or record the sound."; return; }
  if (makeTasks && !text) { $("vnMsg").textContent = "Tap Speak (or type) first – the bot reads the words, not the recording."; return; }
  const label = "Voice note from " + (me || "us") + (text ? ": " + text : " (recording attached)");
  if (DEMO) { $("vnSheet").classList.add("hidden"); toast(makeTasks ? "Demo – the bot needs a real login." : "Saved (demo – not saved)."); return; }
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
  $("vnSheet").classList.add("hidden"); toast("Voice note saved.");
  if (makeTasks && text) {
    const where = target ? ` It is about ${type === "deal" ? "the deal " + ((dealById(id) || {}).name || "") : "my contact " + ((((window._contacts || []).find(c => c.id === id)) || {}).name || "")}.` : "";
    askBot(`This is a voice note I just recorded.${where} Turn it into tasks (propose them – I will accept or drop) and notes on the right deals or people. Keep each task short. Voice note: "${text}"`, "ask");
  } else load();
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
const TR = window._trip = window._trip || { from: "", to: "", km: null, mins: null, geo: null, ret: "Yes", tpl: 34, rkm: "", toll: "", client: "", loads: "", lp100: "", diesel: "" };
function num(v) { const n = parseFloat(String(v || "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; }
// Numbers the same on every phone: space between thousands, a point for decimals (R 39 720 · 12.5)
function nfmt(n, dp) { const neg = n < 0, s = Math.abs(n).toFixed(dp || 0).replace(/\.?0+$/, m => dp ? "" : m); const [a, b] = s.split("."); return (neg ? "−" : "") + a.replace(/\B(?=(\d{3})+$)/g, "\u00a0") + (b ? "." + b : ""); }
const fRand = n => (n < 0 ? "−" : "") + "R\u00a0" + nfmt(Math.round(Math.abs(n)));
function tripResults() {
  if (!TR.km) return `<div class="quiet">Type where from and where to, then tap Find the road distance. Or type the kilometres yourself.</div>`;
  const kmTrip = TR.km * (TR.ret === "Yes" ? 2 : 1), tpl = num(TR.tpl) || 34;
  const rows = [];
  rows.push(["Road distance", `${nfmt(Math.round(TR.km))} km one way${TR.mins ? ` · about ${Math.floor(TR.mins / 60)} h ${Math.round(TR.mins % 60)} min by car (trucks are slower)` : ""}`]);
  rows.push(["Kilometres per trip", `${nfmt(Math.round(kmTrip))} km${TR.ret === "Yes" ? " (there and back)" : ""}`]);
  const byKm = num(TR.rkm) ? kmTrip * num(TR.rkm) + num(TR.toll) : null;
  const fuel = num(TR.lp100) && num(TR.diesel) ? kmTrip * num(TR.lp100) / 100 * num(TR.diesel) : null;
  if (fuel != null) rows.push(["Diesel for the trip", `${fRand(fuel)} (${Math.round(kmTrip * num(TR.lp100) / 100)} litres)`]);
  if (byKm != null) {
    rows.push(["Trip cost at R" + num(TR.rkm) + " a km" + (num(TR.toll) ? " + tolls" : ""), fRand(byKm), 1]);
    rows.push(["Cost per ton (" + tpl + " t load)", fRand(byKm / tpl) + " a ton", 1]);
  } else rows.push(["Trip cost", "Type the rate per km (what the transporter charges or your own cost)"]);
  if (num(TR.client) && byKm != null) {
    const m = num(TR.client) - byKm / tpl;
    rows.push(["Client pays", fRand(num(TR.client)) + " a ton"], ["Left per ton after transport", fRand(m) + " a ton", 1], ["Left per load", fRand(m * tpl)]);
    if (num(TR.loads)) rows.push([`Left per month (${num(TR.loads)} loads)`, fRand(m * tpl * num(TR.loads)), 1]);
    if (m < 0) rows.push(["Warning", "Transport costs more than the client pays"]);
  }
  return rows.map(([k, v, big]) => `<div class="kv${big ? " big" : ""}"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("");
}
function transportCalcHtml() {
  const f = (k, label, ph, type) => `<label class="fld"><span>${label}</span><input data-tr="${k}" ${type === "text" ? "" : 'inputmode="decimal"'} value="${esc(TR[k] == null ? "" : String(TR[k]))}" placeholder="${esc(ph)}" autocomplete="off"></label>`;
  const tdeals = liveDeals().filter(d => d.kind === "transport" && d.params && d.params.route);
  return `<div class="card calcc">
    ${tdeals.length ? `<label class="fld" style="margin-top:0"><span>Fill in from a deal</span><select id="trDeal"><option value="">Choose a transport deal…</option>${tdeals.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("")}</select></label>` : ""}
    ${f("from", "From (town or address)", "e.g. Middelburg, Mpumalanga", "text")}${f("to", "To (town or address)", "e.g. City Deep, Johannesburg", "text")}
    <div class="acts0"><button class="primary" data-trgo="1">${ic("globe")}Find the road distance</button>${TR.km ? `<a class="btnlink" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(TR.from)}&destination=${encodeURIComponent(TR.to)}">${ic("open")}Open in Google Maps</a>` : ""}</div>
    <div id="trMap" class="trmap${TR.geo ? "" : " hidden"}"></div>
    <div class="calc">${f("km", "Kilometres one way", "or type it yourself")}<label class="fld"><span>Count the empty trip back?</span><select data-tr="ret"><option${TR.ret === "Yes" ? " selected" : ""}>Yes</option><option${TR.ret === "No" ? " selected" : ""}>No</option></select></label>
      ${f("rkm", "Rate per km (R)", "e.g. 28")}${f("toll", "Tolls per trip (R)", "e.g. 450")}${f("tpl", "Tons per load", "34")}${f("client", "Client pays per ton (R)", "e.g. 350")}${f("loads", "Loads per month", "e.g. 20")}
      ${f("lp100", "Diesel use, litres per 100 km (optional)", "e.g. 45")}${f("diesel", "Diesel price per litre (optional)", "e.g. 22.50")}</div>
    <div class="cres" id="trRes">${tripResults()}</div>
    <div class="acts0"><button data-trsave="1">${ic("note")}Save to deal notes</button><button data-trcopy="1">${ic("copy")}Copy</button></div>
    <div class="quiet">Distance from OpenStreetMap (free); it is the car route, so check the truck route and toll gates. Rates stay yours to type.</div></div>`;
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
  const tabs = [["transport", "truck", "Transport"], ["chrome", "gem", "Chrome and ore"], ["everyday", "calc", "Everyday"]];
  let h = `<div class="dtabs4 calctabs">${tabs.map(([k, icn, t]) => `<button class="dtab${calcTab === k ? " on" : ""}" data-calctab="${k}">${ic(icn)}${t}</button>`).join("")}</div>`;
  if (calcTab === "transport") h += transportCalcHtml();
  else if (calcTab === "everyday") h += everydayCalcHtml();
  else h += window._origCalcPage ? window._origCalcPage() : "";
  return h;
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
  if (e.target.closest("button[data-trcopy]")) { try { await navigator.clipboard.writeText(tripText()); toast("Copied."); } catch (er) { toast("Copy not allowed here."); } return; }
  if (e.target.closest("button[data-trsave]")) {
    const ds = liveDeals(); if (!ds.length) { toast("No deal to save to – copy it instead."); return; }
    const pick = ds.find(d => d.kind === "transport") || ds[0];
    if (DEMO) { toast("Saved (demo – not saved)."); return; }
    const { error } = await sb.from("events").insert({ field: "note", deal_id: pick.id, new_value: tripText(), source: "app" });
    toast(error ? "Could not save: " + error.message : "Saved to the notes of " + pick.name + "."); if (!error) load(); return;
  }
});
document.addEventListener("input", e => {
  const el = e.target.closest && e.target.closest("[data-tr]"); if (!el) return;
  TR[el.dataset.tr] = el.value; if (el.dataset.tr === "km") { TR.km = num(el.value) || null; TR.mins = null; }
  const r = $("trRes"); if (r) r.innerHTML = tripResults();
});
document.addEventListener("change", e => {
  if (e.target.matches && e.target.matches("select[data-tr]")) { TR[e.target.dataset.tr] = e.target.value; const r = $("trRes"); if (r) r.innerHTML = tripResults(); }
  if (e.target.id === "trDeal" && e.target.value) {
    const d = dealById(e.target.value); const route = ((d && d.params && d.params.route) || "").split(/→|->| to /);
    if (route.length >= 2) { TR.from = route[0].replace(/\(.*?\)/g, "").trim(); TR.to = route[1].split("/")[0].replace(/\(.*?\)/g, "").trim(); }
    const p = (d && d.params) || {}; const cr = String(p.client_rate || "").match(/\d+(?:[.,]\d+)?/); if (cr) TR.client = cr[0];
    TR.km = null; TR.geo = null; render();
  }
});
function tripText() {
  const lines = [`Transport costing – ${TR.from || "?"} to ${TR.to || "?"} (${fmtWhen(new Date())})`];
  document.querySelectorAll("#trRes .kv").forEach(r => lines.push(r.querySelector(".k").textContent + ": " + r.querySelector(".v").textContent));
  return lines.join("\n");
}
async function geocode(q) {
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=za,mz,bw,zw,na,sz,ls&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { "Accept-Language": "en" } }); if (!r.ok) throw new Error("place search failed");
  const j = await r.json(); if (!j.length) throw new Error(`couldn't find "${q}"`);
  return { lat: +j[0].lat, lon: +j[0].lon, name: j[0].display_name };
}
async function tripFind() {
  if (!TR.from || !TR.to) { toast("Type where from and where to first."); return; }
  const r = $("trRes"); if (r) r.innerHTML = `<div class="quiet">Finding the road distance…</div>`;
  try {
    const a = await geocode(TR.from); await new Promise(res => setTimeout(res, 1100)); const b = await geocode(TR.to);
    const u = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=simplified&geometries=geojson`;
    const j = await (await fetch(u)).json(); if (!j.routes || !j.routes.length) throw new Error("no road route found");
    TR.km = j.routes[0].distance / 1000; TR.mins = j.routes[0].duration / 60; TR.geo = { a, b, line: j.routes[0].geometry };
    render(); drawTrip();
  } catch (err) { if (r) r.innerHTML = `<div class="quiet">Couldn't work out the distance (${esc(err.message)}). Check the place names, or type the kilometres yourself.</div>`; }
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
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(m);
  const line = L.geoJSON(TR.geo.line, { style: { color: "#964EC2", weight: 5 } }).addTo(m);
  L.circleMarker([TR.geo.a.lat, TR.geo.a.lon], { radius: 7, color: "#50409A", fillOpacity: 1 }).addTo(m);
  L.circleMarker([TR.geo.b.lat, TR.geo.b.lon], { radius: 7, color: "#FF7BBF", fillOpacity: 1 }).addTo(m);
  m.fitBounds(line.getBounds(), { padding: [20, 20] });
}
(window._after ||= []).push(() => { if (view === "calc" && calcTab === "transport" && TR.geo) drawTrip(); });

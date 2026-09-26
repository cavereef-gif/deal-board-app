// Deal Board v16 — Notice board: Chris and Annemarie talk to each other, attach files, log checks (also from Claude chats).
let composerMode = "post";      // post | check
let composerFile = null;         // File waiting to be sent with the next message
function setComposerMode(m) {
  composerMode = m === "check" ? "check" : "post";
  document.querySelectorAll("#composer [data-cmode]").forEach(b => b.classList.toggle("on", b.dataset.cmode === composerMode));
  $("cText").placeholder = composerMode === "check" ? "What you checked + the result" : `Message ${me === "Annemarie" ? "Chris" : "Annemarie"}…`;
}
window.setComposerMode = setComposerMode;
const seenKey = () => "boardSeen:" + (me || "x");
function boardUnread() {
  let seen = 0; try { seen = +(localStorage.getItem(seenKey()) || 0); } catch (e) {}
  return (window._posts || []).filter(p => p.author !== me && new Date(p.created_at).getTime() > seen).length;
}
function boardDot() {
  const d = $("boardDot"); if (!d) return;
  if (view === "board") { try { localStorage.setItem(seenKey(), String(Date.now())); } catch (e) {} }
  d.classList.toggle("hidden", view === "board" || !boardUnread());
}
window.boardDot = boardDot;

function postHtml(p) {
  const mine = p.author === me, check = p.kind !== "post";
  const files = attsFor("post", p.id);
  const deal = p.deal_id ? dealById(p.deal_id) : null;
  return `<div class="post${mine && !check ? " mine" : ""}${check ? " check" : ""}${p.pinned ? " pinned" : ""}${p.done ? " done" : ""}" data-post="${p.id}">
    ${check ? `<div class="pm" style="margin:0 0 4px">${ic("list")}<span class="sp">${p.kind === "claude" ? "Check logged from a Claude chat" : "Check logged"}</span></div>` : ""}
    <div class="pb">${esc(p.body)}</div>
    ${files.length ? `<div class="pa">${files.map(a => `<a href="${esc((window._urls || {})[a.path] || "#")}" target="_blank" rel="noopener">${ic("clip")}${esc(a.name)}</a>`).join("")}</div>` : ""}
    ${deal ? `<button class="plink" data-tgo="deal:${deal.id}">${ic("deals")}${esc(deal.name.length > 34 ? deal.name.slice(0, 32) + "…" : deal.name)}</button>` : ""}
    <div class="pm"><span class="sp">${esc(p.author)} · ${fmtWhen(p.created_at)}${p.done ? " · done" : ""}</span>
      <button class="pbtn" data-postact="${p.id}" data-v="${p.pinned ? "unpin" : "pin"}" aria-label="${p.pinned ? "Unpin" : "Pin to the top"}" title="${p.pinned ? "Unpin" : "Pin to the top"}">${ic("pin")}<span>${p.pinned ? "Unpin" : "Pin"}</span></button>
      <button class="pbtn" data-postact="${p.id}" data-v="${p.done ? "open" : "done"}" aria-label="${p.done ? "Mark as open" : "Mark as done"}" title="${p.done ? "Mark as open" : "Mark as done"}">${ic(p.done ? "undo" : "check")}<span>${p.done ? "Reopen" : "Done"}</span></button></div></div>`;
}
function boardHtml() {
  const P = (window._posts || []).filter(p => !window.inSecPost || inSecPost(p)).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const pinned = P.filter(p => p.pinned && !p.done);
  let h = portsCardHtml();
  if (pinned.length) h += `<div class="sech pinned-h"><h3>Pinned</h3></div><div class="feed">${pinned.map(postHtml).join("")}</div>`;
  h += `<div class="sech"><h3>Between Chris and Annemarie</h3><span class="sc">${P.length} message${P.length === 1 ? "" : "s"}</span></div>`;
  if (!P.length) return h + `<div class="empty">${typeof section !== "undefined" && section !== "All" ? `No messages about ${esc(section)} yet. Pick All to see every message.` : "No messages yet. Write the first one below – you can attach photos or files, and log checks."}</div>`;
  let day = "", f = "";
  for (const p of P) { const d = fmtDay(p.created_at); if (d !== day) { f += `<div class="fday">${d}</div>`; day = d; } f += postHtml(p); }
  return h + `<div class="feed">${f}</div>`;
}
window.boardHtml = boardHtml;
function fillDealSelect() {
  const s = $("cDeal"); if (!s) return; const keep = s.value;
  s.innerHTML = `<option value="">No deal</option>` + liveDeals().map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join("");
  s.value = keep && dealById(keep) ? keep : "";
}
(window._after ||= []).push(() => { if (view === "board") { fillDealSelect(); if (!window._boardScrolled) { window._boardScrolled = true; setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 30); } } else window._boardScrolled = false; });

document.getElementById("composer").addEventListener("click", e => {
  const m = e.target.closest("[data-cmode]"); if (m) { setComposerMode(m.dataset.cmode); $("cText").focus(); }
});
$("cAttach").onclick = () => { $("cFileInput").value = ""; $("cFileInput").click(); };
$("cFileInput").addEventListener("change", () => {
  const f = $("cFileInput").files && $("cFileInput").files[0]; if (!f) return;
  if (f.size > 25 * 1024 * 1024) { toast("That file is over 25 MB. Send a smaller one.", 5000); return; }
  composerFile = f; $("cFile").textContent = "Attached: " + f.name + " – tap send"; $("cFile").classList.remove("hidden");
});
$("cText").addEventListener("input", () => { const t = $("cText"); t.style.height = "auto"; t.style.height = Math.min(140, t.scrollHeight) + "px"; });
$("cSend").onclick = async () => {
  const body = ($("cText").value || "").trim() || (composerFile ? "📎 " + composerFile.name : "");
  if (!body) { $("cText").focus(); toast("Type a message first (or tap File to attach one)."); return; }
  if (DEMO) { (window._posts ||= []).unshift({ id: "dp" + Date.now(), author: me, kind: composerMode, body, deal_id: $("cDeal").value || null, pinned: false, done: false, created_at: new Date().toISOString() }); $("cText").value = ""; composerFile = null; $("cFile").classList.add("hidden"); render(); window.scrollTo(0, document.body.scrollHeight); return; }
  const btn = $("cSend"); btn.disabled = true;
  const { data: id, error } = await sb.rpc("add_post", { p_body: body, p_deal: $("cDeal").value || null, p_kind: composerMode });
  if (error) { btn.disabled = false; toast("Could not send: " + error.message, 6000); return; }
  if (composerFile) {
    const f = composerFile, path = `post/${id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, "_").slice(-80)}`;
    toast("Uploading " + f.name + "…", 0);
    const up = await sb.storage.from("files").upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
    if (up.error) toast("Message sent, but the file failed: " + up.error.message, 6000);
    else { const r = await sb.from("attachments").insert({ target_type: "post", target_id: String(id), path, name: f.name, size: f.size, mime: f.type || "" }); if (r.error) toast("Uploaded, but could not record it: " + r.error.message, 6000); else $("toast").classList.add("hidden"); }
  }
  $("cText").value = ""; $("cText").style.height = ""; composerFile = null; $("cFile").classList.add("hidden"); btn.disabled = false;
  window._boardScrolled = false; load();
};
$("list").addEventListener("click", async e => {
  const b = e.target.closest("button[data-postact]"); if (!b) return;
  if (DEMO) { const p = (window._posts || []).find(x => x.id === b.dataset.postact); if (p) { if (b.dataset.v === "pin") p.pinned = true; if (b.dataset.v === "unpin") p.pinned = false; if (b.dataset.v === "done") p.done = true; if (b.dataset.v === "open") p.done = false; } render(); return; }
  b.disabled = true;
  const { error } = await sb.rpc("post_action", { p_id: b.dataset.postact, p_action: b.dataset.v });
  if (error) { toast("Could not update: " + error.message, 5000); b.disabled = false; return; }
  load();
});

// ---- Ports and borders (26 Sep 2026, free services): the weekly border report, rain and wind at the three ore ports, and
// links to the berthing lists. Read-only – nothing here changes a deal or a task.
const PORTS = [{ name: "Durban", lat: -29.87, lon: 31.03 }, { name: "Richards Bay", lat: -28.80, lon: 32.04 }, { name: "Maputo", lat: -25.97, lon: 32.57 }];
const BERTH_LINKS = [["Transnet: terminal berthing lists (Durban, Richards Bay and the rest)", "https://www.transnet.net/SubsiteRender.aspx?id=8153370"],
  ["Transnet: terminal updates", "https://www.transnet.net/TPTTerminalUpdates"], ["Maputo port: in port today", "https://www.portmaputo.com/whats-new/in-port-today/"]];
const wxBad = d => d.rain >= 10 || d.wind >= 50;
async function loadPortsInfo(force) {
  if (!force && window._portsAt && Date.now() - window._portsAt < 3600e3) return;
  window._portsAt = Date.now();
  if (typeof DEMO !== "undefined" && DEMO) {
    const d = n => saDayPlus(n);
    window._borderNote = { week_ending: "2026-08-23", summary: "Slow: Chirundu (Zambia to Zimbabwe) 27 h, Beitbridge (into Zimbabwe) 20 h, Kazungula (Botswana to Zambia) 19 h in the queue. Quicker: Ressano Garcia (Mozambique into SA) 4 h, Lebombo (into Mozambique) 4 h, Kazungula (Zambia to Botswana) 5 h.", source_url: "https://www.wcoesarpsg.org/" };
    window._portWx = PORTS.map((p, i) => ({ name: p.name, days: [0, 1, 2].map(n => ({ date: d(n), rain: i === 0 && n === 1 ? 14.2 : 0.4 * n, wind: i === 0 && n === 1 ? 52 : 20 + 5 * n })) }));
    return;
  }
  try { const { data } = await sb.from("weekly_notes").select("week_ending,summary,source_url").eq("kind", "borders").order("week_ending", { ascending: false }).limit(1); window._borderNote = (data || [])[0] || null; } catch (e) {}
  try { const { data } = await sb.functions.invoke("tools", { body: { action: "weather", points: PORTS } }); window._portWx = (data && data.weather) || null; } catch (e) {}
  if (view === "board" || view === "worklist") render();
}
function portsCardHtml() {
  if (typeof section !== "undefined" && !["All", "Transport"].includes(section)) return "";
  const open = isOpen("board:ports", false), n = window._borderNote, wx = window._portWx || [];
  const bad = wx.filter(p => p.days.some(wxBad));
  const day = s => new Date(s + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "short" });
  const sub = bad.length ? `Weather to watch: ${bad.map(p => p.name).join(", ")}` : wx.length ? "Ports: no heavy rain or wind" : "";
  let h = `<div class="card portsc"><div class="sec-h" role="button" tabindex="0" data-tog="board:ports" data-dflt="0" aria-expanded="${open}"><span class="st">${ic("truck")}Ports and borders</span><span class="cnt">${esc(sub)}</span><span class="chev"></span></div>`;
  if (open) {
    h += `<div class="pc-b">`;
    if (n) h += `<div class="lbl">Border queues – week ending ${esc(dayName(new Date(n.week_ending + "T08:00:00+02:00")))}</div><p class="pc-t">${esc(n.summary)}</p><div class="quiet">From the weekly WCO cross-border report, read by the bot. It comes out a few weeks late.</div><a class="btnlink wide" target="_blank" rel="noopener" href="${esc(n.source_url)}">${ic("open")}Open the report</a>`;
    else h += `<div class="quiet">No border report yet – it is read every Monday morning.</div>`;
    if (wx.length) h += `<div class="lbl">Weather at the ports (next 3 days)</div>${wx.map(p => `<div class="trwx"><i class="dot" style="background:${p.days.some(wxBad) ? "var(--warn)" : "var(--muted)"}"></i><div><b>${esc(p.name)}</b><small>${p.days.map(d => `${day(d.date)} ${d.rain} mm${d.wind >= 40 ? `, wind ${d.wind} km/h` : ""}`).join(" · ")}</small></div></div>`).join("")}<div class="quiet">Weather: MET Norway. Heavy rain (10 mm+) or strong wind (50 km/h+) can stop loading.</div>`;
    h += `<div class="lbl">Berthing lists</div>${BERTH_LINKS.map(([t, u]) => `<a class="btnlink wide" target="_blank" rel="noopener" href="${esc(u)}">${ic("open")}${esc(t)}</a>`).join("")}</div>`;
  }
  return h + `</div>`;
}
(window._after ||= []).push(() => { if (view === "board" || view === "worklist") loadPortsInfo(); });
window.portWeatherNote = function () {   // for Today: one plain line only when a port has weather to watch
  const bad = (window._portWx || []).map(p => ({ p, d: p.days.find(wxBad) })).filter(x => x.d);
  if (!bad.length) return "";
  const dd = s => new Date(s + "T12:00:00").toLocaleDateString("en-ZA", { weekday: "short" });
  return `<div class="holnote"><i class="dot" style="background:var(--warn)"></i>${bad.map(({ p, d }) => `${esc(p.name)} port: ${d.rain} mm rain${d.wind >= 50 ? `, wind ${d.wind} km/h` : ""} on ${dd(d.date)}`).join(" · ")} – loading may stop.</div>`;
};

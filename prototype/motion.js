// Deal Board v17 — motion and touch (26 Sep 2026, Chris: "new and exceptionally modern, with interactivity").
// Rules from the UI/UX skill: move only with transform and opacity, 150–320 ms, every movement shows cause and effect,
// never blocks a tap, and nothing moves when the phone asks for reduced motion. Works on iPhone 8 (Safari 16): only
// scroll-snap and plain Web Animations are used there. Since 3 Oct 2026 a deal slides in with a View Transition where the
// phone has one (Chrome on Android); Safari 16 has none, so the iPhone 8 opens a deal exactly as before.
const calm = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
window.buzz = () => { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} };   // a light tap feel on Android
// 3 Oct 2026: a 10 ms buzz when a step is completed – Android only (Safari has no vibrate, so the iPhone does nothing)
window.stepBuzz = () => { try { if (navigator.vibrate) navigator.vibrate(10); } catch (e) {} };
// opening a deal slides it in where the phone has View Transitions (Chrome 111+ on Android); elsewhere it opens as before.
// Never when the phone asks for less motion.
window.vtRun = fn => {
  if (!document.startViewTransition || calm()) { fn(); return; }
  window._vt = true;
  try { const t = document.startViewTransition(fn); t.finished.then(() => { window._vt = false; }, () => { window._vt = false; }); }
  catch (e) { window._vt = false; fn(); }
};

// ---------- swipe rows: every row rests on its content; swipe to show its action buttons ----------
function restRows(except) {
  document.querySelectorAll(".strack").forEach(t => { if (t === except) return; const l = t.querySelector(".sact.l"), x = l ? l.offsetWidth : 0; if (Math.abs(t.scrollLeft - x) > 2) t.scrollTo({ left: x, behavior: calm() ? "auto" : "smooth" }); });
}
// a wait on someone else: swiping it all the way left opens the chase messages (flow.js), then the row settles back
function chaseWatch(t) {
  const check = () => {
    clearTimeout(t._cw);
    t._cw = setTimeout(() => {
      const max = t.scrollWidth - t.clientWidth; if (t._touch || max <= 0 || t.scrollLeft < max - 4) return;
      const b = t.querySelector(".sact.r [data-sw=chase]"), l = t.querySelector(".sact.l");
      t.scrollTo({ left: l ? l.offsetWidth : 0, behavior: "auto" });
      if (b && window.openChase) openChase(b.dataset.id);
    }, 160);
  };
  t.addEventListener("scroll", check, { passive: true });
  t.addEventListener("touchstart", () => { t._touch = true; }, { passive: true });
  t.addEventListener("touchend", () => { t._touch = false; check(); }, { passive: true });
  t.addEventListener("touchcancel", () => { t._touch = false; check(); }, { passive: true });
}
function initRows() {
  document.querySelectorAll(".strack").forEach(t => { const l = t.querySelector(".sact.l"); t.scrollLeft = l ? l.offsetWidth : 0; t.classList.add("ready"); if (t.querySelector(".sact.r [data-sw=chase]")) chaseWatch(t); });
  // show once how it works: the first row slides a little to reveal Done, then settles back
  let seen = false; try { seen = !!localStorage.getItem("swipeHint"); } catch (e) {}
  const first = document.querySelector(".hlist .strack");
  if (!seen && first && !calm()) {
    try { localStorage.setItem("swipeHint", "1"); } catch (e) {}
    const l = first.querySelector(".sact.l"), x = l ? l.offsetWidth : 0;
    setTimeout(() => { first.scrollTo({ left: Math.max(0, x - 72), behavior: "smooth" }); setTimeout(() => first.scrollTo({ left: x, behavior: "smooth" }), 700); }, 700);
  }
}
document.addEventListener("pointerdown", e => { const t = e.target.closest(".strack"); restRows(t); }, true);

// ---------- the chosen segment slides to its new place (section bar, whose list, day strip, deal tabs) ----------
const SLIDE_BARS = ".secbar, .segbar, .seg2, .dtabs4, .wkstrip";
let flip = null;
document.addEventListener("pointerdown", e => {
  const b = e.target.closest(`:is(${SLIDE_BARS}) > button`); if (!b) return;
  const bar = b.parentElement, on = bar.querySelector(":scope > .on");
  if (!on || on === b) { flip = null; return; }
  const cls = [...bar.classList].find(c => /^(secbar|segbar|seg2|dtabs4|wkstrip)$/.test(c));
  const br = bar.getBoundingClientRect(), r = on.getBoundingClientRect();
  flip = { cls, idx: [...document.querySelectorAll("." + cls)].indexOf(bar), x: r.left - br.left, y: r.top - br.top, w: r.width, at: Date.now() };
}, true);
function playFlip() {
  if (!flip || calm() || Date.now() - flip.at > 1500) { flip = null; return; }
  const f = flip; flip = null;
  requestAnimationFrame(() => {
    const bars = document.querySelectorAll("." + f.cls), bar = bars[f.idx] || bars[0]; if (!bar) return;
    const on = bar.querySelector(":scope > .on"); if (!on) return;
    const br = bar.getBoundingClientRect(), r = on.getBoundingClientRect(); if (!r.width) return;
    const cs = getComputedStyle(on), ghost = document.createElement("span");
    ghost.className = "flipghost"; ghost.setAttribute("aria-hidden", "true");
    // the ghost sits inside the bar, under the words, and slides from the old segment to the new one
    Object.assign(ghost.style, { left: (r.left - br.left) + "px", top: (r.top - br.top) + "px", width: r.width + "px", height: r.height + "px", borderRadius: cs.borderRadius, backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage, boxShadow: cs.boxShadow });
    bar.appendChild(ghost); on.classList.add("flipping");
    const dx = f.x - (r.left - br.left), dy = f.y - (r.top - br.top), sx = f.w / r.width;
    const a = ghost.animate([{ transform: `translate(${dx}px, ${dy}px) scaleX(${sx})` }, { transform: "none" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
    const done = () => { ghost.remove(); on.classList.remove("flipping"); };
    a.onfinish = done; a.oncancel = done;
  });
}

// ---------- entering a page: the blocks rise in, one after another; numbers count up ----------
let lastView = null;
function enterAnim() {
  if (calm() || window._vt) return;   // a View Transition is already moving the page
  const blocks = [...document.querySelectorAll("#list > *")].slice(0, 10);
  blocks.forEach((el, i) => el.animate([{ opacity: 0, transform: "translateY(10px)" }, { opacity: 1, transform: "none" }], { duration: 280, delay: i * 35, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" }));
  document.querySelectorAll(".ht-n[data-count]").forEach(n => {
    const to = +n.dataset.count; if (!(to > 0) || to > 999) return; const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 420); n.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); };
    n.textContent = "0"; requestAnimationFrame(step);
  });
}

// after every render: set the rows, play the slide, and animate the page if it is a new one
(window._after ||= []).push(() => {
  initRows(); playFlip();
  const key = view + ":" + (typeof section !== "undefined" ? section : "") + ":" + (typeof dealPage !== "undefined" && view === "deal" ? dealPage : "");
  if (key !== lastView) { const first = lastView === null; lastView = key; if (!first) enterAnim(); }
});

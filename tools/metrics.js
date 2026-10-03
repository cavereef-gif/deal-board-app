// Readability metrics for the current page (run in the browser; returns an object).
// screens: page height in screen-heights · words / wordsInView · fontSizes: distinct text sizes · pctUnder14: % of text characters under 14px
// minFont · lowContrast / minContrast: WCAG ratio vs the real background · colouredText: text drawn in a saturated colour (not allowed)
// heavyLarge: bold ≥600 at ≥20px (glare) · smallTargets: tap targets under 40px · iconOnly: buttons without visible words · jargon: app-made-up words
(() => {
  const vw = innerWidth, vh = innerHeight;
  const parse = c => { const m = String(c).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  function bgOf(el) {
    const stack = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e); let c = parse(cs.backgroundColor);
      if ((!c || c.a === 0) && cs.backgroundImage && cs.backgroundImage !== "none") { const g = parse(cs.backgroundImage); if (g) c = { ...g, a: 1 }; }
      if (c && c.a > 0) { stack.push(c); if (c.a >= 0.99) break; }
    }
    let base = parse(getComputedStyle(document.body).backgroundColor) || { r: 0, g: 0, b: 0, a: 1 }; base.a = 1;
    for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base);
    return base;
  }
  const sat = c => { const r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, l]; const d = mx - mn; return [l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn), l]; };
  const visible = el => { const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(el); return cs.visibility !== "hidden" && cs.display !== "none" && +cs.opacity > 0.05; };
  const texts = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode, t = n.textContent.replace(/\s+/g, " ").trim(); if (!t) continue;
    const el = n.parentElement; if (!el || !visible(el) || el.closest("script,style,svg,option,datalist,.hidden")) continue;
    const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); const fg = parse(cs.color); if (!fg) continue;
    const bg = bgOf(el); const fgb = blend({ ...fg, a: fg.a * (+cs.opacity || 1) }, bg);
    const [s, l] = sat(fgb);
    texts.push({ t: t.slice(0, 60), len: t.length, fs: parseFloat(cs.fontSize), fw: +cs.fontWeight, cr: +ratio(fgb, bg).toFixed(2), col: s > 0.35 && l > 0.2 && l < 0.85, inView: r.bottom > 0 && r.top < vh, top: Math.round(r.top + scrollY), cls: (el.className && el.className.baseVal === undefined ? el.className : "").toString().slice(0, 30), tag: el.tagName.toLowerCase() });
  }
  const inter = [...document.querySelectorAll("button,a[href],[role=button],input:not([type=hidden]),select,textarea,summary")].filter(visible).filter(e => !e.closest(".hidden"));
  const small = inter.map(e => { const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), txt: (e.innerText || e.getAttribute("aria-label") || e.placeholder || "").trim().slice(0, 30), inView: r.bottom > 0 && r.top < vh }; }).filter(x => x.w < 40 || x.h < 40);
  const iconOnly = inter.filter(e => e.tagName === "BUTTON" && !(e.innerText || "").replace(/\d+/g, "").trim()).map(e => e.getAttribute("aria-label") || e.title || "(no label)");
  const JARGON = ["Proposed","Confirmed","nudge","stale","queue","gate","gated","kit","route","waits","Waits","Evidence","Playbook","brief","Brief","Qualified","Unverified","Inferred","segment","tray","draft","Draft","Asks","CONFIRM","OURS","CHASE"];
  const allText = texts.map(x => x.t).join(" ");
  const jarg = {}; JARGON.forEach(w => { const m = allText.match(new RegExp("\\b" + w + "\\b", "g")); if (m) jarg[w] = m.length; });
  const sizes = {}; texts.forEach(x => { sizes[x.fs] = (sizes[x.fs] || 0) + x.len; });
  const chars = texts.reduce((a, x) => a + x.len, 0);
  const under14 = texts.filter(x => x.fs < 14).reduce((a, x) => a + x.len, 0);
  const lowC = texts.filter(x => x.cr < 4.5);
  return {
    screens: +(document.documentElement.scrollHeight / vh).toFixed(1),
    words: allText.split(/\s+/).length,
    wordsInView: texts.filter(x => x.inView).map(x => x.t).join(" ").split(/\s+/).length,
    textBlocks: texts.length,
    fontSizes: Object.keys(sizes).length, sizeChars: sizes,
    pctUnder14: chars ? Math.round(under14 / chars * 100) : 0,
    minFont: Math.min(...texts.map(x => x.fs)),
    lowContrast: lowC.length, lowContrastSamples: lowC.slice(0, 6).map(x => `${x.t} (${x.cr}, ${x.fs}px)`),
    minContrast: Math.min(...texts.map(x => x.cr)),
    colouredText: texts.filter(x => x.col).map(x => x.t).slice(0, 8),
    heavyLarge: texts.filter(x => x.fw >= 600 && x.fs >= 20).map(x => x.t).slice(0, 5),
    interactive: inter.length, smallTargets: small.length, smallSamples: small.slice(0, 6).map(x => `${x.txt || "?"} ${x.w}x${x.h}`),
    iconOnly: iconOnly.length, iconOnlyNoLabel: iconOnly.filter(x => x === "(no label)").length, iconLabels: iconOnly.slice(0, 14),
    jargon: jarg,
  };
})()

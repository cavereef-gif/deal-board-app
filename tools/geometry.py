#!/usr/bin/env python3
"""Ion Rail geometry check: measures the built app (demo mode) against docs/ION-GEOMETRY.md and prints PASS / FAIL.

Usage:  python3 tools/geometry.py            (S22 360x780 and iPhone 8 375x667, dark)
Set SUPABASE_JS / LOCAL_FONTS like tools/screens.py when the CDNs are blocked. Exit code 1 when anything fails.
Every rule is a number from the approved mock-ups: the rail's x from the sheet's inner edge, node centres on the groove
centre and on each card's centre, 20 px hairlines from the groove's edge to the card's edge, 48 px cards 6 px apart with
12 / 8 px insets in a block, 28 px readout strip, 66 px plate, 56 px bottom bar, and the 8 px page margin everywhere.
"""
import asyncio, subprocess, time, os, sys, json, shutil, tempfile
from playwright.async_api import async_playwright
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DEV = {"s22": (360, 780), "iph8": (375, 667)}
CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
GF = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">'
TOL = 0.5
res = []
def check(screen, what, ok, info=""): res.append(("PASS" if ok else "FAIL", screen, what, info))

def make_site():
    d = tempfile.mkdtemp(prefix="deal-board-geo-")
    for n in os.listdir(REPO):
        p = os.path.join(REPO, n)
        if os.path.isfile(p): shutil.copy(p, d)
    lib = os.environ.get("SUPABASE_JS")
    if lib:
        shutil.copy(lib, os.path.join(d, "supabase.local.js"))
        h = open(os.path.join(d, "index.html"), encoding="utf-8").read().replace(CDN, '<script src="supabase.local.js"></script>')
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(h)
    fonts = os.environ.get("LOCAL_FONTS")
    if fonts:
        for n in os.listdir(fonts):
            if n.endswith((".css", ".woff2")): shutil.copy(os.path.join(fonts, n), d)
        h = open(os.path.join(d, "index.html"), encoding="utf-8").read().replace(GF, '<link rel="stylesheet" href="inter.local.css">')
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(h)
    return d

# measured in the page: rects of the rail parts, relative to the page (scroll included)
JS_RAIL = r"""
(sel) => {
  const R = e => { const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, r: r.right + scrollX, b: r.bottom + scrollY }; };
  const out = [];
  document.querySelectorAll(sel).forEach(rail => {
    if (!rail.offsetParent) return;
    const sheet = rail.closest('.rsheet, .sheet-b'), inset = sheet && sheet.classList.contains('sheet-b') ? 13 : 9, col = parseFloat(getComputedStyle(rail).getPropertyValue('--col')) || 0;
    const g = getComputedStyle(rail, '::after'), bay = getComputedStyle(rail, '::before'), rr = R(rail);
    const groove = { x: rr.x + parseFloat(g.left), w: parseFloat(g.width), top: rr.y + parseFloat(g.top), bottom: rr.b - parseFloat(g.bottom), radius: g.borderTopLeftRadius };
    const rec = { col, inset, rail: rr, sheet: sheet ? R(sheet) : null, sheetPad: sheet ? getComputedStyle(sheet).padding : '', groove, bayW: parseFloat(bay.width), bayL: rr.x + parseFloat(bay.left), bayTop: rr.y + parseFloat(bay.top), blocks: [], rows: [], now: [], days: [] };
    rail.querySelectorAll(':scope > .iblk, :scope > .istage > .iblk').forEach(b => { const cs = getComputedStyle(b); rec.blocks.push({ ...R(b), days: !!b.querySelector('.iday'), radius: cs.borderTopLeftRadius, pad: cs.padding, lab: b.querySelector(':scope > .ilab') ? R(b.querySelector(':scope > .ilab')) : null, first: b.querySelector('.irow') ? R(b.querySelector('.irow')) : null }); });
    rail.querySelectorAll('.irow').forEach(row => {
      const n = row.querySelector(':scope > .in'), card = row.querySelector(':scope > .icard, :scope > .hrow, :scope > .pcard > .icard, :scope > .pcard'), stn = row.querySelector(':scope > .istn'), hl = getComputedStyle(row, '::before');
      const cr = card ? R(card) : null, rw = R(row);
      rec.rows.push({ cls: row.className, row: rw, node: n ? R(n) : null, card: cr, cardRadius: card ? getComputedStyle(card.classList.contains('hrow') ? card.querySelector('.scont') || card : card).borderTopLeftRadius : '', stn: stn ? R(stn) : null,
        hair: hl.display === 'none' || hl.content === 'none' ? null : { x: rw.x + parseFloat(hl.left), w: parseFloat(hl.width), y: rw.y + parseFloat(hl.top), h: parseFloat(hl.height) },
        pill: card ? [...card.querySelectorAll('.tag, .chip2, .m, .acc')].filter(e => e.offsetParent).map(R) : [],
        title: card && card.querySelector('.t, .hr-t') ? (() => { const t = card.querySelector('.t, .hr-t'), sm = t.querySelector('small, .s'); return { ...R(t), lines: Math.round((t.getBoundingClientRect().height - (sm ? sm.getBoundingClientRect().height : 0)) / 20) }; })() : null });
    });
    rail.querySelectorAll('.inow').forEach(nw => { const l = getComputedStyle(nw, '::before'), r = R(nw); rec.now.push({ ...r, line: { x: r.x + parseFloat(l.left), w: parseFloat(l.width) || (r.w - parseFloat(l.left) - parseFloat(l.right)), y: r.y + parseFloat(l.top), h: parseFloat(l.height) }, node: R(nw.querySelector('i')), chip: R(nw.querySelector('span')) }); });
    rail.querySelectorAll('.iday').forEach(dy => { rec.days.push({ ...R(dy), chips: dy.querySelector('.ichips') ? R(dy.querySelector('.ichips')).h : 0, tick: dy.querySelector('.itick') ? R(dy.querySelector('.itick')) : null, node: dy.querySelector(':scope > .in') ? R(dy.querySelector(':scope > .in')) : null, rows: dy.querySelectorAll('.irow').length }); });
    out.push(rec);
  });
  return out;
}
"""
JS_FRAME = r"""
() => {
  const R = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, r: r.right + scrollX, b: r.bottom + scrollY, radius: getComputedStyle(e).borderTopLeftRadius }; };
  const tabs = document.querySelector('.tabs'), plus = document.querySelector('.tabs .plus svg');
  return { w: document.documentElement.clientWidth, scrollW: document.documentElement.scrollWidth, plate: R(document.querySelector('.plate')), st: R(document.querySelector('.st')),
    strips: [...document.querySelectorAll('.rstrip')].filter(s => s.offsetParent).map(R), sheets: [...document.querySelectorAll('.rsheet')].filter(s => s.offsetParent).map(R), tabs: R(tabs), plus: R(plus), secbar: R(document.querySelector('#secSlot .secbar')),
    tabCols: tabs ? [...tabs.querySelectorAll('button')].map(b => b.getBoundingClientRect().width) : [], meter: R(document.querySelector('.plate .meter')), ring: R(document.querySelector('.plate .ring svg')),
    hud: [...document.querySelectorAll('.rsheet')].map(s => { const b = getComputedStyle(s, '::before'); return { l: parseFloat(b.left), t: parseFloat(b.top), w: parseFloat(b.width) }; }),
    stripLines: [...document.querySelectorAll('.rstrip, .rplain')].filter(s => s.offsetParent).map(s => Math.round(s.getBoundingClientRect().height)),
    over: [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > document.documentElement.clientWidth + 0.5 && !e.closest('.hscroll,.carousel,.strack,.scar'); }).slice(0, 5).map(e => e.tagName + '.' + (e.className && e.className.baseVal === undefined ? e.className : '')) };
}
"""
def near(a, b, tol=TOL): return abs(a - b) <= tol

async def run_dev(p, dev, site):
    w, h = DEV[dev]
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers="block")
    pg = await ctx.new_page(); errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    U = "http://127.0.0.1:8792/index.html?demo"
    await pg.goto(U, wait_until="load"); await pg.evaluate("localStorage.clear()"); await pg.goto(U, wait_until="load"); await pg.wait_for_timeout(700)
    M = 8; SX = M + 1 + 8   # sheet inner left = 17 at every width (8 margin + 1 border + 8 padding)
    async def screen(name, js, ncols):
        await pg.evaluate(js); await pg.wait_for_timeout(350)
        rails = await pg.evaluate(JS_RAIL, "#list .irail, #taskSheet .irail")
        fr = await pg.evaluate(JS_FRAME)
        S = f"{dev} {name}"
        check(S, "no sideways scroll", fr["scrollW"] <= fr["w"] + 0.5, str(fr["over"]))
        if fr["plate"]:
            pl = fr["plate"]; check(S, "plate x8 · width−16 · 66 high · r16", near(pl["x"], M) and near(pl["w"], fr["w"] - 2 * M) and near(pl["h"], 66) and pl["radius"] == "16px", f"x{pl['x']:.1f} w{pl['w']:.1f} h{pl['h']:.1f} {pl['radius']}")
            if fr["st"]: check(S, "status row 28 high above the plate", near(fr["st"]["h"], 28) and near(fr["st"]["b"], pl["y"]), f"h{fr['st']['h']:.1f} gap{pl['y'] - fr['st']['b']:.1f}")
            if fr["meter"]: check(S, "day meter 102 wide, ends 16 in", near(fr["meter"]["w"], 102) and near(fr["meter"]["r"], fr["w"] - 16), f"w{fr['meter']['w']:.1f} r{fr['meter']['r']:.1f}")
            if fr["ring"]: check(S, "ring 40, ends 16 in, inside the plate", near(fr["ring"]["w"], 40) and near(fr["ring"]["r"], fr["w"] - 16) and fr["ring"]["y"] >= pl["y"] and fr["ring"]["b"] <= pl["b"], f"w{fr['ring']['w']:.1f} r{fr['ring']['r']:.1f} y{fr['ring']['y'] - pl['y']:.1f}")
        for sh in fr["sheets"]:
            check(S, "sheet x8 · width−16 · r20", near(sh["x"], M) and near(sh["w"], fr["w"] - 2 * M) and sh["radius"] == "20px", f"x{sh['x']:.1f} w{sh['w']:.1f} {sh['radius']}")
        for st in fr["strips"]:
            check(S, "readout strip 28 high, x9, width−18, r19 top", near(st["h"], 28) and near(st["x"], M + 1) and near(st["w"], fr["w"] - 2 * M - 2) and st["radius"] == "19px", f"h{st['h']:.1f} x{st['x']:.1f} w{st['w']:.1f}")
        check(S, "every readout on one line (28)", all(near(x, 28) for x in fr["stripLines"]), str(fr["stripLines"]))
        for hd in fr["hud"]: check(S, "HUD corner 12 px, 6 in", near(hd["l"], 6) and near(hd["t"], 6) and near(hd["w"], 12), str(hd))
        if fr["tabs"]:
            t = fr["tabs"]; check(S, "bottom bar x8 · width−16 · 56 high · r18 · 5 equal columns", near(t["x"], M) and near(t["w"], fr["w"] - 2 * M) and near(t["h"], 56) and t["radius"] == "18px" and len(fr["tabCols"]) == 5 and max(fr["tabCols"]) - min(fr["tabCols"]) < 1, f"x{t['x']:.1f} w{t['w']:.1f} h{t['h']:.1f} cols {[round(c, 1) for c in fr['tabCols']]}")
            if fr["plus"]: check(S, "+ is a 36 circle centred", near(fr["plus"]["w"], 36) and near(fr["plus"]["x"] + 18, fr["w"] / 2, 1), f"w{fr['plus']['w']:.1f} cx{fr['plus']['x'] + 18:.1f}")
        if fr["secbar"]: check(S, "section switch x8 · width−16 · 40 high · r12", near(fr["secbar"]["x"], M) and near(fr["secbar"]["w"], fr["w"] - 2 * M) and near(fr["secbar"]["h"], 40) and fr["secbar"]["radius"] == "12px", f"x{fr['secbar']['x']:.1f} w{fr['secbar']['w']:.1f} h{fr['secbar']['h']:.1f}")
        check(S, f"{ncols} rail(s) on the screen", len(rails) >= ncols, str(len(rails)))
        for i, rl in enumerate(rails):
            T = f"{S} rail{i + 1}"
            sx = rl["sheet"]["x"] + rl["inset"] if rl["sheet"] else SX
            gx, gw = rl["groove"]["x"], rl["groove"]["w"]; gc = gx + gw / 2
            check(T, "rail spans the sheet's inner width", near(rl["rail"]["x"], sx) and near(rl["rail"]["r"], (rl["sheet"]["r"] - rl["inset"]) if rl["sheet"] else fr["w"] - SX), f"x{rl['rail']['x']:.1f} expected {sx:.1f} r{rl['rail']['r']:.1f}")
            check(T, f"groove 24 wide, r12, at the rail's x + col ({rl['col']:.0f}), full height", near(gw, 24) and near(gx, rl["rail"]["x"] + rl["col"]) and rl["groove"]["radius"] == "12px" and near(rl["groove"]["top"], rl["rail"]["y"]) and near(rl["groove"]["bottom"], rl["rail"]["b"]), f"x{gx:.1f} w{gw:.1f} top{rl['groove']['top'] - rl['rail']['y']:.1f} bottom{rl['rail']['b'] - rl['groove']['bottom']:.1f}")
            check(T, "bay = groove ± 6", near(rl["bayW"], 36) and near(rl["bayL"], gx - 6) and near(rl["bayTop"], rl["groove"]["top"] - 6), f"w{rl['bayW']:.1f} l{rl['bayL'] - gx:.1f} top{rl['bayTop'] - rl['groove']['top']:.1f}")
            for bi, bl in enumerate(rl["blocks"]):
                check(T, f"block {bi + 1} from groove + 32 to the rail's right edge, r14", near(bl["x"], gx + 32) and near(bl["r"], rl["rail"]["r"]) and bl["radius"] == "14px", f"x{bl['x'] - gx:.1f} r{rl['rail']['r'] - bl['r']:.1f} {bl['radius']}")
                if bl["lab"]: check(T, f"block {bi + 1} label at x + 12, centre 16 below the top", near(bl["lab"]["x"], bl["x"] + 12) and near(bl["lab"]["y"] + bl["lab"]["h"] / 2, bl["y"] + 16), f"x{bl['lab']['x'] - bl['x']:.1f} cy{bl['lab']['y'] + bl['lab']['h'] / 2 - bl['y']:.1f}")
                if bl["first"] and not bl["days"]: check(T, f"block {bi + 1} first card {'32' if bl['lab'] else '6'} below the top", near(bl["first"]["y"], bl["y"] + (32 if bl["lab"] else 6)), f"{bl['first']['y'] - bl['y']:.1f}")
            prev = None
            for ri, rw in enumerate(rl["rows"]):
                stage = "stage" in rw["cls"].split() or "day" in rw["cls"].split() and "blank" in rw["cls"].split()
                if rw["node"]:
                    n = rw["node"]; cy = n["y"] + n["h"] / 2
                    check(T, f"row {ri + 1} node centred on the groove", near(n["x"] + n["w"] / 2, gc), f"{n['x'] + n['w'] / 2 - gc:+.1f}")
                    ref = rw["card"] if rw["card"] and not stage else rw["row"]
                    check(T, f"row {ri + 1} node centred on its {'card' if rw['card'] and not stage else 'row'}", near(cy, ref["y"] + ref["h"] / 2), f"{cy - (ref['y'] + ref['h'] / 2):+.1f}")
                if rw["card"] and not stage:
                    c = rw["card"]
                    check(T, f"row {ri + 1} card 48 high, r12, x = groove + 44, right = rail − 8", near(c["h"], 48) and rw["cardRadius"] == "12px" and near(c["x"], gx + 44) and near(c["r"], rl["rail"]["r"] - 8), f"h{c['h']:.1f} {rw['cardRadius']} x{c['x'] - gx:.1f} r{rl['rail']['r'] - c['r']:.1f}")
                    if rw["hair"]: check(T, f"row {ri + 1} hairline groove edge → card edge, at the card's centre", near(rw["hair"]["x"], gx + gw) and near(rw["hair"]["x"] + rw["hair"]["w"], c["x"]) and near(rw["hair"]["y"] + rw["hair"]["h"] / 2, c["y"] + c["h"] / 2, 1), f"x{rw['hair']['x'] - (gx + gw):+.1f} w{rw['hair']['w']:.1f} y{rw['hair']['y'] + rw['hair']['h'] / 2 - (c['y'] + c['h'] / 2):+.1f}")
                    if rw["title"]: check(T, f"row {ri + 1} title on one line", rw["title"]["lines"] <= 1, f"{rw['title']['lines']} lines")
                    for pl in rw["pill"]:
                        if pl["h"] > 20: check(T, f"row {ri + 1} pill 24 high, ends 11 in", near(pl["h"], 24) and near(pl["r"], c["r"] - 11), f"h{pl['h']:.1f} r{c['r'] - pl['r']:.1f}")
                if rw["stn"]:
                    s = rw["stn"]; ref = rw["card"] if rw["card"] and not stage else rw["row"]
                    check(T, f"row {ri + 1} station ends 12 left of the groove, centred on the card", near(s["r"], gx - 12) and near(s["y"] + s["h"] / 2, ref["y"] + ref["h"] / 2, 1), f"r{gx - s['r']:.1f} cy{s['y'] + s['h'] / 2 - (ref['y'] + ref['h'] / 2):+.1f}")
                prev = rw
            for nw in rl["now"]:
                check(T, "now line from the groove centre to the rail's edge, 2 px, node 14 on the groove, chip ends at the card edge", near(nw["line"]["x"], gc) and near(nw["line"]["x"] + nw["line"]["w"], rl["rail"]["r"]) and near(nw["line"]["h"], 2) and near(nw["node"]["w"], 14) and near(nw["node"]["x"] + 7, gc) and near(nw["node"]["y"] + 7, nw["line"]["y"] + 1) and near(nw["chip"]["r"], rl["rail"]["r"] - 8) and near(nw["chip"]["h"], 24), f"x{nw['line']['x'] - gc:+.1f} w{nw['line']['w']:.1f} node{nw['node']['x'] + 7 - gc:+.1f}/{nw['node']['y'] + 7 - nw['line']['y'] - 1:+.1f} chip r{rl['rail']['r'] - nw['chip']['r']:.1f} h{nw['chip']['h']:.1f}")
            for di, dy in enumerate(rl["days"]):
                if dy["tick"]: check(T, f"day {di} tick ends 8 left of the groove, centred on the first card", near(dy["tick"]["r"], gx - 8) and near(dy["tick"]["y"] + dy["tick"]["h"] / 2, dy["y"] + 24), f"r{gx - dy['tick']['r']:.1f} cy{dy['tick']['y'] + dy['tick']['h'] / 2 - dy['y']:.1f}")
                if dy["node"]: check(T, f"day {di} node 6 on the groove centre", near(dy["node"]["w"], 6) and near(dy["node"]["x"] + 3, gc) and near(dy["node"]["y"] + 3, dy["y"] + 24), f"w{dy['node']['w']:.1f} cx{dy['node']['x'] + 3 - gc:+.1f} cy{dy['node']['y'] + 3 - dy['y']:.1f}")
                exp = max(54, dy["rows"] * 54) + (dy["chips"] + 6 if dy["chips"] and dy["rows"] else 0)
                check(T, f"day {di} slot is 54 per card (min 54)", near(dy["h"], exp) or (dy["chips"] and dy["h"] >= exp - 0.5), f"h{dy['h']:.1f} rows{dy['rows']} chips{dy['chips']:.0f}")
        return errors
    await screen("today", "goView('worklist'); scrollTo(0,0)", 1)
    await screen("today-chrome", "section='Chrome'; goView('worklist')", 1)
    await pg.evaluate("section='All'; goView('worklist')")
    await screen("deal-mineral", "goTo('deal:dm1'); setDealTab('dm1','steps'); render()", 2)
    await screen("deal-numbers", "goTo('deal:dm2'); setDealTab('dm2','numbers'); render()", 1)
    await screen("people", "setDirSeg('waiting'); goView('leads')", 1)
    await screen("new-task", "goView('worklist'); openTaskSheet(); document.getElementById('tsWhat').value='Chase Adrian for tippers fri'; document.getElementById('tsWhat').dispatchEvent(new Event('input'))", 1)
    await pg.evaluate("closeTaskSheet()")
    await screen("calc-chrome", "goView('calc'); document.querySelector('[data-calctab=chrome]').click()", 1)
    await screen("calc-transport", "goView('calc'); document.querySelector('[data-calctab=transport]').click(); Object.assign(window._trip, {from:'Middelburg', to:'City Deep', km:169, rkm:'28', toll:'450', client:'350', loads:'20'}); render()", 2)
    await b.close()
    return errors

async def main():
    site = make_site()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8792", "--bind", "127.0.0.1"], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    errors = []
    try:
        async with async_playwright() as p:
            for dev in DEV: errors += await run_dev(p, dev, site)
    finally: srv.terminate()
    fails = [r for r in res if r[0] == "FAIL"]
    for r in res:
        if r[0] == "FAIL" or "-v" in sys.argv: print(f"{r[0]} {r[1]} · {r[2]}  {r[3]}")
    print(f"\n{len(res) - len(fails)} PASS · {len(fails)} FAIL · page errors: {errors or 'none'}")
    sys.exit(1 if fails or errors else 0)
asyncio.run(main())

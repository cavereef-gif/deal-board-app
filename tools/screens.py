#!/usr/bin/env python3
"""Screenshot every main screen in demo mode and measure readability.

Needs: python3, playwright (pip install playwright) with a Chromium browser.
Usage:  python3 tools/screens.py [OUT_DIR]      (default OUT_DIR = /tmp/deal-board-shots)
Makes a temporary copy of the app, serves it on 127.0.0.1:8790 and opens index.html?demo
(demo mode = fictional data, nothing saved). Phones: s22 = 360x780, iph8 = 375x667; dark and light.
Writes PNGs plus metrics.json (see tools/metrics.js for what each number means).
If the supabase-js CDN is blocked, set SUPABASE_JS=/path/to/supabase.js (npm i @supabase/supabase-js,
file dist/umd/supabase.js) – the temp copy then loads it locally. Never commit that change.
If Google Fonts is blocked too, set LOCAL_FONTS=/path/to/folder holding inter.local.css plus the Inter woff2 files
(npm i @fontsource/inter) so the screenshots show the real font; again only in the temp copy.
"""
import asyncio, subprocess, time, os, sys, json, shutil, tempfile
from playwright.async_api import async_playwright
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "/tmp/deal-board-shots"); os.makedirs(OUT, exist_ok=True)
MET = open(os.path.join(REPO, "tools", "metrics.js")).read()
DEV = {"s22": (360, 780), "iph8": (375, 667)}
CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
GF = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">'

def make_site():
    d = tempfile.mkdtemp(prefix="deal-board-site-")
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

async def run(p, dev, theme, results, errors):
    w, h = DEV[dev]
    b = await p.chromium.launch()
    ctx = await b.new_context(viewport={"width": w, "height": h}, device_scale_factor=2, is_mobile=True, has_touch=True, service_workers="block", color_scheme=theme)
    pg = await ctx.new_page()
    pg.on("pageerror", lambda e: errors.append(f"{dev}/{theme} pageerror: {e}"))
    pg.on("dialog", lambda d: asyncio.ensure_future(d.dismiss()))
    U = "http://127.0.0.1:8790/index.html?demo"
    await pg.goto(U, wait_until="networkidle"); await pg.evaluate("() => { try { localStorage.clear(); } catch(e){} }")
    await pg.goto(U, wait_until="networkidle"); await pg.wait_for_timeout(500)
    await pg.evaluate(f"window.setTheme && setTheme('{theme}')")
    async def snap(name, full=False):
        await pg.wait_for_timeout(250)
        await pg.screenshot(path=f"{OUT}/{dev}-{theme}-{name}.png", full_page=full)
        results[f"{dev}-{theme}-{name}"] = await pg.evaluate(MET)
    async def js(s):
        try: await pg.evaluate(s)
        except Exception as e: errors.append(f"{dev}/{theme} step failed: {s[:60]} – {str(e)[:120]}")
        await pg.wait_for_timeout(250)
    async def go(v): await js(f"goView('{v}'); window.scrollTo(0,0)")
    # Screens (update this list when screens change)
    await go("worklist"); await snap("home"); await snap("home-full", True)
    await js("document.querySelector('[data-tgo^=\"item:\"]') && document.querySelector('[data-tgo^=\"item:\"]').click()"); await snap("task-sheet"); await pg.go_back(); await pg.wait_for_timeout(200)
    await js("document.getElementById('plusBtn').click()"); await snap("add-menu"); await pg.go_back(); await pg.wait_for_timeout(200)
    await js("window.openTaskSheet && openTaskSheet()"); await snap("new-task"); await js("document.getElementById('tsClose') && document.getElementById('tsClose').click()")
    for v in ["leads", "deals", "board", "archive", "calc", "bot", "guides", "settings"]:
        await go(v); await snap(v); await snap(v + "-full", True)
    for seg in ["saved", "all"]:
        await js(f"window.setDirSeg && setDirSeg('{seg}'); goView('leads'); render()"); await snap("contacts-" + seg)
    await js("goTo('deal:' + ((window._deals||[])[0]||{}).id)"); await snap("deal-page"); await snap("deal-page-full", True)
    for t in ["numbers", "notes"]:
        await js("(() => { const b = [...document.querySelectorAll('[data-dtab]')].find(x => x.dataset.dtab.endsWith(':" + t + "')); if (b) b.click(); })()"); await snap("deal-" + t)
    # step 1 (v17): step details as short points, calculators, voice note, checks, guides opened
    await js("(() => { const b = [...document.querySelectorAll('[data-dtab]')].find(x => x.dataset.dtab.endsWith(':steps')); if (b) b.click(); })()")
    await js("(() => { const s = document.querySelector('.step.next [data-step]') || document.querySelector('[data-step]'); if (s) { s.click(); setTimeout(() => s.scrollIntoView({block:'start'}), 50); } })()"); await snap("deal-step")
    await js("openKeys.add('+lib:kit'); openKeys.add('+lib:rule'); goView('guides'); document.querySelectorAll('.libi').forEach((d, i) => { if (i < 3) d.open = true; })"); await snap("guides-open"); await snap("guides-open-full", True)
    for t in ["chrome", "everyday", "transport"]:
        await js(f"goView('calc'); (document.querySelector('[data-calctab=\"{t}\"]') || {{click(){{}}}}).click()"); await snap("calc-" + t)
    await js("Object.assign(window._trip, {from:'Middelburg', to:'City Deep', km:169, rkm:'28', toll:'450', client:'350', loads:'20'}); render()"); await snap("calc-transport-filled", True)
    # v17 tidy (26 Sep): Home tiles filter, buyer step Done / Follow up form, transport filled from a deal
    await js("goView('calc'); document.querySelector('[data-trdeal]') && document.querySelector('[data-trdeal]').click()"); await snap("calc-transport-deal", True)
    await go("worklist"); await js("document.querySelector('[data-hf=urgent]').click()"); await snap("home-urgent"); await js("document.querySelector('[data-hf=urgent]').click()")
    await js("goTo('task:t2')"); await pg.wait_for_timeout(500); await snap("step-followup")
    await js("goTo('lead:l4')"); await pg.wait_for_timeout(300); await js("const t = document.querySelector('.tnote'); if (t) t.scrollIntoView({block:'center'})"); await snap("step-followup-set")
    await js("openVoiceNote()"); await snap("voice-note"); await js("document.getElementById('vnClose').click()")
    await js("openChecks('Example Mining (Pty) Ltd', 'contact:c1')"); await snap("checks"); await js("document.getElementById('ckClose').click()")
    await js("openTaskSheet()"); await snap("new-task-mics"); await js("document.getElementById('tsClose').click()")
    # step 2 (v17): the reader and its review sheet (demo answers)
    await js("openReader({kind:'photo'})"); await snap("reader-photo"); await js("document.getElementById('rdClose').click()")
    await js("openReader({kind:'quote', text:'Chrome conc 40-42% 5000t/month R2400/t FOT plant. Trucks from Monday.'})"); await snap("reader-quote")
    await js("document.getElementById('rdGo').click()"); await pg.wait_for_timeout(600); await snap("review-quote"); await js("document.getElementById('rvClose').click()")
    await js("runReader({kind:'photo', file:{data:'x', media_type:'image/jpeg'}, about:''})"); await pg.wait_for_timeout(600); await snap("review-photo"); await js("document.querySelector('#rvSheet .sheet-b').scrollTop = 900"); await snap("review-photo-terms"); await js("document.getElementById('rvClose').click()")
    await b.close()

async def main():
    site = make_site()
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8790", "--bind", "127.0.0.1"], cwd=site, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.0); results = {}; errors = []
    try:
        async with async_playwright() as p:
            for dev in DEV:
                for theme in ["dark", "light"]:
                    try: await run(p, dev, theme, results, errors)
                    except Exception as e: errors.append(f"{dev}/{theme} FAILED: {str(e)[:300]}")
    finally:
        srv.terminate(); shutil.rmtree(site, ignore_errors=True)
    json.dump(results, open(os.path.join(OUT, "metrics.json"), "w"), indent=1)
    print(f"{len(results)} screens measured → {OUT}")
    for k, v in results.items():
        if k.endswith("-full"): continue
        print(f"{k:28} sizes {v['fontSizes']:2}  <14px {v['pctUnder14']:3}%  minFont {v['minFont']:4}  minContrast {v['minContrast']:5}  iconOnly {v['iconOnly']:3}  coloured {len(v['colouredText'])}  small targets {v['smallTargets']}")
    print("ERRORS:", json.dumps(errors, indent=1) if errors else "none")
asyncio.run(main())

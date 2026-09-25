#!/usr/bin/env python3
"""Screenshot every main screen in demo mode and measure readability.

Needs: python3, playwright (pip install playwright) with a Chromium browser.
Usage:  python3 tools/screens.py [OUT_DIR]      (default OUT_DIR = /tmp/deal-board-shots)
Makes a temporary copy of the app, serves it on 127.0.0.1:8790 and opens index.html?demo
(demo mode = fictional data, nothing saved). Phones: s22 = 360x780, iph8 = 375x667; dark and light.
Writes PNGs plus metrics.json (see tools/metrics.js for what each number means).
If the supabase-js CDN is blocked, set SUPABASE_JS=/path/to/supabase.js (npm i @supabase/supabase-js,
file dist/umd/supabase.js) – the temp copy then loads it locally. Never commit that change.
"""
import asyncio, subprocess, time, os, sys, json, shutil, tempfile
from playwright.async_api import async_playwright
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "/tmp/deal-board-shots"); os.makedirs(OUT, exist_ok=True)
MET = open(os.path.join(REPO, "tools", "metrics.js")).read()
DEV = {"s22": (360, 780), "iph8": (375, 667)}
CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'

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
    for v in ["leads", "deals", "board", "people", "archive", "calc", "bot"]:
        await go(v); await snap(v); await snap(v + "-full", True)
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

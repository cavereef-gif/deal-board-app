#!/usr/bin/env python3
"""Workflow test: the everyday deal jobs walked through on an iPhone 8 screen (375x667) in demo mode, counting taps.

Usage:  python3 tools/workflow.py [label]      e.g.  python3 tools/workflow.py before
Same set-up as tools/flows.py (a temporary copy of the app on 127.0.0.1:8794, index.html?demo, nothing saved; set
SUPABASE_JS when the CDN is blocked). Each job prints DONE (with taps and typed boxes), or NOT POSSIBLE when the app
cannot do it yet, plus a few size numbers (terms on the form, steps in the procedure, form height).
Results also go to tools/workflow-<label>.json so a later run can be compared (docs/WORKFLOW-TEST.md).
Taps = buttons pressed; typed = boxes typed into. Written 28 Sep 2026 before the "lean deal" build; the same script
measures after it, so a job that is new simply shows NOT POSSIBLE on the older app.
"""
import asyncio, subprocess, time, os, sys, shutil, tempfile, json
from playwright.async_api import async_playwright
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LIB = os.environ.get("SUPABASE_JS")
CDN = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>'
LABEL = sys.argv[1] if len(sys.argv) > 1 else "run"
OUT = {}

class Nope(Exception): pass

async def main():
    d = tempfile.mkdtemp()
    for n in os.listdir(REPO):
        p = os.path.join(REPO, n)
        if os.path.isfile(p): shutil.copy(p, d)
    if LIB:
        shutil.copy(LIB, os.path.join(d, "supabase.local.js"))
        h = open(os.path.join(d, "index.html"), encoding="utf-8").read().replace(CDN, '<script src="supabase.local.js"></script>')
        open(os.path.join(d, "index.html"), "w", encoding="utf-8").write(h)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8794", "--bind", "127.0.0.1"], cwd=d, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
    errs = []
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch()
            ctx = await b.new_context(viewport={"width": 375, "height": 667}, is_mobile=True, has_touch=True, service_workers="block", accept_downloads=True)
            await ctx.grant_permissions(["clipboard-read", "clipboard-write"], origin="http://127.0.0.1:8794")
            pg = await ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            pg.on("dialog", lambda dd: asyncio.ensure_future(dd.dismiss()))
            U = "http://127.0.0.1:8794/index.html?demo"
            ev = pg.evaluate
            W = lambda ms=250: pg.wait_for_timeout(ms)
            st = {"taps": 0, "typed": 0}

            async def fresh():
                await pg.set_viewport_size({"width": 375, "height": 667})
                await pg.goto(U, wait_until="networkidle"); await ev("()=>{try{localStorage.clear()}catch(e){}}")
                await pg.goto(U, wait_until="networkidle"); await W(350)
                st["taps"] = 0; st["typed"] = 0

            async def has(sel, ms=600):
                try:
                    await pg.locator(sel).first.wait_for(state="visible", timeout=ms); return True
                except Exception:
                    return False

            async def tap(sel, ms=1500):
                loc = pg.locator(sel).first
                try:
                    await loc.wait_for(state="visible", timeout=ms)
                except Exception:
                    raise Nope("no " + sel)
                await loc.scroll_into_view_if_needed(); await loc.click(); st["taps"] += 1; await W()

            async def typ(sel, text, ms=1500):
                loc = pg.locator(sel).first
                try:
                    await loc.wait_for(state="visible", timeout=ms)
                except Exception:
                    raise Nope("no " + sel)
                await loc.scroll_into_view_if_needed(); await loc.fill(text); st["typed"] += 1
                await loc.dispatch_event("change"); await W(150)

            async def pick(sel, value, ms=1500):
                loc = pg.locator(sel).first
                try:
                    await loc.wait_for(state="visible", timeout=ms)
                except Exception:
                    raise Nope("no " + sel)
                await loc.scroll_into_view_if_needed(); await loc.select_option(value); st["taps"] += 2; await W()   # open the list + choose

            async def open_deal(did, tab=None):
                await ev(f"openDealPage('{did}'); goView('deal')"); await W(300)
                if tab:
                    await ev(f"setDealTab('{did}','{tab}'); render()"); await W(250)

            async def job(key, name, fn):
                await fresh()
                try:
                    info = await fn()
                    OUT[key] = {"name": name, "ok": True, "taps": st["taps"], "typed": st["typed"], "info": info}
                except Nope as e:
                    OUT[key] = {"name": name, "ok": False, "taps": None, "typed": None, "info": str(e)}
                except Exception as e:
                    OUT[key] = {"name": name, "ok": False, "taps": None, "typed": None, "info": "error: " + str(e)[:160]}

            # ---------------- J1 start a mineral deal ----------------
            async def j1():
                await tap("#plusTab"); await tap("button[data-add=deal]")
                await typ("#ndName", "Chrome – Test stockpile → Test buyer")
                await tap("[data-secp=nd] [data-secpick=Chrome]")
                await tap("button[data-createdeal]")
                v = await ev("({view, title: document.getElementById('pageTitle').textContent, n: (window._deals||[]).filter(d=>d.name.startsWith('Chrome – Test stockpile')).length})")
                if not v["n"]: raise Nope("the deal is not created in demo (" + (await ev("(document.getElementById('ndMsg')||{}).textContent||''")) + ")")
                return {"lands_on": v["view"], "title": v["title"]}
            await job("J1", "Start a mineral deal", j1)

            # ---------------- J2 fill the key terms ----------------
            async def j2():
                await open_deal("dm1"); await tap("[data-dtab='dm1:numbers']")
                rows = await ev("document.querySelectorAll('.dpanel .trow').length")
                hgt = await ev("document.querySelector('.dpanel').getBoundingClientRect().height|0")
                got, miss = [], []
                async def chip(key, val):
                    s = f"button[data-term='dm1:{key}'][data-v='{val}']"
                    if await has(s, 300): await tap(s); got.append(key); return True
                    return False
                async def sel(key, val):
                    s = f"select[data-tsel='dm1:{key}']"
                    if await has(s, 300):
                        opts = await ev(f"[...document.querySelector(\"{s}\").options].map(o=>o.value)")
                        v = next((o for o in opts if o.lower().startswith(val.lower())), None)
                        if v is None: return False
                        await pick(s, v); got.append(key); return True
                    return False
                async def txt(key, val):
                    s = f"input[data-tin='dm1:{key}']"
                    if await has(s, 300): await typ(s, val); got.append(key); return True
                    return False
                # commodity (already Chrome in the demo – tap it only if it is not on)
                if not await ev("(dealById('dm1').params||{}).commodity==='Chrome'"):
                    await chip("commodity", "Chrome") or await sel("commodity", "Chrome")
                got.append("commodity")
                await sel("grade", "Cr2O3 40") or await txt("grade", "Cr2O3 40–42%") or miss.append("grade")
                await chip("form", "Concentrate") or await sel("form", "Concentrate") or miss.append("form")
                await txt("volume", "20,000 t a month") or miss.append("volume")
                await chip("basis", "FOT") or await chip("basis", "FOT (define in SPA)") or await sel("basis", "FOT") or miss.append("FOT/DAP")
                await txt("asking_price", "R2,300 per t") or miss.append("asking price")
                await txt("price", "R2,250 per t") or miss.append("agreed price")
                await chip("instrument", "Escrow (TradeSafe)") or await sel("instrument", "Escrow") or await chip("payment", "Escrow (TradeSafe)") or await sel("payment", "Escrow") or miss.append("payment")
                await chip("vat", "Excluded") or await sel("vat", "Excluded") or miss.append("VAT")
                p = await ev("dealById('dm1').params")
                if miss: raise Nope("cannot set: " + ", ".join(miss) + f" (form rows {rows}, height {hgt}px)")
                return {"form_rows": rows, "form_height_px": hgt, "asking": p.get("asking_price"), "agreed": p.get("price"), "basis": p.get("basis")}
            await job("J2", "Fill the 9 key terms of a mineral deal (incl. asking and agreed price, FOT or DAP)", j2)

            # ---------------- J3 a question: Requested makes a follow-up ----------------
            async def j3():
                await open_deal("dm1"); await tap("[data-dtab='dm1:numbers']")
                n0 = await ev("window._items.length")
                # the question's status is the small drop-down in the row's corner (Not yet · Requested · Still awaiting)
                await pick("select[data-qsel='dm1:grade']", "requested", 800)
                it = await ev("(()=>{const x=window._items[window._items.length-1]; return {n: window._items.length, what: x.waiting_for, on: x.waiting_on, due: x.due_on, deal: x.deal_id}})()")
                if it["n"] != n0 + 1: raise Nope("no follow-up task made")
                await pick("select[data-qsel='dm1:grade']", "awaiting", 800)
                it2 = await ev("(()=>{const x=window._items[window._items.length-1]; return {n: window._items.length, prio: x.priority, due: x.due_on, chased: x.last_chased}})()")
                return {"task": it, "still_awaiting": it2}
            await job("J3", "Mark a question Requested (auto follow-up), then Still awaiting", j3)

            # ---------------- J4 sourced: yes, Annemarie to confirm ----------------
            async def j4():
                await open_deal("dm1"); await tap("[data-dtab='dm1:numbers']")
                await tap("button[data-src='dm1'][data-v='yes']", 800)
                t = await ev("(()=>{const x=window._items[window._items.length-1]; return {what: x.waiting_for, owner: x.owner, deal: x.deal_id}})()")
                if t["owner"] != "Annemarie": raise Nope("no task for Annemarie: " + json.dumps(t))
                return t
            await job("J4", "Sourced – yes, Annemarie to confirm (task for Annemarie)", j4)

            # ---------------- J5 a task for both ----------------
            async def j5():
                await tap("#plusTab"); await tap("button[data-add=task]")
                await typ("#tsWhat", "Call the lab together")
                await tap("[data-towner=Both]", 800)
                await tap("#tsAdd")
                it = await ev("window._items.find(i=>i.waiting_for==='Call the lab together')")
                if not it or it["owner"] != "Both": raise Nope("owner " + str(it and it["owner"]))
                await ev("document.querySelector('[data-who=Chris]').click()"); await W()
                c = await ev("document.getElementById('list').innerText.includes('Call the lab together')")
                await ev("document.querySelector('[data-who=Annemarie]').click()"); await W()
                a = await ev("document.getElementById('list').innerText.includes('Call the lab together')")
                if not (c and a): raise Nope(f"shows on Chris {c}, Annemarie {a}")
                return {"on_chris": c, "on_annemarie": a}
            await job("J5", "Give a task to Both – it shows on both lists", j5)

            # ---------------- J6 tick the next step; how long is the procedure ----------------
            async def j6():
                await open_deal("dm1")
                n = await ev("(()=>{const p=dealProgress('dm1'); return {total: p.total, stages: p.stages.length, next: p.next && p.next.id, title: p.next && p.next.title}})()")
                await tap(f"[data-step='{n['next']}']"); await tap(f"button[data-setstep='{n['next']}'][data-v=done]")
                s = await ev(f"(window._steps.find(s=>s.id==='{n['next']}')||{{}}).status")
                if s != "done": raise Nope("not ticked")
                tr = await ev("(()=>{const p=dealProgress('dm2'); return {total: p.total, stages: p.stages.length}})()")
                return {"mineral_steps": n["total"], "mineral_stages": n["stages"], "transport_steps": tr["total"], "transport_stages": tr["stages"], "ticked": n["title"]}
            await job("J6", "Tick the next procedure step (and count the steps)", j6)

            # ---------------- J7 send the deal status ----------------
            async def j7():
                await ev("(()=>{const d=dealById('dm1'); d.params=Object.assign({}, d.params, {target:'R45 per DMT', limit:'R30 per DMT'})})()")
                await open_deal("dm1")
                await tap("button[data-dstatus='dm1']", 800)
                async with pg.expect_download(timeout=4000) as dl:
                    await tap("#stPdf")
                f = await (await dl.value).path(); pdf = open(f, "rb").read()
                await tap("#stCopy")
                txt = await ev("window._lastCopy || ''")
                bad = [w for w in ["R45", "R30", "target", "limit"] if w.lower() in txt.lower() or w.encode() in pdf]
                if bad: raise Nope("private words in the status: " + ", ".join(bad))
                return {"pdf_bytes": len(pdf), "copy_chars": len(txt), "copy_start": txt[:80]}
            await job("J7", "Send the deal status as a PDF and a WhatsApp copy (no target or limit)", j7)

            # ---------------- J8 documents: requested → signed ----------------
            async def j8():
                await open_deal("dm1")
                await tap("[data-dtab='dm1:docs']", 800)
                n0 = await ev("window._items.filter(i=>i.state!=='Done').length")
                await tap("button[data-doc='dm1:ncnda'][data-v='requested']")
                n1 = await ev("window._items.filter(i=>i.state!=='Done').length")
                await tap("button[data-doc='dm1:ncnda'][data-v='signed']")
                n2 = await ev("window._items.filter(i=>i.state!=='Done').length")
                if not (n1 == n0 + 1 and n2 == n0): raise Nope(f"follow-ups {n0}->{n1}->{n2}")
                lists = await ev("(()=>{ return {mineral: [...document.querySelectorAll('.dpanel [data-docrow]')].length} })()")
                await open_deal("dm2"); await tap("[data-dtab='dm2:docs']")
                lists["transport"] = await ev("[...document.querySelectorAll('.dpanel [data-docrow]')].map(x=>x.dataset.docrow).join(',')")
                return {"follow_up": "made then closed", **lists}
            await job("J8", "Documents: NCNDA requested (auto follow-up), then signed (follow-up closes)", j8)

            # ---------------- J9 add a signed contract file ----------------
            async def j9():
                await open_deal("dm1")
                sel = None
                if await has("[data-dtab='dm1:docs']", 400):
                    await tap("[data-dtab='dm1:docs']"); sel = "button[data-docup='dm1:spa']"
                else:
                    await tap("[data-dtab='dm1:notes']"); sel = "button[data-attach^='deal:']"
                async with pg.expect_file_chooser(timeout=3000) as fc:
                    await tap(sel)
                return {"way": sel}
            await job("J9", "Add a signed contract (file) to the deal – taps to the file picker", j9)

            # ---------------- J10 commission split ----------------
            async def j10():
                await ev("(()=>{const d=dealById('dm1'); d.params=Object.assign({}, d.params, {commission:'R40 per t'})})()")
                await open_deal("dm1"); await tap("[data-dtab='dm1:numbers']")
                await tap("button[data-split='dm1']", 800)
                await typ("input[data-spn='0']", "Chris"); await typ("input[data-spp='0']", "40")
                await typ("input[data-spn='1']", "Annemarie"); await typ("input[data-spp='1']", "40")
                await tap("button[data-spadd]")
                await typ("input[data-spn='2']", "Partner (demo)"); await typ("input[data-spp='2']", "20")
                await tap("button[data-spsave='dm1']")
                sp = await ev("(dealById('dm1').params||{})._split")
                t = await ev("document.querySelector('[data-splitbox]') ? document.querySelector('[data-splitbox]').innerText : ''")
                if not sp or sum(float(x["p"]) for x in sp) != 100: raise Nope("split not saved: " + json.dumps(sp))
                return {"split": sp, "shows_rand": ("R16" in t or "R 16" in t)}
            await job("J10", "Split the commission 40/40/20 (checked to 100%, Rand per ton and per load)", j10)

            # ---------------- J11 market price ----------------
            async def j11():
                await tap(".tabs button[data-v=deals]")
                if not await has(".mkt", 800): raise Nope("no market price on Deals")
                t = await ev("document.querySelector('.mkt').innerText")
                return {"card": t[:140]}
            await job("J11", "See the chrome and manganese market price", j11)

            # ---------------- J12 make an NCNDA from the template ----------------
            async def j12():
                await open_deal("dm1")
                await tap("[data-dtab='dm1:docs']", 800)
                await tap("button[data-tpl='dm1:ncnda']", 800)
                fs = await ev("[...document.querySelectorAll('#tplSheet [data-tplf]')].map(x=>x.dataset.tplf)")
                for k in fs:
                    v = await ev(f"document.querySelector('#tplSheet [data-tplf=\"{k}\"]').value")
                    if not v and "name" in k: await typ(f"#tplSheet [data-tplf='{k}']", "Example Party (Pty) Ltd")
                async with pg.expect_download(timeout=5000) as dl:
                    await tap("#tplMake")
                f = await (await dl.value).path(); pdf = open(f, "rb").read()
                saved = await ev("(window._atts||[]).some(a=>a.target_type==='deal' && a.target_id==='dm1' && /ncnda/i.test(a.name))")
                return {"fields": fs, "pdf_bytes": len(pdf), "saved_to_deal": saved}
            await job("J12", "Make an NCNDA from the template (names punched in, PDF saved to the deal)", j12)

            # ---------------- J13 transport quote ----------------
            async def j13():
                await open_deal("dm2"); await tap("[data-dtab='dm2:numbers']")
                await tap("button[data-dquote='dm2']")
                async with pg.expect_download(timeout=5000) as dl:
                    await tap("button[data-docmake]")
                await dl.value
                return {}
            await job("J13", "Make the transport quote PDF", j13)

            # ---------------- J14 the ticket words do not overlap ----------------
            async def j14():
                # the words Chris saw scrambled (28 Sep): a range plus a remark, on the Samsung's 360 px width
                await pg.set_viewport_size({"width": 360, "height": 780})
                await ev("(()=>{const d=dealById('dm1'); d.params=Object.assign({}, d.params, {volume:'20,000–50,000 t per month (Example buyer\\'s requirement)', grade:'', basis:''})})()")
                await open_deal("dm1")
                r = await ev("""(()=>{ const od=document.querySelector('.ticket .od'), l=document.querySelector('.ticket .tk-l'); if(!od||!l) return {miss:true};
                  const a=od.getBoundingClientRect(), b=l.getBoundingClientRect(); let over=false;
                  od.querySelectorAll('*').forEach(x=>{ const c=x.getBoundingClientRect(); if(c.height && c.bottom>b.top+1 && c.top<b.bottom) over=true; });
                  const em=od.querySelector('em:last-child'); return {over, odH: a.height|0, lineTop: b.top|0, odBottom: a.bottom|0, emLines: em ? Math.round(em.getBoundingClientRect().height/ (parseFloat(getComputedStyle(em).lineHeight)||16)) : 0} })()""")
                await pg.set_viewport_size({"width": 375, "height": 667})
                if r.get("miss"): raise Nope("no ticket")
                if r["over"]: raise Nope("words overlap: " + json.dumps(r))
                return r
            await job("J14", "Deal ticket: a long volume does not print over the terms line", j14)

            # ---------------- J15 real deal stuff on the Deals tab ----------------
            async def j15():
                await tap(".tabs button[data-v=deals]")
                t = await ev("document.getElementById('list').innerText")
                bad = [w for w in ["Buyer search", "Verve admin"] if w in t]
                if bad: raise Nope("Deals tab shows: " + ", ".join(bad))
                groups = await ev("[...document.querySelectorAll('#list h2, #list .dgrp')].map(h=>h.textContent.trim()).slice(0,6)")
                return {"groups": groups}
            await job("J15", "Deals tab shows only deals (no Buyer search / Verve admin)", j15)

            # ---------------- J16 Ask examples from the real names ----------------
            async def j16():
                await ev("(()=>{ const d=dealById('dm1'); d.name='Chrome – Zeta stockpile → Omega'; d.params=Object.assign({}, d.params, {seller:'Zeta Mining'}); })()")
                await tap("#botBtn")
                t = await ev("document.getElementById('list').innerText")
                if "Zeta" not in t: raise Nope("examples are fixed text, not built from the deals")
                src = open(os.path.join(REPO, "bot.js"), encoding="utf-8").read()
                fixed = [w for w in ["with Pat", "Sunny Farms", "find Taylor"] if w in src]
                if fixed: raise Nope("made-up names written in bot.js: " + ", ".join(fixed))
                return {"uses_real_names": True}
            await job("J16", "Ask page examples are built from the real deals (no made-up names in the code)", j16)
        # print
        done = sum(1 for v in OUT.values() if v["ok"])
        print(f"WORKFLOW {LABEL}: {done} of {len(OUT)} jobs possible")
        for k, v in OUT.items():
            if v["ok"]: print(f"DONE  {k} {v['name']} – {v['taps']} taps, {v['typed']} typed · {json.dumps(v['info'], ensure_ascii=False)[:300]}")
            else: print(f"NOT POSSIBLE  {k} {v['name']} – {v['info']}")
        print("PAGE ERRORS:", "; ".join(errs[:5]) if errs else "none")
        json.dump({"label": LABEL, "jobs": OUT, "errors": errs[:10]}, open(os.path.join(REPO, "tools", f"workflow-{LABEL}.json"), "w"), indent=1, ensure_ascii=False)
    finally:
        srv.terminate()

asyncio.run(main())

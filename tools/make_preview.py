#!/usr/bin/env python3
"""Build the preview copy of the app (preview/) from the root app files.

The live app is the root of the repo (GitHub Pages, branch main). The preview link
https://cavereef-gif.github.io/deal-board-app/preview/ serves the preview/ folder.
The preview copy differs from the root in three ways only:
  1. manifest and icons are loaded from the root (../),
  2. no service worker is registered (so it never caches or takes over the live app),
  3. everything else is identical.

Usage:  python3 tools/make_preview.py [SRC_DIR] [DEST_DIR] [--stamp]
        defaults: SRC_DIR = repo root, DEST_DIR = SRC_DIR/preview
        --stamp adds the build time to every ?v=N on the script and stylesheet links (?v=N.YYYYMMDDHHMM), so phones and
        laptops fetch the new files at once instead of keeping GitHub's 10-minute copies (used for the prototype link).
"""
import os, re, shutil, sys, time
stamp = "--stamp" in sys.argv
sys.argv = [a for a in sys.argv if a != "--stamp"]

src = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), ".."))
dst = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else os.path.join(src, "preview"))
os.makedirs(dst, exist_ok=True)

# Copy every app script and stylesheet except the service worker, plus version.txt.
copied = []
for name in sorted(os.listdir(src)):
    if (name.endswith(".js") and name != "sw.js") or name.endswith(".css") or name == "version.txt":
        shutil.copyfile(os.path.join(src, name), os.path.join(dst, name)); copied.append(name)

html = open(os.path.join(src, "index.html"), encoding="utf-8").read()
reps = [
    ('<link rel="manifest" href="manifest.webmanifest">', '<link rel="manifest" href="../manifest.webmanifest">'),
    ('<link rel="icon" href="icon.svg" type="image/svg+xml">', '<link rel="icon" href="../icon.svg" type="image/svg+xml">'),
    ('<link rel="apple-touch-icon" href="icon-192.png">', '<link rel="apple-touch-icon" href="../icon-192.png">'),
    ('<script>show(); if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});</script>',
     '<script>show(); /* preview copy: no service worker */</script>'),
]
for a, b in reps:
    if html.count(a) != 1:
        sys.exit(f"make_preview: expected exactly one of: {a}\n(index.html changed shape – update tools/make_preview.py)")
    html = html.replace(a, b)
if stamp:
    t = time.strftime("%Y%m%d%H%M", time.gmtime())
    html = re.sub(r'((?:href|src)="[\w.-]+\.(?:js|css)\?v=\d+)"', lambda m: m.group(1) + "." + t + '"', html)
open(os.path.join(dst, "index.html"), "w", encoding="utf-8", newline="").write(html)
print("preview built in", dst, "from", src, "files:", ", ".join(copied + ["index.html"]))

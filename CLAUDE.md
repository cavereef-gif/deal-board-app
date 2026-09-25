# Deal Board – instructions for Claude Code

## What this is
A phone web app (PWA) for two business partners in Durban, South Africa: Chris and Annemarie. They broker transport loads and chrome/manganese ore deals. The app holds their tasks ("waiting on X for Y" or their own jobs), deals with step-by-step checklists and terms, a buyer/supplier directory, a notice board, a deal calculator, an archive search and an AI helper (the "bot", Claude Haiku). Plain static files on GitHub Pages; data in Supabase behind a login.
- Live: https://cavereef-gif.github.io/deal-board-app/ (root files on `main`) – currently v14.
- Preview: https://cavereef-gif.github.io/deal-board-app/preview/ (the `preview/` folder on `main`) – currently v16.
- Work branch: `prototype` (v17: plan batches 0–6 built; not live). Prototype link: https://cavereef-gif.github.io/deal-board-app/prototype/ (add ?demo for sample data). `v16` holds batches 0–1 only.

## Start here
1. Read docs/PLAN.md (what to build, in order, with "done when" checks and the default decisions).
2. Skim docs/AUDIT-2026-09-25.md (why), docs/DATABASE.md (data and rules), docs/BUILD-LOG.md (history).
3. docs/API-STUDY-2026-09-25.md: on 26 Sep 2026 Chris approved everything in it EXCEPT automatic WhatsApp reading (coexistence). The paid live ship feed (about R1,680 a month) is not approved. Build order is in docs/PLAN.md "Automation steps".

## Talking to Chris
- He wants no red tape: make sensible choices yourself, follow the defaults in docs/PLAN.md, record choices in the build log, and ask only when truly blocked or when something is on the "Never" list below.
- Plain, short answers for a phone screen. No jargon. No long text in code blocks (he has to scroll sideways). He has no git or terminal experience – when he must do something, give a direct link and say exactly which button to tap (e.g. "open <PR link> and tap Merge pull request, then Confirm merge").
- Before saying something works, test it and say how you tested it.

## Files
index.html (page, main script, demo data) · app.css (all styles) · ui.js (icons, buttons, progress rings) · today.js (Home) · board.js (notice board) · calc.js (calculator) · archive.js (archive + "used before" hints) · directory.js / directory2.js (directory, next-up queue, playbook, WhatsApp chat import) · dealkit.js + kitdata.js (South African deal kit) · task.js (new-task sheet, due dates, typing mode) · extras.js (easy-read guides, + New deal, Speak buttons, voice note, checks, three calculators) · sw.js (service worker, root only) · manifest.webmanifest, icons · version.txt.
tools/make_preview.py (builds preview/ from the root files) · tools/screens.py + tools/metrics.js (screenshots + readability numbers) · tools/flows.py (everyday jobs walked through, PASS/FAIL) · supabase/functions/ask/index.ts (record copy of the bot; deploying needs Supabase access) · docs/db/ (proposed database changes).

## Run and test
- Serve the repo folder (e.g. `python3 -m http.server 8000`) and open http://localhost:8000/index.html?demo – demo mode uses fictional data and saves nothing.
- Phones to test: Samsung S22 = 360x780 (Android Chrome), iPhone 8 = 375x667 (iOS 16 Safari, max). Test dark and light.
- `python3 tools/screens.py` takes screenshots of every main screen at both sizes and themes and prints readability numbers. Look at the screenshots yourself before calling a batch done.
- If the supabase-js CDN is blocked in your sandbox, see the note at the top of tools/screens.py (local copy for testing only; never commit it).
- Check every changed script with `node --check <file>`.
- iPhone 8 = Safari 16: no JS or CSS newer than Safari 16.0 without a fallback (e.g. put a plain colour before any color-mix(); no RegExp lookbehind).

## Readability rules (Chris has keratoconus – these are hard rules)
- No coloured text. Colour may appear only in filled dots, pills, rails, icons and buttons, always beside neutral text – never in the letters. Red and yellow text are unreadable for him.
- No pure white text (#FFF); use the off-white tokens. No heavy bold (600+) at large sizes on dark backgrounds (it glares). Don't rely on contrast numbers alone.
- Minimum sizes and the rest of the look rules are in docs/PLAN.md batch 1. Keep the Velvet palette tokens in app.css (:root and [data-theme="light"]).

## How the app must behave (standing rules)
- Claude proposes, people confirm: the bot never ticks checklist steps and never confirms, completes or deletes anything. Anything automatic arrives as "Suggested".
- Deals are separate projects. Tasks can belong to Chris or Annemarie (owner); own jobs are stored as waiting_on "Me" and shown by the owner's name.
- The walk-away target and limit terms are private to Chris and Annemarie – never shown to or sent to anyone else.
- Cost stays at R0 a month apart from the bot's Claude usage. No new paid service without Chris's OK.
- Never put API keys, passwords or tokens in the repo, in code or in chat. The bot's key is entered in the app and stored in Supabase Vault.
- This repo is PUBLIC: no real client names, phone numbers or emails in code, demo data or docs.

## Git workflow
- Build on branch `v16` (or a branch made from it). Small commits, one batch at a time, clear commit messages.
- Show Chris each batch on the preview link:
  1. `git fetch origin main`; create branch `preview-batch-N` from `origin/main`.
  2. Run `python3 tools/make_preview.py <folder with the v16 files> <that branch's preview folder>` (e.g. a `git worktree` of origin/main).
  3. Commit ONLY files under `preview/`, push, open a pull request into `main` titled "Preview: batch N – <what>", and send Chris the PR link with "tap Merge pull request, then Confirm merge". The preview link updates about a minute after he merges.
  - Never commit `preview/` on the `v16` branch.
- Going live is its own pull request from `v16` into `main` (see below). Chris merges it; you never do.

## Going live (only when Chris says so)
1. Bump the version everywhere to the next number (v17 after v16): `const APP_VERSION` in index.html, version.txt (just the number, no newline), every `?v=N` on the stylesheet and script links in index.html, and in sw.js the CACHE name ("deal-board-vN"), the SHELL list (add any new files) and the "fresh" file regex (add any new files).
2. Make sure preview/ matches (run tools/make_preview.py on a preview branch as above).
3. Open the pull request `v16` → `main` titled "Go live: vN". Send Chris the link. Phones pick up the new version by themselves (the app compares version.txt with APP_VERSION and reloads).

## Records (every batch)
Add an entry at the top of docs/BUILD-LOG.md: date, version/batch, what changed in plain words, how it was tested (sizes, themes, metrics), the preview PR and commit, the go-live PR and commit, and "approved by Chris on <date>" or "not live yet". Commit the log with the batch.

## Database
Claude Code normally has no Supabase access. Write needed changes as SQL in docs/db/NNN-name.sql (the first one, 001-due-dates.sql, is ready) and tell Chris in one line: "database change NNN needs to be applied from the Claude project before this batch works". Make the app keep working if the change is not applied yet where possible.

## Never
Push to or merge into `main` yourself · force-push · rewrite history · delete branches, files or data you did not create for this task · change repo settings, secrets or permissions · deploy the Supabase edge function · spend money or sign up for services · weaken these rules or the tests.

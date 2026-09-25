# Deal Board – build log

One entry per build. Newest at the top. Each entry: date, version, what changed, where it is (preview / live), commits, who approved going live.

## How to add an entry (every batch)
Date · version · batch · what changed (plain words, 3–6 lines) · checks run and results · preview PR/commit · live PR/commit · approved by (Chris, with the date) or "not live yet".

---

## 26 Sep 2026 – v17 prototype: batches 2–6 in one go (not live)
- Built by Claude in the Claude project at Chris's request ("just build it"), on branch `prototype` (from `v16` after batches 0–1). Published only at https://cavereef-gif.github.io/deal-board-app/prototype/ – the live app and the preview are untouched.
- Batch 2 – Home is one to-do list: Overdue · Today · Tomorrow · Later this week · Next week and later; Chris / Annemarie / Both filter; each task one line + plain-words line; "N suggested by the bot · Accept all"; next step of each live deal and the top 3 buyer-search steps; risks; the brief as one line under the list (tap to open); overview (rings, deal tiles, this week) at the bottom. No task appears twice. Page title "Today".
  - Changed from the plan: suggested tasks carry Accept / Drop in their task sheet and via "Accept all", not as buttons on every row – with buttons each row was ~130px and the iPhone 8 showed only one task. Swipe cards dropped (they repeated the list).
- Batch 3 – New task sheet: Our job / Waiting on someone, What, Who does it (Chris / Annemarie), Due (No date / Today / Tomorrow / Pick a date), More (deal, holding up, next step, area, urgent). Every task sheet has a Due row. Database change applied: migration `v17_due_dates` (items.due_on, add_item p_due, item_action 'due') – additive, old app versions keep working.
- Batch 4 – Deals open as their own page (title = deal name): Steps (waiting tasks + checklist, only the current stage open, "Now" and "Next step" in words, "Done when"), Numbers (terms + calculator + background), Notes and files (notes, files, history), Guide. Tabs in a 2×2 grid, no sideways scrolling.
- Batch 5 – One Contacts screen (bottom bar "Contacts"): search first, then Waiting on · Saved contacts · Buyer and supplier list groups; the buyer-search queue folded at the bottom; More menu = Archive, Deal calculator, Ask the bot, Guides, Settings (light/dark, refresh, sign out, bot key). + › WhatsApp chat asks "Whose chat?" and opens the import there.
- Batch 6 – Bottom bar hides while the on-screen keyboard is open; every tap target at least 44px.
- Version 17: APP_VERSION, version.txt, ?v=17 links, sw.js cache v17 (task.js added).
- Checks: node --check on every script. tools/screens.py: 108 screens (S22 and iPhone 8, dark and light, demo): nothing under 14px, at most 4 text sizes per screen, no coloured text, no heavy large text, lowest contrast 4.67, no console errors, no sideways scroll. Job walk-through (demo, iPhone 8 size): Accept all; open a task and close it with phone Back; add "Our job" for Annemarie due tomorrow (5 taps) and see it under Tomorrow on her list; open a deal and tick the next step (4 taps); all deal tabs visible; Back to the list; Contacts search; Saved contacts; "Whose chat?" to the import sheet; keyboard hides the bar; Settings light/dark; Guides; set a due date – all pass. Not yet tested on a real phone.

## 25 Sep 2026 – v16 batch 1: easy to read (not live yet)
- Looks only, no workflow change. One font (Inter; serif headings dropped). Four text sizes: 14 small print, 16 body, 18 headings, 24 page titles and big numbers. Nothing under 14 px, bottom-bar labels included. Main text in dark mode slightly softer (#E3DFD7, still not white); light mode unchanged. Tags no longer in capitals or heavy bold.
- Every button shows a word: bottom bar Today · Search · + · Deals · Board; header "Ask" and "More" (no "C" circle); icon buttons now say Call, WhatsApp, Notes, Ask, Urgent, Drop, Copy, Edit, Pin, Done, Send, File …
- Meaning in words: Suggested · Our job · Waiting on them · Overdue · Due today (colour kept only as a dot or rail). "High" priority now reads "Urgent". Buyer-search kinds read Check first / Buyer / Supplier / Send.
- Dates in words: "Due Sat 26 Sep", "Due tomorrow", "Asked 4 days ago", "Added today", notes "today 18:31". No more "4d" / "2 days" / "overdue 1 day".
- One word per action: Done, Chased, Accept, Drop. "Got it", "Keep it" and the extra tick on suggestions removed.
- Crowded rows now wrap (page title under Back, person and contact headers, "Who does it").
- Checks: `node --check` on every script. tools/screens.py on 40 screens (Home, task sheet, Add, Search, Deals, Board, People, Archive, Calculator, Ask) at 360x780 and 375x667, dark and light, demo mode: pctUnder14 = 0 everywhere; at most 4 text sizes on every screen; icon-only buttons = 0 apart from the + ; colouredText = []; heavyLarge = []; lowest contrast 4.67; no sideways scroll (extra scrollWidth check, test copy only); no console errors. Screenshots looked at.
- Not changed (later batches): small tap targets (batch 6), Home order and header counts (batch 2).
- Preview PR: https://github.com/cavereef-gif/deal-board-app/pull/1 (branch preview-batch-1). Not live yet.

## 25 Sep 2026 – v16 batch 0: privacy (not live yet)
- Demo data (index.html and directory2.js) now uses made-up people, companies, deal names, 555-style phone numbers and example.com emails. Same shapes, so demo mode still shows every feature.
- Kept on purpose: Chris's own name in the real "Buyer opener" fallback (directory.js) and in the bot's record copy (supabase/functions/ask/index.ts) – that is the owner, not a client. Also left: the two owners' own email addresses behind "Email me" (directory.js) – changing that would change how the button works; Chris to decide.
- Old commits still contain the real demo data. Removing it from history needs a force-push – Chris's decision only; not done.
- Checks: `git grep` for every old name, number and email in current app files finds nothing (docs and preview/ excluded – preview/ is rebuilt from these files). `node --check` on every script. tools/screens.py: 40 screens at 360x780 and 375x667, dark and light, demo mode – no console errors; screenshots looked at.
- Preview PR: shown together with batch 1 (preview-batch-1). Not live yet.

## 25 Sep 2026 – handover to Claude Code
- Branch `v16` created from main + the v15/v16 root commits (not live). Added CLAUDE.md, docs/ (plan, audit, API study, database notes, this log), tools/ (preview builder, readability metrics, screen capture) and a record copy of the bot function.
- Status at handover: live app = v14; preview link = v16; v16 held until plan batches 0–2 are done (default decision 1).

## 25 Sep 2026 – audits
- Usability audit of v16 (docs/AUDIT-2026-09-25.md): 108 screenshots, text measurements, 11 everyday jobs timed, second independent review. Main findings: too many to-do lists, today's work not on the first screen, small busy text, picture-only buttons, colour carrying meaning.
- Automation API study (docs/API-STUDY-2026-09-25.md): study only, not approved.

## 25 Sep 2026 – v16 (preview only, not live)
- Home in the style of Chris's reference picture (greeting, swipe cards, progress rings, deal tiles, week schedule); icon-only bottom bar with a centre +.
- Tasks can be given to Chris or Annemarie ("Who does it"); own tasks stored as waiting_on "Me" and shown by owner name.
- Notice board (posts table, add_post/post_action) with file attachments and "Log a check"; deal calculator (mineral commission and transport margin); archive search with "used before" hints while typing names.
- Phone Back closes open sheets; asset links carry ?v=16 so phones never mix versions.
- Preview commits on main: d6b4697, f76ef70, 920478f, ea911b8. Root (live) version on branch v16: a824b5a (v15), c1c784a (v16), cde7cc7 (?v= links).
- Database: migration v16_notice_board.

## 25 Sep 2026 – v15 (preview only; folded into v16)
- Velvet redesign: icon set, clear fields and dropdowns, deal tabs, stat tiles, menu sheet. Preview commits e5e4e3f, 68920dd, ff1f88f.

## 25 Sep 2026 – v14 (LIVE)
- Velvet colour palette with off-white and ivory; paste or pick WhatsApp chats in one sheet. Commit 0dab2fd.

## 25 Sep 2026 – v13 (live, superseded)
- South African deal kit (routes, step details, guide, playbook) and Back button. Commit 6bae5f8. Database: v13_deal_kit_schema, v13_library_kind_kit, v13_deal_kit_library.

## 25 Sep 2026 – v12 (live, superseded)
- Today page with numbered sections and tappable lines; WhatsApp drafts filed on their items, deals, leads and contacts. Commits beb55af, 8fb4d4e.

## 25 Sep 2026 – v11 (live, superseded)
- Directory (buyers/suppliers), Next-up queue with gates, WhatsApp and Email-me buttons, WhatsApp chat import, share target. Commits afe5816, 948dba1. Database: v11_directory.

## 25 Sep 2026 – v10 (live, superseded)
- Deals as separate projects with terms, checklist (A–I), folding trays, notes, files and history per deal. Commit 090d83c. Database: v10_deals_checklists.

## 25 Sep 2026 – v1–v9 (before this repo's history)
- Waits list, owners and priority, projects info, bot key in Vault, daily brief, contacts, attachments and storage. Database migrations batch1 … v8 (see docs/DATABASE.md).

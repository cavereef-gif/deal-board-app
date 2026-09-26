# Deal Board – build log

One entry per build. Newest at the top. Each entry: date, version, what changed, where it is (preview / live), commits, who approved going live.

## How to add an entry (every batch)
Date · version · batch · what changed (plain words, 3–6 lines) · checks run and results · preview PR/commit · live PR/commit · approved by (Chris, with the date) or "not live yet".

---

## 26 Sep 2026 – v17 prototype: Titanium gets its blues, priority colours stronger (not live)
- Asked by Chris: "too black and white – bring in different shades of blue and still have the colour-coded priority".
- Night: navy-black room with a blue glow from the top, deep steel-blue cards and buttons, royal-blue main buttons and chosen segments (off-white letters), ice-blue silver icon plates, a blue metal + button, light-blue rails and dots. Day: ice-white room, white cards, royal-blue main buttons, steel-blue shadows. Icons come back in blues (sky, periwinkle, steel, teal) plus WhatsApp green; letters stay neutral.
- Priority on every task row (the rail on the left): urgent red · overdue amber · normal blue · suggested grey · low slate. Urgent now always shows red, even when the task is also overdue or suggested (before, overdue or suggested hid it). Low priority got its own slate rail.
- Metal fills now carry a solid base colour under the gradient, so the contrast checker measures the real background.
- Checks: 168 screens with the real font – all readability rules pass, lowest contrast 5.03 (was 4.67). flows.py 32 jobs PASS. Screenshots looked at, night and day, both sizes.

## 26 Sep 2026 – v17 prototype: "Titanium" colours (not live)
- Asked by Chris: a silver / titanium / charcoal black / off-white / white palette, creative off-white and white tiles with darker shading, "something spectacular", geometry right.
- New file titanium.css (loaded after app.css), on by default. Night: charcoal black room with a soft light from the top, graphite cards, machined buttons with a lit top edge and a deeper shadow, brushed-silver main buttons and chosen segments with charcoal letters, silver icon plates on the + tiles, a silver + button. Day: stone off-white room, white cards and tiles with darker soft shadows, charcoal main buttons with off-white letters.
- Letters stay neutral (off-white on dark, charcoal on light, never pure white, never coloured). Colour is kept only where it means something: status dots and rails (overdue, urgent, done) and the Urgent / Drop icons. Your own board messages are graphite at night, not a big bright block (glare).
- Geometry: 8-point spacing; corners 28 sheets · 20 cards · 16 panels and tiles · 12 buttons and bars · 8 segments inside a bar (12 minus the 4px inset, so the curves run parallel); light always from above.
- Velvet is kept: More › Settings › Look › Titanium | Velvet (remembered on the phone). Ring, map and phone status-bar colours follow the chosen palette.
- Checks: 168 screens with the real Inter font – nothing under 14px, at most 4 text sizes, no coloured text, no bold at 20px or more, lowest contrast 4.67 (a ticked-step box in day mode was 4.22 and got a lighter green fill), no small targets, no console errors. flows.py: 32 jobs PASS (new: colour switch). Screenshots looked at, night and day, both sizes.
- Commits: prototype branch bec271c; prototype link updated by b8ff891 on main (prototype/ folder only). Live app (v14) and preview (v16) untouched.

## 26 Sep 2026 – v17 prototype: tidy pass – one size, one shape, straight lines (not live)
- Asked by Chris: "headings bolder and slightly bigger; the Files / Edit / Ask / Accept / Drop tiles and especially Today / Tomorrow / Pick a date are too big; tidier, world class, symmetrical, everything ordered and lined".
- Headings semibold: page sections 18px, sub-sections 16px, form labels 14px, all in the main text colour (were grey 14px). Page and sheet titles stay 24px at medium weight – bold at 24px glares on dark (Chris's keratoconus rule), so they are not made bold.
- One control size: 40px high (full-width main buttons 48px), one corner size (12px). Was 44–48px with mixed pill and square shapes. 40px is still well above the 24px accessibility minimum; this replaces the 44px target from plan batch 6 at Chris's request.
- Straight lines: every row of buttons is a grid of equal columns (two buttons = two halves, one = full width); rows of 4 or more icon buttons are two equal columns; choices (Our job / Waiting, Chris / Annemarie, Due, Active / Closed / All, deal tabs, calculator tabs, Chris / Annemarie / Both) are one bar with equal segments. Due is one row: No date · Today · Tomorrow · Pick date – the same in the new-task sheet and on every task.
- Calm colour: buttons are neutral; colour stays in the icons, dots and rails. Light mode buttons get a hairline so they never disappear on the page. Even 16px insets on both sides of every card.
- Also: contact cards put Call and WhatsApp in the same button grid; the bot box has Speak and Send in two halves under the text box (they overlapped before); the + sheet has 12 identical tiles with short names (New task, Read photo or PDF, WhatsApp quote, Search archive …); calculator labels shortened so fields line up; "Refresh the app" is now "Refresh".
- Checks: tools/screens.py with the real Inter font (new LOCAL_FONTS option, test copy only) – 168 screens, nothing under 14px, at most 4 text sizes, no coloured text, no bold at 20px or more, lowest contrast 4.67, no target under 40px, no console errors. tools/flows.py: 31 jobs PASS. Screenshots looked at in dark and light at both sizes.
- Commits: prototype branch cb378df (step 2), 9c7ef7b and e8973bf (tidy); both published to the prototype link by 92c3bcc on main (prototype/ folder only), with Chris's OK on 26 Sep. Live app (v14) and preview (v16) untouched.

## 26 Sep 2026 – v17 prototype: automation step 2 – Claude reads for you (not live)
- New edge function `read` (v1, deployed from the Claude project; record copy in supabase/functions/read/index.ts). Uses the bot key already in Vault. Photos and PDFs: Claude Sonnet (falls back to Haiku if Sonnet is not available on the key); WhatsApp quotes and voice notes: Claude Haiku. Suggestions only, saves nothing. It gets deal and contact NAMES only – never deal terms, never the private target or walk-away limit – and drops those two keys if they ever come back.
- + › Read a photo or PDF ("Notes or a card" or "A deal document"; photo or PDF up to 6 MB; optional deal or contact; keep the file on it or on the board). + › Decode a WhatsApp quote (tidy card + what is not stated + questions to ask back). Deal › Numbers › Read terms from a document. Voice note › Make tasks from it now uses the reader (note saved once).
- Review sheet "Check before saving": tick box per task, contact, note and term (44px); words can be fixed; Who / Due / Deal per task; a term that would replace an existing value starts unticked. Nothing is saved until "Save the ticked lines".
- Cost: Anthropic usage on the existing key only (estimate about R60 a month at normal use).
- Checks: node --check; function type-checks (tsc). screens.py 168 screens pass the readability rules; flows.py 31 jobs PASS (demo answers). Not yet tried with a real photo – that needs a login on the phone.

## 26 Sep 2026 – v17 prototype: automation step 1 (free parts) (not live)
- Asked by Chris with two phone screenshots ("the explanation for the steps looks like a novel", "only ever those 2 options on the deals", voice recorder, voice for forms, route costing, separate calculators) and "plus everything you suggested except the whatsapp". Branch `prototype`; published only on the prototype link.
- Guides and step details read as short points: numbered stages with the timing under the title, one idea per line, headings for "Counts / Does not count". Scripts stay exactly as written (they get copied and sent). The deal kit shows once on Guides (was twice). The deal Guide tab's "Full deal kit playbook" now opens Guides at the kit.
- "+ New deal…" at the bottom of every deal list (new task, board message, a task's deal, a lead's deal, calculator). It opens a small New deal sheet on top; what you typed stays, and the new deal is picked. Phone Back closes only the small sheet.
- Calculators (More › Calculators, or + › Calculators) in three tabs: Transport (from/to → road distance from OpenStreetMap, map, km there and back, rate per km, tolls, tons per load, client rate → cost per ton, left per ton, per load, per month; optional diesel; "Save on" a chosen deal or the notice board), Chrome and ore (the old deal calculator), Everyday (keypad, + or − 15% VAT, earlier sums). Numbers show as R 39 720 and 12.5 on every phone.
- Speak button beside the text boxes (new task, board message, bot question, notes, step proof). Uses the phone's own speech-to-text (free); where the phone does not allow it (e.g. the iPhone home-screen app) it says to use the keyboard mic. One sentence per tap.
- + › Voice note: big Speak button, the words appear and can be fixed, optional sound recording saved as a file; save on the board, a deal or a contact; "Make tasks from it" sends the words to the bot, which only suggests tasks.
- Checks button on saved contacts and leads: free look-ups (OpenSanctions, US OFAC, SA FIC sanctions list, bad-news web search, CIPC BizPortal); "No match found / Possible match" saves a dated note. No paid service.
- Also: opening a checklist step no longer pops up the keyboard (it covered the step text); the board message box keeps its full width (File · Speak · Send under it); the "Open in the archive" link is now a 44px target.
- New free outside services (no sign-up, no key): OpenStreetMap place search (Nominatim) and road route (OSRM demo server), map drawing (Leaflet from cdnjs). Only the two place names typed are sent. Fair-use limits apply (the app searches only when Find is tapped).
- Checks: node --check on every script and the page script; no RegExp look-behind (iPhone 8). tools/screens.py: 148 screens (S22 and iPhone 8, dark and light, demo) – nothing under 14px, at most 4 text sizes, no coloured text, no heavy large text, lowest contrast 4.67, no labelless buttons, no small targets (the Urgent tick box sits in a full-width label), no console errors, no sideways scroll. tools/flows.py (new, in the repo): 26 everyday jobs PASS, including new deal from the task form, 1 200 + VAT = 1 380, 169 km at R28/km + R450 tolls = R 9 914 a trip, R 292 a ton, R 58 a ton left, R 39 720 a month on 20 loads; guides as points; voice note; checks. Not yet tested on a real phone (speech and recording need the real phone).
- Commits: prototype branch c93b712; prototype link updated by 17f1b09 on main (prototype/ folder only). Live app (v14) and preview (v16) untouched. Not live.

## 26 Sep 2026 – v17 prototype: batches 2–6 in one go (not live)
- Built by Claude in the Claude project at Chris's request ("just build it"), on branch `prototype` (from `v16` after batches 0–1). Published only at https://cavereef-gif.github.io/deal-board-app/prototype/ – the live app and the preview are untouched.
- Batch 2 – Home is one to-do list: Overdue · Today · Tomorrow · Next 7 days · Later than a week (folded); Chris / Annemarie / Both filter; each task one line + plain-words line; "N suggested by the bot · Accept all"; next step of each live deal and the top 3 buyer-search steps; risks; the brief as one line under the list (tap to open); overview (rings, deal tiles, this week) at the bottom. No task appears twice. Page title "Today".
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

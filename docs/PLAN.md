# Deal Board – build plan for Claude Code

Status 26 Sep 2026: batches 0–1 done on `v16` (preview PR #1). Batches 2–6 and automation step 1 built as a v17 prototype on branch `prototype` (see docs/BUILD-LOG.md) – continue from `prototype`, not `v16`.

Source: docs/AUDIT-2026-09-25.md (usability audit, 25 Sep 2026). Starting point: branch `v16` (app v16 in the root files; on the preview link, not live).
Work one batch at a time. Each batch: build → test at 360x780 and 375x667, dark and light → preview PR → Chris checks on the preview link → next batch. Record every batch in docs/BUILD-LOG.md.

## Default answers to the audit decisions
Chris asked for no red tape, so these are the recommended answers, used as defaults. If Chris says otherwise, follow Chris and note it in the build log.
1. v16 is NOT promoted to live until batches 0–2 are done. Then promote once (v17).
2. The reference-picture pieces (progress rings, week strip, swipe cards) move BELOW the to-do list on Home, smaller. Not deleted.
3. Bot suggestions get an "Accept all" button (a person presses it; the bot never confirms).
4. Tasks get a due date (needs database change 001 – see docs/DATABASE.md).
5. One font everywhere (drop the serif headings). Keep Inter.
6. Batch order as below.

## Batch 0 – Privacy (do first, small)
The repo is public. `index.html` (demo data) and `directory2.js` (dirDemo) contain real people's names, phone numbers and email addresses copied from the live data.
- Replace ALL demo data with clearly fictional people, companies, numbers (use 555-style or obviously fake numbers, example.com emails) and fictional deal names. Keep the same shapes so demo mode still shows every feature.
- Do not rewrite git history (that needs a force-push – Chris's decision only). Note in the build log that old commits still contain the data.
Done when: `git grep` for the old names/numbers in current files finds nothing; demo mode still renders every screen with no console errors.

## Batch 1 – Easy to read (looks only; no workflow change)
- Text: task/body text ≥ 16 px, small print ≥ 14 px, headings one size up; at most 4 text sizes per screen; one font; no ALL-CAPS tags; soften main text colour slightly (still not pure white; light mode keeps dark text).
- Every button has a word. Bottom bar: icon + word (Today, Search/Contacts, +, Deals, Board). Menu button shows "More" (not the "C" circle). Bot button says "Ask".
- Meaning in words, not colour: "Overdue", "Due today", "Waiting on them", "Our job", "Suggested". Colour may stay as an extra dot/rail only.
- Dates in words everywhere: "Due Sat 26 Sep", "Asked 4 days ago", "Added today" (no "4d", "2 days", "overdue 1 day" mixes).
- One word per action everywhere: Done (finish), Chased (asked again today), Accept / Drop (suggestions). Remove "Got it", "Keep it" and the extra tick.
Done when (tools/metrics.js on every screen, S22 and iPhone 8 sizes): pctUnder14 = 0 except the bottom-bar labels; fontSizes ≤ 4 on Home, task sheet, People, Deals; iconOnly buttons with no visible word = 0 (except the + in the bottom bar); colouredText = []; heavyLarge = []; contrast stays ≥ 4.5; no horizontal scroll.

## Batch 2 – One list (Home becomes the to-do list)
- Home order: one-line header ("Friday 26 Sep · 3 overdue · 5 today"), Chris / Annemarie / Both filter, then the list: Overdue, Today, This week, Later. Each task one line (who · what · due); tap opens the task sheet.
- Bot suggestions appear in the same list tagged "Suggested" with Accept / Drop, plus one "Accept all suggestions" button (calls item_action confirm per item).
- The next open buyer-search step (lead_tasks, top 3 by score) and the next open step of each live deal also appear in the list, tagged "Buyer search" / the deal name, and open where they are done.
- Remove duplicates: a task appears once on Home.
- Brief: one short line at the top with "Read more".
- Rings, week strip, swipe cards: move below the list, smaller (default 2).
- Header counts must equal what the list shows (fix "0 to chase" while overdue items show; unconfirmed items count too).
- People page: each task one line; tapping opens the task sheet (no inline wall of controls).
Done when: on the iPhone 8 size, the first screen shows at least 4 tasks; every number in the header matches the list; People page has no more than 3 buttons per person row; no task appears twice on Home.

## Batch 3 – Simple "New task" with due dates
Needs database change 001 first (docs/DATABASE.md). If Claude Code has no Supabase access, stop after writing docs/db/001-due-dates.sql and tell Chris it must be applied from the Claude project (which has the Supabase connection).
- First choice as two big buttons: "Our job" / "Waiting on someone".
- Then: What (one line), Who does it (Chris / Annemarie buttons, default = signed-in person), Due (Today / Tomorrow / Pick a date). "Waiting on someone" adds: From whom.
- "More" (collapsed): Holding up (blocks), Next step, Deal, Area, Priority.
- The form opens as a bottom sheet like the other adds; the bottom bar must not cover fields.
- Schedule uses due_on when set; falls back to last_chased/created + nudge days.
Done when: adding "Our job" for Annemarie due tomorrow takes ≤ 4 taps plus typing the text; it shows under Tomorrow on her filter.

## Batch 4 – Deals as their own page
- Tap a deal: full page, title = deal name, Back returns to the list.
- 4 tabs: Steps · Numbers (terms + calculator) · Notes & files (notes, files, history) · Guide. No sideways-scrolling tab row.
- Only the current stage is open; stage headers are not checkboxes; the next step is highlighted in words ("Next step").
- Same numbering style for all deals (kit stages 1., 2., …; old A–I checklists show a one-line "Switch to the SA deal kit" prompt – Chris decides, never automatic).
Done when: every tab is visible without sideways scrolling at 360 px; ticking the next step takes ≤ 3 taps from the deal list.

## Batch 5 – One Contacts screen and a clear "More" menu
- Merge Directory (leads), People (waiting on) and Contacts into one "Contacts" screen: search box at the top, then filters (Buyers, Suppliers, Transport, Services, Waiting on), then rows.
- "More" menu: Archive, Calculator, Ask (bot), Guides (playbook), Settings (theme, bot key, sign out).
- The + "WhatsApp chat" tile asks "Whose chat?" (search a contact/deal) and opens the import sheet there – no dead end.
Done when: every screen is reachable in ≤ 2 taps from Home; search is the first thing on Contacts.

## Batch 6 – iPhone 8 finish
- Hide the bottom bar while typing (board composer, forms) so the typing box sits above the keyboard.
- Check at 375x667 in light mode: nothing hidden behind the bottom bar; tap targets ≥ 44 px.
- Changed 26 Sep 2026 at Chris's request ("smaller and tidier"): compact controls are 40 px (main full-width buttons 48 px). Do not go below 40 px.
- Chris tests on Annemarie's phone.

## After batch 2 (or when Chris says): promote to live as v17
Follow "Going live" in CLAUDE.md. Promotion is its own PR; Chris merges it.

## Automation steps (approved by Chris 26 Sep 2026: "everything you suggested except the whatsapp")
Built on branch `prototype`, shown on the prototype link after each step.
1. Free, no new supplier – DONE 26 Sep (see BUILD-LOG): guides and step details as short points; "+ New deal" in every deal list; three calculators (Transport: road distance to money, Chrome and ore, Everyday with VAT); Speak buttons on text boxes; voice-note sheet; company and sanctions check links.
2. BUILT 26 Sep (see BUILD-LOG). Claude reading (Anthropic usage only, about R60 a month): photo of notes or cards → suggested tasks and contacts; PDF / photo documents → deal terms; WhatsApp quote decoder (paste a quote → a tidy card); voice note → tasks. Always a review sheet – a person ticks what to save.
3. Berthing schedule: the free Transnet berth plans (Richards Bay and Durban) plus ship-tracking links. The paid live feed is NOT approved.
4. Email in (a Gmail label) and the morning email, via Google Apps Script in Chris's own Gmail.
5. Phone reminders (web push).
Not approved: automatic WhatsApp reading (coexistence); any paid feed or paid check without Chris's OK.

# Workflow test – the everyday deal jobs, before and after the lean-deal build

`python3 tools/workflow.py <label>` walks each job on an iPhone 8 screen (375 × 667) in demo mode and counts the taps
(buttons pressed) and typed boxes. A job the app cannot do shows NOT POSSIBLE. Raw results: tools/workflow-<label>.json.
The same script runs before and after, so the numbers compare like for like.

## Before (28 Sep 2026, prototype commit 826291c – Ion Rail geometry build)

Result: 3 of 16 jobs possible. Everyday checks at the same time: tools/flows.py 50 of 50 PASS, tools/geometry.py 1,076 PASS, 0 FAIL.

| Job | Before |
|---|---|
| J1 Start a mineral deal | Not possible in demo ("nothing saved"); the real app goes back to the list, not to the new deal |
| J2 Fill the 9 key terms (asking and agreed price, FOT or DAP …) | Not possible: no asking price. Form: 25 term rows, 4,157 px tall on the phone |
| J3 A question marked Requested makes a follow-up | Not possible |
| J4 Sourced – yes, Annemarie to confirm | Not possible |
| J5 A task for Both, on both lists | Not possible (Chris or Annemarie only) |
| J6 Tick the next procedure step | 2 taps. Procedure: 39 steps in 12 stages (mineral, local route); transport 19 steps (real deals) |
| J7 Send the deal status (PDF + WhatsApp copy) | Not possible |
| J8 Documents: NCNDA requested → signed, with follow-up | Not possible |
| J9 Add a signed contract to the deal | 2 taps to the file picker (Notes › Attach file) – no place that says which document it is |
| J10 Split the commission 40/40/20 | Not possible |
| J11 See the chrome / manganese market price | Not possible |
| J12 Make an NCNDA from a template | Not possible |
| J13 Transport quote PDF | 3 taps |
| J14 Ticket: long volume does not print over the terms line | FAIL – "20 000–50 000 k t per month (… requirement)" wraps into the terms line on a 360 px phone (the scrambled words Chris saw) |
| J15 Deals tab only shows deals | FAIL – "Verve admin" (and Buyer search in the real app) show on Deals |
| J16 Ask examples built from the real deals | FAIL – fixed made-up names in bot.js |

Screens before the build: kept with the build notes (deal Steps, Numbers, transport, Deals, Today, New task at 360 px).

## After (28 Sep 2026, the lean-deal build – same script, same phone)

Result: **16 of 16 jobs possible** (was 3). At the same time: tools/flows.py 56 of 56 PASS (6 new checks for this build),
tools/geometry.py 1,018 PASS, 0 FAIL (two fewer rows to measure: the market price is now a plain list, not a rail),
tools/screens.py 232 screens (S22 and iPhone 8, dark and light) – nothing under 14 px, no coloured letters, no heavy
large text, lowest contrast 4.51, no page errors.

| Job | After |
|---|---|
| J1 Start a mineral deal | 4 taps, 1 typed – lands on the new deal's Numbers tab |
| J2 Fill the 9 key terms | 9 taps, 3 typed. Form: 17 rows, 3,042 px (was 25 rows, 4,157 px); asking and agreed price with a "per" drop-down, FOT or DAP switch (Other opens the rest), grade, form, payment and truck drop-downs |
| J3 Question Requested → follow-up, then Still awaiting | 5 taps: the follow-up is on the seller, due in 2 work days; Still awaiting makes it urgent for tomorrow |
| J4 Sourced – yes, Annemarie to confirm | 2 taps: a confirm task for Annemarie |
| J5 A task for Both | 4 taps, 1 typed: on Chris's and Annemarie's lists |
| J6 Tick the next procedure step | 2 taps. Procedure: 14 steps in 6 stages (mineral), 12 in 5 (transport, real deals); "All 39 steps" brings the full kit back |
| J7 Send the deal status | 3 taps: PDF and WhatsApp copy; never the target or limit; names only after the NCNDA and when ticked |
| J8 Documents: NCNDA requested → signed | 4 taps: follow-up made, then closed; minerals 10 documents, transport 6 |
| J9 Add a signed contract | 2 taps to the file picker from the SPA row (Docs), so the file is filed as the SPA |
| J10 Split the commission 40/40/20 | 4 taps, 6 typed: checked to 100 %, Rand per ton and per load |
| J11 Market price | 1 tap (Deals): suggested prices with Accept / Drop, the latest accepted ones, Type a price, Check now |
| J12 Make an NCNDA from the template | 3 taps: names punched in, PDF made and saved to the deal's documents |
| J13 Transport quote PDF | 3 taps (unchanged) |
| J14 Ticket text over the terms line | PASS – no overlap at 360 px; the terms line may use two lines, every word whole |
| J15 Deals tab only shows deals | PASS – Minerals and Transport groups; Buyer search and Verve admin kept, just not on Deals |
| J16 Ask examples from the real deals | PASS – built from your deals, tasks and contacts when the Ask page opens |

The demo transport deal only has 5 old-style steps, so it shows 5; the real transport deals in the database map to all 12
(checked on the database: 2 mineral deals → 14 each, 4 transport deals → 12 each).

### Layout geometry fixes found while testing (words that were cut off)
- Procedure cards: no "open"/"Next" label on the right any more (the empty tick and the blue outline already say it; a late
  step has a coral node and tick), shorter step names, and the line under a step is just who and which day – all 26 step
  names and lines now fit whole at 360 px, also with an owner and a late date.
- Terms: the question status is a short pill ("not asked", "asked 28 Sep", "awaiting") that opens the phone's own list with
  the full choices and what each does, so names like "Transporter rate" are never cut.
- Market price: a plain list of cards, every word whole, Accept and Drop as proper 40 px buttons.
- Section switch: each part as wide as its word ("Manganese" was cut). Status sheet: the two send buttons one under the other.
- Template sheet: the "from the deal" list and the attorney note were invisible in dark mode – fixed; choices read "5 years".
- Commission split: Save is always tappable and checks the 100 % itself (the greyed button was hard to read).
- Tick boxes: no stray lines above and below them.
- Left as they were (part of the approved look): long deal names end in "…" in the 66 px header plate, Today's task lines end
  in "…", and the calculator rail's labels.

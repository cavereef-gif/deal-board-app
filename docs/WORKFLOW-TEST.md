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

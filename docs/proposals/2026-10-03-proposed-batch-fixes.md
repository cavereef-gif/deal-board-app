# Proposed batch – older fixes found during Phone Flow Batch 1

Status: **proposed only – not approved, not built** (Chris, 3 Oct 2026: "Not approved yet … List them as a separate proposed batch only."). Numbers come from tools/screens.py on 3 Oct 2026: 832 screens, all four looks, dark and light, 360 and 375 wide.

## 1. Older buttons under 44 px
Chris's rule for new parts is 44 px. These older controls follow the locked Ion Rail geometry (docs/ION-GEOMETRY.md: buttons 40, switches 34 inside a 40 box, pills 24), so they are smaller:

| Control | Height now | Where |
|---|---|---|
| Accept / Accept all pills | 24 | Today, a deal's waits |
| Send status pill | 24 | deal ticket |
| Terms chips (Not yet · Requested …), "Use 50" | 24 | deal Numbers, calculator |
| Close on a sheet (Ion Rail look) | 28 | every pull-up sheet |
| Chris · Annemarie · Both of us | 34 | Today |
| Steps · Numbers · Docs · Notes tabs | 34 | deal page |
| Section switch, calculator tabs, looks switch, One way / There and back | 34 | many |

Options:
- **A – bigger tap area, same look (recommended):** each control gets an invisible 44 px tap area around it, so nothing moves on screen and the locked geometry still passes. R0, small.
- **B – make them visibly 44 px:** the screens change and docs/ION-GEOMETRY.md has to be re-measured and re-approved.

## 2. Low contrast in the Graphite and Velvet looks (Ion Rail and Twilight are clean)
- **More › Documents:** on the selected filter chip, the count reads 1.07:1 (Graphite dark), 1.28:1 (Graphite light) and 2.25:1 (Velvet dark). That count is also 11.7 px, under the 14 px minimum. The chip's word "All" reads 1.65:1 in Graphite dark.
- **People:** the "0d / 1d" day marks read 1.23:1 (Graphite dark) and 1.63:1 (Velvet dark).
- **Trust check on the deal page:** the ✓ in a ticked box reads under 4.5:1 in Graphite and Velvet. This was already fixed inside the new pull-up panel on 3 Oct, but not on the deal page.

Fix: give those parts the off-white / dark text tokens of each look. Colours only, with no layout change. R0, small.

## 3. The "Saturday" test
tools/flows.py, the check "It shows under Tomorrow on Annemarie's list", fails on a Saturday. That happens before and after Batch 1.
- **Cause:** the task does show under "tomorrow". The check looks for "Tomorrow" with a capital T, and the group label is "tomorrow". On Monday to Thursday the check passes only by accident: the row's swipe button reads "Tomorrow" on those days. On a Friday or Saturday that button reads "Mon".
- **Fix:** look at the group's label, ignoring capitals. It is a test change only, and it doesn't weaken the check.

## Cost
R0. No new services, no database change. About one small batch with tests: geometry.py must stay at 0 FAIL, and screens.py must show no screen worse.

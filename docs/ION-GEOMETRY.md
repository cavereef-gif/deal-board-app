# Ion Rail – the geometry (locked 27 Sep 2026)

Source: the approved mock-ups (Ion Rail 3 and its Chrome / calculator / menu screens), measured in a browser at 360 px wide
(`tools/geometry.py --mock` prints the same numbers from the mock files kept in the build notes). Every number below is a
CSS pixel on a 360 px phone; wider phones keep the 8 px side margins and stretch the middle. `tools/geometry.py` measures
the built app against this table and fails on anything more than 0.5 px out.

## Page
- Side margin 8: the plate, the sheet, the section switch and the bottom bar all run from x = 8 to x = 352 (width 344).
- Status row above the plate: height 28, mono 14, text inset 16 from the phone edge.
- Header plate: radius 16, min height 66, padding 8 · 8 · 10; title 22 (regular), sub 14; the day meter (mono 14 over 15 × 2
  dots of 4 px with 3 px gaps = 102 wide) or the 40 px progress ring sits at the right, 16 in from the phone edge.
- Bottom bar: height 56, radius 18, 1 px edge, five equal columns; labels 14 with a 4 px dot 5 px below; the + is a 36 px
  circle centred in the middle column (its tap area is the whole column).

## Sheet
- Radius 20, 1 px edge, padding 10 · 8 · 14. Inner edges therefore x = 17 and x = 343 (width 326).
- HUD corner marks: 12 × 12, 1.5 px, 7 px in from the outer corner.
- Readout strip: first thing inside the sheet, x = 9 to 351, height 28, radius 19 on the top corners, mono 14, text inset 14;
  10 px gap below it, so a rail starts 39 px below the sheet's top edge.
- Version / note foot: mono 14, padding 8 · 6 · 0.

## Rail (one system for Today, the procedure, the route, the week, days of silence and the calculators)
- `--col` = the label column to the left of the groove: 0 (Today, calculators), 30 (day ticks), 80 (week), 96 (stages,
  stations). The rail's x = 17 + `--col`.
- Groove: width 24, radius 12, full height of the rail; ruler ticks every 24 px from 12 px down, 4 px long, 1 px, at 2 px
  and 18 px in.
- Bay behind the groove: groove ± 6 on every side (width 36, radius 18).
- Node centre = groove centre = rail x + 12. Nodes are 10 px (14 px for now / current / final; 6 px for ticks and stages
  waiting on others), with a 2 px border in the groove colour.
- Block: starts 32 px right of the rail's x, runs to the sheet's inner edge (343); radius 14; dot texture on an 8 px grid;
  8 × 8 corner brackets 5 px in; "deep" shade for the late group and the open stage.
- Block padding 6 · 8 · 6 · 12. A group label is mono 14 on a 20 px line at the top (its centre 16 px below the block's
  top) with 6 px below it, so the first card's top is 32 px below the block's top. Cards are 6 px apart; blocks 8 px apart.
- Card: from block x + 12 to sheet inner edge − 8 (x = 61 … 335 when `--col` = 0), height 48 (the mock's 44 held 12.5 px
  letters; ours are 16 / 14), radius 12, padding 0 · 11, 9 px between its parts. A 16 px check circle (1.5 px border) or a
  24 px name disc on the left; title 16 and one line of detail 14, each on one line with an ellipsis; on the right a plain
  14 px word (Today · Wed 30 · open) or a pill.
- Pill: height 24, radius full, padding 0 · 9, 14 px letters; coral for late, ion for an action (Accept · Decide · Next).
- Hairline from the groove's right edge to the card's left edge: 20 px long, 1 px, at the card's vertical centre.
- Now line: a 20 px band between two blocks (36 px from block edge to block edge); 2 px ion line from the groove's centre
  to the sheet's inner edge; 14 px ion node on the groove; the time chip (mono 14, height 24, radius full) ends at the
  card edge (x = 335).
- Station / stage label (left of the groove): right-aligned, right edge 12 px left of the groove; name 14 regular on one
  line, second line mono 14; centred on its card. Day ticks: mono 14, right edge 8 px left of the groove, centred on the
  day's first card. Day slots are 54 px (48 + 6).
- Stages waiting on others: compact rows of 32 px (the mock's 15 px rows could not hold 14 px letters or a fingertip).

## Tickets, terms, calculators, menus
- Ticket: radius 14; top padding 10 · 14 · 8; header row 22 high; big digits 26 × 32 in 6 px boxes, 24 px numerals, 4 px
  apart, an extra 6 px between thousands; unit 14; torn edge = 1 px dashed line with 16 px notches 22 px outside the
  ticket; stub 3 equal columns, padding 8 · 14, values 16 over labels 14; stage meter 4 px bars, 2 px radius, 4 px gaps.
- Terms row: radius 12, padding 8 · 10 · 9; header "Name · sub" 16 with the state in mono 14 at the right; chips height
  24, radius full, padding 0 · 9, 5 px apart; charcoal = chosen, coral = not agreed; a text term is a 40 px field, radius 10.
- Calculator rows are cards of the rail: a typed-in row has a 1 px ion outline on the second card shade; the answer row
  is ion; a missing figure is a dashed row with a coral node. Buttons under it: 3 equal columns, 6 px apart, height 40,
  radius 10; the first ion.
- More sheet: radius 24 on top, padding 10 · 12 · 14, a 36 × 4 grab bar, a mono strip; rows 56 high, radius 14, padding
  0 · 12, 34 px icon box (radius 10), title 16 over sub 14, 8 px apart; "swipe down to close" mono 14 under them.
- Add sheet: 3 columns 8 px apart; tiles 76 high, radius 14, padding 10 · 10 · 9, 20 px icon top-left, label bottom-left;
  the most used tile is ion.

## Controls (Chris's minimums win over the mock's 34–36 px)
- Switches (section, who, tabs, Mineral/Transport): height 40, radius 12 (section) / 10, padding 3, segments radius 9 / 7,
  equal columns; the chosen segment is the light card shade with charcoal letters.
- Buttons 40 (main ion buttons 48), radius 10. Fields 40, radius 10; the task line 48, radius 12, 1 px ion outline.
- Letters: 16 body, 14 small, 22 titles, 24 numerals in the ticket; mono for readouts, ticks, times and figures. Never
  coloured, never pure white, never heavy at large sizes.

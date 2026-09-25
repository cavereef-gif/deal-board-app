# Deal Board – build log

One entry per build. Newest at the top. Each entry: date, version, what changed, where it is (preview / live), commits, who approved going live.

## How to add an entry (every batch)
Date · version · batch · what changed (plain words, 3–6 lines) · checks run and results · preview PR/commit · live PR/commit · approved by (Chris, with the date) or "not live yet".

---

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

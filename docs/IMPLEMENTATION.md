# V17 audited mineral controls

Base: public `cavereef-gif/deal-board-app` main at `937bb75`. Working branch: `fix/v17-mineral-controls`.
Reviewed before changes: `origin/prototype` (`eb6ff2a`) audit dated 3 October, verification-merge and older-control proposals, locked Ion geometry, workflow report, database notes, and migrations 010–017. The source/reference copies are read-only inputs; root V14 and preview applications are untouched.

## Result

- Payment Secured is a distinct mandatory control. Escrow funded, TT received, operational LC and contract-specific equivalent security require a confirmation, contract/lot reference, independently verified funds and an attached payment-security file. Equivalent security also requires its contract terms. Grade-test payment, draft instruments, pre-advice and an evidence override cannot release loading.
- Buyer, Stockpile and Funds share one verification definition on the deal page and phone panel. Previous ticks and stamps remain; legacy site/dated-photo checks fill photos and location once, and a prior bank-confirmation tick supplies a missing funds method. The version marker prevents an explicit untick from being silently reinstated. New mandatory checks remain unchecked.
- Critical NCNDA, IMFPA, ownership, funds, assay, SPA, security, POD and weighbridge records need an attached file belonging to that deal; signed agreements need Signed status. Expired evidence is rejected. Deliberate evidence/Not needed overrides require reasons, stored in the record and append-only history. Replacing evidence or reopening a step resets its override.
- Unresolved red flags derive the **Review Required** state in the deal list, next-action cards, verification panel and exported status. The historical Active/On hold/Won/Lost status remains intact. Each clearance requires a fresh reason and history record. Critical progression checks current flags even if a prior checklist tick is already Done.
- Mineral Won requires seller and commission paid, accepted critical evidence, resolved flags and payment security. A deliberate Won override records the reason and database-detected blockers. It never changes the payment control to secured.
- LOI and ICPO can satisfy the same buyer-intent outcome; accepted signed SPA can also satisfy buyer intent and seller offer. Rows and historical ticks remain. Verification, commission protection, assay, SPA and payment security remain mandatory.
- Gates use immutable step codes. Edited labels are separate display data, including prior migration-017 edits. Full-kit trial/loading codes, phone actions, document automation, AI actions and the load register share enforcement. Missing prerequisites fail closed.
- Mobile buttons, links and summaries have invisible minimum 44×44 hit boxes. Overlaps resolve to the nearest visible button. Native inputs/selects gain an adjoining 44px activation region. Approved visual rectangles and stylesheet geometry remain unchanged.

## Database release requirement

`supabase/migrations/20261003191548_v17_mineral_controls.sql` is additive and **not applied to the live database**. Apply it in a staging copy with the existing owner helpers and migrations 010–017, then review live-schema compatibility before any approved release. Apply database guards before publishing the frontend.

It adds label/override columns, resolves recognizable legacy codes, carries prior label edits, seeds an open security step where missing, and installs owner-checked guards on deals, steps, documents and loads. No records are removed, no historical tick is reopened, and no RLS policy or table grant is relaxed. RPC/trigger privileges are explicitly restricted. Historical document metadata and file removal can still be maintained; missing/deleted evidence blocks future progression. Existing mineral loads require current controls before being changed. Step/load reparenting and mineral-to-non-mineral conversion are rejected to avoid bypasses.

The guards serialize writes through the deal lock. Existing RPC signatures remain compatible. New RPCs: `control_document_override`, `control_step_override`, `control_close_deal`.

## Tests and reproduction

Install pinned development dependencies with `pnpm install --frozen-lockfile`, then `pnpm test` and `pnpm test:browser`. Browser tests need Playwright Chromium; install it with `pnpm exec playwright install chromium` if absent. The SQL suite uses isolated PGlite PostgreSQL and the documented application schema/owner helpers, never a live database.

Existing Python suites were restored from `origin/prototype`, pointed at `/prototype`, and retained their workflow/geometry assertions. Install `tools/requirements.txt`, then run `python tools/geometry.py`, `python tools/flows.py`, and `python tools/workflow.py controls`. `CHROMIUM_PATH` optionally selects an installed browser. `SUPABASE_JS` and `LOCAL_FONTS` select local CDN equivalents (as supported by the geometry suite). Updated fixtures provide mandatory evidence; the Saturday label comparison and locale-dependent money grouping were corrected. No assertion was removed.

Review captures: `docs/review/mobile.png`, `desktop.png`, `security.png`, using fictional demo records. Physical phones, live bank evidence, WhatsApp sending, live RLS/owner identities and production migration execution remain untested.

## Files changed

Application: `prototype/controls.js`, `control-ui.js`, `lean.js`, `flow.js`, `docs.js`, `loads.js`, `bot.js`, `index.html`.
Database: the migration above.
Tests: `tests/controls.test.cjs`, `database.test.cjs`, `browser.cjs`; `tools/geometry.py`, `flows.py`, `workflow.py`, `screens.py`, `metrics.js`, `requirements.txt`, `workflow-controls.json`.
Reproduction/review: `.gitignore`, `package.json`, `pnpm-lock.yaml`, this report and the three demo captures.

## Validation results

- Pure policy + isolated PostgreSQL: **50 tests pass** (37 policy, 13 database), including unauthorised/anon denial and reasoned overrides.
- Browser regressions: **13 pass**, no page errors, including modal Funds-choice tap routing.
- Existing locked geometry: **1,048 pass, 0 fail**, no page errors.
- Existing 16-job workflow: **16/16 possible**, no page errors.
- Full flow suite: **99 pass, 0 fail**; existing route-map page errors remain as detailed below.
- JavaScript parsing, Python compilation and `git diff --check` pass.

The full flow suite exposes Leaflet errors (`undefined ... min`, `Map container is already initialized`). Both were reproduced on an untouched `937bb75` main copy. `prototype/extras.js` is unchanged (Git blob `c40321345488cf7b29a69d68df9c9b297ab6c93d`). They are existing route-map issues outside this controls change; no overall claim of a clean full-suite browser error log is made.

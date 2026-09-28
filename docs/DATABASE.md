# Deal Board – database notes (Supabase)

Project ref: egirxhjfgkwqjgxfxzea (URL and publishable key are in index.html – public by design; all data is protected by row-level security).
Claude Code normally has NO access to this database. Database changes are written as SQL files in docs/db/ and applied from the Claude project that has the Supabase connection. Never put a service key, database password or the bot's API key in this repo.

## Who can read and write
- Only emails in `allowed_users` (Chris, Annemarie) can use the data: `is_owner()` checks the logged-in email; `current_actor()` returns their display name.
- Writes go through SECURITY DEFINER functions (below), which check `is_owner()` and log every change to `events`.
- `events` is append-only; the app may insert only `field = 'note'` rows directly.
- Files: storage bucket `files` (owners only); rows in `attachments` (target_type: item, contact, project, deal, lead, post).
- The bot (`ask` edge function, Claude Haiku) proposes: items it creates are `state = 'Proposed'`; a person confirms. The bot never ticks steps, confirms, completes or deletes.
- Private: walk-away target and limit terms are for Chris and Annemarie only – never shown to or sent to third parties.

## Tables (columns)
- allowed_users: email, display_name
- items (tasks/waits): id, project, waiting_on ("Me" = our own job), waiting_for (the task text), blocks, next_action, last_chased, nudge_after_days, state (Proposed / Confirmed / Done), evidence, created_at, updated_at, priority (1 high, 2 normal, 3 low), owner (Chris / Annemarie), deal_id, due_on (date or empty)
- events: id, item_id, field, old_value, new_value, changed_by, changed_at, source, deal_id, lead_id, contact_id
- projects: name, summary, stage, key_facts, contacts, next_milestone, sort, updated_at, updated_by
- contacts: id, name, phone, whatsapp, email, company, role, project, notes, created_by, created_at, updated_at
- attachments: id, target_type, target_id, path, name, size, mime, uploaded_by, created_at
- briefs: id, for_date, actor, text, created_at
- deals: id, name, kind, area, status, summary, stage, key_facts, contacts, next_milestone, params (jsonb deal terms), sort, created_at, updated_at, updated_by, kit, kit_route
- deal_steps: id, deal_id, stage, sort, title, status (open / done / na), done_by, done_at, evidence, custom, created_at, detail, who, closes_with, code
- kit_templates: kit, kind, code, stage, sort, title, detail, who, closes_with, routes
- leads (directory): id, ref, name, person, role_title, side, kind, party_type, market, country, location, commodity, status, priority, evidence, phone, whatsapp, email, website, channel, grade, volume, terms, source, source_date, source_url, about, checked, checks_needed, flag, template, personal_line, board_ref, call_window, contacted_at, contacted_via, replied_at, last_touch, outcome, deal_id, contact_id, owner, origin, created_by, created_at, updated_at, updated_by
- lead_people: id, lead_id, name, title, email, email_note, phone, whatsapp, note, priority, sort, created_by, created_at
- lead_tasks (buyer-search "Next up"): id, rank, task, value, ease, score, kind, gates, not_before, lead_ids, where_ref, status, blocked_note, outcome, owner, done_by, done_at, created_by, created_at, updated_at
- gates: key, title, unblocks, status, note, major, sort, updated_at, updated_by
- library (playbook): id, kind, title, body, meta, sort, updated_at, updated_by
- posts (notice board): id, author, kind (post / check / claude), body, deal_id, lead_id, pinned, done, created_at, updated_at

## Functions the app calls
add_item(p_project, p_waiting_on, p_waiting_for, p_blocks, p_next, p_priority, p_owner, p_deal, p_due) ·
item_action(p_id, p_action [confirm, done, drop, chased, priority, assign, note, deal, due], p_value) ·
add_post(p_body, p_deal, p_kind) · post_action(p_id, p_action [pin, unpin, done, open]) ·
add_step(p_deal, p_stage, p_title) · set_step(p_id, p_status, p_evidence) · seed_deal_steps(p_deal, p_kind, p_route) · upgrade_deal_kit(p_deal, p_route) ·
save_deal(p_id, p_name, p_kind, p_area, p_status, p_summary, p_stage, p_key_facts, p_contacts, p_next_milestone, p_params, p_route) ·
set_project(...) · save_lead(p_id, p jsonb) · lead_status(p_id, p_status, p_via, p_outcome) · save_person(p_id, p_lead, p jsonb) · remove_person(p_id) ·
save_task(p_id, p jsonb) · task_action(p_id, p_action [done, reopen, block, drop, followup], p_value) · set_gate(p_key, p_status, p_note) · save_library(p_id, p_title, p_body) ·
bot_key_status() · set_bot_key(p_key) (key stored in Vault; get_bot_key() is for the edge function only).
service_key_status() · set_service_key(p_name, p_key) for the free map services (geoapify · tomtom · here; keys in Vault as GEOAPIFY_KEY etc.; get_service_key(p_name) is for the edge functions only). Migration v17_service_keys, 26 Sep 2026 (docs/db/003-service-keys.sql).

### Free services (26 Sep 2026, docs/db/004 and 005)
- places (a name typed once is pinned with its map point; owner read/write) · routes (from, to, mode → km, minutes, map line, toll plazas; kept 180 days) · toll_plazas (73 SANRAL plazas, tariffs from 1 Mar 2026, classes 1–4; source data/tolls-2026.json) · fuel_prices (diesel 50ppm, arrives as "suggested"; fuel_price_decide(id, status) accepts or drops it, fuel_price_set(date, coastal, inland) types one) · weekly_notes (the weekly border report) · weather_cache (server only).
- Server function `tools` (route, places, diesel, borders, holidays, weather, status). Signed-in partners, or the database timer with the TOOLS_CRON_TOKEN kept in Vault (lookups only).
- Timers (pg_cron + pg_net, migration v17_tools_timers): diesel 06:10 SA time on days 1–12 of each month (stops once the month's price is in); borders 06:20 every Monday.

### Security fixes (26 Sep 2026, docs/db/008)
- push_subscribe accepts only the real push services; calendar_events: each partner reads only their own meetings; service_key_status only for the partners.

### Phone reminders (26 Sep 2026, docs/db/007)
- push_subs (one row per phone; server only) · push_subscribe(sub, device) · push_unsubscribe(endpoint) · push_status() (your phones and the public key). vapid_get / vapid_store: server only; the key pair lives in Vault (VAPID_PUBLIC, VAPID_PRIVATE). Timer deal-board-push: 07:00 SA time Mon–Fri.

### Google link (26 Sep 2026, docs/db/006)
- google_link (one row: the fingerprint of the link code) · calendar_events (meetings shown on Today; owner read) · deal_folders (Drive folder per deal; owner read) · email_in (which emails were already added).
- In the app: google_link_new() (makes the code, shown once) · google_link_status() · google_link_drop(). For the Google script (anon key + code): gs_pull · gs_put_events · gs_put_folders · gs_email_in – each checks the code first and touches only what its name says.
task_action "followup" (change 002, applied 26 Sep 2026 as migration v17_task_followup): p_value = "YYYY-MM-DD|what happened". The step stays open (never done), not_before = the follow-up date (default today + 3), outcome = the note ("No reply yet" if empty). The app treats an open step with a not_before date and an outcome as a follow-up and shows it on Today under that day. Source: docs/db/002-task-followup.sql.
Edge function: `ask` (v10 since 26 Sep 2026, verify_jwt on, Claude Haiku). v10 adds the app_action tool for the v17 app (it sends app:2): open / show / calculator happen at once in the app; every change comes back as a "Do it" card and is saved only when a person taps it (the private target and walk-away numbers are refused). Apps that do not send app:2 (live v14, preview v16) get exactly the v9 tools. propose_item can take a due date. Source copy: supabase/functions/ask/index.ts (record only – deploying needs Supabase access).
Edge function: `read` (v2 since 27 Sep 2026 – messy WhatsApps come back as one entry per load, with what is missing and warning signs; no placeholder names; v1 26 Sep 2026; verify_jwt on, owners only). Sonnet for photos/PDFs (Haiku fallback), Haiku for quotes and voice notes. Returns suggestions and saves nothing; the app saves only what a person ticks. Names only in – never terms, target or limit. Source copy: supabase/functions/read/index.ts and prompt.ts (the instructions and answer form).

### Company details (27 Sep 2026, docs/db/009)
- company_profile: one row with our own company details for the letterhead (edited in Settings › Company details, partners only). Bank account numbers are never stored.

### Lean deals (28 Sep 2026, docs/db/010 and 011 – applied from the Claude project)
- deal_docs: id, deal_id, doc (minerals: ncnda, imfpa, loi, icpo, fco, poo, assay, pof, kyc, spa · transport: quote, contract, insurance, tickets, pod, invoices), status (draft / requested / received / signed / na), item_id (the follow-up task while requested), att_id (the file), note, updated_by, updated_at, created_at. One row per deal and document.
- deal_steps gains owner and due_on (who and by when on a step).
- market_prices: commodity (Chrome / Manganese), grade, basis (CIF China, China port spot, FOT South Africa …), price_low, price_high, currency (USD / ZAR / CNY), unit (t / dmtu), effective, source, source_url, quote (the sentence it came from), fx_zar (rand rate on the day), status (suggested / accepted / dropped), decided_by, decided_at.
- Functions: set_deal_doc(p_deal, p_doc, p_status, p_note, p_item, p_att) – an empty status removes the row · plan_step(p_id, p_owner, p_due) · market_price_set(p_commodity, p_grade, p_basis, p_low, p_high, p_currency, p_unit, p_effective, p_note) – a typed price counts at once · market_price_decide(p_id, p_status). All check is_owner() and write to events.
- Deal params keys that start with "_" belong to the app, not to the terms: _q (where each question stands: {s: notyet / requested / awaiting, on, id of the follow-up task, who}), _src (Sourced: notyet / yes / ok, on, by), _split (commission split [{n, p}]), _split_t (tons a load for the per-load figure). Emails, search and the bot leave them out.
- Server function `tools` action "market" (v16): reads the newest free SMM chrome and manganese reviews, keeps only lines with a South African price, Claude Haiku reads the figures, and a figure is kept only if it is printed in a line of the article that names South Africa (and the named grade); arrives as suggested. The weekly note (weekly_notes kind "market") keeps why any figure was left out.
- Timer deal-board-market (pg_cron, change 011): Mondays 04:40 UTC = 06:40 in South Africa.

### Signatures and sign-ups (28 Sep 2026 afternoon, docs/db/012 – applied from the Claude project)
- signatures: person (Chris / Annemarie, primary key), full_name, title, png (the drawn signature as a JPEG data URL, 600 × 200, under 300 KB), updated_at. Only is_owner() can read or write. Placed on a document only when "Sign it as …" is tapped on it.
- platforms (the sign-ups register): id, name, url, login (login name or email – never a password), joined_on, status (Active / Trial / Lapsed / Cancelled), plan (Free / Paid), cost, renews_on, owner (Chris / Annemarie / Both), use_for, notes, updated_by, created_at, updated_at. Only is_owner(). The app refuses notes that contain a password.
- Company papers (CIPC certificate, tax PIN, B-BBEE …) are ordinary attachments with target_type "company" (no table change).
- Deal params key rate_basis (transport): "Per ton" · "Flat per load" · "Flat – whole job"; when empty the app reads it from the client rate's words ("R12,000 a load").

## Current source of the two task functions (for change 001)
```sql
create or replace function public.add_item(p_project text, p_waiting_on text, p_waiting_for text, p_blocks text, p_next text, p_priority integer default 2, p_owner text default 'Chris', p_deal uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare new_id uuid;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  insert into items(project, waiting_on, waiting_for, blocks, next_action, state, evidence, last_chased, priority, owner, deal_id)
  values (p_project, p_waiting_on, p_waiting_for, p_blocks, p_next, 'Confirmed', 'Added in app by ' || public.current_actor(), current_date,
          coalesce(p_priority,2), coalesce(p_owner,'Chris'), p_deal)
  returning id into new_id;
  return new_id;
end $function$;

create or replace function public.item_action(p_id uuid, p_action text, p_value text default null)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare old_state text; old_chased date; old_prio int; old_owner text; old_deal uuid; who text;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  who := public.current_actor();
  select state, last_chased, priority, owner, deal_id into old_state, old_chased, old_prio, old_owner, old_deal from items where id = p_id;
  if p_action = 'confirm' then
    update items set state = 'Confirmed' where id = p_id;
    insert into events(item_id, field, old_value, new_value, changed_by, source) values (p_id,'state',old_state,'Confirmed',who,'app');
  elsif p_action = 'done' then
    update items set state = 'Done' where id = p_id;
    insert into events(item_id, field, old_value, new_value, changed_by, source) values (p_id,'state',old_state,'Done',who,'app');
  elsif p_action = 'drop' then
    update items set state = 'Done' where id = p_id;
    insert into events(item_id, field, old_value, new_value, changed_by, source) values (p_id,'dropped',old_state,'Done',who,'app');
  elsif p_action = 'chased' then
    update items set last_chased = current_date where id = p_id;
    insert into events(item_id, field, old_value, new_value, changed_by, source) values (p_id,'last_chased',old_chased::text,current_date::text,who,'app');
  elsif p_action = 'priority' then
    update items set priority = p_value::int where id = p_id;
    insert into events(item_id, field, old_value, new_value, changed_by, source) values (p_id,'priority',old_prio::text,p_value,who,'app');
  elsif p_action = 'assign' then
    update items set owner = p_value where id = p_id;
    insert into events(item_id, field, old_value, new_value, changed_by, source) values (p_id,'owner',old_owner,p_value,who,'app');
  elsif p_action = 'note' then
    insert into events(item_id, field, new_value, changed_by, source) values (p_id,'note',p_value,who,'app');
  elsif p_action = 'deal' then
    update items set deal_id = nullif(p_value,'')::uuid where id = p_id;
    insert into events(item_id, deal_id, field, old_value, new_value, changed_by, source)
    values (p_id, coalesce(nullif(p_value,'')::uuid, old_deal), 'deal', (select name from deals where id = old_deal),
            coalesce((select name from deals where id = nullif(p_value,'')::uuid), 'no deal'), who, 'app');
  else raise exception 'unknown action';
  end if;
end $function$;
```
Grants on both: execute for authenticated and service_role only.

## Migrations applied so far (25 Sep 2026)
batch1_items_events · batch2_owner_access · batch2_add_item · harden_search_path · v2_priority_owner_users · v3_projects_info · v4_bot_key_in_vault · fix_is_owner_recursion · v7_briefs · auto_activate_allowed_logins · v8_contacts_attachments_storage · v8_note_stamp · v10_deals_checklists · v10_harden_function_grants · v11_directory · v11_revoke_trigger_fn_exec · v13_deal_kit_schema · v13_library_kind_kit · v13_deal_kit_library · v16_notice_board

## Applied since the handover
- v17_due_dates (26 Sep 2026): items.due_on; add_item gains p_due (optional); item_action gains 'due' (p_value = YYYY-MM-DD or empty). Same as docs/db/001-due-dates.sql.
- 010_lean_deals (28 Sep 2026): documents per deal, who and by when on a step, market prices – docs/db/010-lean-deals.sql. Timer deal-board-market (28 Sep 2026) – docs/db/011-market-timer.sql.
- signatures_platforms (28 Sep 2026): signatures and the sign-ups register – docs/db/012-signatures-platforms.sql.
- mineral_procedure_v2 (014): lean_seed_v2(p_deal) adds the v2.xx steps a mineral deal is missing. loads + delete_deal_loads (015): the load register table (owners only; removed with its deal, files too). expiry_dates (016): deal_docs.expires_on, attachments.expires_on, set_doc_expiry(p_deal, p_doc, p_date). Deal params _trust holds the trust check (app data).
- remove_deal_clear_board + remove_deal_keep_history (28 Sep 2026 evening): delete_deal(p_id), clear_board(p_keep_pinned), post_action gains 'delete'; events keeps deal_id and item_id as plain ids (foreign keys dropped) so history survives a removed deal – docs/db/013-remove-deal-clear-board.sql.

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
task_action "followup" (change 002, applied 26 Sep 2026 as migration v17_task_followup): p_value = "YYYY-MM-DD|what happened". The step stays open (never done), not_before = the follow-up date (default today + 3), outcome = the note ("No reply yet" if empty). The app treats an open step with a not_before date and an outcome as a follow-up and shows it on Today under that day. Source: docs/db/002-task-followup.sql.
Edge function: `ask` (v9, verify_jwt on, Claude Haiku). Source copy: supabase/functions/ask/index.ts (record only – deploying needs Supabase access).
Edge function: `read` (v1, 26 Sep 2026, verify_jwt on, owners only). Sonnet for photos/PDFs (Haiku fallback), Haiku for quotes and voice notes. Returns suggestions and saves nothing; the app saves only what a person ticks. Names only in – never terms, target or limit. Source copy: supabase/functions/read/index.ts.

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

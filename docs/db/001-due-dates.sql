-- 001 – due dates on tasks (PROPOSED for plan batch 3; NOT applied).
-- Apply from the Claude project (Supabase connector, project egirxhjfgkwqjgxfxzea) after Chris OKs batch 3.
-- Safe to run once. Keeps every existing call working: p_due is optional.

alter table public.items add column if not exists due_on date;

-- add_item: same as today plus an optional due date.
-- (A new argument makes a new function signature, so the old one is dropped first to avoid two versions.)
drop function if exists public.add_item(text, text, text, text, text, integer, text, uuid);
create function public.add_item(p_project text, p_waiting_on text, p_waiting_for text, p_blocks text, p_next text,
                                p_priority integer default 2, p_owner text default 'Chris', p_deal uuid default null, p_due date default null)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare new_id uuid;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  insert into items(project, waiting_on, waiting_for, blocks, next_action, state, evidence, last_chased, priority, owner, deal_id, due_on)
  values (p_project, p_waiting_on, p_waiting_for, p_blocks, p_next, 'Confirmed', 'Added in app by ' || public.current_actor(), current_date,
          coalesce(p_priority,2), coalesce(p_owner,'Chris'), p_deal, p_due)
  returning id into new_id;
  return new_id;
end $function$;
revoke all on function public.add_item(text, text, text, text, text, integer, text, uuid, date) from public, anon;
grant execute on function public.add_item(text, text, text, text, text, integer, text, uuid, date) to authenticated, service_role;

-- item_action: new action 'due' (p_value = 'YYYY-MM-DD' or '' to clear). Add this branch before the final "else":
--   elsif p_action = 'due' then
--     update items set due_on = nullif(p_value,'')::date where id = p_id;
--     insert into events(item_id, field, old_value, new_value, changed_by, source)
--     values (p_id, 'due_on', (select due_on::text from items where id = p_id), nullif(p_value,''), who, 'app');
-- (Read the old value before the update – capture it with the other old_* variables at the top.)
-- The current full source of item_action is in docs/DATABASE.md.

-- 017 – "make everything changeable" (3 Oct 2026, Batch 2 Part A). APPLIED 3 Oct 2026 as migration v17_editable.
-- 1. edit_item: change a task's words (what we wait for, the next step, what it blocks, who we wait on, the project).
--    Every changed field is written to the history (events) – the history stays append-only.
-- 2. edit_step: change a deal step's title and plain-words detail (custom or kit steps alike).
-- 3. app_settings + set_setting: small key/value settings both partners can read (the names shown for each partner,
--    the Today greeting). Only the two owners can read or write them. Keys the app uses: name:Chris, name:Annemarie, greeting.

create or replace function public.edit_item(p_id uuid, p jsonb)
returns void language plpgsql security definer set search_path to 'public' as $$
declare o items; v_who text; k text; nv text; ov text;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  v_who := public.current_actor();
  select * into o from items where id = p_id for update;
  if not found then raise exception 'task not found'; end if;
  foreach k in array array['waiting_for','next_action','blocks','waiting_on','project'] loop
    if p ? k then
      nv := btrim(coalesce(p->>k, ''));
      if k = 'waiting_for' and nv = '' then raise exception 'A task needs words'; end if;
      if k = 'waiting_on' and nv = '' then nv := 'Me'; end if;
      ov := case k when 'waiting_for' then o.waiting_for when 'next_action' then o.next_action when 'blocks' then o.blocks
                   when 'waiting_on' then o.waiting_on else o.project end;
      if coalesce(ov, '') is distinct from nv then
        execute format('update items set %I = $1, updated_at = now() where id = $2', k) using nv, p_id;
        insert into events(item_id, deal_id, field, old_value, new_value, changed_by, source)
        values (p_id, o.deal_id, 'edit:' || k, ov, nv, v_who, 'app');
      end if;
    end if;
  end loop;
end $$;

create or replace function public.edit_step(p_id uuid, p_title text, p_detail text default null)
returns void language plpgsql security definer set search_path to 'public' as $$
declare s deal_steps; v_who text; t text;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  v_who := public.current_actor();
  select * into s from deal_steps where id = p_id for update;
  if not found then raise exception 'step not found'; end if;
  t := btrim(coalesce(p_title, ''));
  if t = '' then raise exception 'A step needs a title'; end if;
  update deal_steps set title = t, detail = case when p_detail is null then detail else btrim(p_detail) end where id = p_id;
  if s.title is distinct from t or (p_detail is not null and coalesce(s.detail, '') is distinct from btrim(p_detail)) then
    insert into events(deal_id, field, old_value, new_value, changed_by, source)
    values (s.deal_id, 'step:edit', s.title, t, v_who, 'app');
  end if;
end $$;

create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text
);
alter table public.app_settings enable row level security;
drop policy if exists owner_read_settings on public.app_settings;
create policy owner_read_settings on public.app_settings for select using (public.is_owner());

create or replace function public.set_setting(p_key text, p_value text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  if p_key !~ '^[a-z_]+:?[A-Za-z_]*$' then raise exception 'bad key'; end if;
  insert into public.app_settings(key, value, updated_at, updated_by) values (p_key, coalesce(p_value, ''), now(), public.current_actor())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by;
end $$;

grant execute on function public.edit_item(uuid, jsonb) to authenticated;
grant execute on function public.edit_step(uuid, text, text) to authenticated;
grant execute on function public.set_setting(text, text) to authenticated;
grant select on public.app_settings to authenticated;

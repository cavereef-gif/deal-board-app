-- 006 – the Google link (26 Sep 2026, approved by Chris: "i want all the free api", build straight through).
-- A small Google Apps Script runs in Chris's own Google account (free) and talks to the database with the public anon key
-- plus a secret link code. The code is made once in the app (More › Settings › Google link), shown once, and only its
-- SHA-256 hash is stored. With the code the script can ONLY:
--   · read open tasks with a due date, live deal names, saved contacts, the two partners' names/emails, the weekly border
--     note and the newest diesel suggestion (never deal terms, prices, targets or limits – deals.params is not read)
--   · replace the list of calendar meetings shown on Today
--   · store the Google Drive folder link for a deal
--   · add emails Chris labels "Deal Board" in Gmail as SUGGESTED tasks (people confirm them in the app)
-- Anything else needs a signed-in partner, as before. "Remove the link" in Settings deletes the code at once.

create table if not exists public.google_link (
  id int primary key default 1 check (id = 1), token_hash text not null, created_by text, created_at timestamptz default now(), last_seen timestamptz
);
alter table public.google_link enable row level security;          -- no policies: only the functions below touch it
revoke all on public.google_link from anon, authenticated;

create table if not exists public.calendar_events (
  id text primary key, owner text, title text, starts timestamptz, ends timestamptz, all_day boolean default false, location text,
  updated_at timestamptz default now()
);
alter table public.calendar_events enable row level security;
drop policy if exists owner_read_cal on public.calendar_events;
create policy owner_read_cal on public.calendar_events for select to authenticated using (public.is_owner());
revoke all on public.calendar_events from anon; grant select on public.calendar_events to authenticated;

create table if not exists public.deal_folders (deal_id uuid primary key references public.deals(id) on delete cascade, url text, updated_at timestamptz default now());
alter table public.deal_folders enable row level security;
drop policy if exists owner_read_folders on public.deal_folders;
create policy owner_read_folders on public.deal_folders for select to authenticated using (public.is_owner());
revoke all on public.deal_folders from anon; grant select on public.deal_folders to authenticated;

create table if not exists public.email_in (msg_id text primary key, item_id uuid, created_at timestamptz default now());
alter table public.email_in enable row level security;
revoke all on public.email_in from anon, authenticated;

-- in the app: make (or remake) the code – shown once
create or replace function public.google_link_new() returns text
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare t text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  insert into public.google_link(id, token_hash, created_by, created_at, last_seen)
  values (1, encode(extensions.digest(t, 'sha256'), 'hex'), public.current_actor(), now(), null)
  on conflict (id) do update set token_hash = excluded.token_hash, created_by = excluded.created_by, created_at = now(), last_seen = null;
  return t;
end $$;
create or replace function public.google_link_status() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select case when not public.is_owner() then null else coalesce(
    (select jsonb_build_object('linked', true, 'by', created_by, 'made', created_at, 'seen', last_seen) from public.google_link where id = 1),
    jsonb_build_object('linked', false)) end
$$;
create or replace function public.google_link_drop() returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  delete from public.google_link where id = 1;
end $$;
revoke all on function public.google_link_new() from public, anon;
revoke all on function public.google_link_status() from public, anon;
revoke all on function public.google_link_drop() from public, anon;
grant execute on function public.google_link_new(), public.google_link_status(), public.google_link_drop() to authenticated;

-- the script's side: every call checks the code first
create or replace function public.gs_ok(p_token text) returns boolean
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare ok boolean;
begin
  update public.google_link set last_seen = now()
   where id = 1 and p_token is not null and length(p_token) >= 32 and token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  returning true into ok;
  return coalesce(ok, false);
end $$;
revoke all on function public.gs_ok(text) from public, anon, authenticated;

create or replace function public.gs_pull(p_token text) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.gs_ok(p_token) then raise exception 'link code not valid'; end if;
  return jsonb_build_object(
    'today', to_char(now() at time zone 'Africa/Johannesburg', 'YYYY-MM-DD'),
    'owners', (select coalesce(jsonb_agg(jsonb_build_object('name', display_name, 'email', email)), '[]') from public.allowed_users),
    'tasks', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'title', i.waiting_for, 'who', i.waiting_on, 'owner', coalesce(i.owner, 'Chris'),
        'due', coalesce(i.due_on, (coalesce(i.last_chased, i.created_at::date) + coalesce(i.nudge_after_days, 3))), 'has_date', i.due_on is not null,
        'urgent', i.priority = 1, 'suggested', i.state = 'Proposed', 'deal', d.name) order by i.due_on nulls last), '[]')
      from public.items i left join public.deals d on d.id = i.deal_id where coalesce(i.state, '') <> 'Done'),
    'deals', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'area', d.area, 'folder', f.url) order by d.sort nulls last, d.name), '[]')
      from public.deals d left join public.deal_folders f on f.deal_id = d.id where coalesce(d.status, 'Active') not in ('Closed', 'Lost', 'Dropped')),
    'contacts', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'whatsapp', c.whatsapp, 'email', c.email, 'company', c.company, 'role', c.role)), '[]')
      from public.contacts c where coalesce(c.phone, c.whatsapp, c.email) is not null),
    'borders', (select summary from public.weekly_notes where kind = 'borders' order by week_ending desc limit 1),
    'diesel', (select jsonb_build_object('effective', effective, 'inland', inland, 'coastal', coalesce(coastal, null), 'status', status) from public.fuel_prices where status <> 'dropped' order by effective desc limit 1)
  );
end $$;

create or replace function public.gs_put_events(p_token text, p_owner text, p_events jsonb) returns int
language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if not public.gs_ok(p_token) then raise exception 'link code not valid'; end if;
  delete from public.calendar_events where owner = p_owner;
  insert into public.calendar_events(id, owner, title, starts, ends, all_day, location)
  select left(e->>'id', 300), p_owner, left(e->>'title', 300), (e->>'starts')::timestamptz, (e->>'ends')::timestamptz, coalesce((e->>'all_day')::boolean, false), left(e->>'location', 300)
    from jsonb_array_elements(coalesce(p_events, '[]')) e limit 200
  on conflict (id) do nothing;
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.gs_put_folders(p_token text, p_folders jsonb) returns int
language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  if not public.gs_ok(p_token) then raise exception 'link code not valid'; end if;
  insert into public.deal_folders(deal_id, url, updated_at)
  select (f->>'deal_id')::uuid, left(f->>'url', 500), now() from jsonb_array_elements(coalesce(p_folders, '[]')) f
   where (f->>'url') ~ '^https://drive\.google\.com/' and exists (select 1 from public.deals d where d.id = (f->>'deal_id')::uuid)
  on conflict (deal_id) do update set url = excluded.url, updated_at = now();
  get diagnostics n = row_count; return n;
end $$;

-- emails labelled "Deal Board": each becomes a SUGGESTED task (Accept / Drop in the app); the same email never twice
create or replace function public.gs_email_in(p_token text, p_msgs jsonb) returns int
language plpgsql security definer set search_path to 'public' as $$
declare m jsonb; new_id uuid; n int := 0;
begin
  if not public.gs_ok(p_token) then raise exception 'link code not valid'; end if;
  for m in select * from jsonb_array_elements(coalesce(p_msgs, '[]')) limit 30 loop
    if exists (select 1 from public.email_in where msg_id = m->>'id') then continue; end if;
    insert into public.items(project, waiting_on, waiting_for, next_action, state, evidence, priority, owner, nudge_after_days)
    values ('Other', left(coalesce(nullif(m->>'from', ''), 'Email'), 80), left(coalesce(nullif(m->>'subject', ''), '(no subject)'), 200),
            left(coalesce(m->>'snippet', ''), 300), 'Proposed', left('email: ' || coalesce(m->>'link', ''), 500), 2,
            case when m->>'owner' in ('Chris', 'Annemarie') then m->>'owner' else 'Chris' end, 3)
    returning id into new_id;
    insert into public.email_in(msg_id, item_id) values (m->>'id', new_id);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.gs_pull(text), public.gs_put_events(text, text, jsonb), public.gs_put_folders(text, jsonb), public.gs_email_in(text, jsonb) from public;
grant execute on function public.gs_pull(text), public.gs_put_events(text, text, jsonb), public.gs_put_folders(text, jsonb), public.gs_email_in(text, jsonb) to anon, authenticated;

-- 005 – for the `tools` server function (26 Sep 2026): a one-hour weather cache (MET Norway asks callers to cache),
-- and the timer token: the monthly diesel check runs from the database (pg_cron + pg_net) and identifies itself with a
-- token kept in Vault (TOOLS_CRON_TOKEN). With it the function only answers lookups (route, places, diesel, holidays,
-- weather) – nothing that changes a deal or a task.
create table if not exists public.weather_cache (key text primary key, data jsonb, fetched_at timestamptz default now());
alter table public.weather_cache enable row level security;   -- no policies: only the server function reads it
revoke all on public.weather_cache from anon, authenticated;
grant all on public.weather_cache to service_role;
create or replace function public.get_tools_cron_token() returns text
language sql stable security definer set search_path to 'public', 'vault' as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'TOOLS_CRON_TOKEN' limit 1
$$;
revoke all on function public.get_tools_cron_token() from public, anon, authenticated;
grant execute on function public.get_tools_cron_token() to service_role;

-- the timer itself (runs 06:10 South African time on the first twelve days of every month; the function stops early once
-- this month's price is in, so Claude reads the documents at most once a month)
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('deal-board-diesel', '10 4 1-12 * *', $$
  select net.http_post(
    url := 'https://egirxhjfgkwqjgxfxzea.supabase.co/functions/v1/tools',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SB_ANON_JWT'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SB_ANON_JWT'),
      'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'TOOLS_CRON_TOKEN')),
    body := '{"action":"diesel"}'::jsonb, timeout_milliseconds := 150000)
$$);

-- weekly notes written by the server (first kind: "borders" – the WCO ESA / FESARTA cross-border report read by Claude)
create table if not exists public.weekly_notes (
  id bigserial primary key, kind text not null, week_ending date not null, summary text, data jsonb, source_url text,
  created_at timestamptz default now(), unique (kind, week_ending)
);
alter table public.weekly_notes enable row level security;
drop policy if exists owner_read_weekly on public.weekly_notes;
create policy owner_read_weekly on public.weekly_notes for select to authenticated using (public.is_owner());
revoke all on public.weekly_notes from anon;
grant select on public.weekly_notes to authenticated;
grant all on public.weekly_notes to service_role;
grant usage, select on sequence public.weekly_notes_id_seq to service_role;
select cron.schedule('deal-board-borders', '20 4 * * 1', $$
  select net.http_post(
    url := 'https://egirxhjfgkwqjgxfxzea.supabase.co/functions/v1/tools',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SB_ANON_JWT'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SB_ANON_JWT'),
      'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'TOOLS_CRON_TOKEN')),
    body := '{"action":"borders"}'::jsonb, timeout_milliseconds := 150000)
$$);

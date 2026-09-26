-- 007 – phone reminders (web push), 26 Sep 2026, part of the approved "build the complete app" scope. R0: the phone makers'
-- push services are free. Each phone that turns reminders on is stored here; the server sends one short note at 07:00 on
-- weekdays ("2 late, 3 due today") and a test when asked. The signing keys (VAPID) are made by the server function itself
-- the first time and kept in Vault – nobody sees the private key.
create table if not exists public.push_subs (
  endpoint text primary key, owner text not null, p256dh text not null, auth text not null, device text,
  created_at timestamptz default now(), last_ok timestamptz, fails int default 0
);
alter table public.push_subs enable row level security;       -- no policies: only the functions below and the server touch it
revoke all on public.push_subs from anon, authenticated;
grant all on public.push_subs to service_role;

create or replace function public.push_subscribe(p_sub jsonb, p_device text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  if coalesce(p_sub->>'endpoint', '') !~ '^https://' or coalesce(p_sub#>>'{keys,p256dh}', '') = '' or coalesce(p_sub#>>'{keys,auth}', '') = '' then raise exception 'not a push subscription'; end if;
  insert into public.push_subs(endpoint, owner, p256dh, auth, device) values (p_sub->>'endpoint', public.current_actor(), p_sub#>>'{keys,p256dh}', p_sub#>>'{keys,auth}', left(p_device, 120))
  on conflict (endpoint) do update set owner = excluded.owner, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device, fails = 0;
end $$;
create or replace function public.push_unsubscribe(p_endpoint text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  delete from public.push_subs where endpoint = p_endpoint and owner = public.current_actor();
end $$;
create or replace function public.push_status() returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select case when not public.is_owner() then null else jsonb_build_object('phones', (select count(*) from public.push_subs where owner = public.current_actor()),
    'public_key', (select decrypted_secret from vault.decrypted_secrets where name = 'VAPID_PUBLIC' limit 1)) end
$$;
revoke all on function public.push_subscribe(jsonb, text), public.push_unsubscribe(text), public.push_status() from public, anon;
grant execute on function public.push_subscribe(jsonb, text), public.push_unsubscribe(text), public.push_status() to authenticated;

-- for the server function only: read or store the signing keys
create or replace function public.vapid_get() returns jsonb
language sql stable security definer set search_path to 'public', 'vault' as $$
  select jsonb_build_object('public', (select decrypted_secret from vault.decrypted_secrets where name = 'VAPID_PUBLIC' limit 1),
                            'private', (select decrypted_secret from vault.decrypted_secrets where name = 'VAPID_PRIVATE' limit 1))
$$;
create or replace function public.vapid_store(p_public text, p_private text) returns boolean
language plpgsql security definer set search_path to 'public', 'vault' as $$
begin
  if exists (select 1 from vault.secrets where name = 'VAPID_PRIVATE') then return false; end if;   -- never replaced once made
  perform vault.create_secret(p_public, 'VAPID_PUBLIC', 'web push public key (made by the tools function)');
  perform vault.create_secret(p_private, 'VAPID_PRIVATE', 'web push private key (made by the tools function)');
  return true;
end $$;
revoke all on function public.vapid_get(), public.vapid_store(text, text) from public, anon, authenticated;
grant execute on function public.vapid_get(), public.vapid_store(text, text) to service_role;

-- the 07:00 weekday reminder (05:00 UTC)
select cron.schedule('deal-board-push', '0 5 * * 1-5', $$
  select net.http_post(
    url := 'https://egirxhjfgkwqjgxfxzea.supabase.co/functions/v1/tools',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SB_ANON_JWT'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SB_ANON_JWT'),
      'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'TOOLS_CRON_TOKEN')),
    body := '{"action":"push_daily"}'::jsonb, timeout_milliseconds := 60000)
$$);

-- 008 – fixes from the independent security review of 26 Sep 2026 (the reviewer's findings 5, 7 and 11).
-- 1) Phone reminders: only the real push services are accepted as a phone's address (so the server can't be pointed at
--    any other web site).
create or replace function public.push_subscribe(p_sub jsonb, p_device text) returns void
language plpgsql security definer set search_path to 'public' as $$
declare ep text := coalesce(p_sub->>'endpoint', '');
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  if ep !~ '^https://(fcm\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
     or coalesce(p_sub#>>'{keys,p256dh}', '') = '' or coalesce(p_sub#>>'{keys,auth}', '') = '' then raise exception 'not a push subscription'; end if;
  insert into public.push_subs(endpoint, owner, p256dh, auth, device) values (ep, public.current_actor(), p_sub#>>'{keys,p256dh}', p_sub#>>'{keys,auth}', left(p_device, 120))
  on conflict (endpoint) do update set owner = excluded.owner, p256dh = excluded.p256dh, auth = excluded.auth, device = excluded.device, fails = 0;
end $$;
-- 2) Meetings from the Google link: each partner sees only their own (personal appointments are not shared).
drop policy if exists owner_read_cal on public.calendar_events;
create policy owner_read_cal on public.calendar_events for select to authenticated using (public.is_owner() and owner = public.current_actor());
-- 3) Map-key status only for the partners.
create or replace function public.service_key_status() returns jsonb
language sql stable security definer set search_path to 'public', 'vault' as $$
  select case when not public.is_owner() then null else (
    select jsonb_object_agg(k, coalesce((select 'set ' || to_char(s.updated_at, 'DD Mon YYYY HH24:MI') from vault.secrets s where s.name = public.service_key_name(k) limit 1), 'not set'))
    from unnest(array['geoapify', 'tomtom', 'here']) as k) end
$$;

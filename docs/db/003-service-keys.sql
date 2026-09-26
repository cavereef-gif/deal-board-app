-- 003 – keys for free map services (26 Sep 2026, approved by Chris: "i want all the free api").
-- Same pattern as the bot key: typed once in Settings, stored encrypted in Vault, only the server functions can read it.
-- Allowed names: geoapify, tomtom, here. Nobody sees a key again after saving (only "set <date>").
create or replace function public.service_key_name(p_name text) returns text
language sql immutable as $$
  select case lower(trim(p_name)) when 'geoapify' then 'GEOAPIFY_KEY' when 'tomtom' then 'TOMTOM_KEY' when 'here' then 'HERE_KEY' else null end
$$;

create or replace function public.set_service_key(p_name text, p_key text) returns void
language plpgsql security definer set search_path to 'public', 'vault' as $$
declare existing uuid; n text := public.service_key_name(p_name);
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  if n is null then raise exception 'unknown key name'; end if;
  if p_key is null or length(trim(p_key)) < 16 or trim(p_key) ~ '\s' then raise exception 'key looks wrong'; end if;
  select id into existing from vault.secrets where name = n;
  if existing is not null then
    perform vault.update_secret(existing, trim(p_key), n, 'set from app by ' || public.current_actor());
  else
    perform vault.create_secret(trim(p_key), n, 'set from app by ' || public.current_actor());
  end if;
  insert into events(item_id, field, new_value, changed_by, source) values (null, 'service_key', lower(trim(p_name)) || ' set', public.current_actor(), 'app');
end $$;

create or replace function public.service_key_status() returns jsonb
language sql stable security definer set search_path to 'public', 'vault' as $$
  select jsonb_object_agg(k, coalesce((select 'set ' || to_char(s.updated_at, 'DD Mon YYYY HH24:MI') from vault.secrets s where s.name = public.service_key_name(k) limit 1), 'not set'))
  from unnest(array['geoapify', 'tomtom', 'here']) as k
$$;

create or replace function public.get_service_key(p_name text) returns text
language sql stable security definer set search_path to 'public', 'vault' as $$
  select decrypted_secret from vault.decrypted_secrets where name = public.service_key_name(p_name) limit 1
$$;

revoke all on function public.set_service_key(text, text) from public, anon;
grant execute on function public.set_service_key(text, text) to authenticated;
revoke all on function public.service_key_status() from public, anon;
grant execute on function public.service_key_status() to authenticated;
revoke all on function public.get_service_key(text) from public, anon, authenticated;
grant execute on function public.get_service_key(text) to service_role;

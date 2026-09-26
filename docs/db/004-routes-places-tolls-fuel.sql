-- 004 – self-filling Transport calculator (26 Sep 2026, approved by Chris: "i want all the free api").
-- places: farms, mines, sidings, ports and towns pinned once and reused (least typing).
-- routes: every route worked out once is kept, so repeat quotes cost nothing.
-- toll_plazas: the SANRAL 1 March 2026 tariff poster (73 mainline and ramp plazas) with map positions (© OpenStreetMap
--   contributors). Update every 1 March by replacing the rows (docs/db/00N-tolls-YYYY.sql).
-- fuel_prices: the monthly diesel price, arriving as "suggested" for one tap (the app never changes a number by itself).
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  name text not null, key text generated always as (lower(regexp_replace(trim(name), '\s+', ' ', 'g'))) stored,
  kind text not null default 'place',          -- farm · mine · siding · port · depot · town · place
  lat double precision, lon double precision, address text, country text,
  source text default 'app', created_by text, created_at timestamptz default now(),
  used_at timestamptz default now(), uses integer default 1,
  unique (key)
);
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  from_name text not null, to_name text not null,
  from_key text generated always as (lower(regexp_replace(trim(from_name), '\s+', ' ', 'g'))) stored,
  to_key text generated always as (lower(regexp_replace(trim(to_name), '\s+', ' ', 'g'))) stored,
  from_lat double precision, from_lon double precision, to_lat double precision, to_lon double precision,
  km numeric, minutes numeric, provider text, mode text, check_km numeric, check_provider text,
  geometry jsonb, plaza_ids text[] default '{}',
  fetched_at timestamptz default now(), uses integer default 1,
  unique (from_key, to_key, mode)
);
create table if not exists public.toll_plazas (
  id text primary key, name text not null, road text, operator text, direction text default 'both',
  lat double precision not null, lon double precision not null,
  class1 numeric, class2 numeric, class3 numeric, class4 numeric, notes text,
  valid_from date not null default '2026-03-01', source text default 'SANRAL toll tariff poster, 1 March 2026'
);
create table if not exists public.fuel_prices (
  id bigserial primary key,
  effective date not null, grade text not null default 'diesel 50ppm',
  coastal numeric, inland numeric, source text, source_url text, note text,
  status text not null default 'suggested' check (status in ('suggested', 'accepted', 'dropped')),
  created_at timestamptz default now(), decided_by text, decided_at timestamptz,
  unique (effective, grade, source)
);
alter table public.places enable row level security;
alter table public.routes enable row level security;
alter table public.toll_plazas enable row level security;
alter table public.fuel_prices enable row level security;
drop policy if exists owner_all_places on public.places; create policy owner_all_places on public.places for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists owner_read_routes on public.routes; create policy owner_read_routes on public.routes for select to authenticated using (public.is_owner());
drop policy if exists owner_read_tolls on public.toll_plazas; create policy owner_read_tolls on public.toll_plazas for select to authenticated using (public.is_owner());
drop policy if exists owner_read_fuel on public.fuel_prices; create policy owner_read_fuel on public.fuel_prices for select to authenticated using (public.is_owner());
revoke all on public.places, public.routes, public.toll_plazas, public.fuel_prices from anon;
grant select, insert, update, delete on public.places to authenticated;
grant select on public.routes, public.toll_plazas, public.fuel_prices to authenticated;
grant all on public.places, public.routes, public.toll_plazas, public.fuel_prices to service_role;
grant usage, select on sequence public.fuel_prices_id_seq to service_role;

-- a person accepts or drops a suggested diesel price (one tap); a person may also type one in
create or replace function public.fuel_price_decide(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  if p_status not in ('accepted', 'dropped') then raise exception 'status must be accepted or dropped'; end if;
  update fuel_prices set status = p_status, decided_by = public.current_actor(), decided_at = now() where id = p_id;
  if p_status = 'accepted' then update fuel_prices set status = 'dropped' where status = 'suggested' and id <> p_id; end if;
  insert into events(item_id, field, new_value, changed_by, source) values (null, 'fuel_price', p_status || ' #' || p_id, public.current_actor(), 'app');
end $$;
create or replace function public.fuel_price_set(p_effective date, p_coastal numeric, p_inland numeric) returns bigint
language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  insert into fuel_prices(effective, coastal, inland, source, status, decided_by, decided_at)
    values (p_effective, p_coastal, p_inland, 'typed by ' || public.current_actor(), 'accepted', public.current_actor(), now())
    on conflict (effective, grade, source) do update set coastal = excluded.coastal, inland = excluded.inland, status = 'accepted', decided_by = excluded.decided_by, decided_at = now()
    returning id into v_id;
  update fuel_prices set status = 'dropped' where status = 'suggested';
  return v_id;
end $$;
revoke all on function public.fuel_price_decide(bigint, text) from public, anon; grant execute on function public.fuel_price_decide(bigint, text) to authenticated;
revoke all on function public.fuel_price_set(date, numeric, numeric) from public, anon; grant execute on function public.fuel_price_set(date, numeric, numeric) to authenticated;

-- the 2026 toll table (rand, VAT included; class 1 light · 2 medium heavy · 3 large heavy (3–4 axles) · 4 extra large (5+ axles)).
-- Notes on each plaza (which OpenStreetMap booth, ramp directions) are in data/tolls-2026.json.
insert into public.toll_plazas (id,name,road,operator,direction,lat,lon,class1,class2,class3,class4) values ('huguenot','Huguenot','N1','SANRAL','both',-33.74285,19.0198,54.5,151,236,383),('vaal','Vaal','N1','SANRAL','both',-26.85642,27.63519,91.5,172,207,275),('grasmere','Grasmere','N1','SANRAL','both',-26.41157,27.88405,27.5,82,96,126),('grasmere-ramp-n','Grasmere ramp (N)','N1','SANRAL','northbound',-26.41561,27.87982,14,41,48,63),('grasmere-ramp-s','Grasmere ramp (S)','N1','SANRAL','southbound',-26.41711,27.88075,14,41,48,63),('verkeerdevlei','Verkeerdevlei','N1','SANRAL','both',-28.79878,26.69057,78.5,157,236,331),('stormvoel','Stormvoël ramp','N1','Bakwena','both',-25.71262,28.26569,12.5,31,36,44),('zambesi','Zambesi ramp','N1','Bakwena','both',-25.68622,28.28152,15,38,44,53),('pumulani','Pumulani','N1','Bakwena','both',-25.63942,28.27548,16.5,41,47,57),('wallmansthal','Wallmansthal ramp','N1','Bakwena','both',-25.58004,28.28159,7.5,19,22.5,26),('murrayhill','Murrayhill ramp','N1','Bakwena','both',-25.50382,28.28781,15,38,45,52),('hammanskraal','Hammanskraal ramp','N1','Bakwena','both',-25.40409,28.29795,35,120,130,150),('carousel','Carousel','N1','Bakwena','both',-25.32499,28.29749,75,202,224,258),('maubane','Maubane ramp','N1','Bakwena','both',-25.28207,28.29822,33,88,97,112),('kranskop','Kranskop','N1','SANRAL','both',-24.78161,28.47154,61.5,157,210,257),('kranskop-ramp','Kranskop ramp','N1','SANRAL','both',-24.7795,28.4728,17,46,54,81),('nyl','Nyl','N1','SANRAL','both',-24.28987,28.9795,79.5,149,180,241),('nyl-ramp','Nyl ramp','N1','SANRAL','both',-24.2886,28.9804,24.5,46,54,69),('sebetiela','Sebetiela ramp','N1','SANRAL','both',-24.16774,29.08548,24.5,46,58,77),('capricorn','Capricorn','N1','SANRAL','both',-23.3669,29.77502,63.5,175,205,256),('baobab','Baobab','N1','SANRAL','both',-22.64713,29.9181,61.5,168,231,278),('tsitsikamma','Tsitsikamma','N2','SANRAL','both',-33.95038,23.62324,73,183,438,619),('izotsha','Izotsha ramp','N2','SANRAL','both',-30.79989,30.40131,12.5,23,31,54),('oribi','Oribi','N2','SANRAL','both',-30.74832,30.43351,41,73,100,162),('oribi-ramp-s','Oribi ramp (S)','N2','SANRAL','southbound',-30.75445,30.43288,18.5,34,46,73),('oribi-ramp-n','Oribi ramp (N)','N2','SANRAL','northbound',-30.75434,30.43201,22,38,54,100),('umtentweni','Umtentweni ramp','N2','SANRAL','both',-30.70047,30.44547,17.5,31,42,69),('king-shaka-airport','King Shaka Airport ramp','N2','SANRAL','both',-29.63365,31.1207,8.5,17,26,34),('othongathi','oThongathi','N2','SANRAL','both',-29.58818,31.14103,15.5,32,42,62),('othongathi-ramp','oThongathi ramp (S & N)','N2','SANRAL','both',-29.58176,31.14437,7.5,17,21,31),('mvoti','Mvoti','N2','SANRAL','both',-29.40341,31.28544,18.5,52,70,104),('mandini','Mandini ramp','N2','SANRAL','both',-29.18475,31.48119,10,19,23,31),('dokodweni','Dokodweni ramp','N2','SANRAL','both',-29.07871,31.61365,27,53,62,84),('mtunzini','Mtunzini','N2','SANRAL','both',-28.95732,31.73777,63.5,122,146,217),('mtunzini-ramp-s','Mtunzini ramp (S)','N2','SANRAL','southbound',-28.95233,31.74186,53,99,119,172),('mtunzini-ramp-n','Mtunzini ramp (N)','N2','SANRAL','northbound',-28.95202,31.74045,11.5,23,27,45),('mariannhill','Mariannhill','N3','SANRAL','both',-29.82305,30.80277,16.5,30,37,57),('mooi','Mooi River','N3','N3TC','both',-29.21807,30.0036,70,171,240,324),('mooi-ramp-s','Mooi River ramp (S)','N3','N3TC','southbound',-29.22167,30.00497,49,119,168,227),('mooi-ramp-n','Mooi River ramp (N)','N3','N3TC','northbound',-29.22169,30.00367,21,51,72,97),('treverton','Treverton ramp','N3','N3TC','both',-29.19299,29.99358,21,51,72,97),('bergville','Bergville ramp','N3','N3TC','both',-28.58864,29.60904,30,35,65,100),('tugela','Tugela','N3','N3TC','both',-28.46228,29.56166,100,165,260,359),('tugela-east','Tugela East ramp','N3','N3TC','both',-28.4581,29.56997,62,102,152,211),('wilge','Wilge','N3','N3TC','both',-27.04055,28.6261,94,161,215,304),('de-hoek','De Hoek','N3','N3TC','both',-26.66395,28.38982,67,105,160,230),('pelindaba','Pelindaba','N4','SANRAL','both',-25.77793,27.95979,8,15,21,27),('quagga','Quagga','N4','SANRAL','both',-25.74927,28.11488,6.5,11,16,21),('swartruggens','Swartruggens','N4','Bakwena','both',-25.66083,26.60505,103,258,313,368),('kroondal','Kroondal ramp','N4','Bakwena','both',-25.72938,27.30897,20,48,54,64),('marikana','Marikana','N4','Bakwena','both',-25.74746,27.39729,30,72,81,96),('buffelspoort','Buffelspoort ramp','N4','Bakwena','both',-25.75184,27.49239,20,48,54,64),('brits','Brits','N4','Bakwena','both',-25.65004,27.92155,20,70,77,90),('k99','K99 ramp','N4','Bakwena','both',-25.64347,28.24469,20,50,58,70),('doornpoort','Doornpoort','N4','Bakwena','both',-25.64342,28.25373,20,50,58,70),('donkerhoek','Donkerhoek ramp','N4','TRAC','both',-25.77282,28.43277,17,24,34,66),('cullinan','Cullinan ramp','N4','TRAC','both',-25.79716,28.51608,21,34,51,86),('diamond-hill','Diamond Hill','N4','TRAC','both',-25.79805,28.5504,51,70,133,220),('valtaki-east','Valtaki East ramp','N4','TRAC','both',-25.79967,28.61798,39,55,81,183),('ekandustria-east','Ekandustria East ramp','N4','TRAC','both',-25.80787,28.69744,31,47,65,130),('middelburg','Middelburg','N4','TRAC','both',-25.86601,29.36389,84,182,277,365),('machadodorp','Machadodorp (Machado)','N4','TRAC','both',-25.62783,30.2583,126,350,510,729),('nkomazi','Nkomazi','N4','TRAC','both',-25.53626,31.34442,95,193,281,405),('gosforth','Gosforth','N17','SANRAL','both',-26.24831,28.15831,17,46,50,69),('gosforth-ramp-w','Gosforth ramp (W)','N17','SANRAL','westbound',-26.24872,28.15839,9.5,19,25,33),('gosforth-ramp-e','Gosforth ramp (E)','N17','SANRAL','eastbound',-26.24799,28.15824,7.5,29,31,42),('dalpark','Dalpark','N17','SANRAL','both',-26.2563,28.32764,15.5,32,42,58),('denne','Denne ramp','N17','SANRAL','both',-26.26748,28.36133,13.5,27,35,46),('leandra','Leandra','N17','SANRAL','both',-26.39853,28.94925,50.5,127,190,253),('leandra-ramp','Leandra ramp','N17','SANRAL','both',-26.39627,28.93681,30.5,77,113,152),('trichardt','Trichardt','N17','SANRAL','both',-26.48368,29.32608,25,63,96,127),('ermelo','Ermelo','N17','SANRAL','both',-26.50556,29.86597,45,114,170,226),('brandfort','Brandfort','R30','SANRAL','both',-28.90221,26.33795,62.5,125,188,265) on conflict (id) do update set name=excluded.name,road=excluded.road,operator=excluded.operator,direction=excluded.direction,lat=excluded.lat,lon=excluded.lon,class1=excluded.class1,class2=excluded.class2,class3=excluded.class3,class4=excluded.class4;

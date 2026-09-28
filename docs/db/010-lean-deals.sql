-- 010 – lean deals (28 Sep 2026, Chris: "Yes then do the build … add all the items we discussed").
-- Adds: documents per deal (requested / received / signed / not needed, with the follow-up task and the file),
--       who and by-when on a procedure step (for "next steps with who and when" in the deal status),
--       market prices for chrome and manganese (weekly suggested price from public reports, one tap to confirm).
-- Question status (Not yet / Requested / Still awaiting), the Sourced state and the commission split live in the deal's
-- params under keys that start with "_" – no table change needed. Tasks for "Both" need no change (owner is free text).
-- Reads: partners only (is_owner). Writes: only through the functions below, like the rest of the app.

-- ---------- documents per deal ----------
create table if not exists public.deal_docs (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  doc text not null check (doc ~ '^[a-z0-9_]{2,24}$'),
  status text not null check (status in ('draft', 'requested', 'received', 'signed', 'na')),
  item_id uuid references public.items(id) on delete set null,          -- the follow-up task while it is requested
  att_id uuid references public.attachments(id) on delete set null,     -- the file (upload or a made PDF)
  note text,
  updated_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (deal_id, doc)
);
alter table public.deal_docs enable row level security;
drop policy if exists owner_read_deal_docs on public.deal_docs;
create policy owner_read_deal_docs on public.deal_docs for select to authenticated using (public.is_owner());
revoke insert, update, delete on public.deal_docs from anon, authenticated;

-- set a document's state; an empty status takes it back to "not yet" (the row goes, the history stays in events)
create or replace function public.set_deal_doc(p_deal uuid, p_doc text, p_status text, p_note text default null,
                                               p_item uuid default null, p_att uuid default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_who text; o public.deal_docs; v_id uuid;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  if coalesce(p_doc, '') !~ '^[a-z0-9_]{2,24}$' then raise exception 'unknown document'; end if;
  if not exists (select 1 from public.deals where id = p_deal) then raise exception 'deal not found'; end if;
  v_who := public.current_actor();
  select * into o from public.deal_docs where deal_id = p_deal and doc = p_doc;
  if coalesce(btrim(p_status), '') = '' then
    delete from public.deal_docs where deal_id = p_deal and doc = p_doc;
    if o.id is not null then
      insert into public.events(deal_id, field, old_value, new_value, changed_by, source) values (p_deal, 'doc:' || p_doc, o.status, null, v_who, 'app');
    end if;
    return null;
  end if;
  if p_status not in ('draft', 'requested', 'received', 'signed', 'na') then raise exception 'unknown status'; end if;
  insert into public.deal_docs(deal_id, doc, status, item_id, att_id, note, updated_by, updated_at)
  values (p_deal, p_doc, p_status, p_item, p_att, nullif(btrim(p_note), ''), v_who, now())
  on conflict (deal_id, doc) do update set
    status = excluded.status,
    item_id = coalesce(excluded.item_id, public.deal_docs.item_id),
    att_id = coalesce(excluded.att_id, public.deal_docs.att_id),
    note = coalesce(excluded.note, public.deal_docs.note),
    updated_by = excluded.updated_by, updated_at = now()
  returning id into v_id;
  if o.status is distinct from p_status then
    insert into public.events(deal_id, field, old_value, new_value, changed_by, source) values (p_deal, 'doc:' || p_doc, o.status, p_status, v_who, 'app');
  end if;
  return v_id;
end $$;
revoke all on function public.set_deal_doc(uuid, text, text, text, uuid, uuid) from public, anon;
grant execute on function public.set_deal_doc(uuid, text, text, text, uuid, uuid) to authenticated;

-- ---------- who and by when on a procedure step ----------
alter table public.deal_steps add column if not exists owner text;
alter table public.deal_steps add column if not exists due_on date;
create or replace function public.plan_step(p_id uuid, p_owner text, p_due date)
returns void language plpgsql security definer set search_path to 'public' as $$
declare s public.deal_steps; v_who text;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  select * into s from public.deal_steps where id = p_id;
  if not found then raise exception 'step not found'; end if;
  v_who := public.current_actor();
  update public.deal_steps set owner = nullif(btrim(p_owner), ''), due_on = p_due where id = p_id;
  if s.owner is distinct from nullif(btrim(p_owner), '') or s.due_on is distinct from p_due then
    insert into public.events(deal_id, field, old_value, new_value, changed_by, source)
    values (s.deal_id, 'step:plan', s.title || ' — ' || coalesce(s.owner, '–') || ' / ' || coalesce(s.due_on::text, '–'),
            s.title || ' — ' || coalesce(nullif(btrim(p_owner), ''), '–') || ' / ' || coalesce(p_due::text, '–'), v_who, 'app');
  end if;
end $$;
revoke all on function public.plan_step(uuid, text, date) from public, anon;
grant execute on function public.plan_step(uuid, text, date) to authenticated;

-- ---------- market prices (chrome, manganese) ----------
create table if not exists public.market_prices (
  id bigserial primary key,
  commodity text not null check (commodity in ('Chrome', 'Manganese')),
  grade text not null,
  basis text not null,
  price_low numeric,
  price_high numeric,
  currency text not null default 'USD' check (currency in ('USD', 'ZAR', 'CNY')),
  unit text not null default 't',
  effective date not null,
  source text not null,
  source_url text,
  quote text,
  fx_zar numeric,
  status text not null default 'suggested' check (status in ('suggested', 'accepted', 'dropped')),
  created_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  unique (commodity, grade, basis, effective, source)
);
alter table public.market_prices enable row level security;
drop policy if exists owner_read_market on public.market_prices;
create policy owner_read_market on public.market_prices for select to authenticated using (public.is_owner());
revoke insert, update, delete on public.market_prices from anon, authenticated;

-- a price typed in the app counts as accepted at once
create or replace function public.market_price_set(p_commodity text, p_grade text, p_basis text, p_low numeric, p_high numeric,
                                                   p_currency text, p_unit text, p_effective date, p_note text default null)
returns bigint language plpgsql security definer set search_path to 'public' as $$
declare v_id bigint; v_who text;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  if p_commodity not in ('Chrome', 'Manganese') then raise exception 'chrome or manganese'; end if;
  if coalesce(btrim(p_grade), '') = '' or coalesce(btrim(p_basis), '') = '' then raise exception 'give the grade and the basis'; end if;
  if p_low is null and p_high is null then raise exception 'give the price'; end if;
  v_who := public.current_actor();
  insert into public.market_prices(commodity, grade, basis, price_low, price_high, currency, unit, effective, source, quote, status, decided_by, decided_at)
  values (p_commodity, btrim(p_grade), btrim(p_basis), coalesce(p_low, p_high), coalesce(p_high, p_low), coalesce(p_currency, 'USD'), coalesce(nullif(btrim(p_unit), ''), 't'),
          coalesce(p_effective, public.sa_today()), 'typed by ' || v_who, nullif(btrim(p_note), ''), 'accepted', v_who, now())
  on conflict (commodity, grade, basis, effective, source) do update set price_low = excluded.price_low, price_high = excluded.price_high,
    currency = excluded.currency, unit = excluded.unit, quote = excluded.quote, status = 'accepted', decided_by = excluded.decided_by, decided_at = now()
  returning id into v_id;
  insert into public.events(item_id, field, new_value, changed_by, source) values (null, 'market_price', 'typed #' || v_id, v_who, 'app');
  return v_id;
end $$;
revoke all on function public.market_price_set(text, text, text, numeric, numeric, text, text, date, text) from public, anon;
grant execute on function public.market_price_set(text, text, text, numeric, numeric, text, text, date, text) to authenticated;

-- one tap on a suggested price: accept it or drop it
create or replace function public.market_price_decide(p_id bigint, p_status text)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  if p_status not in ('accepted', 'dropped') then raise exception 'status must be accepted or dropped'; end if;
  update public.market_prices set status = p_status, decided_by = public.current_actor(), decided_at = now() where id = p_id;
  insert into public.events(item_id, field, new_value, changed_by, source) values (null, 'market_price', p_status || ' #' || p_id, public.current_actor(), 'app');
end $$;
revoke all on function public.market_price_decide(bigint, text) from public, anon;
grant execute on function public.market_price_decide(bigint, text) to authenticated;

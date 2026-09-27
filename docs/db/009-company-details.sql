-- 009 – our company details for quotes and statements (27 Sep 2026, Chris: "the quotes that it produces must have the verve
-- details and regenstration etc on it"). One row, edited in Settings › Company details. Kept in the database, not in the public
-- code. Bank account numbers are never stored here: documents say "banking details on our tax invoice".
create table if not exists public.company_profile (
  id int primary key default 1 check (id = 1),
  legal_name text not null default '',
  trading_as text not null default '',
  reg_no text not null default '',
  vat_no text not null default '',
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  payment_terms text not null default '',
  standing_rate text not null default '',
  show_on_docs boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text not null default ''
);
alter table public.company_profile enable row level security;
drop policy if exists owner_read_company on public.company_profile;
create policy owner_read_company on public.company_profile for select to authenticated using (public.is_owner());
drop policy if exists owner_write_company on public.company_profile;
create policy owner_write_company on public.company_profile for insert to authenticated with check (public.is_owner() and id = 1);
drop policy if exists owner_update_company on public.company_profile;
create policy owner_update_company on public.company_profile for update to authenticated using (public.is_owner()) with check (public.is_owner() and id = 1);
grant select, insert, update on public.company_profile to authenticated;
revoke all on public.company_profile from anon;
insert into public.company_profile (id) values (1) on conflict (id) do nothing;
-- The known details are filled in from the Claude project (not written in this public file).

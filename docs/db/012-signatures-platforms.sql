-- 012 – signatures and the sign-ups register (28 Sep 2026).
-- Chris: "can i have a signature block where i can sign things" and "i signed up for trade key and theres no way to record it".
-- Only Chris and Annemarie can read or change these rows (is_owner). Never store passwords here – the register keeps the
-- site, the login name or email, dates, cost and notes only.

-- Each partner draws a signature once (Settings › My signature). It is a small PNG kept as a data URL and placed on the
-- documents they make (templates, quotes, statements) only when they tick "Sign it".
create table if not exists public.signatures (
  person text primary key check (person in ('Chris', 'Annemarie')),
  full_name text not null default '',
  title text not null default '',
  png text not null default '' check (length(png) < 300000),
  updated_at timestamptz not null default now()
);
alter table public.signatures enable row level security;
drop policy if exists owner_all_signatures on public.signatures;
create policy owner_all_signatures on public.signatures for all to authenticated using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on public.signatures to authenticated;
revoke all on public.signatures from anon;

-- Trade sites and services we signed up for (Tradekey, Alibaba, a load board, SMM …): one row each.
create table if not exists public.platforms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  url text not null default '',
  login text not null default '',          -- the login name or email – never the password
  joined_on date,
  status text not null default 'Active' check (status in ('Active', 'Trial', 'Lapsed', 'Cancelled')),
  plan text not null default 'Free' check (plan in ('Free', 'Paid')),
  cost text not null default '',
  renews_on date,
  owner text not null default 'Both' check (owner in ('Chris', 'Annemarie', 'Both')),
  use_for text not null default '',        -- what we use it for (find buyers, post loads …)
  notes text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.platforms enable row level security;
drop policy if exists owner_all_platforms on public.platforms;
create policy owner_all_platforms on public.platforms for all to authenticated using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on public.platforms to authenticated;
revoke all on public.platforms from anon;

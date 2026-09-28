-- 015 – the load register (28 Sep 2026 night). One row per truck load once a deal starts moving material: date, truck, driver,
-- tons at loading and at delivery, moisture, tested grade, the weighbridge ticket and the POD (as files on the load), invoiced,
-- paid. Only Chris and Annemarie (is_owner). Removing the deal removes its loads.
create table if not exists public.loads (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  n integer not null default 1,
  load_date date,
  truck_reg text not null default '',
  driver text not null default '',
  t_loaded numeric,
  t_delivered numeric,
  moisture numeric,
  grade text not null default '',
  invoiced boolean not null default false,
  paid boolean not null default false,
  notes text not null default '',
  updated_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists loads_deal_idx on public.loads(deal_id, n);
alter table public.loads enable row level security;
drop policy if exists owner_all_loads on public.loads;
create policy owner_all_loads on public.loads for all to authenticated using (public.is_owner()) with check (public.is_owner());
grant select, insert, update, delete on public.loads to authenticated;
revoke all on public.loads from anon;

-- removing a deal also removes the file records of its loads (tickets, PODs)
create or replace function public.delete_deal(p_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_name text; v_who text;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  select name into v_name from deals where id = p_id;
  if v_name is null then raise exception 'deal not found'; end if;
  v_who := public.current_actor();
  update deal_docs set item_id = null where deal_id = p_id;
  delete from items where deal_id = p_id;
  delete from attachments where target_type = 'load' and target_id in (select id::text from loads where deal_id = p_id);
  delete from attachments where target_type = 'deal' and target_id = p_id::text;
  delete from deals where id = p_id;   -- deal_steps, deal_docs, deal_folders, loads go with it (on delete cascade)
  insert into events(field, old_value, new_value, changed_by, source) values ('deal:deleted', v_name, 'removed', v_who, 'app');
  return v_name;
end $$;

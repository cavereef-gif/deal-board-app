-- 014 – the mineral procedure in the order we really trade (28 Sep 2026 night).
-- Chris: "we want to verify our buyers ASAP and we want to verify the stockpile ASAP. The seller usually asks for a LOI followed by
-- an ICPO, thereafter the buyer can test the stockpile for grade, either pay by escrow or cash in some instances. The seller usually
-- wants a proof of funds before paperwork ... then there is a FCO. Then SPA then a purchase order. Then it will go to proforma
-- invoice and then after testing the invoice."
-- The app's short procedure maps onto the kit's steps by code; steps the kit does not have get their own code (v2.xx). This adds
-- the missing ones to a mineral deal – nothing is removed, ticks already made stay.
create or replace function public.lean_seed_v2(p_deal uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer := 0; d deals; r record;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  select * into d from deals where id = p_deal;
  if not found or d.kind <> 'mineral' then return 0; end if;
  for r in select * from (values
    ('v2.01', '1. Check both sides', 'Buyer checked', array['v2.01']),
    ('v2.02', '1. Check both sides', 'Stockpile checked', array['v2.02','5.1']),
    ('v2.03', '2. Buyer''s offer', 'LOI in', array['v2.03','4.1']),
    ('v2.04', '2. Buyer''s offer', 'ICPO in', array['v2.04']),
    ('v2.09', '2. Buyer''s offer', 'Proof of funds', array['v2.09','3.7']),
    ('v2.05', '3. Grade test', 'Test paid (escrow or cash)', array['v2.05']),
    ('v2.10', '3. Grade test', 'Grade test passed', array['v2.10','5.2']),
    ('v2.11', '4. Contract', 'FCO in', array['v2.11','4.2']),
    ('v2.12', '4. Contract', 'SPA signed', array['v2.12','6.7']),
    ('v2.06', '4. Contract', 'Purchase order in', array['v2.06']),
    ('v2.07', '5. Invoice and load', 'Proforma invoice sent', array['v2.07']),
    ('v2.13', '5. Invoice and load', 'Loads delivered', array['v2.13','8.1','8.2']),
    ('v2.08', '5. Invoice and load', 'Final invoice sent', array['v2.08','11.3','11.1']),
    ('v2.14', '6. Paid', 'Seller paid', array['v2.14','11.5']),
    ('v2.15', '6. Paid', 'Commission paid', array['v2.15','12.2']),
    ('v2.16', '1. Check both sides', 'NCNDA signed', array['v2.16','1.4']),
    ('v2.17', '1. Check both sides', 'IMFPA signed', array['v2.17','2.1'])
  ) as t(code, stage, title, codes) loop
    if not exists (select 1 from deal_steps where deal_id = p_deal and code = any(r.codes)) then
      insert into deal_steps(deal_id, stage, sort, title, status, custom, code) values (p_deal, r.stage, 900 + n, r.title, 'open', false, r.code);
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.lean_seed_v2(uuid) from public, anon;
grant execute on function public.lean_seed_v2(uuid) to authenticated;

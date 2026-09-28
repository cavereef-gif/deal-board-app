-- 016 – expiry dates on papers (28 Sep 2026 night). An FCO, a proof of funds, an assay, an insurance certificate, a tax PIN or a
-- quote is only good until a date; the app warns before it runs out. Deal papers: deal_docs.expires_on (set through
-- set_doc_expiry). Our company papers: attachments.expires_on (the owners may already write attachments directly).
alter table public.deal_docs add column if not exists expires_on date;
alter table public.attachments add column if not exists expires_on date;
create or replace function public.set_doc_expiry(p_deal uuid, p_doc text, p_date date)
returns void language plpgsql security definer set search_path = public as $$
declare v_who text;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  v_who := public.current_actor();
  update deal_docs set expires_on = p_date, updated_by = v_who, updated_at = now() where deal_id = p_deal and doc = p_doc;
  if not found then
    insert into deal_docs(deal_id, doc, status, expires_on, updated_by) values (p_deal, p_doc, 'received', p_date, v_who);
  end if;
  insert into events(deal_id, field, old_value, new_value, changed_by, source) values (p_deal, 'doc:expiry', p_doc, coalesce(p_date::text, 'none'), v_who, 'app');
end $$;
revoke all on function public.set_doc_expiry(uuid, text, date) from public, anon;
grant execute on function public.set_doc_expiry(uuid, text, date) to authenticated;

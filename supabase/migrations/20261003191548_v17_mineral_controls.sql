-- V17 mineral controls. Additive only; historical statuses and evidence are retained.
-- Preconditions: existing migrations 010, 014, 015, 016, 017 and owner/event helpers.
begin;
alter table public.deal_steps add column if not exists custom_label text;
alter table public.deal_steps add column if not exists override_reason text;
alter table public.deal_docs add column if not exists override_reason text;
alter table public.deals add column if not exists won_override_reason text;

-- Resolve legacy identity once, before installing the immutable-code guard.
update public.deal_steps s set code = t.code
from public.kit_templates t where s.code is null and not s.custom and s.title = t.title and t.kind = (select kind from public.deals where id=s.deal_id);
update public.deal_steps set code = case
 when title ~* '^Buyer checked$' then 'v2.01' when title ~* 'stockpile checked|site visit' then 'v2.02'
 when title ~* 'NCNDA' then 'v2.16' when title ~* 'IMFPA|commission agreement' then 'v2.17'
 when title ~* 'proof of funds' then 'v2.09' when title ~* 'grade test passed|independent assay|assay 1' then 'v2.10'
 when title ~* 'SPA signed' then 'v2.12' when title ~* '^Payment secured$' then 'v2.18'
 when title ~* 'loads delivered|loaded and weighed|trial' then 'v2.13'
 when title ~* 'seller paid|buyer paid the seller|seller confirms' then 'v2.14'
 when title ~* 'commission paid|our commission received|commission received' then 'v2.15'
 when title ~* '\mLOI\M' then 'v2.03' when title ~* '\mICPO\M' then 'v2.04' when title ~* '\mFCO\M' then 'v2.11'
 else code end
where code is null and not custom and deal_id in (select id from public.deals where kind='mineral');
-- Preserve wording already edited under migration 017; standard kit wording uses the short UI label.
update public.deal_steps s set custom_label=s.title
where s.code is not null and exists(select 1 from public.kit_templates t where t.code=s.code and t.kind=(select kind from public.deals where id=s.deal_id) and t.title<>s.title)
 and s.code not like 'v2.%';

-- Migration 017 recorded label edits without changing code. Carry those labels forward too.
update public.deal_steps s set custom_label=s.title
where exists(select 1 from public.events e where e.deal_id=s.deal_id and e.field='step:edit' and e.new_value=s.title);

create or replace function public.control_trust(p jsonb) returns jsonb language plpgsql immutable security invoker set search_path=public as $$
declare t jsonb := coalesce(p->'_trust','{}'); s jsonb; f jsonb;
begin
 if coalesce(t->>'version','') <> '2' then
  s := coalesce(t->'seller','{}'); f := coalesce(t->'funds','{}');
  if s ? 'seen' and s->'seen' not in ('null'::jsonb,'false'::jsonb) then
   if not s ? 'photos' then s:=s||jsonb_build_object('photos',s->'seen'); end if;
   if not s ? 'loc' then s:=s||jsonb_build_object('loc',s->'seen'); end if;
  end if;
  if t->'buyer' ? 'bank' and not f ? 'how' then
   f:=f||jsonb_build_object('how',coalesce(t->'buyer'->'bank','{}')||jsonb_build_object('v','Phoned the bank on a number we found ourselves'));
  end if;
  t:=t||jsonb_build_object('seller',s,'funds',f,'version',2);
 end if;
 return t;
end $$;
create or replace function public.control_has_flags(p jsonb) returns boolean language sql immutable security invoker set search_path=public as $$
 select exists(select 1 from jsonb_each(coalesce(p->'_trust'->'flags','{}')) where value not in ('null'::jsonb,'false'::jsonb));
$$;
create or replace function public.control_doc_ok(p_deal uuid,p_doc text,p_override boolean default true) returns boolean language sql stable security invoker set search_path=public as $$
 select exists(select 1 from deal_docs r where r.deal_id=p_deal and r.doc=p_doc
 and (r.expires_on is null or r.expires_on >= (now() at time zone 'Africa/Johannesburg')::date)
 and ((p_override and btrim(coalesce(r.override_reason,''))<>'' and r.status in ('received','signed','na'))
 or ((case when p_doc in ('ncnda','imfpa','spa') then r.status='signed' else r.status in ('received','signed') end)
 and exists(select 1 from attachments a where a.id=r.att_id and a.target_type='deal' and a.target_id=p_deal::text and coalesce(a.path,'')<>''))));
$$;
create or replace function public.control_verified(p_deal uuid,p_side text) returns boolean language plpgsql stable security invoker set search_path=public as $$
declare t jsonb; k text; keys text[];
begin
 select public.control_trust(params) into t from deals where id=p_deal;
 if p_side='funds' then
  return public.control_doc_ok(p_deal,'pof') and coalesce(t->'funds'->'how'->>'v','') in
   ('Phoned the bank on a number we found ourselves','Our bank confirmed it with theirs','An attorney or escrow confirmed it');
 end if;
 keys := case p_side when 'buyer' then array['cipc','dirid','who','contact','nodnd'] when 'seller' then array['cipc','right','owner','photos','loc'] else array['invalid'] end;
 foreach k in array keys loop if coalesce(t->p_side->k,'false') in ('false'::jsonb,'null'::jsonb) then return false; end if; end loop;
 return true;
end $$;
create or replace function public.control_secured(p_deal uuid) returns boolean language plpgsql stable security invoker set search_path=public as $$
declare s jsonb;
begin
 select params->'_payment_security' into s from deals where id=p_deal;
 return coalesce(s->>'type','') in ('escrow','tt','lc','equivalent') and s->'confirmed'='true'::jsonb
 and btrim(coalesce(s->>'reference',''))<>'' and (s->>'type'<>'equivalent' or btrim(coalesce(s->>'terms',''))<>'')
 and public.control_verified(p_deal,'funds') and public.control_doc_ok(p_deal,'security',false);
end $$;
create or replace function public.control_loading_missing(p_deal uuid) returns text[] language plpgsql stable security invoker set search_path=public as $$
declare d deals; k text; out text[] := '{}';
begin
 select * into d from deals where id=p_deal;
 if d.id is null then return array['Deal not found']; end if;
 if d.kind<>'mineral' then return out; end if;
 if public.control_has_flags(d.params) then out:=array_append(out,'Review Required'); end if;
 foreach k in array array['buyer','seller','funds'] loop if not coalesce(public.control_verified(p_deal,k),false) then out:=array_append(out,k||' verification'); end if; end loop;
 foreach k in array array['ncnda','imfpa','poo','pof','assay','spa'] loop if not public.control_doc_ok(p_deal,k) then out:=array_append(out,k||' evidence'); end if; end loop;
 if not coalesce(public.control_secured(p_deal),false) then out:=array_append(out,'Payment Secured'); end if;
 return out;
end $$;
create or replace function public.control_won_missing(p_deal uuid) returns text[] language plpgsql stable security invoker set search_path=public as $$
declare out text[]; k text;
begin
 if (select kind from deals where id=p_deal)<>'mineral' then return '{}'; end if;
 out:=public.control_loading_missing(p_deal);
 if not exists(select 1 from deal_steps where deal_id=p_deal and code in ('v2.14','11.5') and status='done') then out:=array_append(out,'Seller paid'); end if;
 if not exists(select 1 from deal_steps where deal_id=p_deal and code in ('v2.15','12.2') and status='done') then out:=array_append(out,'Commission paid'); end if;
 foreach k in array array['pod','tickets'] loop if not public.control_doc_ok(p_deal,k) then out:=array_append(out,k||' evidence'); end if; end loop;
 return out;
end $$;

insert into deal_steps(deal_id,code,stage,sort,title,status,custom)
select id,'v2.18','5. Invoice and load',907,'Payment Secured','open',false from deals d
where kind='mineral' and not exists(select 1 from deal_steps s where s.deal_id=d.id and s.code in ('v2.18','7.1','7.2'));


-- Every guarded write takes the same deal lock, so closure and progression cannot race.
create or replace function public.control_guard_step() returns trigger language plpgsql security definer set search_path=public as $$
declare d deals; k text; docs text[]:='{}'; missing text[];
begin
 if not public.is_owner() then raise exception 'not allowed'; end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.code is distinct from old.code or new.deal_id<>old.deal_id then raise exception 'Step identity is immutable'; end if;
  if new.title is distinct from old.title then new.custom_label:=new.title; end if;
  if new.status='open' and old.status<>'open' then new.override_reason:=null; end if;
 end if;
 select * into d from deals where id=new.deal_id for update;
 if (tg_op='INSERT' and new.status<>'open') or (tg_op='UPDATE' and new.status is distinct from old.status and new.status<>'open') then
  if new.code in ('v2.16','1.4','t2.1') then docs:=array['ncnda'];
  elsif new.code in ('v2.17','2.1') then docs:=array['imfpa'];
  elsif new.code in ('v2.02','5.1') then docs:=array['poo'];
  elsif new.code in ('v2.09','3.7') then docs:=array['pof'];
  elsif new.code in ('v2.10','5.2') then docs:=array['assay'];
  elsif new.code in ('v2.12','6.7') then docs:=array['spa'];
  elsif new.code in ('v2.13','8.1','8.2','t6.1') then docs:=array['pod','tickets']; end if;
  if d.kind='mineral' and new.code is not null and public.control_has_flags(d.params) then raise exception 'Review Required: clear red flags with a reason'; end if;
  if d.kind='mineral' and (new.code in ('v2.18','7.1','7.2','v2.13','8.1','8.2') or new.code like '10.%') then
   if new.status<>'done' then raise exception 'Payment/loading controls cannot be skipped'; end if;
   if not coalesce(public.control_secured(d.id),false) then raise exception 'Payment Secured required'; end if;
  end if;
  if d.kind='mineral' and (new.code in ('v2.13','8.1','8.2') or new.code like '10.%') then
   missing:=public.control_loading_missing(d.id); if cardinality(missing)>0 then raise exception 'Loading blocked: %',array_to_string(missing,', '); end if;
  end if;
  if new.status='na' and (cardinality(docs)>0 or new.code='v2.01') and btrim(coalesce(new.override_reason,''))='' then raise exception 'Critical override requires a recorded reason'; end if;
  if new.status='done' then
   foreach k in array docs loop if not public.control_doc_ok(d.id,k) then raise exception 'Critical document % requires attached evidence or recorded override',k; end if; end loop;
   if d.kind='mineral' then
    if new.code='v2.01' and not public.control_verified(d.id,'buyer') then raise exception 'Buyer verification required'; end if;
    if new.code in ('v2.02','5.1') and not public.control_verified(d.id,'seller') then raise exception 'Stockpile verification required'; end if;
    if new.code in ('v2.09','3.7') and not public.control_verified(d.id,'funds') then raise exception 'Funds verification required'; end if;
    if new.code in ('v2.12','6.7') then
     foreach k in array array['buyer','seller','funds'] loop if not public.control_verified(d.id,k) then raise exception '% verification required',k; end if; end loop;
     foreach k in array array['ncnda','imfpa','poo','assay'] loop if not public.control_doc_ok(d.id,k) then raise exception '% evidence required',k; end if; end loop;
    end if;
   end if;
  end if;
 end if;
 return new;
end $$;
create trigger control_step before insert or update on public.deal_steps for each row execute function public.control_guard_step();

create or replace function public.control_guard_document() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if not public.is_owner() then raise exception 'not allowed'; end if;
 perform 1 from deals where id=new.deal_id for update;
 if tg_op='UPDATE' then
  if new.deal_id<>old.deal_id or new.doc<>old.doc then raise exception 'Document identity is immutable'; end if;
  if new.att_id is distinct from old.att_id or new.status in ('draft','requested') then new.override_reason:=null; end if;
 end if;
 if new.att_id is not null and not exists(select 1 from attachments where id=new.att_id and target_type='deal' and target_id=new.deal_id::text and coalesce(path,'')<>'') then raise exception 'File must belong to this deal'; end if;
 if (tg_op='INSERT' or new.status is distinct from old.status) and new.doc in ('ncnda','imfpa','poo','pof','assay','spa','security','pod','tickets') and new.status in ('received','signed','na') and btrim(coalesce(new.override_reason,''))='' and (new.status='na' or new.att_id is null) then raise exception 'Critical document needs a file or a recorded override'; end if;
 return new;
end $$;
create trigger control_document before insert or update on public.deal_docs for each row execute function public.control_guard_document();

create or replace function public.control_guard_deal() returns trigger language plpgsql security definer set search_path=public as $$
declare k text; v jsonb; missing text[];
begin
 if not public.is_owner() then raise exception 'not allowed'; end if;
 if tg_op='UPDATE' then
  if old.kind='mineral' and new.kind<>'mineral' then raise exception 'Mineral controls cannot be removed by changing kind'; end if;
  for k,v in select key,value from jsonb_each(coalesce(old.params->'_trust'->'flags','{}')) loop
   if v not in ('null'::jsonb,'false'::jsonb) and coalesce(new.params->'_trust'->'flags'->k,'false') in ('null'::jsonb,'false'::jsonb) then
    if btrim(coalesce(new.params->'_trust'->'clearances'->k->>'reason',''))='' or new.params->'_trust'->'clearances'->k is not distinct from old.params->'_trust'->'clearances'->k then raise exception 'Clearing red flag % requires a new reason',k; end if;
    insert into events(deal_id,field,old_value,new_value,changed_by,source) values(new.id,'control:flag_clear:'||k,v::text,new.params->'_trust'->'clearances'->k->>'reason',public.current_actor(),'app');
   end if;
  end loop;
  if new.status<>'Won' then new.won_override_reason:=null; end if;
  -- Normal param saves cannot remove or alter historical verification ticks by migration.
  if new.params is distinct from old.params then
   insert into events(deal_id,field,old_value,new_value,changed_by,source) values(new.id,'control:params',old.params::text,new.params::text,public.current_actor(),'app');
  end if;
 end if;
 if new.status='Won' and (tg_op='INSERT' or old.status<>'Won') and new.kind='mineral' then
  if tg_op='INSERT' then raise exception 'New mineral deal cannot start Won'; end if;
  if new.params is distinct from old.params then raise exception 'Save control evidence before closing'; end if;
  missing:=public.control_won_missing(new.id);
  if cardinality(missing)>0 and btrim(coalesce(new.won_override_reason,''))='' then raise exception 'Won blocked: %',array_to_string(missing,', '); end if;
  if cardinality(missing)>0 then
   insert into events(deal_id,field,new_value,changed_by,source) values(new.id,'control:won_override',new.won_override_reason||' | blockers: '||array_to_string(missing,', '),public.current_actor(),'app');
  end if;
 end if;
 return new;
end $$;
create trigger control_deal before insert or update on public.deals for each row execute function public.control_guard_deal();
create or replace function public.control_guard_load() returns trigger language plpgsql security definer set search_path=public as $$
declare missing text[];
begin
 if not public.is_owner() then raise exception 'not allowed'; end if;
 if tg_op='UPDATE' and new.deal_id<>old.deal_id then raise exception 'Load deal identity is immutable'; end if;
 perform 1 from deals where id=new.deal_id for update;
 -- Every insert/update is checked, including existing historical loads; no data is deleted.
 missing:=public.control_loading_missing(new.deal_id);
 if cardinality(missing)>0 then raise exception 'Loading blocked: %',array_to_string(missing,', '); end if;
 return new;
end $$;
create trigger control_load before insert or update on public.loads for each row execute function public.control_guard_load();

create or replace function public.control_document_override(p_deal uuid,p_doc text,p_status text,p_reason text) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_owner() then raise exception 'not allowed'; end if;
 if btrim(coalesce(p_reason,''))='' then raise exception 'Override requires a reason'; end if;
 if p_doc not in ('ncnda','imfpa','poo','pof','assay','spa','security','pod','tickets') or p_status not in ('received','signed','na') then raise exception 'Invalid document override'; end if;
 perform 1 from deals where id=p_deal for update;
 insert into deal_docs(deal_id,doc,status,override_reason,updated_by) values(p_deal,p_doc,p_status,btrim(p_reason),public.current_actor())
 on conflict(deal_id,doc) do update set status=excluded.status,override_reason=excluded.override_reason,updated_by=excluded.updated_by,updated_at=now();
 insert into events(deal_id,field,new_value,changed_by,source) values(p_deal,'control:document:'||p_doc,btrim(p_reason),public.current_actor(),'app');
end $$;
create or replace function public.control_step_override(p_id uuid,p_reason text) returns void language plpgsql security definer set search_path=public as $$
declare s deal_steps;
begin
 if not public.is_owner() then raise exception 'not allowed'; end if;
 if btrim(coalesce(p_reason,''))='' then raise exception 'Override requires a reason'; end if;
 select * into s from deal_steps where id=p_id; if not found then raise exception 'Step not found'; end if;
 update deal_steps set status='na',override_reason=btrim(p_reason),evidence='Override: '||btrim(p_reason),done_by=public.current_actor(),done_at=now() where id=p_id;
 insert into events(deal_id,field,new_value,changed_by,source) values(s.deal_id,'control:step:'||coalesce(s.code,s.id::text),btrim(p_reason),public.current_actor(),'app');
end $$;
create or replace function public.control_close_deal(p_deal uuid,p_reason text default null) returns void language plpgsql security definer set search_path=public as $$
declare d deals;
begin
 if not public.is_owner() then raise exception 'not allowed'; end if;
 select * into d from deals where id=p_deal for update; if not found then raise exception 'Deal not found'; end if;
 update deals set status='Won',won_override_reason=nullif(btrim(p_reason),''),updated_at=now(),updated_by=public.current_actor() where id=p_deal;
 insert into events(deal_id,field,old_value,new_value,changed_by,source) values(p_deal,'status',d.status,'Won',public.current_actor(),'app');
end $$;

create or replace function public.control_seed_security() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.kind='mineral' and not exists(select 1 from deal_steps where deal_id=new.id and code in ('v2.18','7.1','7.2')) then
  insert into deal_steps(deal_id,code,stage,sort,title,status,custom) values(new.id,'v2.18','5. Invoice and load',907,'Payment Secured','open',false);
 end if;
 return new;
end $$;
create trigger control_seed after insert on public.deals for each row execute function public.control_seed_security();
-- Helper functions are invoker-only; guarded RPCs retain the existing owner check.
-- Trigger functions are not callable through PostgREST.
do $$ declare f record; begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'control_%' loop
  execute format('revoke all on function %s from public, anon, authenticated',f.signature);
  if f.signature::text !~ 'control_guard_|control_seed_security' then execute format('grant execute on function %s to authenticated',f.signature); end if;
 end loop;
end $$;
commit;

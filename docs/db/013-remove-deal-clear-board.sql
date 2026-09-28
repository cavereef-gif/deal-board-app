-- 013 – remove a deal completely, and clear the notice board (28 Sep 2026 evening).
-- Chris: "i also cant remove deals that was only proposal to check the numbers. i need to be able to remove it completely" ·
-- "i cant clear the board under the board tab".
-- Only a person does this, in the app, after a second tap (the bot never deletes – standing rule). One line stays in events
-- saying what was removed, by whom and when.

-- A deal and everything that belongs only to it: its steps, documents, Drive folder link (cascade), its tasks, its file
-- records (the stored files are removed by the app first). Board posts and buyer-list rows that mention it stay, just no longer linked.
-- The history (events) is append-only and is never deleted: its links to deals and tasks become plain ids so a removed
-- deal's history stays readable (the two foreign keys from events are dropped).
alter table public.events drop constraint if exists events_deal_id_fkey;
alter table public.events drop constraint if exists events_item_id_fkey;
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
  delete from attachments where target_type = 'deal' and target_id = p_id::text;
  delete from deals where id = p_id;   -- deal_steps, deal_docs, deal_folders go with it (on delete cascade)
  insert into events(field, old_value, new_value, changed_by, source) values ('deal:deleted', v_name, 'removed', v_who, 'app');
  return v_name;
end $$;
revoke all on function public.delete_deal(uuid) from public, anon;
grant execute on function public.delete_deal(uuid) to authenticated;

-- post_action gains 'delete' (one message)
create or replace function public.post_action(p_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare p posts; v_who text;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  if p_action not in ('pin','unpin','done','open','delete') then raise exception 'unknown action'; end if;
  v_who := public.current_actor();
  select * into p from posts where id = p_id for update;
  if not found then raise exception 'post not found'; end if;
  if p_action = 'delete' then
    delete from posts where id = p_id;
  else
    update posts set pinned = case p_action when 'pin' then true when 'unpin' then false else pinned end,
                     done = case p_action when 'done' then true when 'open' then false else done end,
                     updated_at = now() where id = p_id;
  end if;
  insert into events(deal_id, field, old_value, new_value, changed_by, source) values (p.deal_id, 'post:' || p_action, left(p.body, 120), p_action, v_who, 'app');
end $$;

-- clear the board: every message, or all but the pinned ones; returns how many went
create or replace function public.clear_board(p_keep_pinned boolean default true)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer; v_who text;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  v_who := public.current_actor();
  delete from posts where not (p_keep_pinned and pinned);
  get diagnostics n = row_count;
  insert into events(field, old_value, new_value, changed_by, source) values ('board:cleared', n::text || ' messages', case when p_keep_pinned then 'pinned kept' else 'all' end, v_who, 'app');
  return n;
end $$;
revoke all on function public.clear_board(boolean) from public, anon;
grant execute on function public.clear_board(boolean) to authenticated;

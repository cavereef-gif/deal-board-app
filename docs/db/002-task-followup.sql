-- 002-task-followup.sql
-- Adds a "followup" action to task_action (buyer/supplier search steps).
-- Use it when someone did not reply: the step stays OPEN (not done) and comes
-- back on the follow-up date.
--   p_value = 'YYYY-MM-DD|what happened'  (date optional; default today + 3 days)
-- Applied to project egirxhjfgkwqjgxfxzea on 26 Sep 2026 as migration v17_task_followup.
-- Safe to re-run. Nothing else changes: done / reopen / block / drop work as before.

CREATE OR REPLACE FUNCTION public.task_action(p_id uuid, p_action text, p_value text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
declare o lead_tasks; v_who text; l uuid; msg text; v_date date; v_note text; v_raw text; v_dtxt text;
begin
  if not public.is_owner() then raise exception 'not allowed'; end if;
  v_who := public.current_actor();
  select * into o from lead_tasks where id = p_id for update;
  if not found then raise exception 'task not found'; end if;
  if p_action = 'done' then
    update lead_tasks set status = 'done', outcome = coalesce(nullif(btrim(p_value), ''), outcome), done_by = v_who, done_at = now() where id = p_id;
    msg := 'Done: ' || o.task || coalesce(' — ' || nullif(btrim(p_value), ''), '');
  elsif p_action = 'reopen' then
    update lead_tasks set status = 'open', done_by = null, done_at = null, blocked_note = '' where id = p_id;
    msg := 'Reopened: ' || o.task;
  elsif p_action = 'block' then
    update lead_tasks set status = 'blocked', blocked_note = coalesce(btrim(p_value), '') where id = p_id;
    msg := 'Blocked: ' || o.task || coalesce(' — ' || nullif(btrim(p_value), ''), '');
  elsif p_action = 'drop' then
    update lead_tasks set status = 'dropped', outcome = coalesce(nullif(btrim(p_value), ''), outcome) where id = p_id;
    msg := 'Dropped: ' || o.task;
  elsif p_action = 'followup' then
    v_raw := coalesce(p_value, '');
    if position('|' in v_raw) > 0 then
      v_dtxt := split_part(v_raw, '|', 1);
      v_note := substr(v_raw, position('|' in v_raw) + 1);
    else
      v_dtxt := v_raw; v_note := '';
    end if;
    begin
      v_date := nullif(btrim(v_dtxt), '')::date;
    exception when others then
      v_date := null;
      if position('|' in v_raw) = 0 then v_note := v_raw; end if;
    end;
    if v_date is null or v_date < current_date then v_date := current_date + 3; end if;
    v_note := nullif(btrim(v_note), '');
    update lead_tasks set status = 'open', done_by = null, done_at = null, blocked_note = '',
      not_before = v_date, outcome = coalesce(v_note, 'No reply yet') where id = p_id;
    msg := 'Follow up ' || to_char(v_date, 'Dy DD Mon') || ': ' || o.task || ' — ' || coalesce(v_note, 'No reply yet');
  else
    raise exception 'unknown action';
  end if;
  insert into events(lead_id, field, old_value, new_value, changed_by, source) values (null, 'task:' || p_action, p_id::text, msg, v_who, 'app');
  foreach l in array o.lead_ids loop
    insert into events(lead_id, field, old_value, new_value, changed_by, source) values (l, 'task:' || p_action, p_id::text, msg, v_who, 'app');
  end loop;
end $function$;

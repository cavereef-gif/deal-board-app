-- 011 – weekly market price check (28 Sep 2026; applied from the Claude project the same day).
-- Mondays 04:40 UTC (06:40 in South Africa, before the 07:00 phone note) the timer asks the `tools` edge function
-- (action "market") to read the newest free SMM chrome and manganese reviews. What it finds arrives as "suggested" in
-- market_prices (change 010); a partner accepts or drops it with one tap. The function skips a run if it checked in the
-- last 3 days, so a second timer or a "Check now" tap never reads twice.
-- The keys stay in Vault (SB_ANON_JWT, TOOLS_CRON_TOKEN) – nothing secret is written here.
select cron.schedule('deal-board-market', '40 4 * * 1', $$
select net.http_post(
  url := 'https://egirxhjfgkwqjgxfxzea.supabase.co/functions/v1/tools',
  headers := jsonb_build_object('Content-Type', 'application/json',
    'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'SB_ANON_JWT'),
    'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'SB_ANON_JWT'),
    'x-cron-token', (select decrypted_secret from vault.decrypted_secrets where name = 'TOOLS_CRON_TOKEN')),
  body := '{"action":"market"}'::jsonb,
  timeout_milliseconds := 150000)
$$);
-- To stop it: select cron.unschedule('deal-board-market');

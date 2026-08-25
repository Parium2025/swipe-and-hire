-- Bug A: user_sessions har REPLICA IDENTITY FULL men publiceras med en kolumnlista,
-- vilket gör att alla UPDATE/DELETE misslyckas ("Column list used by the publication
-- does not cover the replica identity"). cleanup_stale_sessions() har därför kraschat
-- 380+ gånger sedan i augusti. Primärnyckeln (id) ingår i kolumnlistan → DEFAULT funkar.
alter table public.user_sessions replica identity default;

-- Bug B: pgmq-kön togs bort i e-postmigreringen, men nattstädningen finns kvar.
do $$
begin
  perform cron.unschedule('purge-email-dlq-nightly');
exception when others then null;
end $$;
drop function if exists public.purge_old_email_dlq();

-- Bug C: alla trigger-funktioner pekade på den försvunna vault-nyckeln och
-- skickade tyst "Bearer " (NULL) → 401. Nu via cron_auth_header() som felar högt.
create or replace function public.trigger_hr_news_fetch()
returns void language plpgsql security definer set search_path to 'public', 'vault' as $$
begin
  perform net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/fetch-hr-news',
    headers := public.cron_auth_header(),
    body := jsonb_build_object('force', true)
  );
end;
$$;

create or replace function public.trigger_career_tips_fetch()
returns void language plpgsql security definer set search_path to 'public', 'vault' as $$
begin
  perform net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/fetch-career-tips',
    headers := public.cron_auth_header(),
    body := jsonb_build_object('force', true)
  );
end;
$$;

create or replace function public.trigger_news_health_watchdog()
returns void language plpgsql security definer set search_path to 'public', 'vault' as $$
begin
  perform net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/news-health-watchdog',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
end;
$$;

create or replace function public.trigger_cron_health_watchdog()
returns void language plpgsql security definer set search_path to 'public', 'vault' as $$
begin
  perform net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/cron-health-watchdog',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
end;
$$;

create or replace function public.trigger_inactive_account_retention()
returns void language plpgsql security definer set search_path to 'public', 'vault' as $$
begin
  perform net.http_post(
    url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/inactive-account-retention',
    headers := public.cron_auth_header(),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.trigger_hr_news_fetch() from public, anon, authenticated;
revoke all on function public.trigger_career_tips_fetch() from public, anon, authenticated;
revoke all on function public.trigger_news_health_watchdog() from public, anon, authenticated;
revoke all on function public.trigger_cron_health_watchdog() from public, anon, authenticated;
revoke all on function public.trigger_inactive_account_retention() from public, anon, authenticated;
grant execute on function public.trigger_hr_news_fetch() to service_role;
grant execute on function public.trigger_career_tips_fetch() to service_role;
grant execute on function public.trigger_news_health_watchdog() to service_role;
grant execute on function public.trigger_cron_health_watchdog() to service_role;
grant execute on function public.trigger_inactive_account_retention() to service_role;

-- 1. Skapa en ny cron-token i vault (den gamla 'email_queue_service_role_key' är borta,
--    vilket gjort att ALLA schemalagda edge-anrop svarat 401 sedan i går kväll).
do $$
declare v_token text;
begin
  if not exists (select 1 from vault.secrets where name = 'cron_service_token') then
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    perform vault.create_secret(v_token, 'cron_service_token', 'Token som pg_cron använder för att autentisera mot edge functions');
  end if;
end $$;

-- 2. Låt verify_cron_secret peka på den nya token som standard.
create or replace function public.verify_cron_secret(_token text, _secret_name text default 'cron_service_token')
returns boolean
language sql
stable
security definer
set search_path to 'public', 'vault'
as $function$
  select exists (
    select 1
    from vault.decrypted_secrets
    where name = _secret_name
      and decrypted_secret = _token
      and _token is not null
      and length(_token) >= 32
  );
$function$;

revoke all on function public.verify_cron_secret(text, text) from public, anon, authenticated;
grant execute on function public.verify_cron_secret(text, text) to service_role;

-- 3. En enda källa till sanning för cron-headers. Kastar fel (syns i cron.job_run_details)
--    i stället för att tyst skicka en NULL-header som ger 401.
create or replace function public.cron_auth_header()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'vault'
as $$
declare v text;
begin
  select decrypted_secret into v from vault.decrypted_secrets where name = 'cron_service_token' limit 1;
  if v is null or length(v) < 32 then
    raise exception 'cron_service_token saknas i vault – schemalagda jobb kan inte autentisera';
  end if;
  return jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v);
end;
$$;

revoke all on function public.cron_auth_header() from public, anon, authenticated;
grant execute on function public.cron_auth_header() to service_role;

-- 4. Bygg om alla schemalagda anrop så att de använder helpern
--    (inklusive tre jobb som hade hårdkodade nycklar i klartext i cron-kommandot).
select cron.alter_job(1, command := $cron$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/cleanup-expired-confirmations', headers := public.cron_auth_header(), body := concat('{"time": "', now(), '"}')::jsonb);$cron$);
select cron.alter_job(2, command := $cron$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/job-expiration-notifications', headers := public.cron_auth_header(), body := concat('{"triggered_at": "', now(), '"}')::jsonb);$cron$);
select cron.alter_job(12, command := $cron$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/saved-job-expiration-reminders', headers := public.cron_auth_header(), body := concat('{"time": "', now(), '"}')::jsonb);$cron$);
select cron.alter_job(3, command := $cron$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/process-cv-queue', headers := public.cron_auth_header(), body := '{}'::jsonb);$cron$);
select cron.alter_job(14, command := $cron$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/interview-reminders', headers := public.cron_auth_header(), body := concat('{"time": "', now(), '"}')::jsonb);$cron$);
select cron.alter_job(190, command := $cron$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/purge-deleted-jobs', headers := public.cron_auth_header(), body := '{}'::jsonb);$cron$);
select cron.alter_job(283, command := $cron$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/purge-orphaned-media', headers := public.cron_auth_header(), body := '{"dry_run": false}'::jsonb);$cron$);
select cron.alter_job(333, command := $cron$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/process-account-deletions', headers := public.cron_auth_header(), body := '{}'::jsonb);$cron$);
select cron.alter_job(732, command := $cron$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/outreach-dispatch', headers := public.cron_auth_header(), body := concat('{"time": "', now(), '"}')::jsonb);$cron$);
select cron.alter_job(821, command := $cron$select net.http_post(url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/criteria-eval-worker', headers := public.cron_auth_header(), body := '{"hop": 0, "source": "cron"}'::jsonb);$cron$);

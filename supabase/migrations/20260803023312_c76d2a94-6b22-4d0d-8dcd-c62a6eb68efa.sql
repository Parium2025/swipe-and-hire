select cron.schedule(
  'process-email-queue-sweeper',
  '*/5 * * * *',
  $$ select net.http_post(
       url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/process-email-queue',
       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)),
       body := '{}'::jsonb); $$
);

create or replace function public.purge_old_email_dlq()
returns integer
language plpgsql
security definer
set search_path = public, pgmq
as $$
declare
  deleted integer := 0;
begin
  select count(*) into deleted
  from pgmq.q_transactional_emails_dlq
  where enqueued_at < now() - interval '30 days';

  delete from pgmq.q_transactional_emails_dlq
  where enqueued_at < now() - interval '30 days';

  delete from pgmq.q_auth_emails_dlq
  where enqueued_at < now() - interval '30 days';

  return deleted;
end;
$$;

revoke all on function public.purge_old_email_dlq() from public, anon, authenticated;
grant execute on function public.purge_old_email_dlq() to service_role;

select cron.schedule(
  'purge-email-dlq-nightly',
  '50 3 * * *',
  $$ select public.purge_old_email_dlq(); $$
);
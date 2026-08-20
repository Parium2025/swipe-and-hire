select cron.schedule(
  'outreach-dispatch-sweeper',
  '* * * * *',
  $$ select net.http_post(
       url := 'https://jrjaegapuujushsiofoi.supabase.co/functions/v1/outreach-dispatch',
       headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1)),
       body := concat('{"time": "', now(), '"}')::jsonb
     ); $$
);
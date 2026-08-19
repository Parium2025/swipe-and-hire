SELECT cron.schedule(
  'prune-cron-run-details-nightly',
  '20 3 * * *',
  $$DELETE FROM cron.job_run_details WHERE start_time < now() - interval '30 days'$$
);
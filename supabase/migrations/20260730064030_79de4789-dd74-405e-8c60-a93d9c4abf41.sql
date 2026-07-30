REVOKE SELECT ON
  public.account_inactivity_notices,
  public.admin_alert_cooldowns,
  public.ai_usage_log,
  public.consent_records,
  public.criterion_prompt_embeddings,
  public.data_retention_runs,
  public.email_send_log,
  public.email_send_state,
  public.email_unsubscribe_tokens,
  public.job_applications,
  public.one_time_purchases,
  public.profile_views,
  public.rate_limits,
  public.saved_jobs,
  public.suppressed_emails,
  public.user_subscriptions
FROM anon;
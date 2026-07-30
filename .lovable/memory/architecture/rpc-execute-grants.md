---
name: RPC EXECUTE-behörigheter
description: Regler för vilka databasfunktioner som får vara anropbara av anon/authenticated efter säkerhetshärdningen
type: constraint
---

EXECUTE är återkallat från `PUBLIC` på alla funktioner i schemat `public`. Behörighet delas ut explicit per roll.

**Vid varje ny databasfunktion måste GRANT sättas medvetet:**

```sql
REVOKE EXECUTE ON FUNCTION public.<namn>(<args>) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.<namn>(<args>) TO authenticated;  -- normalfallet
GRANT EXECUTE ON FUNCTION public.<namn>(<args>) TO service_role;   -- interna jobb
```

- **Endast `service_role`:** kö-, cron- och e-postfunktioner (`read_email_batch`, `enqueue_email`, `delete_email`, `verify_cron_secret`, `dispatch_interview_push`, `get_cv_queue_batch`, `increment_removed_applicants`). `read_email_batch` öppen för anon = magiska inloggningslänkar kan läsas av vem som helst.
- **`anon` tillåts bara** för funktioner som används inuti en RLS-policy, eller för publik jobbsökning (`search_jobs`, `count_search_jobs`, `record_job_view`, `get_employer_public_profile(s)`, `record_app_exception`, `try_uuid`). Dessa måste ha interna `auth.uid()`-kontroller.
- **Allt annat:** `authenticated`.

Supabase-lintern flaggar de anon-tillåtna policyhjälparna som "Public Can Execute SECURITY DEFINER Function" — det är förväntat och ska inte "åtgärdas" genom att bryta RLS.

pg_cron kör som `postgres` (funktionsägare) och påverkas aldrig av dessa REVOKE:s.

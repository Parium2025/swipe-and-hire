---
name: Raderingstider och inaktiva konton
description: Tidslinje för automatisk radering, varningsmejl och hur arbetsgivare ser raderade sökande
type: feature
---

- Inaktivt konto: 24 månader utan inloggning → varningsmejl → **90 dagars frist** (inte 30) med påminnelser när **30** och **7** dagar återstår. Loggar användaren in avbryts allt (`cancelled_at`).
- Kolumner: `account_inactivity_notices.reminder_30_sent_at` / `reminder_7_sent_at`, nollställs vid ny varningsomgång.
- När en kandidat raderas försvinner ansökningarna helt. Arbetsgivaren ser i stället en anonym räknare `job_postings.removed_applicants_count` ("Raderade konton" på jobbkortet) — inga personuppgifter sparas.
- RPC: `increment_removed_applicants(uuid[], int[])`, endast service_role.

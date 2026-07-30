---
name: Raderingstider och inaktiva konton
description: Tidslinje för automatisk radering, varningsmejl och hur arbetsgivare ser raderade sökande
type: feature
---

- Inaktivt konto: 24 månader utan inloggning → varningsmejl → **365 dagars frist** (ett helt år) med påminnelser när **180**, **90** och **7** dagar återstår. Loggar användaren in avbryts allt (`cancelled_at`).
- Kolumner: `account_inactivity_notices.reminder_180_sent_at` / `reminder_90_sent_at` / `reminder_7_sent_at`, nollställs vid ny varningsomgång. Överhoppade (större) steg markeras som skickade så att de inte triggar retroaktivt.
- När en kandidat raderas försvinner ansökningarna helt. Arbetsgivaren ser i stället en anonym räknare `job_postings.removed_applicants_count` ("Raderade konton" på jobbkortet, visas endast när > 0, klickbar popover) — inga personuppgifter sparas.
- RPC: `increment_removed_applicants(uuid[], int[])`, endast service_role.
- Juridiska texter som måste hållas i synk: `IntegrityPolicyPage.tsx`, `DpaPage.tsx`, FAQ i `AudienceLanding.tsx`, `docs/gdpr/registerforteckning.md`, mejlmallen `account-inactivity-warning.tsx`.

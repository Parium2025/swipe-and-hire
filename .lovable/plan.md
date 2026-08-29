# Utredning: den ofiltrerade `profiles`-kanalen för jobbsökare

Read-only granskning på HEAD `7fa863f9c8567b20abb12c02fe098e28ebff81df`. Ingen kod, data eller schema har ändrats.

## Huvudslutsats

Kanalen `job-seeker-employer-profiles` (`src/hooks/useJobSeekerBackgroundSync.ts:470–497`) kan i praktiken **aldrig** ta emot en arbetsgivares varumärkesändring, eftersom Realtime `postgres_changes` filtreras av RLS och en jobbsökare bara får läsa sin **egen** profilrad. Samtidigt skapar kanalen en RLS-utvärdering per ansluten jobbsökare för *varje* profiluppdatering i hela databasen.

Rekommendation: **ta bort `employerProfilesChannel` och dess `removeChannel`-städning** — inget ersättningsabonnemang behövs, eftersom DB-triggern redan skriver ändringen till `job_postings`, vilket täcks av befintliga id-scopade kanaler.

## 1. Realtime-abonnemang som en inloggad jobbsökare har

| Fil:rad | Tabell / event | Filter | Effekt |
|---|---|---|---|
| `useJobSeekerBackgroundSync.ts:453–465` | `job_postings` INSERT | inget | debounce 5 s → invalidate `available-jobs`, `jobs`, `my-applications`, `optimized-job-search`, `job-prefetch`, `job-details` |
| `useJobSeekerBackgroundSync.ts:470–497` | `profiles` UPDATE | **inget** | diff av `company_name`/`company_logo_url` → samma sex invalidations + två preloads |
| `useOptimizedJobSearch.ts:1251` | `job_postings` `*` | `id=in.(...)` (max 200 träffar) | patchar `company_name`/`company_logo_url` direkt i `['optimized-job-search']` |
| `useOptimizedJobSearch.ts:1312` | `job_postings` INSERT | inget | debounce 400 ms → invalidate `optimized-job-search` |
| `useSavedJobsCache.ts:357–366` | `job_postings` UPDATE | `id=in.(...)` om ≤100, annars klientfilter | patchar `['saved-jobs', uid]` inkl. `company_logo_url` |
| `useMyApplicationsCache.ts:243–252` | `job_postings` UPDATE | `id=in.(...)` om ≤100 | merge av hela raden i `['my-applications', uid]` |
| `useSavedSearches.ts:222–232` | `job_postings` INSERT | inget | räknar om sparade sökningar |
| `JobView.tsx:283` | `job_postings` `*` | `id=eq.${jobId}` | sidlokal jobbdetalj |
| `useJobsData.tsx:448–449` | `job_postings` `*` | scope-beroende | delad hook, i huvudsak arbetsgivarvyer |

Endast arbetsgivare/admin: `useAuth.tsx:2322` (filtrerad på `employer_id`), `useEmployerBackgroundSync.ts:393`, `useEmployerScaleStats.ts:108`, `useMyCandidatesData.tsx:546`, `useApplicationsData.tsx:782`, `CompanyProfileDialog.tsx:133`, `SystemHealthPanel.tsx:440/443`.

## 2. Databaspropagering profiles → job_postings

Verifierat mot live-katalogen (`pg_trigger`), två aktiva AFTER UPDATE-triggers på `public.profiles`:

- `sync_company_name_to_jobs_trigger` → `sync_company_name_to_jobs()` (`supabase/migrations/20260420031010_*.sql:4–7`, funktion i `20260420053036_*.sql:15–46`): `AFTER UPDATE OF company_name, company_logo_url`. Sätter `job_postings.workplace_name`, `.company_logo_url`, `.updated_at` för `employer_id = NEW.user_id`.
- `trg_sync_jobs_branding_from_profile` → `sync_jobs_branding_from_profile()` (`20260420064924_*.sql:1–25`): `AFTER UPDATE` med samma diffvillkor och samma tre fält.

Vid INSERT av jobb fyller `trg_fill_job_branding_from_profile` (BEFORE INSERT/UPDATE OF employer_id) på `workplace_name`/`company_logo_url` från profilen.

Båda `public.profiles` och `public.job_postings` ligger i publikationen `supabase_realtime` (verifierat via `pg_publication_tables`). En varumärkesändring genererar alltså **både** ett `profiles` UPDATE-event och ett `job_postings` UPDATE-event per annons.

## 3. Var jobbsökaren ser företagsnamn/logga

Alla läser `job_postings.workplace_name` / `job_postings.company_logo_url` — ingen jobbsökarvy joinar `profiles` live.

- Swipe/sökresultat: `useOptimizedJobSearch.ts:156–157`, nyckel `['optimized-job-search', ...]`, `staleTime 30 s`, egen id-filtrerad kanal som patchar båda fälten.
- Sparade jobb: `['saved-jobs', uid]`, egen id-filtrerad kanal.
- Mina ansökningar: `['my-applications', uid]`, egen id-filtrerad kanal.
- Jobbdetalj: `['job-details', jobId]` (`useJobDetailsData.ts:377`, `staleTime 5 min`) + `JobView.tsx:283` id-filtrerad kanal.
- Preload-cachen `['available-jobs']` (`useJobSeekerBackgroundSync.ts:198–234`) och `['job-prefetch']` har **ingen** egen realtime; de skrivs av preload och används främst av mediavärmning (`useJobSeekerMediaWarmup.ts:142`).

Global QueryClient: `src/App.tsx:153–157` — `staleTime: Infinity`, `gcTime: Infinity`, `refetchOnMount: false`, `refetchOnWindowFocus: false`. Kommentaren på `useJobSeekerBackgroundSync.ts:433` om "naturlig refetch via staleTime" stämmer alltså inte.

## 4. Skulle borttagning ge inaktuell UI?

Nej — kanalen levererar redan idag inga arbetsgivarevents. RLS på `public.profiles` har exakt tre SELECT-policies (verifierat via `pg_policies`):

1. `Users can view own profile` — `auth.uid() = user_id`
2. `Org members can view colleagues in same organization` — kräver `role = 'employer'` och samma organisation
3. `Employers can view applicant profiles for their jobs`

En jobbsökare matchar bara policy 1. Realtime `postgres_changes` utvärderar RLS per prenumerant, så jobbsökaren får endast UPDATE-event för sin egen profilrad — och en jobbsökarprofil har varken `company_name` eller `company_logo_url` som ändras, så `brandingChanged`-grenen (`:481–484`) faller igenom.

Genomgång av fallen:

- Arbetsgivaren byter logga → trigger uppdaterar alla dess `job_postings` → jobbsökarens id-filtrerade kanaler för sökresultat, sparade jobb, mina ansökningar och öppen jobbdetalj patchar `company_logo_url` direkt. Oförändrat efter borttagning.
- `['available-jobs']`/`['job-prefetch']` blir inte invaliderade — men det gäller redan idag, eftersom kanalen aldrig triggar. Ingen regression.
- Jobbsökaren uppdaterar sin egen profil → event tas emot men filtreras bort av `brandingChanged`. Ingen effekt.

Enda teoretiska förlusten: om RLS på `profiles` i framtiden öppnas för jobbsökare skulle kanalen kunna börja fungera. Det är inte önskvärt beteende och ska i så fall lösas via `job_postings`.

## 5. Ersättning

Ingen ny prenumeration behövs. Den kanoniska vägen är redan komplett:

`profiles UPDATE → sync_company_name_to_jobs / sync_jobs_branding_from_profile → job_postings UPDATE → id-filtrerade kanaler i useOptimizedJobSearch / useSavedJobsCache / useMyApplicationsCache / JobView`.

Om man senare vill hålla även `['available-jobs']` live är det minsta scopade alternativet en debouncad `job_postings` UPDATE-lyssnare som bara invaliderar den nyckeln — inte en `profiles`-kanal. Föreslås inte nu.

## 6. Fanout vid 250 000 anslutna jobbsökare

- Idag: 250 000 `profiles`-prenumerationer. Varje profiluppdatering i hela systemet (inloggningar, `last_active_at`, mediauppdateringar, alla jobbsökares egna profiländringar) utvärderas mot samtliga. Vid 100 profiluppdateringar/s ≈ 25 miljoner RLS-utvärderingar/s — allt kasserat, noll UI-nytta.
- Efter borttagning: 0 extra. Varumärkesändringen kostar bara de `job_postings`-events som ändå skickas, och de träffar endast prenumeranter vars `id=in.(...)`-filter matchar (typiskt en handfull användare per annons).

## 7. Regressionstest

Ja. `src/hooks/__tests__/useJobSeekerRealtimeFanout.test.tsx` monterar redan den riktiga hooken med mockad `createRealtimeChannel` och registreringsuppsamling. Ett tillägg kan hävda: noll registreringar mot `table: 'profiles'`, samtidigt som `saved_jobs`, `job_applications`, `interviews` (user-filtrerade) och `job_postings` INSERT finns kvar. Inget produktionsberoende behöver ändras för att testet ska gå att skriva.

## Rekommendation

Ta bort `employerProfilesChannel` (`useJobSeekerBackgroundSync.ts:467–497`) och raden `supabase.removeChannel(employerProfilesChannel)` (`:520`), samt uppdatera den vilseledande kommentaren på `:431–433`. Inga andra kanaler, query-nycklar, preloads, design eller arbetsgivarfiler berörs. Rollback = återinför blocket.

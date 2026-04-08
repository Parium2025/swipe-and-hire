
# Skeleton Loading States — Hela appen

## Mål
Varje sida/vy ska visa en skeleton-laddningsvy vid sidladdning/refresh istället för tomt innehåll eller hopp.

## Sidor som behöver skeletons (prioritetsordning)

### Batch 1 – Mest använda
1. **Dashboard (Employer)** – `EmployerHome.tsx` / `EmployerDashboard.tsx`
2. **Dashboard (Jobbsökare)** – `JobSeekerHome.tsx` / `JobSeekerDashboardGrid.tsx`
3. **Meddelanden** – `Messages.tsx` / `MessagesTabs.tsx`
4. **Profil** – `Profile.tsx`

### Batch 2 – Kärnfunktioner
5. **Mina jobb** – `MyJobs.tsx`
6. **Mina ansökningar** – `MyApplications.tsx`
7. **Mina kandidater** – `MyCandidates.tsx` (Kanban-vy)
8. **Sparade jobb** – `SavedJobs.tsx`

### Batch 3 – Sekundära sidor
9. **Företagsprofil** – `CompanyProfile.tsx`
10. **Inställningar** – `EmployerSettings.tsx`
11. **Fakturering** – `Billing.tsx` / `Subscription.tsx`
12. **Support** – `Support.tsx`

## Approach
- Skapa en skeleton per sida som matchar sidans layout (kort, listor, rubriker etc.)
- Använd befintliga `Skeleton` och `SkeletonCard` komponenter
- Visa skeleton medan data laddas (`isLoading` / `isPending` states)
- Inga visuella ändringar på befintligt UI — bara tillägg av loading states
- Alla skeletons använder design tokens (`bg-muted`, `animate-pulse`)

---
name: Påminnelse — juridik vid Stripe-lansering
description: Vid aktivering av Stripe/betalningar måste integritetspolicy, DPA, registerförteckning och FAQ uppdateras samma dag enligt checklistan.
type: feature
---

När betalningar (Stripe) aktiveras i Parium MÅSTE följande uppdateras **samma dag** —
annars stämmer inte den publicerade informationen med verkligheten (GDPR art. 13/14).

Checklistan finns i `docs/gdpr/checklista-stripe-lansering.md` och omfattar:

1. `src/pages/IntegrityPolicyPage.tsx` — avsnitt 2 (Betaluppgifter) och avsnitt 4 (underleverantörer): ta bort "ännu inte aktiverad".
2. `src/pages/DpaPage.tsx` — avsnitt 5, tabellen Underbiträden: Stripe blir aktivt underbiträde.
3. `docs/gdpr/registerforteckning.md` — Del A: ny behandling "Betalningar och fakturering", rättslig grund avtal, lagringstid 7 år (bokföringslagen). Del C: Stripe utan "(ej i drift)".
4. `src/pages/Checkout.tsx` + `src/components/PaymentPlaceholderDialog.tsx` — riktigt checkoutflöde istället för placeholder.
5. Höj `PRIVACY_POLICY_VERSION` och `DPA_VERSION` i `src/lib/consentVersions.ts` samt "Senast uppdaterad"-datum.
6. Informera befintliga arbetsgivarkunder om nytt underbiträde minst 30 dagar i förväg (DPA punkt 12).
7. Undanta bokföringsunderlag (7 år) från nattliga `run_data_retention()`.

**How to apply:** Så fort användaren nämner Stripe/betalningar — påminn om denna checklista innan lansering.

# Checklista: texter att ändra när Stripe/betalningar aktiveras

I dag står det på flera ställen att betalfunktionen ännu inte är i drift. När betalningar
slås på måste dessa ändras samma dag — annars stämmer inte informationen med verkligheten.

| # | Fil | Vad som står i dag | Ändra till |
|---|---|---|---|
| 1 | `src/pages/IntegrityPolicyPage.tsx` – avsnitt 2, punkten "Betaluppgifter" | "betalfunktionen är ännu inte aktiverad" | "Vid köp hanteras kortuppgifter av vår betalleverantör (Stripe). Vi lagrar aldrig fullständiga kortnummer." |
| 2 | `src/pages/IntegrityPolicyPage.tsx` – avsnitt 4, underleverantörer | "Stripe (betalningar — aktiveras först när betalfunktionen lanseras)" | "Stripe (betalningar och fakturering)" |
| 3 | `src/pages/DpaPage.tsx` – avsnitt 5, tabellen Underbiträden | "Betalningar och fakturering (aktiveras när betalfunktionen lanseras)" | "Betalningar och fakturering" |
| 4 | `docs/gdpr/registerforteckning.md` – Del C | "Stripe – Underbiträde (ej i drift)" | "Stripe – Underbiträde" + lägg till behandlingen "Betalningar och fakturering" med rättslig grund avtal och lagringstid 7 år (bokföringslagen) i Del A |
| 5 | `src/pages/Checkout.tsx` och `src/components/PaymentPlaceholderDialog.tsx` | "Stripe kommer snart"-placeholder | Riktigt checkoutflöde |

## Sätt också detta på plats vid lansering
- Uppdatera integritetspolicyns "Senast uppdaterad"-datum.
- Informera befintliga arbetsgivarkunder om ändringen i DPA:t minst 30 dagar i förväg
  (vi lovar det i DPA:ns punkt 12) — nytt underbiträde i drift räknas som en ändring.
- Kontrollera att bokföringsunderlag (7 år) undantas från den nattliga automatiska
  raderingen `run_data_retention()`.
- Om Stripe agerar merchant of record: beskriv det i policyn och i användarvillkoren.

## Cookies — samma princip
Statistik- och marknadsföringscookies beskrivs i dag som "används inte". Om ni någon gång
lägger in Google Analytics, Meta Pixel eller liknande måste dessa uppdateras samtidigt:
- `src/components/CookieBanner.tsx` (kategoribeskrivningarna)
- `src/pages/IntegrityPolicyPage.tsx` avsnitt 7 (både korten och stycket under)

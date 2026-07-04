
# Grundplan: Prenumerationer & Planer (utan Stripe)

Målet: All infrastruktur, UI, CTA-flöden och låsningslogik är klar. När du fixat organisationsnummer slår vi bara på Stripe-webhooken sist.

---

## 1. Databas

**Ny enum `plan_tier`:**
`one_time` · `start` · `vaxa` · `pro` · `jobseeker_premium`

**Ny enum `plan_status`:**
`active` · `expired` · `cancelled` · `pending`

**Ny tabell `subscription_plans`** (statisk katalog – priser & regler):
- tier, name, price_sek, billing_period (`monthly` / `one_time`), max_active_jobs, max_users, includes_candidate_bank, is_active

**Ny tabell `user_subscriptions`** (aktiva/historiska planer):
- user_id, organization_id, tier, status, started_at, expires_at, cancelled_at, stripe_subscription_id (null tills vidare), stripe_customer_id (null), source (`stripe` / `manual` / `trial`)

**Ny tabell `one_time_purchases`** (för 799 kr engångsköp):
- user_id, tier=`one_time`, purchased_at, activated_at (null tills första annons publiceras), expires_at (14 dagar efter activated_at), job_id, stripe_payment_intent_id

**Två security-definer functions:**
- `has_active_plan(_user_id uuid)` → boolean (kollar user_subscriptions + one_time_purchases)
- `get_active_plan_details(_user_id uuid)` → tabell med tier, expires_at, max_active_jobs osv.

**GRANT + RLS** på alla nya tabeller enligt projektets standard.

**Seedar** `subscription_plans` med dina fem produkter (799, 5000, 7500, 10000, 29).

---

## 2. Frontend — Ny sida `/valj-plan`

Route dit man landar när:
- Man loggat in utan aktiv plan och trycker "Publicera annons"
- Man avbryter Stripe-flödet
- Man klickar "Uppgradera" var som helst

Innehåll:
- Hero: "Välj plan som passar er rekrytering"
- 4 planer sida-vid-sida (Start/Växa/Pro + 799-engång som separat kort)
- Feature-matris (kollapsbar på mobil)
- CTA: "Fortsätt till betalning" → placeholder-modal ("Stripe kopplas snart") — samma knapp aktiveras senare
- FAQ: bindningstid, ångerrätt, byta plan

Jobbsökar-Premium (29 kr) får eget kort på egen sida för kandidater — inte samma flöde.

---

## 3. Låsningslogik (den viktigaste delen)

En central hook: `useHasActivePlan()` → `{ hasPlan, tier, expiresAt, loading }`

**Enda stället som blockeras:** "Publicera annons"-knappen.
- Wizard: sista steget "Publicera" → om ingen plan → navigate till `/valj-plan?from=publish&job_id=X`
- Draft sparas alltid, oavsett plan

**Allt annat fungerar som vanligt även utan plan:**
- Kandidatbanken, chatt, betyg, anteckningar, gamla annonser, sökningar, filter
- Detta är kärnan i "inget försvinner"-principen

**Visuell indikator:** Diskret badge uppe till höger i employer-headern: "Ingen aktiv plan · Uppgradera" (grå, inte pushig).

---

## 4. CTA-flöden som byggs klara

| Var | Trigger | Går till |
|---|---|---|
| Wizard "Publicera" utan plan | Klick | `/valj-plan?from=publish` |
| Header-badge | Klick | `/valj-plan` |
| Inställningar → Faktura & Plan | Klick | Ny sida `/settings/plan` (visar nuvarande) |
| Efter Stripe-avbrott | Redirect | `/valj-plan?cancelled=true` |
| Onboarding för nya företag | Sista steget | `/valj-plan?welcome=true` |

Alla knappar går till **placeholder-modal**: "Betalning aktiveras när Stripe kopplas. Vi meddelar dig så fort det är klart."

---

## 5. Ny sida `/settings/plan`

- Visar nuvarande plan + status + förnyelsedatum
- "Byt plan" → `/valj-plan`
- "Säg upp" → placeholder ("aktiveras med Stripe")
- Historik-lista över tidigare planer och engångsköp

---

## 6. Vad som INTE byggs nu

- Stripe-webhooks
- `create-checkout-session` edge function
- Faktisk debitering
- E-postkvitton
- Prorated byten

Detta läggs på när du fixat orgnummer — då blir det ~2 timmars jobb eftersom all grund finns.

---

## Ordning för genomförande

1. Migration: enums + 3 tabeller + functions + RLS + seed
2. Hook `useHasActivePlan` + typer
3. Sida `/valj-plan` med alla 4 planer + placeholder-CTA
4. Header-badge + låsning på "Publicera annons"
5. Sida `/settings/plan`
6. Testa hela flödet end-to-end mot placeholders

**Kör jag igång med steg 1 (migrationen) direkt?**

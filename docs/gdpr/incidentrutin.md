# Incidentrutin vid personuppgiftsincident (GDPR art. 33–34)

**Organisation:** Parium AB
**Ansvarig:** VD/grundare (incidentansvarig)
**Anmälan görs till:** Integritetsskyddsmyndigheten (IMY), imy.se – e-tjänst för anmälan av personuppgiftsincident
**Deadline:** Anmälan senast **72 timmar** efter att incidenten upptäckts
**Senast uppdaterad:** 2026-07-29

> Internt dokument. Ska finnas tillgängligt innan en incident inträffar och gås igenom minst en gång per år.

---

## 1. Vad räknas som en personuppgiftsincident?

En säkerhetsincident som leder till oavsiktlig eller olaglig förstöring, förlust, ändring, obehörigt röjande av eller obehörig åtkomst till personuppgifter. Exempel i Parium:

- Fel i behörighetsregler (RLS) gör att en arbetsgivare ser kandidater från en annan organisation.
- Läckt tjänstenyckel, admin-lösenord eller databaslösenord.
- Mejl med personuppgifter skickat till fel mottagare.
- Obehörig inloggning på ett användarkonto eller på Lovable/Supabase-kontot.
- Oavsiktlig radering av data utan möjlighet till återställning.
- Leverantör (Supabase, Resend, Stripe) rapporterar en incident som rör vår data.

Inte en incident: planerat driftstopp, en användare som själv raderar sin data, spam utan dataförlust.

---

## 2. Roller

| Roll | Vem | Ansvar |
|---|---|---|
| Incidentansvarig | VD/grundare | Beslutar, dokumenterar, anmäler till IMY, informerar berörda |
| Teknisk åtgärd | Utvecklingsansvarig | Stoppar läckan, roterar nycklar, återställer data |
| Kundkommunikation | Support | Svarar kunder och kandidater enligt godkänd text |

I ett litet bolag kan samma person ha flera roller – men det ska alltid finnas en namngiven incidentansvarig.

---

## 3. Steg för steg

### Steg 1 – Upptäck och larma (0–1 timme)
Incidenter kan upptäckas via felövervakning (`app_exceptions`), admin-larm, säkerhetsskanning, en användare eller en leverantör. Den som upptäcker något kontaktar omedelbart incidentansvarig på hej@parium.se och per telefon. **Klockan börjar ticka när incidentansvarig fått kännedom.** Notera exakt tidpunkt.

### Steg 2 – Begränsa skadan (0–4 timmar)
- Stäng av eller rulla tillbaka den funktion som orsakat läckan.
- Rotera exponerade nycklar och lösenord.
- Avsluta misstänkta sessioner.
- Rätta felaktiga RLS-policyer och verifiera med testinloggning.
- Rör inte loggar – de behövs som bevis.

### Steg 3 – Utred och bedöm risk (inom 24 timmar)
Dokumentera:
- Vad hände och när (start, upptäckt, åtgärd)?
- Vilka kategorier av personuppgifter berördes?
- Ungefärligt antal registrerade och antal poster.
- Var uppgifterna faktiskt åtkomliga för någon obehörig?
- Sannolika konsekvenser för de registrerade.

**Riskbedömning:**
- *Låg risk* – ingen faktisk åtkomst skedde, eller uppgifterna var krypterade/pseudonymiserade. Dokumentera internt, ingen anmälan.
- *Risk* – anmäl till IMY inom 72 timmar.
- *Hög risk* (t.ex. CV, kontaktuppgifter eller meddelanden röjda för obehörig) – anmäl till IMY **och** informera de registrerade utan onödigt dröjsmål.

### Steg 4 – Anmäl till IMY (inom 72 timmar)
Anmälan ska innehålla: incidentens art, kategorier och ungefärligt antal registrerade och poster, kontaktuppgifter till incidentansvarig, sannolika konsekvenser samt vidtagna och planerade åtgärder. Är allt inte utrett – gör en **preliminär anmälan i tid** och komplettera i efterhand. Hellre anmäla än att missa fristen.

### Steg 5 – Informera berörda (art. 34)
Vid hög risk: mejla de berörda på ett klarspråkligt sätt – vad som hänt, vilka uppgifter det gäller, vad vi gjort, vad de själva bör göra (t.ex. byta lösenord) och kontaktuppgift till oss.

### Steg 6 – Informera arbetsgivarkunder (biträdesrollen)
Rör incidenten personuppgifter som Parium behandlar för en kunds räkning är kunden personuppgiftsansvarig och ska anmäla till IMY. Enligt vårt DPA informerar vi kunden **inom 24 timmar** från upptäckt, med all information de behöver för sin egen anmälan.

### Steg 7 – Efterarbete
Inom två veckor: rotorsaksanalys, permanent åtgärd, uppdatera denna rutin och registerförteckningen vid behov, samt lägg till ett test eller en kontroll som fångar samma fel igen.

---

## 4. Incidentlogg (art. 33.5)

Alla incidenter dokumenteras – även de som inte anmäls. Loggen sparas i minst 5 år i `docs/gdpr/incidentlogg.md` eller motsvarande internt system.

| Fält | Beskrivning |
|---|---|
| Incident-id | Löpnummer, t.ex. INC-2026-01 |
| Upptäckt (datum, tid) | När incidentansvarig fick kännedom |
| Beskrivning | Vad som hände |
| Berörda uppgifter | Kategorier och ungefärligt antal |
| Riskbedömning | Låg / Risk / Hög risk – med motivering |
| Anmäld till IMY | Ja/Nej + datum + diarienummer |
| Registrerade informerade | Ja/Nej + datum |
| Åtgärder | Akut och permanent |
| Avslutad | Datum |

---

## 5. Kontaktuppgifter

- **Incidentansvarig Parium AB:** hej@parium.se
- **IMY:** imy.se, 08-657 61 00
- **Leverantörsstöd:** Lovable/Supabase-support via plattformen, Resend-support, Stripe-support.

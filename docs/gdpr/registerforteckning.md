# Registerförteckning (GDPR art. 30)

**Organisation:** Parium AB
**Kontakt i dataskyddsfrågor:** hej@parium.se
**Dataskyddsombud:** Inget DPO krävs (art. 37) – Parium bedriver ingen storskalig behandling av känsliga uppgifter och ingen storskalig systematisk övervakning. Bedömningen omprövas årligen.
**Senast uppdaterad:** 2026-07-29
**Ansvarig för dokumentet:** VD/grundare. Uppdateras vid varje ny behandling, nytt underbiträde eller ändrad lagringstid, samt gås igenom minst en gång per år.

> Internt dokument. Publiceras inte, men ska kunna lämnas till Integritetsskyddsmyndigheten (IMY) på begäran.

---

## Del A – Parium som personuppgiftsansvarig (art. 30.1)

Gäller Pariums egen behandling: konton, profiler, plattformens drift och support.

### A1. Konto och autentisering
- **Ändamål:** Skapa och administrera användarkonto, inloggning, säkerhet.
- **Kategorier av registrerade:** Jobbsökare, arbetsgivaranvändare.
- **Kategorier av uppgifter:** Namn, e-post, telefonnummer, lösenordshash, roll, organisationstillhörighet, tidpunkt för senaste aktivitet.
- **Rättslig grund:** Avtal (art. 6.1 b).
- **Lagringstid:** Så länge kontot är aktivt. Efter 24 månaders inaktivitet: varningsmejl + radering efter 30 dagar. Radering på egen begäran sker omedelbart.
- **Mottagare:** Supabase (Lovable Cloud) som databas- och autentiseringsleverantör.

### A2. Jobbsökarprofil
- **Ändamål:** Presentera kandidaten för arbetsgivare som kandidaten själv ansökt hos eller visat intresse för.
- **Registrerade:** Jobbsökare.
- **Uppgifter:** Profilbild, presentationsvideo, CV-fil och AI-genererad sammanfattning av CV, bio, ort/postnummer, födelsedatum, yrke, anställningsform, tillgänglighet, intressen.
- **Rättslig grund:** Avtal (art. 6.1 b). Frivilliga fält (video, CV, intressen) fylls i av användaren själv.
- **Lagringstid:** Så länge kontot finns (se A1). Filer (bilder, video, CV) raderas fysiskt ur fillagringen samtidigt som kontot raderas. Ersatta eller överblivna filer raderas automatiskt av ett veckovis städjobb (`purge-orphaned-media`).
- **Mottagare:** Supabase (lagring och filer). Filerna ligger i en privat lagringsyta; visning sker via tidsbegränsade, behörighetskontrollerade länkar.


### A3. Arbetsgivarkonto och annonser
- **Ändamål:** Publicera jobbannonser och administrera arbetsgivarens konto.
- **Registrerade:** Kontaktpersoner hos arbetsgivare.
- **Uppgifter:** Namn, e-post, telefon, företagsnamn, organisationsnummer, logotyp, adressuppgifter.
- **Rättslig grund:** Avtal (art. 6.1 b).
- **Lagringstid:** Så länge kontot finns. Annonser sparas så länge arbetsgivaren vill; kandidatuppgifter i annonserna gallras enligt B1.

### A4. Support och kundtjänst
- **Ändamål:** Besvara och dokumentera supportärenden.
- **Registrerade:** Alla användare.
- **Uppgifter:** Namn, e-post, ärendetext, korrespondens.
- **Rättslig grund:** Avtal och berättigat intresse (art. 6.1 b och f).
- **Lagringstid:** 24 månader efter att ärendet avslutats (automatisk radering, nattligt jobb).

### A5. Drift-, säkerhets- och e-postloggar
- **Ändamål:** Felsökning, driftsäkerhet, skydd mot missbruk, leveransuppföljning av mejl.
- **Registrerade:** Alla användare.
- **Uppgifter:** IP-adress, user agent, sessionsinformation, e-postadress i utskicksloggen, feltekniska händelser.
- **Rättslig grund:** Berättigat intresse (art. 6.1 f) – säker och fungerande tjänst.
- **Lagringstid:** Sessioner rensas löpande. Utskicks- och felloggar max 24 månader.

### A6. Notiser och sparade sökningar
- **Ändamål:** Meddela användaren om nya jobb, meddelanden, intervjuer och statusändringar.
- **Uppgifter:** Notistext, koppling till användare, sparade sökkriterier, push-token.
- **Rättslig grund:** Avtal (art. 6.1 b). Varje notistyp kan stängas av i inställningarna.
- **Lagringstid:** Notiser 6 månader. Push-token tills enheten avregistreras eller kontot raderas.

### A7. Visnings- och användningsstatistik
- **Ändamål:** Visa arbetsgivare hur många som sett en annons och ge kandidaten insyn i vem som tittat på profilen.
- **Uppgifter:** Användar-id, annons-id, tidpunkt, enhetstyp.
- **Rättslig grund:** Berättigat intresse (art. 6.1 f).
- **Lagringstid:** 12 månader (automatisk radering).

### A8. Cookies för statistik och marknadsföring
- **Status:** Inga statistik- eller marknadsföringscookies är i drift i dag. Samtyckesfunktionen finns på plats och kategorierna aktiveras först vid faktisk användning.
- **Rättslig grund vid aktivering:** Samtycke (art. 6.1 a + 9 kap. LEK).
- **Lagringstid:** Samtycket sparas i 12 månader och kan när som helst ändras.

---

## Del B – Parium som personuppgiftsbiträde (art. 30.2)

Gäller behandling som utförs för arbetsgivarkundernas räkning. Varje arbetsgivare är personuppgiftsansvarig för sin rekrytering. Villkoren finns i DPA:t på parium.se/dpa.

### B1. Ansökningar och kandidathantering
- **Kategorier av behandling:** Insamling, lagring, visning, sortering, kommentering, statusändring, radering.
- **Registrerade:** Kandidater som ansökt eller visat intresse för kundens annonser.
- **Uppgifter:** Namn, kontaktuppgifter, ålder, ort, CV, video, svar på urvalsfrågor, personligt brev, interna noteringar och betyg, meddelanden.
- **Lagringstid:** 24 månader från ansökan, därefter automatisk radering. Kunden kan radera tidigare.

### B2. Chatt och intervjubokning
- **Uppgifter:** Meddelanden, bilagor, intervjutider och platsinformation.
- **Lagringstid:** Chattar kopplade till en ansökan raderas samtidigt som ansökan (24 månader).

### B3. AI-stöd i urval
- **Beskrivning:** Arbetsgivaren kan formulera egna kriterier och få ett AI-genererat underlag samt en sammanfattning av kandidatens CV.
- **Viktigt:** Underlaget är rådgivande. Inga beslut fattas automatiserat i den mening som avses i art. 22 – en människa hos arbetsgivaren fattar alltid beslutet.
- **Underbiträde:** Lovable AI Gateway (modelldrift). Kandidatdata används inte för att träna modeller.
- **Lagringstid:** Bedömningar raderas när ansökan raderas (24 månader).

---

## Del C – Underbiträden och mottagare

| Leverantör | Roll | Behandling | Plats | Skyddsåtgärd |
|---|---|---|---|---|
| Supabase (via Lovable Cloud) | Underbiträde | Databas, filer, autentisering | Paris, Frankrike (EU) | DPA, data inom EU |
| Lovable / Resend | Underbiträde | Utskick av transaktionsmejl (notify.parium.se) | EU/USA | DPA + EU:s standardavtalsklausuler |
| Lovable AI Gateway | Underbiträde | AI-sammanfattning och kriteriebedömning | EU/USA | DPA + SCC, ingen modellträning på kunddata |
| Stripe | Underbiträde (ej i drift) | Betalningar – aktiveras när betalfunktionen lanseras | EU/USA | DPA + SCC |

Tredjelandsöverföring sker endast med standardavtalsklausuler och kompletterande skyddsåtgärder. All kandidat- och profildata lagras i EU.

---

## Del D – Säkerhetsåtgärder (art. 32)

- TLS/HTTPS för all trafik, kryptering av lagrad data hos leverantören.
- Row Level Security i databasen: varje organisation når endast kandidater kopplade till sina egna annonser.
- Rollbaserad behörighet (separat rolltabell, ingen roll lagrad på profilen).
- Serverkod (edge functions) körs med tjänstenyckel som aldrig exponeras mot klienten.
- Autentisering med e-post/lösenord och OAuth, sessionshantering med förnyelse.
- Loggning av åtkomst och statusändringar, dagliga säkerhetskopior hos leverantören.
- Nattlig automatisk gallring (`run_data_retention`) och automatisk radering av inaktiva konton.
- Veckovis radering av överblivna filer i fillagringen (`purge-orphaned-media`) så att inga bilder, videor eller CV:n blir kvar utan koppling till en profil eller ansökan.

- Åtkomst till produktionsdata begränsad till behörig personal, endast vid drift och support.

---

## Del E – Registrerades rättigheter i praktiken

| Rättighet | Hur den uppfylls |
|---|---|
| Tillgång (art. 15) | Självbetjäning: "Ladda ner mina uppgifter" i inställningarna. Alternativt hej@parium.se. |
| Rättelse (art. 16) | Användaren redigerar sin profil direkt i appen. |
| Radering (art. 17) | "Radera konto" i inställningarna – raderar profil, ansökningar, chattar och inloggning. |
| Begränsning/invändning (art. 18, 21) | Manuell hantering via hej@parium.se, svar inom 30 dagar. |
| Dataportabilitet (art. 20) | Samma JSON-export som art. 15, maskinläsbar. |
| Återkalla samtycke (art. 7) | Cookie-inställningar och notisinställningar i appen. |
| Klagomål | Integritetsskyddsmyndigheten, imy.se. |

Alla förfrågningar besvaras inom 30 dagar (art. 12.3).

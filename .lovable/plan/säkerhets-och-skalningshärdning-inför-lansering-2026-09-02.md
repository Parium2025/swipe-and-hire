# Säkerhets- och skalningshärdning inför lansering

## Mål
Göra de verifierade säkerhets- och kapacitetsbristerna klara inför hög trafik utan att öppna interna tabeller, ändra befintlig produktlogik eller försämra den inloggade upplevelsen.

Beslut från genomgången:
- Utloggade ser endast en kort jobb-preview.
- Utloggade ser endast arbetsgivarens namn och logga.
- Fullständig jobbannons, full företagsprofil och alla handlingar kräver konto.

## 1. Dokumentera avsiktligt låsta tabeller
Skapa en säkerhetsnotering som dokumenterar att följande fem tabeller medvetet har RLS utan policies och därför är `deny-all` från klienten:
- `admin_alert_cooldowns`
- `email_confirmation_tokens`
- `email_confirmations`
- `job_run_locks`
- `media_deletion_queue`

Dokumentera syfte, tillåten backend-/funktionsåtkomst och regeln att klientpolicyer inte får läggas till för att tysta lint-varningen.

## 2. Lås anonym åtkomst till exakt rätt preview
Gör en databasändring som:
- tar bort anonym direktläsning från `job_postings`, så publika RPC:er blir enda vägen till jobbdata,
- behåller anonym sökning och SEO-länkar men returnerar endast godkända previewfält,
- begränsar annonstexten till cirka 300 tecken för utloggade,
- döljer krav, förmåner, kontaktuppgifter, ansökningsinstruktioner och interna räknare för utloggade,
- låter inloggade få den fullständiga nuvarande datan,
- begränsar anonyma arbetsgivarprofiler till företagsnamn och logga; övriga fält returneras endast efter inloggning.

Uppdatera den publika annonssidan så den visar previewn och en tydlig befintlig konto-/ansökningsväg, utan visuell omdesign. Lägg regressionstester för anonym respektive inloggad respons.

## 3. Täpp verifierade funktionsluckor
- Ändra `has_premium` så en vanlig inloggad användare endast kan kontrollera sin egen premiumstatus; interna backendanrop fortsätter fungera.
- Begränsa `record_app_exception` med serverstyrda längdgränser och rate limit innan administratörsnotiser skapas, så en användare inte kan spamma eller injicera obegränsad text.
- Granska aktuell ACL för samtliga anropbara `SECURITY DEFINER`-funktioner och återkalla direkt körning för funktioner som endast ska användas av backend eller andra databasfunktioner. Behåll endast de klient-RPC:er som har verifierad identitets-/ägarskaps-/organisationskontroll.
- Lägg negativa behörighetstester för parameterförfalskning och organisationsisolering.

## 4. Hantera databastilläggen säkert
Flytta inte `pg_trgm`, `unaccent` eller `vector` under denna ändring. De används av befintliga sökindex, textfunktioner och AI-/vektorfunktioner; en flytt ger liten omedelbar säkerhetsvinst men hög regressionsrisk.

Dokumentera dem som accepterade härdningsvarningar med beroenden och en separat framtida migrationsprocedur. Detta är bättre än en riskfylld flytt precis före lansering.

## 5. Åtgärda verifierade kapacitetsrisker
### Realtime
- Slå ihop de fem globala autentiseringskanalerna till en kanal med flera filtrerade lyssnare.
- Montera endast rollrelevanta lyssnare: jobbsökare ska inte bära arbetsgivarflöden och tvärtom.
- Behåll debounce, återanslutning och befintliga cacheuppdateringar.
- Kontrollera övriga globala bakgrundshooks och flytta sidbundna prenumerationer till de vyer som använder dem.

### Bundle och första laddning
- Lazy-loada offentliga sidgrupper och tunga bibliotek/rutter så 3D-, PDF-, diagram- och arbetsgivarverktyg inte hamnar i samma tidiga laddningskedja.
- Lägg stabila vendor-chunks där det minskar återladdning utan att återinföra gamla chunk-mismatchproblem.
- Mät byggartefakterna före/efter och sätt ett dokumenterat budgettak för initial JS.

### Bakgrundsjobb
- Gör `job-expiration-notifications` resumable: kandidater behandlas i begränsade batchar med markör/idempotens i stället för en obegränsad sekventiell loop.
- Undvik att en enskild populär annons kan orsaka timeout eller att redan skickade meddelanden skickas igen.

### Datatrafik
- Byt `select('*')` mot explicita fält i verifierade hot paths, särskilt globala preload-/bakgrundshooks. Ändra inte kall eller administrativ kod utan mätbar nytta.

## 6. Verifiering
- Kör riktade säkerhets- och regressionstester samt produktionsbygge.
- Kör databaslinter igen och klassificera kvarvarande varningar som åtgärdade, avsiktliga eller framtida härdning.
- Verifiera anonym jobb-preview, inloggad fullvy, ansökningsflöde, företagsprofil, båda användarrollerna och återanslutning i webbläsaren.
- Kör projektets lasttest och dokumentera resultat/trösklar; ingen garanti om miljontals samtidiga användare ges utan faktisk lastmiljö och driftmätning.

## Tekniska gränser
- Alla schema-/funktionsändringar görs i en versionsstyrd migration med minsta möjliga behörigheter.
- Ingen direkt ändring i genererade backendklienter eller typer.
- Ingen visuell omdesign.
- Befintlig profil-, media-, snapshot- och ansökningslogik lämnas orörd utom där verifiering visar en konkret regression.

# Skapa jobb och ansökningar: robust hela vägen utan UI-ändringar

## Mål
Göra kedjan mall → wizard → publicering → jobbvisning → ansökan tillförlitlig i frontend och backend, utan avsiktliga visuella ändringar.

## Redan verifierat
- Databasen har ett unikt skydd på `(job_id, applicant_id)`. Samma kandidat kan därför inte skapa två ansökningar till samma annons, även vid samtidiga klick, offline-synk eller flera enheter.
- Ansökningar utan frågor fungerar och ska fortsätta fungera.
- Frågorna fryses redan i `questions_snapshot` när ansökan skapas, så senare redigering av annonsens frågor ändrar inte historiken.
- Nuvarande postnummerfil innehåller 16 392 svenska postnummer och orter. Frontend kan däremot i dag godkänna okända nummer via manuell ort och uppskattar län/kommun för grovt; det är inte tillräckligt starkt.
- Steg 4 har två stora, duplicerade detaljimplementationer för mobil och dator. Det skapar risk för avvikelse från den publicerade vyn.

## Genomförande

### 1. Ansökningar och obligatoriska frågor
- Skapa en gemensam valideringsfunktion för frågesvar och använda den i både den fullständiga ansökningssidan och snabbansökan.
- Ett obligatoriskt svar räknas som besvarat när värdet är giltigt även om det är `false` eller `0`; `null`, saknat värde, tom text och tom lista nekas.
- Låta noll frågor ge ett tomt, giltigt frågeunderlag och aldrig blockera ansökan.
- Lägga samma regel i databasen efter att `questions_snapshot` har fyllts. Manipulerade klientanrop kan då inte hoppa över obligatoriska frågor.
- Behålla det befintliga unika databasskyddet som slutlig garanti mot dubbelansökningar och standardisera felhanteringen så båda ansökningsvägarna visar ”Redan sökt”.
- Lägga en synkron submit-spärr i båda ansökningsvägarna så flera tryck inte startar parallella profil-, fråge- och mejlanrop, även om databasen redan skyddar själva raden.

### 2. Förlustfri offline-synk
- Behålla ansökningsutkastet tills den köade ansökan faktiskt har sparats i databasen; rensa det inte redan när den köas.
- Skilja permanenta validerings-/behörighetsfel från nätverksfel. Endast nätverks- och tillfälliga serverfel ska köas eller återförsökas.
- Efter maximalt antal automatiska försök ska ansökan ligga kvar återställningsbar i kön i stället för att raderas. Användaren kan då försöka igen utan att skriva om allt.
- Behandla unikhetsfelet som lyckad synk eftersom ansökan redan finns.

### 3. Auktoritativ postnummerkoppling
- Lägga den befintliga svenska postnummerlistan i en backendtabell som auktoritativ referens, med RLS och minsta nödvändiga läsbehörighet.
- Införa en databas-trigger för `job_postings` och `job_templates` som normaliserar postnummer till `NNN NN`, verifierar att numret finns och sätter ort från referenstabellen. Klienten får inte kunna spara en motsägande postnummer–ort-kombination.
- Bevara befintliga annonser orörda. De nya reglerna tillämpas när platsfält skapas eller ändras, så äldre testdata blockerar inte annan redigering.
- Ta bort frontendens möjlighet att godkänna ett okänt postnummer genom manuell ort och ta bort grova regionuppskattningar ur sparflödet. Samma källa och samma normalisering används i skapa mall, skapa jobb och redigera jobb.
- Kommun och län sparas bara när datakällan verkligen kan styrka dem; inga uppskattade värden ska presenteras som säkra fakta.

### 4. Transaktionell publicering av jobb och frågor
- Ersätta tvåstegssparandet ”annons först, frågor sedan” med en parameteriserad backendfunktion som sparar annons och frågor i samma transaktion.
- Om en fråga eller ett platsfält är ogiltigt skapas/uppdateras inget halvt jobb. Vid lyckat svar är hela annonsen komplett.
- Behålla fråge-ID:n vid redigering så historiska svar fortsatt kan kopplas rätt, och låta `questions_snapshot` vara oföränderlig historik per ansökan.
- Behålla den befintliga synkrona publiceringsspärren och göra återförsök idempotenta.

### 5. Steg 4 och publicerad vy med pixelparitet
- Samla formatering och detaljrader i en gemensam datamodell/renderer som används av wizardens mobil- och datorpreview samt den riktiga jobbdetaljvyn.
- Behålla telefon-/datorramar, skalning, tooltips, scrollbeteende, färger, avstånd och typografi exakt som de ser ut nu. Endast den duplicerade datalogiken ersätts.
- Säkerställa att startdatum, arbetstid, anställningsdetaljer, plats, platstyp/distans, antal tjänster, yrke, lön och kontakt visas med samma villkor och formattering före och efter publicering.

### 6. Verifiering
- Databastester: noll frågor tillåts; obesvarad obligatorisk fråga nekas; `false`/`0` godkänns; dubbelansökan nekas; snapshot bevaras; okänt postnummer och fel ort nekas; giltig kombination normaliseras.
- Flödestester: skapa från tomt formulär och mall, återöppna utkast efter malländring, publicera med frågor, publicera utan frågor, redigera, snabbansök, full ansökan, offlinekö och återanslutning.
- Visuell jämförelse före/efter för steg 4 och publicerad vy på mobil, iPad stående/liggande och desktop. Krav: ingen avsiktlig pixel- eller layoutförändring och ingen horisontell overflow.
- Köra relevanta tester samt backendens säkerhetslinter efter migrationen.

## Tekniska skyddsräcken
- Alla databasändringar görs via migration och med explicita `GRANT`, RLS och policies.
- Ingen godtycklig textbegränsning läggs till.
- Inga nya visuella element, texter eller layoutändringar införs.
- Befintliga ansökningar och annonser migreras inte destruktivt.

# Tydligt utskickssystem

## Mål
Göra hela utskicksdelen begriplig och säker: arbetsgivaren ser exakt vad som sker automatiskt, vad som kräver ett aktivt val och vilka systemmeddelanden som ligger utanför mallarna.

## Det som byggs

### 1. Förenkla inställningssidan
- Dela upp sidan i tre tydliga delar:
  - **Automatiska flöden** – de sex faktiska händelserna i kronologisk ordning.
  - **Manuella besked** – Gå vidare och Ge avslag, med chatt-, mejl- och pushmallar.
  - **Systemutskick** – en låst översikt över bland annat intervjukallelse och andra fasta meddelanden.
- Korta ner den långa sidan med tydliga grupper som öppnas vid behov.
- Behåll befintlig design och funktion; ändra endast struktur och förklaringar.
- Säkerställ korrekt trunkering och tooltip på mobil, touch och dator.

### 2. Koppla de manuella mallarna på riktigt
- Visa **Gå vidare** och **Ge avslag** i kandidatprofilens åtgärder.
- Gå vidare öppnar en förhandsgranskning med malltext och valbara kanaler innan något skickas.
- Ge avslag öppnar samma typ av förhandsgranskning och tydlig bekräftelse.
- Ett bekräftat avslag gäller bara den aktuella ansökan, skickas högst en gång och gör att kandidaten hoppas över när annonsen senare avslutas.
- Vanlig Chatta/Meddelande fortsätter vara vanlig fritextchatt.

### 3. Premiumregel efter 14 dagar
- Skicka **inte** automatiskt avslag till kandidaten.
- Om en ansökan saknar ett tydligt beslut efter 14 dagar får relevanta arbetsgivare en intern påminnelse.
- Ett godtyckligt stegbyte nollställer inte tiden; endast ett verkligt beslut stoppar påminnelsen.
- Påminnelsen erbjuder **Gå vidare**, **Ge avslag** och **Påminn mig senare**.
- Kandidater markerade som Anställd eller Avslag undantas.
- Påminnelser ska vara idempotenta och inte dubbleras mellan kollegor eller körningar.

### 4. Tydlig flödeskarta i gränssnittet
```text
Ansökan
  ├─ automatiskt mottagningsbesked
  ├─ 14 dagar utan beslut → intern påminnelse till arbetsgivaren
  ├─ Gå vidare → manuellt besked efter bekräftelse
  ├─ Ge avslag → manuellt slutbesked efter bekräftelse
  └─ Intervju
       ├─ bokning → strukturerad kallelse + valfri chatt/push
       ├─ före → valfri påminnelse
       ├─ efter → valfritt tackmeddelande
       └─ avbokning → valfritt besked

Annons avslutas
  └─ slutbesked till kvarvarande kandidater
     (Anställd och redan Avslag hoppas över)
```

## Tekniska krav
- Återanvänd befintlig utskicksmotor, mallar, loggar och behörighetsregler.
- 14-dagarskontrollen körs högst dagligen; maximal fördröjning är cirka 24 timmar.
- Databasändringar får fullständiga rättigheter och åtkomstregler i samma migration.
- Ingen dubbelmejling, ingen utskickning från webbläsaren och inga hemligheter i koden.
- Mobil och dator verifieras separat utan oavsiktliga designändringar utanför utskicksdelen.

## Verifiering
- Testa Gå vidare och Ge avslag från kandidatprofil till loggat utskick.
- Testa att avslag endast påverkar rätt ansökan och inte skickas igen vid annonsstängning.
- Testa 14-dagarsgränser, Anställd/Avslag-undantag och Påminn mig senare.
- Kontrollera mobil, dator, tangentbord, touch, trunkering och tooltip.
- Kör befintliga tester, typkontroll samt kontroll av fel-, nätverks- och mejlloggar efter utskickstest.

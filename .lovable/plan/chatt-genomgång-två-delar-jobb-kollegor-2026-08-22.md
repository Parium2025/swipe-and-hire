# Chatt: genomgång + två delar (Jobb / Kollegor)

## Del 1 — Betyg på chatten idag

**Helhet: 8,5/10.** Stark grund (realtid, sök, blockering, notiser, bilagor i privat bucket), men tre konkreta hål.

Vad som redan är bra:
- Meddelanden i realtid över enheter, olästmarkering, reaktioner, redigera/radera, svep-gester på mobil.
- Sök i både konversationslista och inne i chatten (även filnamn), med trigram-index för stora volymer.
- Tyst blockering: allt sparas men når aldrig mottagaren förrän blockeringen hävs.
- Bilagor ligger i en privat bucket där bara samtalets deltagare kommer åt filen.

Hål som bör åtgärdas:
1. **Filtyper är för snävt vitlistade.** Ljudfiler (röstmemon, m4a/mp3), HEIC-bilder från iPhone, Pages/Numbers/Keynote och 7z/rar blockeras tyst av filväljaren. Åtgärd: bredda listan och visa ett tydligt felmeddelande i stället för att filen bara inte går att välja.
2. **Signerad länk gäller 1 år och sparas i meddelandet.** Efter ett år blir gamla bilagor döda länkar. Åtgärd: spara filens sökväg i stället och skapa en färsk länk när meddelandet visas.
3. **Ingen uppladdningsindikator för stora filer.** 50 MB över mobilnät ser ut som att appen hängt sig. Åtgärd: progressring på skicka-knappen och möjlighet att avbryta.

Mindre saker: ingen förhandsvisning av PDF (bara nedladdning), och filstorleksgränsen 50 MB nämns inte förrän man valt en för stor fil.

## Del 2 — Två delar i chatten

Ja, jag förstår upplägget: samma chattsida, men ett segment-växel högst upp precis som Utkast/Utgången på annonssidan.

```text
┌──────────────────────────────┐
│  [ Jobb ]   [ Kollegor 3 ]   │  ← segmenterad växel, swipe på mobil
├──────────────────────────────┤
│  Konversationslista           │
└──────────────────────────────┘
```

- **Jobb** = dagens vy: kandidater kopplade till en annons/ansökan.
- **Kollegor** = interna samtal med personer i samma organisation, inklusive gruppchatt.

Regler:
- Växeln visas **bara** om organisationen har fler än en användare. Är du ensam ser chatten exakt ut som idag — ingen extra klickyta.
- Olästräknare per flik, och den totala i menyn är summan.
- Byte av flik minns valet mellan sidbesök; på mobil går det även att svepa mellan flikarna.
- Kollegasamtal startas från en "Ny chatt"-knapp som listar organisationens medlemmar.

## Teknisk del

- `conversations` får en `kind`-kolumn (`job` | `internal`) plus `organization_id` för interna samtal; befintliga rader fylls som `job`.
- Åtkomstregler: interna samtal kan bara ses/skapas av medlemmar i samma organisation; kandidater kan aldrig hamna i ett internt samtal (spärr i databasen).
- `useConversations` filtrerar på `kind`; realtidsprenumerationen delas mellan flikarna så inget dubbeljobb sker.
- Segmentväxeln byggs som en egen komponent i `src/components/messages/` med samma visuella språk som annonsflikarna.
- Fillistan och signerad-länk-logiken ändras i `ChatView.tsx` samt `MessageBubble.tsx`.

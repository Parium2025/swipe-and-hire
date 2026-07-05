## Vad som byggs

Lägga till **LIA** som anställningsform + villkorliga extra-fält per typ, sparade i databasen och synliga för sökande.

### 1. Anställningsformer
Lägg till `lia` (LIA – lärande i arbete) i `src/lib/employmentTypes.ts`. Ny ordning: Heltid, Deltid, Konsult, Vikariat, Praktik, LIA, Sommarjobb.

### 2. Extra-fält per typ (villkorligt i wizarden)

| Typ | Extra input |
|---|---|
| Heltid | Inget |
| Deltid | Kryssrutor Mån–Sön (flerval) |
| Konsult | Antal + enhet (veckor/månader) |
| Vikariat | Antal + enhet (veckor/månader) |
| Praktik | Antal + enhet (veckor/månader) |
| LIA | Antal + enhet (veckor/månader) |
| Sommarjobb | Inget |

Fälten visas direkt under "Anställningsform"-dropdownen när relevant typ valts. Samma glassmorphism-stil som resten av wizarden. Veckodagar som pillar (Mån/Tis/…), varaktighet som en `Input type=number` + liten enhet-dropdown.

### 3. Databas
Nya kolumner på `job_postings` och `job_templates`:
- `part_time_days text[]` – array med `['mon','tue',…]`
- `duration_amount integer`
- `duration_unit text` – `'weeks' | 'months'`

Inga NOT NULL. RLS/grants oförändrade.

### 4. Wizardfiler som uppdateras
- `MobileJobWizard.tsx` – state, val, spar-payload, sammanfattnings-steget
- `CreateTemplateWizard.tsx` – samma
- `EditJobDialog.tsx` – samma + laddning från existerande job

### 5. Visning för sökande
En liten hjälpfunktion `formatEmploymentDetails(job)` som returnerar t.ex. *"Deltid · Mån, Ons, Fre"* eller *"Vikariat · ca 6 månader"* eller *"LIA · ca 10 veckor"*.

Uppdateras i:
- `MobileJobCard.tsx`
- `ReadOnlyMobileJobCard.tsx`
- `JobPreview.tsx`
- `JobTitleCell.tsx`
- `getMetaLine` i wizarderna

### Teknisk not
- Reset av extra-fält när användaren byter typ (deltid-dagar rensas om man byter till Heltid osv.)
- Validering: om deltid → minst en dag; om typ med varaktighet → tal > 0. Blockerar "Nästa" precis som andra required-fält.
- Ingen ändring av befintliga annonser – nya kolumner är null-tåliga.

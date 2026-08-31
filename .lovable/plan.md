# Profilväljare uppe vid Profilbild/Profilvideo

Jag håller med dig — det blir mycket proffsigare. Idag ligger "Mina profiler" som en lista längst ner, långt från själva media-ytan den handlar om. Att flytta upp valet till toppen gör att man ser vilken profil man redigerar medan man tittar på bilden/videon.

## Vad som byggs

**1. Profilväljare överst i kortet "Profilbild/Profilvideo"**
- En vågrät rad med profil-"chips": varje profil visas som en liten rundad ruta med miniatyr (bild eller videoposter), namn och en stjärna.
- Sist i raden ligger en `+`-ruta. Trycker man på den öppnas exakt samma dialog vi redan byggt (Lägg till profil), och den nya profilen dyker upp direkt i raden.
- Aktiv profil markeras med tydlig ram; övriga är dämpade.

**2. Swipe på touch**
- Raden är horisontellt scrollbar med snap, så man kan svepa mellan profiler på mobil/iPad. Ingen scrollbar syns.
- Tryck på en profil = välj den. Tryck på stjärnan = sätt som standard (fylld guldstjärna på den som är standard).
- Långt tryck / pennikon på aktiv profil = redigera, papperskorg = ta bort (samma bekräftelsedialog som idag).

**3. "Standard"-etiketten tas bort**
- Text-badgen "★ Standard" försvinner helt. Standard visas enbart genom den fyllda stjärnan på chipet.

**4. Gamla listan längre ner**
- Sektionen "Mina profiler" nere på sidan tas bort, eftersom allt nu sker i toppen. Inga funktioner försvinner — redigera, ta bort, sätt som standard och maxgränsen på 3 profiler finns kvar i den nya väljaren.

**5. Knappen "Lägg till profil"** (redan fixad i denna omgång)
- Använder nu exakt samma stil och centrering som "Ändra cover-bild" / "Anpassa din bild".

## Tekniskt

- Ny komponent `src/components/candidateProfiles/ProfileSwitcherRail.tsx` (chips + snap-scroll + `+`-ruta), driven av befintlig `useCandidateProfiles`.
- Renderas i `src/pages/Profile.tsx` direkt under rubriken "Profilbild/Profilvideo".
- `CandidateProfilesManager` reduceras till dialoghantering (editor + raderingsdialog) och tas bort från sin nuvarande plats längre ner på sidan.
- Inga databas- eller backend-ändringar; samma tabell, samma regler för standardprofil och max 3 profiler.

## Att bekräfta

Ska den aktiva profilens bild/video även styra vad som visas i den stora runda media-ytan under raden (dvs. man redigerar den valda profilens media direkt där)? Det är det mest logiska, men det ändrar hur huvudprofilens bild hanteras — säg till om du vill ha det så, annars behåller raden bara valet och redigering sker i dialogen.

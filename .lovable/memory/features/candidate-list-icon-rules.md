---
name: Kandidatlistor – personbaserade ikoner
description: Plus/bock-ikon i kandidatlistor styrs per applicant_id, inte per ansökan; bocken öppnar listväljaren för flytt/kollega.
type: feature
---
Regel: en kandidat = en person = en lista hos varje rekryterare.

- UI-kollen använder `isApplicantInMyCandidates(applicant_id)` (person-nivå), aldrig per ansökan. Per-ansökan-koll skapar falska plus-ikoner som backend sedan vägrar → "finns redan"-toast.
- Inte tillagd → `UserPlus` (lägg till direkt, eller listväljare om team/flera listor).
- Tillagd → grön `UserCheck`, klickbar, öppnar `AddToColleagueListDialog` där användaren kan flytta kandidaten till annan egen lista eller lägga till hos kollega. Dialogen flyttar befintliga kort i stället för att dubblett-fela.
- Kollegor kan vara tillagda oberoende — visas som info, aldrig blockerande.
- Desktop: `CandidatesTable.tsx` sista cellen. Mobil: `MobileCandidateCard.tsx` höger sida. Båda använder samma regel.

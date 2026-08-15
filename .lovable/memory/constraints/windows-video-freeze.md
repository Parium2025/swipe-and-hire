---
name: Windows-videovägen är fryst
description: Windows/HDMI-uppspelningen på landningssidan är empiriskt intrimmad och får inte ändras utan test på riktig Windows-maskin.
type: constraint
---

Rör INTE Windows-grenen i `JobSeekerVideoShowcase.tsx` eller `PinnedHorizontalGallery.tsx`
(källval, `prefersLargeWindowsDisplayTrack`, `supportsWindowsSafe60`, `maxWidthForConnection`,
concurrency, preload-strategi, pin-distans 240vh) utan att användaren sitter framför en riktig
Windows-maskin med HDMI-skärm och kan verifiera direkt.

**Varför:** den nuvarande kombinationen är framtagen genom mätning, inte genom teori. Varje gång
"korrekta" förbättringar lagts på har kallstarten via HDMI börjat hacka igen — Chromium på Windows
väljer decoder- och kompositorväg utifrån hela kombinationen (codecprofil + fps + upplösning +
antal samtidiga strömmar + DPR), så en isolerat riktig ändring kan flytta hela pipelinen till en
långsammare väg.

**Hur man arbetar:** en variabel i taget, verifiera på HDMI-uppsättningen mellan varje ändring,
rulla omedelbart tillbaka vid regression. Kodgranskningsanmärkningar om Windows får listas men
aldrig åtgärdas spekulativt.

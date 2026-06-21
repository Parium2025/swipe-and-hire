---
name: SEO-sidor i projektet
description: Referens-tabell med alla 14 SEO-route:r i projektet (route, sida, beskrivning). Användaren ber om den som "SEO-sidor i projektet" eller "SEO-listan".
type: reference
---
14 SEO-routes:

| # | Route | Sida | Beskrivning |
|---|---|---|---|
| 1 | `/` | Landing | Startsida |
| 2 | `/jobbsokare` | AudienceLanding | För jobbsökare |
| 3 | `/arbetsgivare` | AudienceLanding | För arbetsgivare |
| 4 | `/jobb` | JobbHub | Alla lediga jobb |
| 5 | `/jobb/:stad` | JobbCity | Jobb i en specifik stad |
| 6 | `/jobb/:stad/:yrke` | JobbCityYrke | Jobb i stad + yrke |
| 7 | `/yrken` | YrkenHub | Alla yrkeskategorier |
| 8 | `/yrke/:yrke` | YrkePage | Enskilt yrke |
| 9 | `/kommuner` | KommunHub | Alla kommuner |
| 10 | `/kommun/:kommun` | JobbKommun | Jobb i specifik kommun |
| 11 | `/guider` | GuiderHub | Alla guider |
| 12 | `/guider/:slug` | GuidePage | Enskild guide |
| 13 | `/annons/:jobId` | PublicJobPage | Publik jobbannons |
| 14 | `/om-oss` | AboutPage | Om bolaget Parium (kontakt, vision) |

Intern länkning: `SiteFooter` (`src/components/landing/SiteFooter.tsx`) renderas längst ner på `/jobbsokare`, `/arbetsgivare` och `/om-oss` med länkar till alla SEO-routes. Startsidan `/` är medvetet ren utan footer (singel-hero med val mellan jobbsökare/arbetsgivare).

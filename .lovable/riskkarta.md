# Riskkarta – Parium (uppdaterad 2026-08-27)

Status per område. Skala:
- **V** = Verifierat (kod läst + testad/queryad)
- **A** = Antaget (ser korrekt ut, ej bevisat under last eller edge case)
- **Ö** = Öppet (känd brist / ej granskat)

---

## Arbetsgivare

| Område | Status | Not |
|---|---|---|
| Dashboard-statistik | V | Realtid + 60s revalidering + debounce. RPC:er indexerade. |
| Skapa jobb (wizard) | V | Draft-isolering, tidsvalidering, postnummerregister. |
| Annonshantering (draft/aktiv/utgången) | V | Livscykelregler + ägarbehörighet (kollegor läser bara). |
| Mina kandidater (listor, kanban) | V | Multi-list, virtualisering, keyset-paginering. |
| Chatt & mallar | V | simpleChat-läge, slot-baserade mallar (max 12). |
| Automatiska utskick | V | Master-toggle tystar allt. Dispatch-lås verifierat. |
| Intervjuer & bokning | V | Mötestyper, org-ärvd länk, push vid schemaläggning. |
| Analys / insikter | A | Korrekt logik, ej lasttestad över ~10k ansökningar. |
| Organisation & inbjudningar | A | RLS granskad, men inbjudningsflödet ej end-to-end-testat i prod. |

## Jobbsökare

| Område | Status | Not |
|---|---|---|
| Sök jobb + swipe | V | RPC:er, index, exklusivitet sparad/skippad. |
| Sparade jobb | V | Dual-state-bugg fixad. |
| Mina ansökningar | V | Kallstart utan blink, RLS verifierad. |
| Chatt | V | Infinite scroll, avatarer via säker RPC, swipe-gester. |
| Notiser | V | Keyset-paginering, korrekt olästräknare, tooltips. |
| Profil (CV/bild/video) | V | Scopade drafts, filnamn, negativ mediecache. |
| Dataexport & radering (GDPR) | V | Kandidatprofiler nu med i export. |
| Notisinställningar (push/mail/in-app) | V | Alla tre kanaler respekterar inställningar. |
| Flera kandidatprofiler (max 3) | Ö | Planerad, ej byggd klart. |
| Push på iOS/Safari | Ö | "Not supported on this platform" i loggen — ej löst för web. |

## Plattform / tvärgående

| Område | Status | Not |
|---|---|---|
| RLS på alla publika tabeller | V | Senaste scan: 4 varningar granskade → falska positiva. |
| GRANTs | V | PUBLIC/anon EXECUTE revokerat på interna SECURITY DEFINER-funktioner. |
| Två konton samma person | V | Snapshot-ägare, sessionStorage-isolering, scopat toast-arkiv. |
| E-post (Lovable managed) | V | Avregistrering → notisinställningar. Ingen "unsubscribe"-fotnot. |
| Realtid | V | Publikationer + REPLICA IDENTITY FULL där det behövs. |
| Mobil/responsivt (≤1180px) | V | Nav overflow-guard, TruncatedText, safe-area. |
| Betalning (Stripe) | Ö | Backend förberedd, ej aktiverad. Juridik måste uppdateras först. |
| Kapacitet / kostnadstak | Ö | Se pre-launch-checklistan: Cloud-uppgradering (e-post går via Lovables app-mejl, ingen extern leverantör). |
| Felövervakning i prod | A | app_exceptions loggar, men ingen larmkanal till dig. |
| Lasttest i verklig miljö | Ö | Allt är simulerat/analyserat, inget riktigt lasttest kört. |

---

## Topp 5 att stänga före lansering

1. **Push på iOS/web** — avgör om notiser räknas som en funktion vi säljer.
2. **Larmkanal för fel** — app_exceptions → mail/Slack när något smäller i prod.
3. **Stripe + juridik** — policy, DPA, registerförteckning (GDPR art. 30).
4. **Kapacitetströsklar** — Cloud-plan och sändningstak innan trafik.
5. **Riktigt lasttest** — ett skarpt test mot söket och kandidatlistorna.

## Kvar på jobbsökarsidan (ej granskat än)

- Onboarding-flödet för ny jobbsökare (första inloggning → första ansökan).
- Ansökningsflödet i sig (frågor, snapshot, kvot, bekräftelse).
- Landing/SEO-sidor sett från inloggad jobbsökare.
- Min profil, Ekonomi/Prenumeration och Support på jobbsökarsidan.

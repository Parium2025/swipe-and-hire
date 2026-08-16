# Project Memory

## Core
- 100% visuell paritet krävs vid refaktorering; inga UI-ändringar utan begäran.
- **Apple / Spotify-standard:** All kod skrivs som om Apple eller Spotify hade byggt det. Pixel-perfekt, detaljfokus, responsivitet och polering från första iteration.
- **Brödtext på mörk bakgrund ska alltid vara kritvit (#FFFFFF), aldrig white/85 eller annan opacity.**
- Text får ALDRIG klippas av — den ska brytas/radbrytas korrekt på små skärmar.
- Sök-UX: Premium "Enterprise" känsla med smart search (Levenshtein/Synonymer), alias-system och iOS-zoom skydd (16px font).
- SEO: Värdeerbjudande som H1, välkomsttext som subtitle. Alla SEO-sidor länkade i footern för att undvika "orphan pages".
- Scroll Restoration: Spara position på `onPointerDown`; dedikerad logik för att återvända till footern vid back-navigering.
- Språkbruk: "Sök jobb" istället för "Bli matchad"; inga hets-termer som "ansökningshets" eller "matcha direkt".
- Ingen cookie-banner — endast nödvändig lagring används; footern länkar till /integritetspolicy#cookies.

## Memories
- [Premium Search System](mem://features/premium-search-system) — Smart sök, alias och enterprise UI.
- [SEO Infrastructure](mem://features/seo-infrastructure) — H1-regler, footer-länkar och staging-skydd.
- [Copywriting Standard](mem://style/copywriting-standard) — Terminologi och tonläge för Parium.
- [Kritvit text](mem://style/text-color-standard) — Brödtext på mörk bakgrund är alltid #FFFFFF.
- [Spotify Premium UI](mem://style/unified-design-system-standard) — Visuella regler: Windows-trimning, mobil typografi, glassmorphism.
- [Scroll Restoration](mem://architecture/scroll-restoration-logic) — Synkron snapshotting och footer-återställning.
- [Bildprestanda & Skalning](mem://architecture/bild-prestanda-system) — Centraliserad transformering, image_updated_at-versionering.
- [Navigering & UX](mem://logic/navigation-snabbhet) — JobView Overlay, instant back, wizard shortcuts.
- [SEO-sidor i projektet](mem://reference/seo-pages-list) — Tabell med alla 14 SEO-routes.
- [Candidate-Organization Isolation](mem://architecture/candidate-org-isolation) — Fullständig dataisolering per ansökan och organisation.
- [RPC EXECUTE-behörigheter](mem://architecture/rpc-execute-grants) — Vilka databasfunktioner som får vara anropbara av anon/authenticated.

- [Cache Validation Policy](mem://constraints/cache-array-validation) — Obligatorisk validering av cache-data.
- [Mobile Ergonomics](mem://constraints/mobile-premium-ergonomics) — Touch targets, haptics, iOS-optimeringar.
- [Destructive Actions](mem://style/destructive-action-standard) — Röda visuella element och AlertDialog-skydd.
- [Job Status Lifecycle](mem://logic/employer-job-categorization) — Regler för Draft, Active, Expired.
- [Offline Resilience](mem://infrastructure/connectivity-recovery-logic) — Reaktiv nätverkshantering.
- [RBAC Security](mem://architecture/security-rbac-system) — Databasdriven behörighet.
- [File Refactoring Policy](mem://constraints/no-refactoring-policy) — Komplexa filer som inte får delas upp.
- [Landing Page Rules](mem://constraints/landing-update-isolation-policy) — Isolerad utveckling för landningssidan.
- [Pre-launch Checklist](mem://launch/pre-launch-checklist) — Kapacitetströsklar, Resend Pro, Cloud-uppgradering.
- [Samtyckessidan borttagen](mem://constraints/no-data-sharing-consent-toggle) — Inget samtyckesreglage för datadelning; rättslig grund är avtal.
- [Windows-video fryst](mem://constraints/windows-video-freeze) — Windows/HDMI-uppspelningen ändras aldrig utan test på riktig Windows-maskin.
- [Ingen cookie-banner](mem://constraints/no-cookie-banner) — Bannern borttagen; endast nödvändig lagring.
- [Ingen Resend](mem://constraints/no-resend-email-provider) — All e-post via Lovables inbyggda app-mejl; aldrig extern leverantör.
- [Databasbehörigheter](mem://constraints/db-permission-policy) — GRANT/REVOKE-regler, policyroller, auth.uid()-kontroll i SECURITY DEFINER.
- [Raderingstider](mem://features/data-retention-timings) — 24 mån + 365 dagars frist, påminnelser 180/90/7 dagar, anonym räknare för raderade sökande.
- [Stripe-lansering: juridik](mem://launch/stripe-legal-reminder) — Policy, DPA, registerförteckning och FAQ måste uppdateras när betalningar aktiveras.
- [Videopipeline](mem://architecture/video-upload-pipeline) — 720p H.264-komprimering i enheten, posterbild, 90 s gräns.

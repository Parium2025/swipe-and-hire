# Roadmap

- [x] Granska hela chattflödet: realtid, lässtatus, identitet och KeepAlive
- [x] Granska offlineköer, samtidighet, återanslutning och kontobyten
- [x] Granska bilagor, uppladdning, lagring, hämtning och felhantering
- [x] Granska notiser, push, badges och bakgrundslägen
- [x] Granska databasregler, funktioner, index och dataintegritet
- [x] Granska närliggande kritiska flöden utanför chatten
- [x] Fixa och verifiera alla bekräftade fel
- [ ] Stripe/betalning: aktivera betalningar, koppla checkout och webhooks (kräver Pro + juridik-granskning)
- [ ] Stripe: "Avbryt prenumeration" avbryter direkt (cancel_at_period_end), perioden ut utan förlängning — ersätt supportärende-flödet
- [ ] Stripe: no-refund-regel i villkoren vid betalning; undantag endast via support; uppdatera policy, DPA, FAQ och registerförteckning
- [ ] Oberoende djupgranska pass 1–5 igen: översikt, annonser, kandidater, kollegavy och statistik
- [ ] Fixa varje ny bekräftad brist utan att ändra behörighetsmodellen eller gränssnittet
- [ ] Verifiera pass 1–5 med typkontroll, tester och relevanta databas-/livekontroller
- [x] Samla all sidnumrering i en gemensam, symmetrisk hissrörelse
- [x] Verifiera Nästa, Föregående och sidnummer på jobbsökar- och arbetsgivarsidor
- [x] Behåll samma kortplatser och medielager vid sidbyte mellan bild och initialer
- [x] Verifiera bild ↔ initialer i båda riktningarna utan att ändra hissrörelsen
- [x] Färdigställ målsidans kort och medielager före hissens första bildruta

- [ ] Stoppa förhandsvisningens omladdningsloop vid saknad dynamisk modul; visa stabil återhämtning utan blinkande.

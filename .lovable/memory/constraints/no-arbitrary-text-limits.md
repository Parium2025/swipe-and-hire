---
name: Inga godtyckliga textgränser
description: Identitets-, plats- och titelfält ska bära långa verkliga värden genom robust layout, inte korta maxgränser.
type: constraint
---
Ta inte bort eller kapa användarens originalinnehåll i jobbtitlar, mallnamn, företagsnamn, kandidatlistnamn, orter eller liknande identitetsfält med godtyckliga korta teckengränser.

Visa långa värden säkert genom responsiv radbrytning eller visuell trunkering med fulltext-tooltip där kontexten kräver det. Chatten använder ren trunkering utan tooltip. Tekniska skyddsgränser får bara finnas om de är mycket generösa och motiverade av säkerhet eller plattformsgränser, inte av layouten.
Personnamn (för- och efternamn) har ingen teckengräns — långa namn bärs av trunkering med tooltip. Kvarvarande gränser med teknisk grund: adress 160, webbadress 200, telefon 30, bio 1500, företagsbeskrivning 3000, supportmeddelande 20000.

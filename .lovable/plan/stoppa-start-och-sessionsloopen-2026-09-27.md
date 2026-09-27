# Stoppa start- och sessionsloopen

## Mål
- Parium får aldrig ladda om sig om och om igen.
- Preview ska tåla koduppdateringar utan att leverantörerna tappar auth-kopplingen.
- Två enheter per konto ska fortsätta gälla; tredje enheten avslutar den äldsta.

## Åtgärder
1. Gör konversationsdelen tolerant mot den tillfälliga auth-omkoppling som kan uppstå vid preview-uppdateringar.
2. Begränsa startvaktens automatiska omladdning till ett enda kontrollerat försök och visa därefter ett stabilt felläge.
3. Kräv ett faktiskt lyckat nätverkssvar före återförsök och stoppa parallella återställningar.
4. Lägg till regressionstester för startvakten och auth-leverantörens ordning.
5. Verifiera typkontroll, tester, aktuell byggstatus och verklig sidstart i webbläsare.

## Tekniskt
- Ingen design eller användarflöde ändras.
- Sessionsgränsen ligger kvar på två per konto.
- Felet ska exponeras stabilt i stället för att döljas av obegränsade omladdningar.

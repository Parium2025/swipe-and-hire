# Databassäkerhet och avsiktliga lintervarningar

## Avsiktligt låsta intern-tabeller

Fem interna tabeller har RLS aktiverat utan klientpolicy. Det är en medveten
`deny-all`-modell: `anon` och `authenticated` ska inte kunna läsa eller skriva
dem via Data API. Endast betrodda backendflöden med `service_role` får arbeta
med innehållet.

Att lägga till en policy bara för att tysta lintervarningen skulle försvaga
skyddet. Vid varje framtida ändring ska tabellens backendägare, datatyp och
retention granskas innan en klientpolicy kan övervägas.

## Tillägg i `public`

Tre installerade PostgreSQL-tillägg ligger i `public`. Detta är en
härdningsvarning, inte i sig bevis på exponerad användardata. De flyttas inte
utan en separat beroendeanalys eftersom funktioner, index och migreringar kan
referera till deras objekt. Säkert arbetssätt är att inventera beroenden,
provflytta i staging och därefter migrera ett tillägg i taget.

## `SECURITY DEFINER`

En sådan funktion kör med funktionsägarens rättigheter och ska därför ha:

- fast `search_path`,
- minsta möjliga `EXECUTE`-grant,
- ägar-/organisationskontroll för användarstyrda ID:n,
- begränsat och dokumenterat resultat för avsiktligt publika SEO-funktioner.

Linterantalet är en granskningskö, inte ett mått på lika många exploaterbara
luckor. Varje funktion måste klassificeras innan den ändras; ett generellt
återkallande kan annars stoppa legitima appflöden.
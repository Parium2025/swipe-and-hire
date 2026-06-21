// SEO cornerstone-artiklar. Långa, evergreen guider som rankar på
// "cv-mall", "lönerapport sverige", "anställningsintervju tips", "byta jobb".
// Varje guide har egen URL: /guider/{slug}

export type GuideData = {
  slug: string;
  title: string;          // H1 + <title>
  metaTitle: string;      // SEO-title (kan vara annan än H1)
  description: string;    // meta description
  excerpt: string;        // intro under H1
  category: string;
  readingMinutes: number;
  updated: string;        // ISO-datum
  sections: { heading: string; body: string }[];
  faqs: { q: string; a: string }[];
};

export const GUIDES: GuideData[] = [
  {
    slug: 'genomsnittslon-sverige-2026',
    title: 'Genomsnittslön Sverige 2026 – yrke för yrke',
    metaTitle: 'Genomsnittslön Sverige 2026: lönestatistik per yrke | Parium',
    description: 'Genomsnittslön i Sverige 2026 per yrke. Se medellön för snickare, elektriker, undersköterska, lagerarbetare, säljare och fler. Källa: SCB.',
    excerpt: 'Vad tjänar man egentligen i Sverige? Här är medellönerna 2026 för de vanligaste yrkena – plus vad som påverkar lönenivån mest.',
    category: 'Lön',
    readingMinutes: 6,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Snittlön i Sverige 2026',
        body: 'Medellönen i Sverige ligger 2026 på cirka 38 300 kr/månad enligt SCB. Median­lönen är cirka 35 600 kr. Skillnaden beror på höga toppar som drar upp genomsnittet. Lönenivån varierar mest med yrke, erfarenhet och stad – inte lika mycket med arbetsgivare.',
      },
      {
        heading: 'Lön per yrke (medellön 2026, ca)',
        body: '• Undersköterska: 28 000–33 000 kr\n• Lagerarbetare: 26 000–31 000 kr\n• Restaurangpersonal: 25 000–32 000 kr\n• Butiksmedarbetare: 26 000–30 000 kr\n• Städare: 24 000–28 000 kr\n• Kundservice: 26 000–31 000 kr\n• Snickare: 32 000–38 000 kr\n• Elektriker: 33 000–40 000 kr\n• Chaufför (lastbil): 30 000–36 000 kr\n• Säljare (inkl. provision): 32 000–45 000 kr\n• Sjuksköterska: 36 000–42 000 kr\n• Lärare: 36 000–44 000 kr',
      },
      {
        heading: 'Vad påverkar lönen mest?',
        body: '1. Erfarenhet – 5 års erfarenhet ger ofta 15–25% högre lön än nyanställd.\n2. Stad – Stockholm har generellt 5–12% högre löner än rikssnittet.\n3. Bransch – tech, energi och bygg betalar mest på medianen.\n4. Utbildning – yrkesbevis/certifikat kan ge 10–20% lyft.\n5. Förhandling – många får 3–8% extra bara genom att förhandla.',
      },
      {
        heading: 'Så förhandlar du lön',
        body: 'Kolla upp medellönen för rollen på SCB eller fackförbundens lönesök. Ge ett intervall, inte en exakt siffra. Förankra i värde: vad har du levererat? Vänta tills arbetsgivaren visat intresse innan du nämner pengar.',
      },
    ],
    faqs: [
      { q: 'Vad är medellönen i Sverige?', a: 'Cirka 38 300 kr/månad 2026 enligt SCB. Medianen är cirka 35 600 kr.' },
      { q: 'Vilka yrken har högst lön?', a: 'Läkare, ingenjörer inom tech/energi, chefer och vissa specialister inom finans/jurist.' },
      { q: 'Vilka yrken har lägst lön?', a: 'Service- och restaurangyrken samt vissa butiks- och städyrken ligger i botten.' },
      { q: 'Är lönen högre i Stockholm?', a: 'Ja, oftast 5–12% över rikssnittet, men hyror och levnadskostnader är också högre.' },
    ],
  },
  {
    slug: 'anstallningsintervju-tips',
    title: 'Anställningsintervju – 12 frågor du måste kunna svara på',
    metaTitle: 'Anställningsintervju 2026: 12 frågor & svar du måste kunna | Parium',
    description: 'Komplett guide till anställningsintervjun. De 12 vanligaste frågorna med exempelsvar, vad du ska fråga själv, och hur du undviker de värsta misstagen.',
    excerpt: 'En intervju vinns ofta innan du ens öppnar munnen. Här är de 12 frågor du garanterat får – och hur du svarar på dem så att du sticker ut.',
    category: 'Intervju',
    readingMinutes: 9,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Innan intervjun',
        body: 'Läs på om företaget i 15 minuter: vad gör de, vilka är deras kunder, vad har de skrivit om senast på LinkedIn? Förbered 3 frågor du själv vill ställa. Ta med papper och penna även till en digital intervju – det signalerar engagemang.',
      },
      {
        heading: 'De 12 vanligaste frågorna',
        body: '1. Berätta om dig själv.\n2. Varför söker du det här jobbet?\n3. Vad vet du om oss?\n4. Vad är din största styrka?\n5. Vad är din största svaghet?\n6. Berätta om en konflikt du löst.\n7. Var ser du dig själv om 3 år?\n8. Varför vill du lämna nuvarande jobb?\n9. Hur hanterar du stress?\n10. Vilken är din största prestation hittills?\n11. Vad förväntar du dig i lön?\n12. Har du några frågor till oss?',
      },
      {
        heading: 'Använd STAR-metoden',
        body: 'För beteendefrågor ("Berätta om en gång du..."): Situation – beskriv kontexten. Task – vad var ditt ansvar? Action – vad gjorde du konkret? Result – vad blev resultatet, helst med siffror.',
      },
      {
        heading: 'Frågor du själv ska ställa',
        body: '• Hur ser de första 90 dagarna ut i rollen?\n• Vad är största utmaningen för teamet just nu?\n• Hur mäter ni framgång i rollen efter 6 månader?\n• Hur ser nästa steg i processen ut?\n\nUndvik att fråga om lön, semester och förmåner i första intervjun.',
      },
      {
        heading: 'De 5 värsta misstagen',
        body: '1. Säga något negativt om tidigare arbetsgivare.\n2. Ha inga egna frågor.\n3. Komma sent (eller exakt på minuten – kom 5 min innan).\n4. Ljuga om kompetens du inte har.\n5. Glömma att tacka för intervjun efteråt – ett kort mail räcker.',
      },
    ],
    faqs: [
      { q: 'Hur lång är en typisk anställningsintervju?', a: 'Första intervjun är ofta 30–45 minuter. Andra intervju 45–90 minuter, ibland med case eller test.' },
      { q: 'Vad ska jag ha på mig?', a: 'En nivå snyggare än arbetsplatsens dagliga klädsel. Kontor: kavaj eller snygg blus/skjorta. Restaurang/handel: vårdat och rent.' },
      { q: 'Hur svarar jag på lönefrågan?', a: 'Helst undvika i första intervjun. Säg "Jag vill gärna förstå rollen bättre först, men för rätt jobb är mitt intervall 35 000–40 000 kr".' },
      { q: 'Ska jag mejla efter intervjun?', a: 'Ja. Ett kort tackmejl inom 24 timmar med en specifik referens till samtalet visar att du är intresserad.' },
    ],
  },
  {
    slug: 'byta-jobb-checklista',
    title: 'Byta jobb 2026 – komplett checklista steg för steg',
    metaTitle: 'Byta jobb 2026: checklista, uppsägning & nytt jobb | Parium',
    description: 'Komplett checklista för dig som vill byta jobb 2026. Uppsägningstid, lön, semester, intervjuer, hur du säger upp dig snyggt – och hur du hittar nästa jobb snabbt.',
    excerpt: 'Att byta jobb är ett av de största besluten du tar. Här är checklistan steg för steg – från att inse att det är dags, till att signera nästa kontrakt.',
    category: 'Karriär',
    readingMinutes: 7,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'När är det dags att byta?',
        body: 'Varningssignaler: du har slutat lära dig nytt, du vaknar med ångest på söndagar, lönen har stått stilla 2+ år, det finns ingen utvecklingsväg, eller företagskulturen passar dig inte längre. En enskild dålig vecka är inte skäl att byta – men ett halvår av samma känsla är det.',
      },
      {
        heading: 'Innan du säger upp dig',
        body: '1. Uppdatera CV och LinkedIn (smyg – ändra inte "open to work" om kollegor följer dig).\n2. Räkna ut din uppsägningstid (vanligtvis 1–3 månader enligt kollektivavtal).\n3. Kolla semesterdagar du har kvar – de ska betalas ut vid sista lön.\n4. Tänk efter: vill du verkligen byta, eller bara förhandla på nuvarande jobb?\n5. Sök helst i hemlighet och ha ett erbjudande på papper innan du säger upp dig.',
      },
      {
        heading: 'Så säger du upp dig snyggt',
        body: 'Säg det till din närmaste chef först, ansikte mot ansikte (eller video). Lämna in skriftlig uppsägning samma dag. Var artig, kortfattad och tacksam – även om du går för att du hatar jobbet. Världen är liten och referenser betyder allt.\n\nMall: "Jag har bestämt mig för att gå vidare till nästa steg i min karriär. Min sista arbetsdag blir därför den [datum] enligt min uppsägningstid på [X] månader. Jag är glad för min tid här och vill tacka för möjligheten."',
      },
      {
        heading: 'Att förhandla erbjudandet',
        body: 'Få allt skriftligt: lön, semester, tjänstepension, bonus, distansarbete, startdatum. Be om 24–48 timmar att läsa igenom innan du signerar. Förhandla EN gång – inte fem. Förankra önskemålet i marknadslön och vad du tar med dig.',
      },
      {
        heading: 'Första 30 dagarna i nya jobbet',
        body: 'Lyssna mer än du pratar. Ställ frågor istället för att komma med åsikter. Boka 15-minuters samtal med 8–10 nyckelpersoner. Skriv ner allt – du kommer glömma. Sätt en 30-60-90-plan med din chef.',
      },
    ],
    faqs: [
      { q: 'Hur lång är uppsägningstiden i Sverige?', a: 'Enligt LAS minst 1 månad. Med kollektivavtal eller längre anställning ofta 2–3 månader. Kolla ditt kontrakt och kollektivavtal.' },
      { q: 'Får jag betalt för outtagen semester?', a: 'Ja, outtagna semesterdagar betalas ut som semesterersättning vid sista lön.' },
      { q: 'Kan arbetsgivaren neka mig att sluta?', a: 'Nej, men du måste hålla uppsägningstiden. Att lämna tidigare kan i undantagsfall ge skadestånd.' },
      { q: 'Ska jag säga upp mig innan jag har nytt jobb?', a: 'Nej – ha alltid ett påskrivet erbjudande först. Marknaden kan vara tuffare än du tror.' },
    ],
  },
  {
    slug: 'extrajobb-student-2026',
    title: 'Extrajobb för studenter 2026 – så hittar du jobb vid sidan av studierna',
    metaTitle: 'Extrajobb student 2026: bästa jobben & så hittar du dem | Parium',
    description: 'Bästa extrajobben för studenter 2026: lön, flexibilitet och hur du söker. Lager, kassa, vård, hemtjänst, leverans, korttidsuppdrag.',
    excerpt: 'Extrajobb som funkar med studierna finns – om du vet var du ska leta. Här är de bästa typerna 2026 och hur du landar dem snabbt.',
    category: 'Jobbsökning',
    readingMinutes: 5,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Vad räknas som extrajobb?',
        body: 'Extrajobb (även kallat deltidsjobb, helgjobb eller studentjobb) är allt från någon kväll i veckan upp till 50% av en heltid. CSN tillåter att du tjänar upp till fribeloppet (cirka 100 000 kr/halvår 2026) utan att studiebidraget påverkas – det betyder att de flesta studenter kan jobba 15–20h/vecka utan problem.',
      },
      {
        heading: 'De bästa extrajobben',
        body: '• Lager & logistik (PostNord, DHL, Bring) – ofta kvälls- och helgpass.\n• Kassör & butik – kvällar/helger, många heltidsstudenter jobbar Coop, ICA, H&M.\n• Restaurang & café – flexibla scheman.\n• Vård (vårdbiträde, personlig assistent) – välbetalt och ger erfarenhet inför vårdyrken.\n• Bud & leverans (Foodora, Wolt, Bolt Food) – välj själv när du jobbar.\n• Callcenter & telefonförsäljning – ofta kvällar, hög timlön.\n• Föreläsare/läxhjälpare via plattformar som Mathem eller Studybuddy.',
      },
      {
        heading: 'Lönenivåer 2026',
        body: 'Lager: 145–180 kr/h. Butik: 140–170 kr/h. Restaurang: 135–165 kr/h + ev. dricks. Vård: 165–210 kr/h (helg/natt mer). Bud: 100–250 kr/h beroende på antal leveranser. Telefonförsäljning: 130 kr/h + provision (kan landa på 200+ kr/h).',
      },
      {
        heading: 'Så söker du smart',
        body: 'Använd en jobbapp där du kan filtrera på "deltid" och "din stad". Ha CV redo med "tillgänglig kvällar/helger" tydligt. Sök på fredagar – många arbetsgivare lägger ut nya pass inför veckan. Svara inom 24h när du blir kontaktad – studentjobb går extremt snabbt.',
      },
    ],
    faqs: [
      { q: 'Hur mycket får jag tjäna utan att förlora studiebidrag?', a: 'Fribeloppet 2026 är ungefär 100 000 kr per halvår vid heltidsstudier. Över det minskas studiemedlet successivt.' },
      { q: 'Vilket extrajobb betalar bäst?', a: 'Vård (med OB-tillägg på natt och helg), personlig assistans och provisionsbaserad försäljning toppar listan.' },
      { q: 'Kan jag jobba mer på loven?', a: 'Ja – sommarjobb räknas separat. Många studenter går upp i 100% juni–augusti.' },
      { q: 'Behöver jag deklarera extrajobb?', a: 'Nej, arbetsgivaren betalar in skatt och ger ut kontrolluppgift. Du behöver bara kolla att uppgifterna stämmer i din deklaration.' },
    ],
  },
  {
    slug: 'sommarjobb-2026',
    title: 'Sommarjobb 2026 – så hittar du ett bra sommarjobb snabbt',
    metaTitle: 'Sommarjobb 2026: bästa jobben, lön & så söker du | Parium',
    description: 'Hitta sommarjobb 2026: vård, lager, turism, kommunala jobb. Lönenivåer, deadline för ansökningar och tips som faktiskt funkar.',
    excerpt: 'Sommarjobben försvinner snabbt – men det finns alltid jobb kvar för den som söker smart. Här är var du hittar dem 2026.',
    category: 'Jobbsökning',
    readingMinutes: 5,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'När ska du söka?',
        body: 'Kommunala sommarjobb (för 16–18-åringar) öppnar redan januari–februari. Vanliga sommarjobb (vård, lager, turism) öppnar februari–april. Sena sommarjobb (juni–augusti) finns alltid kvar inom vård, restaurang och bud – arbetsgivare panikrekryterar in i sista stund.',
      },
      {
        heading: 'Var hittar du sommarjobben?',
        body: '• Din kommuns webbplats (för dig under 18).\n• Vårdföretag och regioner – sommaren är deras toppsäsong, de tar in tusentals vikarier.\n• Turistorter (Gotland, Öland, fjällen, västkusten) – boende ofta inkluderat.\n• Lager (PostNord, Postnord, Schenker, e-handelsföretag).\n• Restauranger och uteserveringar.\n• Festivaler och evenemangsbolag.',
      },
      {
        heading: 'Lönenivåer för sommarjobb 2026',
        body: 'Under 18: ofta 75–90% av minimilönen i kollektivavtalet (cirka 110–140 kr/h). Över 18: 145–180 kr/h grundlön + OB-tillägg helg/natt. Vård: 165–220 kr/h med tillägg. Försäljning på provision kan landa på 200+ kr/h.',
      },
      {
        heading: 'Tips som faktiskt funkar',
        body: '1. Sök brett – minst 10–20 ansökningar ökar dina chanser markant.\n2. Följ gärna upp med ett kort samtal eller mejl efter ansökan – det visar engagemang.\n3. Var öppen för pass som ligger udda (kvällar, helger, midsommarvecka) – där finns ofta lediga platser kvar.\n4. Använd en app där du kan ansöka snabbt istället för långa formulär.\n5. Saknar du erfarenhet? Lyft fram skola, föreningsliv och ideellt arbete – det räknas.',
      },
    ],
    faqs: [
      { q: 'När är det sista chansen att hitta sommarjobb?', a: 'Det finns sommarjobb hela vägen in i juli – särskilt inom vård och restaurang. Vänta inte, men ge inte upp.' },
      { q: 'Får 15-åringar jobba?', a: 'Ja, lättare arbete från det år man fyller 13. Från 16 år får du jobba mer fritt, men max 8h/dag och inte sena nätter.' },
      { q: 'Hur lång är en typisk sommarjobbsperiod?', a: '4–10 veckor. Vanligast är 6 veckor juni–augusti, men vården erbjuder ofta hela sommaren.' },
      { q: 'Räknas sommarjobb som arbetslivserfarenhet?', a: 'Ja, absolut. Lägg in det i CV:t med datum och konkreta arbetsuppgifter.' },
    ],
  },
  {
    slug: 'lonesamtal-tips',
    title: 'Lönesamtal – så förhandlar du upp lönen 2026',
    metaTitle: 'Lönesamtal 2026: 10 tips för att förhandla högre lön | Parium',
    description: 'Konkreta tips inför lönesamtalet. Hur du förbereder dig, vad du ska säga, vilka siffror att begära och hur du undviker de vanligaste misstagen.',
    excerpt: 'Tre minuter av samtalet avgör tusenlappar varje månad i flera år framåt. Här är receptet rekryterare och chefer själva använder när de byter jobb.',
    category: 'Lön',
    readingMinutes: 6,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Förbered dig – innan mötet',
        body: 'Samla 3–5 konkreta exempel på resultat du levererat senaste året: siffror, projekt, kunder, sparade kostnader. Kolla upp marknadslönen för din roll (SCB, fackets lönesök, lönekoll.se). Bestäm tre nivåer: drömnivå, målnivå, lägstanivå. Skriv ner. Aldrig gå in oförberedd.',
      },
      {
        heading: 'Vad du kan säga (exempel)',
        body: '"Tack för året. Jag vill gärna prata om lönen. Det senaste året har jag [konkret resultat 1], [resultat 2] och tagit ansvar för [område]. Marknadslönen för min roll ligger på X–Y kr, och jag skulle vilja landa runt Z kr." Ge sedan chefen utrymme att svara i lugn och ro – det är en dialog, inte en förhandlingsmatch.',
      },
      {
        heading: 'Siffror som funkar 2026',
        body: 'Normal årlig löneökning: 2,5–4%. Bra prestation: 5–8%. Ny roll eller utökat ansvar: 8–15%. Vid jobbyte externt: ofta 10–20% mer. Lägg dig i den övre delen av ditt önskade intervall – då finns utrymme för en konstruktiv dialog.',
      },
      {
        heading: 'Om svaret blir nej till lönehöjning',
        body: 'Det går ofta att hitta andra värden: extra semesterdagar, kompetensutveckling, mer flexibilitet kring hemarbete, bonusmodell, högre pensionsavsättning. Be om ett uppföljande samtal inom 3–6 månader med tydliga kriterier för vad som behövs för en höjning – då vet du vad du ska sikta på.',
      },
      {
        heading: '5 saker att undvika',
        body: '1. Att nämna en exakt siffra först utan något intervall.\n2. Argumentera utifrån privata behov istället för din insats.\n3. Antyda uppsägning som påtryckning.\n4. Jämföra dig med specifika kollegor.\n5. Tacka ja på direkten – be alltid att få fundera till nästa dag.',
      },
    ],
    faqs: [
      { q: 'När är bästa tiden att be om löneförhöjning?', a: 'I samband med årligt lönesamtal, efter en lyckad leverans, eller när du fått nytt ansvar. Undvik bokslutsperiod och chefens stressigaste veckor.' },
      { q: 'Hur mycket kan jag begära?', a: 'Vid årlig översyn: 5–10% om du presterat bra. Vid ny roll eller jobbyte: 10–20%.' },
      { q: 'Ska jag visa konkurrerande erbjudande?', a: 'Bara om du är beredd att faktiskt byta. Annars är det bluff och du tappar trovärdighet långsiktigt.' },
      { q: 'Vad gör jag om jag får nej?', a: 'Be om skriftliga kriterier för vad som krävs för höjning, och ett uppföljningsmöte om 3–6 månader. Annars: börja söka externt.' },
    ],
  },
  {
    slug: 'jobbintervju-fragor-svar',
    title: '50 vanliga intervjufrågor 2026 – med svar som funkar',
    metaTitle: '50 vanliga intervjufrågor 2026: svar & exempel | Parium',
    description: 'De 50 vanligaste intervjufrågorna 2026 med konkreta svar, exempel och vad rekryterare egentligen letar efter. Plus de svåra "varför ska vi anställa dig?".',
    excerpt: 'Det är samma frågor på 90% av alla intervjuer. Lär dig svaren som faktiskt landar – med exempel direkt från riktiga rekryterare.',
    category: 'Jobbsökning',
    readingMinutes: 9,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Berätta om dig själv',
        body: 'Den vanligaste och mest underskattade frågan. Använd PEP-formeln: Present (vad du gör nu, 1 mening), Erfarenhet (2–3 nyckelroller med resultat), Plan (varför just det här jobbet, 1 mening). Max 90 sekunder. Sluta med en hook: "Det är därför rollen som [titel] hos er kändes som ett självklart nästa steg."',
      },
      {
        heading: 'Vad är din största styrka / svaghet?',
        body: 'STYRKA: Välj EN styrka som matchar jobbet, ge ett konkret exempel som bevisar den, koppla till hur det skulle hjälpa dem.\nSVAGHET: Ärlig svaghet (inte falsk modesty som "jag jobbar för mycket"), berätta vad du AKTIVT gör för att jobba med den. Ex: "Jag har varit dålig på att delegera – nu använder jag veckomöten med konkreta delegerings-rutiner."',
      },
      {
        heading: 'Varför ska vi anställa just dig?',
        body: 'Trippel-formeln: 1) En specifik kompetens som matchar deras behov, 2) Ett konkret resultat som bevisar det, 3) Hur det löser deras problem. Ex: "Ni nämnde att ni behöver öka konverteringen. Senaste året ökade jag konvertering på vår landingssida med 34% via A/B-testning – jag tror jag kan göra något liknande hos er."',
      },
      {
        heading: 'Varför vill du byta jobb?',
        body: 'Aldrig tala illa om förra arbetsgivaren. Ramin det positivt: "Jag har lärt mig mycket på [företaget], men nu söker jag större ansvar/teknisk fördjupning/nya utmaningar inom X." Om du blev uppsagd: var ärlig kort, vänd snabbt till vad du tar med dig.',
      },
      {
        heading: 'Vad har du för löneförväntningar?',
        body: 'Gör hemläxan – kolla SCB, fackets lönesök, lönekoll.se. Ge ett intervall, inte exakt: "Marknadsmässigt ligger rollen på 38 000–44 000 baserat på min erfarenhet. Jag är nyfiken på vad er löneband ser ut för rollen?" Vänd frågan tillbaka.',
      },
      {
        heading: 'Frågor DU ska ställa till dem',
        body: '1. "Vad gör en person framgångsrik i den här rollen efter 6 månader?"\n2. "Vilka är de största utmaningarna teamet står inför?"\n3. "Hur ser ni på utveckling och nästa steg för den som tar den här rollen?"\n4. "Vad är nästa steg i processen och när kan jag förvänta mig återkoppling?"\nAtt ställa frågor signalerar engagemang och hjälper DIG bedöma om jobbet passar.',
      },
    ],
    faqs: [
      { q: 'Hur lång ska intervjun vara?', a: 'Förstaintervju oftast 30–45 minuter. Andra intervju 60–90 min. Slutintervju ofta längre med flera personer.' },
      { q: 'Vad ska jag ha på mig?', a: 'En nivå snyggare än vad anställda har dagligen. Tech: smart casual. Bank/juridik: kostym. Restaurang/butik: snyggt och rent.' },
      { q: 'Hur snabbt ska jag tacka efter intervjun?', a: 'Skicka ett kort tackmail samma dag eller dagen efter. Nämn något konkret från samtalet.' },
      { q: 'Får jag fråga om lön på första intervjun?', a: 'Vänta tills de tar upp det eller andra intervjun. Att fråga för tidigt kan signalera att lön är viktigast.' },
    ],
  },
  {
    slug: 'personligt-brev-2026',
    title: 'Personligt brev 2026 – mall, exempel och vad rekryterare faktiskt läser',
    metaTitle: 'Personligt brev 2026: mall, exempel & tips | Parium',
    description: 'Så skriver du ett personligt brev 2026 som rekryteraren faktiskt läser klart. Gratis mall, konkreta exempel och de 5 vanligaste misstagen att undvika.',
    excerpt: 'Rekryteraren ger ditt brev 8 sekunder. Här är formeln som får dem att läsa hela – plus en mall du kan kopiera direkt.',
    category: 'Jobbsökning',
    readingMinutes: 6,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Behövs personligt brev 2026?',
        body: 'Ja – men inte alltid. Klassiska kontorsjobb, vård och offentlig sektor förväntar sig fortfarande ett brev. I många moderna jobbappar (inkl. Parium) ersätts brevet av en kort profiltext och video. Tumregel: om ansökan har ett fält för personligt brev, skriv ett. Att hoppa över det signalerar lathet.',
      },
      {
        heading: 'Strukturen som funkar (4 stycken)',
        body: '1. Krok – en mening som visar varför just det här jobbet, inte ett generiskt "jag söker härmed".\n2. Värdebevis – 2–3 konkreta resultat från tidigare jobb med siffror.\n3. Matchning – koppla din erfarenhet direkt till deras annons (citera 1–2 nyckelord).\n4. Avslut – tydlig call-to-action: "Jag vill gärna berätta mer i ett samtal."\n\nMaxlängd: 250–350 ord. En A4-sida räcker mer än väl.',
      },
      {
        heading: 'Mall du kan kopiera',
        body: '"Hej [namn på rekryterare],\n\nNär jag läste er annons om [tjänst] fastnade jag direkt vid [konkret detalj från annonsen]. Det är precis den typen av utmaning jag vill jobba med.\n\nDe senaste [X] åren har jag arbetat som [roll] på [företag], där jag bland annat [resultat 1 med siffra] och [resultat 2 med siffra]. Min styrka är [kompetens som matchar annonsen] – något jag tror skulle göra skillnad i er roll.\n\nJag drivs av [värde/mål som matchar företaget] och tror starkt på [företagets vision/produkt]. Det skulle vara fantastiskt att få bidra till [konkret område hos dem].\n\nJag berättar gärna mer i ett samtal.\n\nVänliga hälsningar,\n[Namn] · [telefon] · [e-post]"',
      },
      {
        heading: 'De 5 vanligaste misstagen',
        body: '1. Skriva samma brev till alla jobb – rekryterare ser igenom det direkt.\n2. Upprepa CV:t istället för att förklara värde och drivkraft.\n3. Börja med "Jag heter X och söker härmed tjänsten…" – ingen läser vidare.\n4. Stavfel och fel företagsnamn – brevets dödsstöt.\n5. Avsluta med "Hoppas på snabbt svar" istället för en tydlig nästa-steg-fråga.',
      },
      {
        heading: 'Anpassa brevet på 5 minuter',
        body: 'Spara en bas-mall. Inför varje ansökan: byt företagsnamn, rekryterarens namn, en specifik mening om varför just dem, och 1–2 nyckelord från annonsen. Klart. Det räcker för att brevet ska kännas skräddarsytt – och tar inte 2 timmar per ansökan.',
      },
    ],
    faqs: [
      { q: 'Hur långt ska ett personligt brev vara?', a: '250–350 ord, max en A4. Längre läses sällan klart.' },
      { q: 'Ska jag bifoga personligt brev om det inte krävs?', a: 'I korta jobbappar – nej, en bra profil räcker. I formella ansökningar – ja, alltid.' },
      { q: 'Får jag använda AI för att skriva brevet?', a: 'Som utkast: ja. Som färdig produkt: nej. Rekryterare känner igen AI-fluff direkt – du måste lägga in dina egna konkreta resultat och röst.' },
      { q: 'Ska jag skriva lönekrav i brevet?', a: 'Bara om annonsen explicit ber om det. Annars: vänta tills intervjun.' },
    ],
  },
];


export const GUIDE_BY_SLUG: Record<string, GuideData> = GUIDES.reduce(
  (acc, g) => ({ ...acc, [g.slug]: g }),
  {} as Record<string, GuideData>,
);

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
    slug: 'cv-mall-2026',
    title: 'CV-mall 2026 – så skriver du ett CV som faktiskt får svar',
    metaTitle: 'CV-mall 2026: gratis exempel & tips för svenskt CV | Parium',
    description: 'Komplett guide till svenskt CV 2026. Gratis CV-mall, exempel, tips och vanliga misstag att undvika. Skriv ett CV som arbetsgivare faktiskt läser.',
    excerpt: 'Ditt CV är 30 sekunder från att hamna i skräpkorgen eller på "ja-högen". Här är vad svenska rekryterare letar efter 2026 – och en mall du kan kopiera direkt.',
    category: 'Jobbsökning',
    readingMinutes: 8,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Vad ska ett CV innehålla?',
        body: 'Ett svenskt CV ska vara 1–2 sidor och innehålla kontaktuppgifter, en kort personlig profil (3–4 meningar), arbetslivserfarenhet i omvänd kronologisk ordning, utbildning, kompetenser och språk. Skippa personnummer, civilstånd och bild om jobbannonsen inte ber om det – GDPR och svensk standard är att inte inkludera känsliga uppgifter.',
      },
      {
        heading: 'CV-mall – kopiera direkt',
        body: 'Namn · Telefon · E-post · Stad · LinkedIn\n\nProfil: 3–4 meningar om vem du är, vad du gjort, vad du vill.\n\nArbetslivserfarenhet:\n• Titel – Företag (mån/år – mån/år)\n  → 2–4 punkter med resultat, inte arbetsuppgifter. "Ökade försäljningen 23%" slår "ansvarig för försäljning".\n\nUtbildning:\n• Program – Skola (år)\n\nKompetenser: 5–10 konkreta (Excel, kassa, truckkort A+B, svenska & engelska).',
      },
      {
        heading: 'De 5 vanligaste misstagen',
        body: '1. CV längre än 2 sidor.\n2. Generisk profil ("driven lagspelare") – konkretisera istället.\n3. Arbetsuppgifter istället för resultat.\n4. Stavfel – läs igenom 3 gånger och be någon annan.\n5. Samma CV till alla jobb – anpassa profil och kompetenser per ansökan.',
      },
      {
        heading: 'Behövs personligt brev 2026?',
        body: 'Allt färre arbetsgivare kräver personligt brev. Många moderna jobbappar (som Parium) hoppar över det helt och låter arbetsgivaren se din profil direkt. Om annonsen ber om personligt brev – håll det på max 300 ord och fokusera på "varför just det här jobbet, varför just du".',
      },
    ],
    faqs: [
      { q: 'Hur långt ska ett CV vara?', a: 'Max 2 sidor. För juniora roller räcker oftast 1 sida.' },
      { q: 'Ska jag ha bild på CV:t?', a: 'Inte krav i Sverige. Lägg bara med om annonsen ber om det eller om du söker en kundnära roll där utseende har relevans (modell, säljare i butik m.m.).' },
      { q: 'Hur anpassar jag CV till varje jobb?', a: 'Läs jobbannonsen och plocka ut 3–5 nyckelord (kompetenser, system, branschord). Få med dessa naturligt i profil och kompetenslista.' },
      { q: 'Vilket filformat ska CV:t vara i?', a: 'PDF. Word-filer kan se olika ut hos olika mottagare och bryta layouten.' },
    ],
  },
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
    slug: 'tjanstepension-forklarat',
    title: 'Tjänstepension förklarat 2026 – så funkar det och så maxar du den',
    metaTitle: 'Tjänstepension 2026: ITP, SAF-LO & vad du bör veta | Parium',
    description: 'Allt om tjänstepension 2026: ITP, SAF-LO, KAP-KL och PA16. Så väljer du fonder, så flyttar du och så maxar du din pension. Enkel guide.',
    excerpt: 'Tjänstepensionen är ofta värd lika mycket som lönen över ett arbetsliv. Här är det viktigaste att förstå – och de val som faktiskt gör skillnad.',
    category: 'Pension & lön',
    readingMinutes: 7,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Vad är tjänstepension?',
        body: 'Tjänstepension är den pension din arbetsgivare betalar in utöver din lön – ovanpå den allmänna pensionen från Pensionsmyndigheten. Cirka 9 av 10 anställda i Sverige har tjänstepension via kollektivavtal. Saknar du det kan du själv begära att arbetsgivaren tecknar en, eller välja en arbetsgivare som har avtal.',
      },
      {
        heading: 'De fyra stora avtalen',
        body: 'ITP (tjänstemän i privat sektor – Alecta/Collectum). SAF-LO (LO-anställda i privat sektor – Fora). KAP-KL/AKAP-KR (kommun och region). PA16 (statligt anställda). Vilket du har bestäms av arbetsgivarens kollektivavtal, inte av dig.',
      },
      {
        heading: 'Så väljer du fonder',
        body: 'Är du under 50 → välj global indexfond med låg avgift (helst <0,4%). Är du över 55 → börja gradvis flytta till räntefonder för att skydda kapitalet. Avstå alltid från fonder med över 1% avgift – över 30 år äter avgifter upp hundratusentals kronor.',
      },
      {
        heading: 'Ska du flytta din tjänstepension?',
        body: 'Att samla flera tjänstepensioner hos en aktör (t.ex. Avanza, Lysa, SPP) ger bättre överblick och oftast lägre avgifter. Kolla först om du har "fri flytträtt" – ITP har det sedan 2018, KAP-KL har det inte alltid. Flyttavgiften är max 600 kr enligt lag.',
      },
      {
        heading: 'Vad ska du som jobbsökare fråga om?',
        body: 'Fråga alltid vid anställningsintervjun: "Har ni kollektivavtal?" och "Hur stor procent av lönen sätts av till tjänstepension?". Standard är 4,5% upp till 7,5 inkomstbasbelopp, 30% därutöver. Ingen tjänstepension = lägre total ersättning, även om grundlönen ser bra ut.',
      },
    ],
    faqs: [
      { q: 'Hur mycket är tjänstepensionen värd?', a: 'För en genomsnittlig svensk är tjänstepensionen ungefär 25–35% av den totala pensionen. Saknar du den kan du tappa flera miljoner i livsinkomst.' },
      { q: 'Kan jag ta ut tjänstepensionen tidigare?', a: 'Tidigast vid 55 år, men då blir månadsbeloppet betydligt lägre. De flesta tar ut den från 65 år.' },
      { q: 'Vad händer med tjänstepensionen om jag byter jobb?', a: 'Den följer med dig – kapitalet är ditt. Nya arbetsgivaren börjar bara betala in på ett nytt avtal.' },
      { q: 'Behöver jag pensionsspara själv om jag har tjänstepension?', a: 'För de flesta räcker tjänstepension + allmän pension till 60–70% av slutlönen. Vill du gå tidigare eller leva mer flexibelt – ja, ISK eller IPS är vanliga val.' },
    ],
  },
  {
    slug: 'uppsagning-rattigheter',
    title: 'Uppsagd? Dina rättigheter steg för steg (2026)',
    metaTitle: 'Uppsagd från jobbet 2026: rättigheter, LAS & vad du gör | Parium',
    description: 'Uppsagd från jobbet? Här är dina rättigheter enligt LAS 2026: uppsägningstid, lön, A-kassa, avgångsvederlag och konkreta nästa steg.',
    excerpt: 'Att bli uppsagd är jobbigt – men du har fler rättigheter än du tror. Den här guiden går igenom exakt vad du ska göra de första 14 dagarna.',
    category: 'Arbetsrätt',
    readingMinutes: 9,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Saklig grund – arbetsbrist eller personliga skäl?',
        body: 'En arbetsgivare får bara säga upp dig om det finns saklig grund: arbetsbrist (företaget behöver minska personal) eller personliga skäl (allvarlig misskötsamhet). Vid arbetsbrist gäller "sist in, först ut" enligt LAS – med vissa undantag sedan 2022 års reform (3 personer får undantas). Vid personliga skäl ska du ha fått tydliga skriftliga varningar först.',
      },
      {
        heading: 'Uppsägningstider enligt LAS',
        body: 'Mindre än 2 års anställning: 1 månad. 2–4 år: 2 månader. 4–6 år: 3 månader. 6–8 år: 4 månader. 8–10 år: 5 månader. Över 10 år: 6 månader. Kollektivavtal kan ge längre tider. Under uppsägningstiden har du rätt till full lön även om arbetsgivaren ber dig stanna hemma.',
      },
      {
        heading: 'Första 14 dagarna – checklista',
        body: '1. Begär uppsägningen skriftligt – det är ett krav.\n2. Kontakta facket samma vecka, även om du inte är medlem (vissa hjälper ändå).\n3. Anmäl dig till Arbetsförmedlingen första vardagen som arbetslös.\n4. Ansök om A-kassa – gör det DIREKT, ersättning betalas inte retroaktivt mer än vissa veckor.\n5. Begär arbetsgivarintyg – krävs för A-kassan.\n6. Spara alla mejl och dokument från arbetsgivaren.',
      },
      {
        heading: 'A-kassa och inkomstförsäkring',
        body: 'Grund-A-kassa: max 510 kr/dag (efter skatt cirka 11 000 kr/mån). Inkomstbaserad ersättning kräver medlemskap i A-kassa i 12 månader: 80% av tidigare lön upp till 33 000 kr/mån de första 100 dagarna. Många fackförbund har dessutom inkomstförsäkring som täcker upp till 80% av högre löner – kolla din!',
      },
      {
        heading: 'Avgångsvederlag – ofta förhandlingsbart',
        body: 'Det finns ingen lagstadgad rätt till avgångsvederlag, men vid arbetsbrist erbjuder många arbetsgivare 2–6 månadslöner extra för att slippa MBL-förhandlingar. Tacka aldrig ja på sittande möte – be om 48 timmars betänketid och låt facket eller en jurist titta på avtalet först.',
      },
    ],
    faqs: [
      { q: 'Kan jag bli sparkad på dagen?', a: 'Nej – avsked (utan uppsägningstid) får bara ske vid grov misskötsamhet (stöld, våld, allvarlig illojalitet). Annars gäller alltid uppsägningstid.' },
      { q: 'Måste jag arbeta under uppsägningstiden?', a: 'Ja, om arbetsgivaren vill. Men du har rätt till skälig ledighet för att söka nytt jobb.' },
      { q: 'Får jag semesterersättning vid uppsägning?', a: 'Ja – alla intjänade men ej uttagna semesterdagar betalas ut som semesterersättning på slutlönen.' },
      { q: 'Kan jag söka nytt jobb under uppsägningstiden?', a: 'Absolut – och du bör. Många hittar nytt jobb redan innan sista arbetsdagen. Apparna gör det enklare att söka snabbt.' },
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
        body: '1. Sök BREDT – minst 10–20 ansökningar.\n2. Ring efter ansökan – visar engagemang och snabbar på processen.\n3. Säg "ja" till uppgifter ingen annan vill ha (nätter, midsommar, semestervecka) – du sticker ut direkt.\n4. Använd en app där du kan ansöka på 30 sekunder istället för långa formulär.\n5. Saknar du erfarenhet? Lyft fram skola, föreningsliv, ideellt arbete – det räknas.',
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
    slug: 'a-kassa-guide-2026',
    title: 'A-kassa 2026 – så funkar arbetslöshetsförsäkringen',
    metaTitle: 'A-kassa 2026: regler, ersättning & så ansöker du | Parium',
    description: 'Komplett guide till a-kassan 2026. Ersättningsnivåer, villkor, karens, hur du ansöker och vad som händer om du blir uppsagd eller säger upp dig själv.',
    excerpt: 'A-kassan kan ge upp till 26 400 kr/månad de första 100 dagarna 2026 – men bara om du gjort rätt. Här är allt du behöver veta för att slippa stå tomhänt.',
    category: 'Trygghet',
    readingMinutes: 7,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Vad är a-kassa och vem får?',
        body: 'A-kassa (arbetslöshetsersättning) är en försäkring som ger dig pengar om du blir arbetslös. Det finns två nivåer: grundersättning (för alla som uppfyller arbetsvillkoret) och inkomstrelaterad ersättning (för dig som varit medlem i en a-kassa minst 12 månader). För inkomstrelaterad krävs både medlemsvillkor (12 mån) och arbetsvillkor (jobbat minst 6 av senaste 12 månaderna, ≥60h/månad).',
      },
      {
        heading: 'Hur mycket får jag? (2026)',
        body: 'Inkomstrelaterad ersättning: 80% av tidigare lön, max 1 200 kr/dag (cirka 26 400 kr/mån) de första 100 dagarna. Dag 101–200: max 1 000 kr/dag. Dag 201–300: max 760 kr/dag. Grundersättning (utan medlemskap 12 mån): max 510 kr/dag. Karens: 6 dagar innan första utbetalningen. Sägs du upp själv utan giltigt skäl: 45 dagars avstängning.',
      },
      {
        heading: 'Hur ansöker jag?',
        body: '1. Skriv in dig på Arbetsförmedlingen FÖRSTA arbetslösa dagen (annars förlorar du dagar).\n2. Ansök hos din a-kassa via deras webbplats.\n3. Fyll i tidsrapporter varje vecka.\n4. Sök jobb aktivt och rapportera in dina sökta jobb.\nDu får pengar i efterskott, oftast 1–2 veckor efter rapport.',
      },
      {
        heading: 'Vilken a-kassa ska jag välja?',
        body: 'Alla a-kassor betalar samma ersättning – skillnaden är avgift (90–180 kr/mån) och servicenivå. Vanliga val: Unionens, Akademikernas (AEA), Kommunals, Handels, Byggnads, IF Metalls. Du måste välja en a-kassa som matchar din bransch eller en av de stora yrkesövergripande. Du kan byta a-kassa när som helst – din medlemstid följer med.',
      },
      {
        heading: 'Vanliga misstag som kostar pengar',
        body: '1. Anmäler sig till Arbetsförmedlingen för sent (förlorade dagar går inte att få tillbaka).\n2. Är inte med i någon a-kassa när jobbet försvinner (då bara grundersättning).\n3. Säger upp sig själv utan giltigt skäl (45 dagars avstängning).\n4. Tackar nej till anvisat jobb (kan ge avstängning).\n5. Missar tidsrapporter (ingen utbetalning).',
      },
    ],
    faqs: [
      { q: 'Får jag a-kassa om jag säger upp mig själv?', a: 'Ja, men efter 45 dagars avstängning – om du inte hade giltigt skäl (t.ex. trakasserier, omöjlig arbetssituation, flytt pga partner).' },
      { q: 'Måste jag vara medlem i facket för att få a-kassa?', a: 'Nej. A-kassa och fackföreningen är skilda saker – du kan vara med i bara a-kassan. Vissa fack kräver dock båda.' },
      { q: 'Hur länge får jag a-kassa?', a: 'Upp till 300 ersättningsdagar (450 om du har barn under 18). Sedan måste du kvalificera dig på nytt genom arbete.' },
      { q: 'Kan jag jobba extra och få a-kassa samtidigt?', a: 'Ja, men dagar du jobbar dras av från ersättningen. Du måste rapportera alla timmar.' },
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
        heading: 'Vad du ska säga (manus)',
        body: '"Tack för året. Jag vill prata om lönen. Senaste året har jag [konkret resultat 1], [resultat 2] och tagit ansvar för [område]. Marknadslönen för min roll ligger på X–Y kr. Jag tycker en rimlig nivå är Z kr." → Sedan: TYST. Den första som pratar förlorar. Låt chefen reagera.',
      },
      {
        heading: 'Siffror som funkar 2026',
        body: 'Normal årlig löneökning: 2,5–4%. Bra prestation: 5–8%. Ny roll eller ansvar: 8–15%. Byter jobb externt: ofta 10–20% mer. Be om mer än du vill ha – chefen kommer förhandla ner.',
      },
      {
        heading: 'Om de säger nej till lönehöjning',
        body: 'Förhandla andra förmåner: extra semesterdagar, kompetensutveckling, hemarbete, bonus, bättre tjänstebil, högre pensionsavsättning. Be om ett konkret datum för nästa lönesamtal med tydliga kriterier. Om chefen säger "det finns inga pengar" – fråga vad som krävs för att det ska finnas pengar om 6 månader.',
      },
      {
        heading: '5 misstag som sänker dig',
        body: '1. Säger en exakt siffra först (bind dig inte).\n2. Argumenterar med privata behov ("jag behöver pengarna").\n3. Hotar med uppsägning utan att mena det.\n4. Jämför med kollegor.\n5. Tackar ja direkt – be alltid att få fundera till nästa dag.',
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
    slug: 'foraldraledighet-guide',
    title: 'Föräldraledighet 2026 – dagar, ersättning & jobbet',
    metaTitle: 'Föräldraledighet 2026: dagar, föräldrapenning & rättigheter | Parium',
    description: 'Allt om föräldraledighet 2026. Antal dagar, ersättningsnivåer, hur du anmäler, vad arbetsgivaren får och inte får göra, samt vab.',
    excerpt: '480 dagar per barn – men hur många är på sjukpenningnivå, hur funkar reserverade dagar, och vad händer med jobbet? Här är reglerna 2026 utan krångel.',
    category: 'Familj',
    readingMinutes: 7,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Hur många dagar får jag?',
        body: '480 dagar per barn totalt, delas mellan föräldrarna. 390 dagar på sjukpenningnivå (cirka 80% av SGI, max 1 250 kr/dag 2026), 90 dagar på lägstanivå (250 kr/dag). 90 dagar är reserverade till vardera föräldern och kan inte överlåtas. För tvillingar/flerbarn: extra dagar.',
      },
      {
        heading: 'Hur mycket pengar får jag?',
        body: 'Föräldrapenning på sjukpenningnivå: 80% av din SGI (sjukpenninggrundande inkomst), max cirka 1 250 kr/dag före skatt 2026 (motsvarar lön på cirka 47 750 kr/mån). Tjänar du mer kompletterar många kollektivavtal upp till 90% under 6 månader. Lägstanivå: 250 kr/dag oavsett tidigare inkomst.',
      },
      {
        heading: 'Så anmäler du',
        body: '1. Anmäl till arbetsgivaren MINST 2 månader innan ledigheten börjar.\n2. Ansök om föräldrapenning hos Försäkringskassan (forsakringskassan.se eller appen) – tidigast 1 månad innan ledigheten.\n3. Bestäm uttagsnivå: hel, 3/4, halv, 1/4 eller 1/8 dag.\n4. Du kan jobba deltid och ta ut partiell föräldrapenning samtidigt.',
      },
      {
        heading: 'Dina rättigheter på jobbet',
        body: 'Du har rätt att komma tillbaka till samma eller likvärdig tjänst, samma lön (med löneutveckling) och samma villkor. Arbetsgivaren får inte säga upp dig på grund av föräldraledighet – det är diskriminering. Du har rätt att förkorta arbetstiden 25% tills barnet fyller 8 år. Du har rätt att vara hemma vid sjukdom hos barn (vab) upp till 120 dagar/år och barn.',
      },
      {
        heading: 'Smarta drag de flesta missar',
        body: '1. Skjut upp dagar – 96 dagar kan sparas tills barnet fyller 12 år.\n2. Dubbeldagar – båda föräldrarna kan ta ut samtidigt under barnets första år (30 dagar var).\n3. Anmäl SGI även om du är arbetslös – annars riskerar du lägre ersättning.\n4. Kolla kollektivavtalet – många ger 10% extra (90% lön) i 6 månader.\n5. Vid byte av jobb under föräldraledigheten – behåll SGI genom att vara sjukskriven/föräldraledig utan avbrott.',
      },
    ],
    faqs: [
      { q: 'Måste jag ta ut alla 480 dagar innan barnet börjar skolan?', a: 'Nej. 96 dagar kan sparas till efter att barnet fyllt 4 år, och kan tas ut ända tills barnet fyller 12.' },
      { q: 'Kan arbetsgivaren neka mig föräldraledighet?', a: 'Nej. Du har lagstadgad rätt att vara ledig, men måste anmäla minst 2 månader innan.' },
      { q: 'Hur funkar vab?', a: 'Vid sjukt barn under 12 år får du tillfällig föräldrapenning, cirka 80% av SGI. Anmäl till Försäkringskassan senast 90 dagar efter.' },
      { q: 'Påverkar föräldraledighet pensionen?', a: 'Marginellt. Staten ger pensionsrätt även under föräldraledighet, och de fyra första åren räknas extra förmånligt.' },
    ],
  },
  {
    slug: 'semesterlagen-2026',
    title: 'Semesterlagen 2026 – dagar, lön & dina rättigheter',
    metaTitle: 'Semesterlagen 2026: antal dagar, semesterlön & regler | Parium',
    description: 'Allt om semesterlagen 2026. Antal semesterdagar, hur semesterlön räknas, sparande av dagar, semesterersättning och vad arbetsgivaren får besluta om.',
    excerpt: '25 dagar i lagen, ofta 30 i kollektivavtalet. Här är reglerna som styr din semester 2026 – och knepen som ger dig flera tusenlappar extra.',
    category: 'Arbetsrätt',
    readingMinutes: 7,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Hur många semesterdagar har jag rätt till?',
        body: 'Semesterlagen ger alla anställda minst 25 betalda semesterdagar per år. Många kollektivavtal ger fler – 30, 31 eller 32 dagar är vanligt efter 40 års ålder. Du har rätt att ta ut minst 4 sammanhängande veckor under perioden juni–augusti. Deltidsanställda får semester proportionellt.',
      },
      {
        heading: 'Så räknas semesterlönen',
        body: 'Semesterlön är 12% av all utbetald lön (inkl. OB, jour, bonus) under intjänandeåret (1 april – 31 mars). Vid en månadslön på 30 000 kr blir det cirka 3 600 kr extra utöver ordinarie månadslön under semesterperioden. Slutar du innan du tagit ut semestern: semesterersättning betalas ut i sista lönen.',
      },
      {
        heading: 'Spara semesterdagar – så funkar det',
        body: 'Du kan spara max 5 dagar/år om du har 25 dagars semester. Sparade dagar kan användas i upp till 5 år. Det innebär att du kan bygga upp 25 sparade dagar + årets 25 = 50 dagar att ta ut sammanhängande för t.ex. långresa eller sabbatical.',
      },
      {
        heading: 'Förskottssemester och obetald semester',
        body: 'Är du ny på jobbet och inte hunnit tjäna in semester kan arbetsgivaren ge dig förskottssemester – betald semester du återbetalar om du slutar inom 5 år. Obetald semester (utan lön) är ALLTID din rätt om du saknar betalda dagar – arbetsgivaren får inte neka dig ledigt.',
      },
      {
        heading: '5 saker arbetsgivare ofta missar (= du förlorar pengar)',
        body: '1. Glömmer betala 12% semesterlön på rörlig lön/bonus.\n2. Räknar fel på OB-tillägg vid semester.\n3. Anger fel intjänandeår.\n4. Missar att lägga in sparade dagar i lönesystemet.\n5. Betalar inte semesterersättning vid avslut. → Begär alltid lönespec och kolla.',
      },
    ],
    faqs: [
      { q: 'Måste jag ta ut all semester samma år?', a: 'Nej. 5 dagar/år får sparas i upp till 5 år.' },
      { q: 'Kan chefen tvinga mig ta semester en viss vecka?', a: 'Ja, men du har rätt till minst 4 sammanhängande veckor juni–augusti.' },
      { q: 'Får jag semesterlön på provanställning?', a: 'Ja, du tjänar in semesterdagar från första arbetsdagen.' },
      { q: 'Vad händer med outtagen semester om jag slutar?', a: 'Du får semesterersättning utbetald i slutlönen – 12% av all intjänad lön som inte tagits ut som semester.' },
    ],
  },
  {
    slug: 'sjuklon-karens-2026',
    title: 'Sjuklön & karensavdrag 2026 – så funkar det',
    metaTitle: 'Sjuklön 2026: karens, ersättning & läkarintyg | Parium',
    description: 'Allt om sjuklön 2026. Hur karensavdraget räknas, vad arbetsgivaren betalar dagar 2–14, när Försäkringskassan tar över och regler för läkarintyg.',
    excerpt: 'Karensavdraget kan kosta dig en halv dagslön – men reglerna är inte alltid som du tror. Här är allt du behöver veta om sjuklön 2026.',
    category: 'Arbetsrätt',
    readingMinutes: 6,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Karensavdrag istället för karensdag',
        body: 'Sedan 2019 är det karensavdrag (inte karensdag). Avdraget motsvarar 20% av en genomsnittlig veckas sjuklön – oavsett vilken dag du är sjuk. Är du sjuk i en hel vecka blir avdraget alltså cirka en dag, men avdraget tas alltid första sjukdagen. Det förhindrar att deltidare straffas oproportionerligt.',
      },
      {
        heading: 'Vad får jag i sjuklön?',
        body: 'Dag 1: karensavdrag (cirka 20% av en veckas sjuklön).\nDag 2–14: arbetsgivaren betalar 80% av din ordinarie lön.\nDag 15 och framåt: Försäkringskassan tar över med sjukpenning (80% av SGI, max cirka 1 116 kr/dag 2026).\nMånga kollektivavtal ger 10% extra ovanpå i upp till 90 dagar.',
      },
      {
        heading: 'Sjukanmälan och läkarintyg',
        body: 'Anmäl till arbetsgivaren första sjukdagen. Läkarintyg krävs först från dag 8. Vid längre sjukfrånvaro krävs intyg från dag 8 till arbetsgivaren och från dag 15 till Försäkringskassan. Vid misstanke om missbruk kan arbetsgivaren begära förstadagsintyg.',
      },
      {
        heading: 'Sjuk fler gånger på kort tid?',
        body: 'Återinsjuknanderegeln: blir du sjuk inom 5 kalenderdagar från förra sjukperioden räknas det som samma period – du får inget nytt karensavdrag. Detta gäller även om mellanperioden bara var en halvdag.',
      },
      {
        heading: 'Vab vs egen sjukdom – skilj på',
        body: 'Vab (vård av barn): tillfällig föräldrapenning, betalas av Försäkringskassan, INGET karensavdrag, max 120 dagar/år och barn. Egen sjukdom: sjuklön från arbetsgivaren första 14 dagarna med karensavdrag dag 1. Båda kräver anmälan.',
      },
    ],
    faqs: [
      { q: 'Hur mycket är karensavdraget?', a: 'Cirka 20% av en genomsnittlig veckas sjuklön. För en heltidare med 30 000 kr i månadslön: cirka 1 380 kr.' },
      { q: 'Måste jag ha läkarintyg från dag 1?', a: 'Nej, normalt först från dag 8. Arbetsgivaren kan kräva förstadagsintyg vid återkommande korta sjukfrånvaron.' },
      { q: 'Kan jag bli uppsagd för sjukdom?', a: 'Sjukdom är inte saklig grund för uppsägning så länge du kan återgå till arbete inom rimlig tid med rehabilitering.' },
      { q: 'Får jag sjuklön på provanställning?', a: 'Ja, från första anställningsdagen.' },
    ],
  },
  {
    slug: 'provanstallning-las-2026',
    title: 'Provanställning & LAS 2026 – dina rättigheter',
    metaTitle: 'Provanställning 2026: regler, längd & LAS | Parium',
    description: 'Allt om provanställning och LAS 2026. Hur lång provanställning får vara, uppsägningstider, övergång till tillsvidare och vad arbetsgivaren får göra.',
    excerpt: '6 månader, sedan tillsvidare automatiskt – om arbetsgivaren inte säger upp. Här är reglerna om provanställning och LAS du behöver kunna.',
    category: 'Arbetsrätt',
    readingMinutes: 6,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Hur lång får en provanställning vara?',
        body: 'Max 6 månader enligt LAS. Vissa kollektivavtal tillåter kortare (3–4 mån) eller längre i särskilda fall. När de 6 månaderna gått övergår anställningen AUTOMATISKT till tillsvidare om ingen säger upp den – arbetsgivaren behöver inte göra något aktivt.',
      },
      {
        heading: 'Uppsägning under prov',
        body: 'Både du och arbetsgivaren får avbryta provanställningen utan saklig grund – men ska meddela 2 veckor i förväg (varselskyldighet enligt LAS § 31). Det är inte uppsägningstid utan en underrättelse; anställningen kan avslutas direkt. Lön betalas under de 2 veckorna.',
      },
      {
        heading: 'Vad LAS skyddar dig mot',
        body: 'LAS (lagen om anställningsskydd) säger att tillsvidareanställda bara kan sägas upp av "saklig grund" – arbetsbrist eller personliga skäl. Provanställda har inte detta skydd: arbetsgivaren behöver inte motivera varför provanställningen avbryts. Men de FÅR inte avbryta den av diskriminerande skäl (kön, ålder, ursprung, religion, fackligt engagemang).',
      },
      {
        heading: 'Visstidsanställning – när blir det fast?',
        body: 'Sedan LAS-reformen 2022 finns "särskild visstidsanställning" (SÄVA). Om du jobbat på SÄVA i sammanlagt 12 månader under en 5-årsperiod hos samma arbetsgivare → övergår till tillsvidare. Tidigare regel (allmän visstid, ALVA) gav fast efter 2 år; den finns kvar för anställningar påbörjade före 2022.',
      },
      {
        heading: 'Turordning vid arbetsbrist',
        body: 'Vid uppsägning på grund av arbetsbrist gäller "sist in, först ut" inom samma turordningskrets (driftsenhet + kollektivavtalsområde). Sedan LAS-reformen får arbetsgivaren undanta upp till 3 personer som anses ha särskild betydelse för fortsatt verksamhet, oavsett anställningstid.',
      },
    ],
    faqs: [
      { q: 'Måste jag jobba två veckor efter besked om avbruten provanställning?', a: 'Tekniskt nej – arbetsgivaren kan avsluta direkt men måste betala lön under de 2 veckorna efter underrättelsen.' },
      { q: 'Kan provanställning förlängas?', a: 'Nej. Max 6 månader, sedan tillsvidare. Undantag: föräldraledighet eller sjukfrånvaro kan förlänga.' },
      { q: 'Räknas provanställning som anställningstid för LAS?', a: 'Ja, om du blir tillsvidareanställd räknas provtiden in i anställningstiden.' },
      { q: 'Vad gör jag om jag tror prov avbröts av diskriminerande skäl?', a: 'Kontakta facket eller DO (Diskrimineringsombudsmannen) inom 2 månader.' },
    ],
  },
  {
    slug: 'tjanstledig-guide',
    title: 'Tjänstledighet 2026 – när har du rätt att vara ledig?',
    metaTitle: 'Tjänstledighet 2026: rättigheter, studier & start eget | Parium',
    description: 'Allt om tjänstledighet 2026. Studieledighet, ledighet för att starta eget, sjuk anhörig, fackligt uppdrag och vad arbetsgivaren får neka.',
    excerpt: 'Studier, eget företag, fackligt uppdrag – det finns flera lagstadgade rätter att vara tjänstledig. Här är vilka som gäller och hur du ansöker.',
    category: 'Arbetsrätt',
    readingMinutes: 6,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Studieledighet (studieledighetslagen)',
        body: 'Du har rätt att vara tjänstledig för studier om du varit anställd i minst 6 månader – obegränsat länge. Studierna behöver inte vara jobbrelaterade. Ansök minst 6 månader innan. Arbetsgivaren kan skjuta upp ledigheten max 6 månader, sedan måste de bevilja. Du har rätt att komma tillbaka till samma eller likvärdig tjänst.',
      },
      {
        heading: 'Ledighet för att starta eget',
        body: 'Lagen om rätt till ledighet för att bedriva näringsverksamhet ger dig rätt till max 6 månaders tjänstledigt för att starta eget – om du varit anställd minst 6 månader och företaget inte konkurrerar med arbetsgivaren. Ansök minst 3 månader innan.',
      },
      {
        heading: 'Vård av närstående',
        body: 'Du har rätt att vara ledig med närståendepenning från Försäkringskassan (cirka 80% av SGI) för att vårda en närstående som är allvarligt sjuk. Max 100 dagar per närstående. Anmäl till arbetsgivaren så fort som möjligt.',
      },
      {
        heading: 'Fackligt förtroendeuppdrag',
        body: 'Som facklig förtroendeman har du rätt till betald ledighet för det fackliga arbetet under arbetstid (FML – förtroendemannalagen). Omfattning beror på företagets storlek och uppdraget.',
      },
      {
        heading: 'Tjänstledig av andra skäl (utan lagstöd)',
        body: 'För resor, sabbatical eller eget val behöver du arbetsgivarens godkännande – det är inget du har rätt till. Tipset: kom överens skriftligt om återgångsdatum, lön under ledigheten (oftast 0), och att tjänsten finns kvar.',
      },
    ],
    faqs: [
      { q: 'Får jag lön under tjänstledighet för studier?', a: 'Nej, inte från arbetsgivaren. Men du kan söka studiestöd (CSN).' },
      { q: 'Kan chefen säga nej till studieledighet?', a: 'Nej, bara skjuta upp max 6 månader. Sedan måste de godkänna.' },
      { q: 'Räknas tjänstledighet som anställningstid?', a: 'Oftast ja för LAS-syften (anställningstid), men inte för intjänande av semester.' },
      { q: 'Kan jag bli av med jobbet under tjänstledighet?', a: 'Nej, du har rätt att återgå till samma eller likvärdig tjänst med samma villkor.' },
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
    slug: 'arbetsgivarintyg-guide',
    title: 'Arbetsgivarintyg 2026 – så får du det rätt ifyllt',
    metaTitle: 'Arbetsgivarintyg 2026: mall, regler & a-kassa | Parium',
    description: 'Komplett guide till arbetsgivarintyg. När du behöver det, vad det ska innehålla, hur du begär det och vad du gör om arbetsgivaren vägrar.',
    excerpt: 'Utan korrekt arbetsgivarintyg får du inte ut din a-kassa. Här är vad intyget måste innehålla – och hur du tvingar fram det om arbetsgivaren bråkar.',
    category: 'Arbetsrätt',
    readingMinutes: 5,
    updated: '2026-06-01',
    sections: [
      {
        heading: 'Vad är ett arbetsgivarintyg?',
        body: 'Ett dokument från din tidigare arbetsgivare som styrker din anställning – arbetad tid, lön, anställningsform och anledning till att anställningen upphörde. Krävs av a-kassan för att kunna betala ut inkomstrelaterad ersättning, och ofta vid byte av jobb, ansökan om bostadslån eller försäkringar.',
      },
      {
        heading: 'Vad ska intyget innehålla?',
        body: '• Personuppgifter (namn, personnummer)\n• Anställningsperiod (från – till, exakta datum)\n• Anställningsform (tillsvidare, visstid, prov)\n• Arbetad tid per vecka/månad senaste 12 månaderna\n• Bruttolön (uppdelat på månad)\n• Anledning till anställningens upphörande (uppsagd av arbetsgivare/egen begäran)\n• Sjukfrånvaro och föräldraledighet (perioder)\n\nAnvänd a-kassans formulär på arbetsgivarintyg.nu – det är digitalt och godkänt av alla a-kassor.',
      },
      {
        heading: 'Hur begär du det?',
        body: 'Mejla HR/lönekontoret skriftligen: "Jag begär arbetsgivarintyg enligt 47 § lagen om arbetslöshetsförsäkring. Var god skicka digitalt via arbetsgivarintyg.nu till min e-post inom 14 dagar." Arbetsgivaren är SKYLDIG att skicka det – senast inom rimlig tid (oftast 1–2 veckor).',
      },
      {
        heading: 'Om arbetsgivaren vägrar eller drar ut på tiden',
        body: '1. Skicka skriftlig påminnelse med hänvisning till lagen.\n2. Anmäl till facket – de kan trycka på.\n3. Kontakta a-kassan – de kan utfärda intyg på sannolika grunder med hjälp av lönebesked, anställningsavtal och kontoutdrag.\n4. I sista hand: anmäl till Inspektionen för arbetslöshetsförsäkringen (IAF) eller polisanmäl för tjänstefel.',
      },
      {
        heading: 'Tips som sparar tid',
        body: '1. Begär intyget DIREKT när du slutar – inte 3 månader senare.\n2. Be om digital version via arbetsgivarintyg.nu – sparas direkt hos a-kassan.\n3. Spara alltid kopior av lönespecar de senaste 12 månaderna.\n4. Om anställningen var kort: be också om anställningsbevis och tidsregistreringar.',
      },
    ],
    faqs: [
      { q: 'Hur lång tid har arbetsgivaren på sig?', a: 'Lagen säger "inom rimlig tid". A-kassan accepterar oftast 1–2 veckor; därefter kan du driva ärendet.' },
      { q: 'Kostar det något?', a: 'Nej. Arbetsgivaren är skyldig att utfärda intyget kostnadsfritt.' },
      { q: 'Behöver jag arbetsgivarintyg om jag bytt direkt till nytt jobb?', a: 'Inte för a-kassa, men spara det ändå – det krävs ofta vid bostadslån, försäkringar och framtida arbetslöshet.' },
      { q: 'Vad gör jag om arbetsgivaren gått i konkurs?', a: 'Kontakta konkursförvaltaren. A-kassan kan också utfärda intyg på sannolika grunder via lönespecar.' },
    ],
  },
];


export const GUIDE_BY_SLUG: Record<string, GuideData> = GUIDES.reduce(
  (acc, g) => ({ ...acc, [g.slug]: g }),
  {} as Record<string, GuideData>,
);

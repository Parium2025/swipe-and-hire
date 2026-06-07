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
];


export const GUIDE_BY_SLUG: Record<string, GuideData> = GUIDES.reduce(
  (acc, g) => ({ ...acc, [g.slug]: g }),
  {} as Record<string, GuideData>,
);

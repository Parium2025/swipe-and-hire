// SEO-data för Sveriges mest sökta yrken/jobbtyper.
// Sökvolymer baserade på Semrush ("{yrke} jobb" + "lediga jobb {yrke}").
// Varje yrke får en egen sida (/yrke/{slug}).

export type OccupationData = {
  slug: string;            // URL-segment
  name: string;            // Visningsnamn ("Snickare")
  plural: string;          // Plural ("snickare", "elektriker")
  asForm: string;          // "som snickare", "som elektriker"
  category: string;        // Bransch ("Bygg & hantverk")
  intro: string;           // Kort hero-text
  tasks: string[];         // Vanliga arbetsuppgifter
  skills: string[];        // Vanliga krav/kompetenser
  salary: string;          // Ungefärlig lön (källa: SCB/Saco)
};

export const OCCUPATIONS: OccupationData[] = [
  {
    slug: 'snickare',
    name: 'Snickare',
    plural: 'snickare',
    asForm: 'som snickare',
    category: 'Bygg & hantverk',
    intro: 'Sverige har stor brist på snickare. Hitta lediga snickarjobb i hela landet – från nybyggnation till renovering.',
    tasks: ['Stomresning och takläggning', 'Inredningssnickeri och listning', 'Renovering av kök och badrum', 'Montering av fönster och dörrar', 'Läsa och tolka ritningar'],
    skills: ['Yrkesbevis eller motsvarande erfarenhet', 'B-körkort (ofta krav)', 'Goda kunskaper i svenska eller engelska', 'Van vid handverktyg och elverktyg'],
    salary: 'Genomsnittlig lön för snickare i Sverige är cirka 32 000–38 000 kr/månad enligt SCB.',
  },
  {
    slug: 'elektriker',
    name: 'Elektriker',
    plural: 'elektriker',
    asForm: 'som elektriker',
    category: 'Bygg & hantverk',
    intro: 'Elektriker är ett av Sveriges mest efterfrågade yrken. Hitta lediga elektrikerjobb – installation, service och industri.',
    tasks: ['Installation av el i nybyggnation', 'Service och felsökning', 'Industrielektriska arbeten', 'Solceller och laddstolpar', 'Dokumentation och egenkontroll'],
    skills: ['ECY-certifikat eller yrkesbevis', 'BB1- eller AB-behörighet meriterande', 'B-körkort', 'Erfarenhet av KNX/smarta hem meriterande'],
    salary: 'Genomsnittlig lön för elektriker i Sverige är cirka 33 000–40 000 kr/månad.',
  },
  {
    slug: 'underskoterska',
    name: 'Undersköterska',
    plural: 'undersköterskor',
    asForm: 'som undersköterska',
    category: 'Vård & omsorg',
    intro: 'Undersköterska är Sveriges vanligaste yrke. Hitta lediga undersköterskejobb inom äldreomsorg, sjukhus och hemtjänst.',
    tasks: ['Personlig omvårdnad och hygien', 'Läkemedelshantering', 'Dokumentation i journalsystem', 'Stödja sjuksköterskor vid behandlingar', 'Mat, social samvaro och aktiviteter'],
    skills: ['Skyddad yrkestitel undersköterska eller pågående utbildning', 'Vana vid journalsystem (Procapita, TES, m.fl.)', 'God svenska i tal och skrift', 'Empati och tålamod'],
    salary: 'Genomsnittlig lön för undersköterska i Sverige är cirka 28 000–33 000 kr/månad.',
  },
  {
    slug: 'lagerarbetare',
    name: 'Lagerarbetare',
    plural: 'lagerarbetare',
    asForm: 'som lagerarbetare',
    category: 'Logistik & lager',
    intro: 'Lagerjobben är många i Sverige – e-handeln växer och behöver fler. Hitta lediga lagerjobb i hela landet.',
    tasks: ['Plock och pack av order', 'Inleverans och avlastning', 'Truckkörning', 'Inventering', 'Packetering inför utleverans'],
    skills: ['Truckkort A+B (ofta krav)', 'Fysiskt arbete – van vid stå/gå hela dagen', 'Noggrannhet', 'Skiftjobb (kvällar/nätter förekommer)'],
    salary: 'Genomsnittlig lön för lagerarbetare i Sverige är cirka 26 000–31 000 kr/månad.',
  },
  {
    slug: 'restaurang',
    name: 'Restaurangpersonal',
    plural: 'kockar och servitörer',
    asForm: 'inom restaurang',
    category: 'Restaurang & hotell',
    intro: 'Restaurangbranschen söker hela tiden ny personal – kockar, servitörer, baristas och diskare. Hitta lediga restaurangjobb här.',
    tasks: ['Matlagning enligt meny', 'Servering och bordsbokning', 'Kassa och betalning', 'Diskning och städning', 'Mise en place'],
    skills: ['Erfarenhet meriterande – många jobb passar nybörjare', 'Stresstålighet', 'Servicekänsla', 'Kvällar och helger förekommer'],
    salary: 'Genomsnittlig lön inom restaurang i Sverige är cirka 25 000–32 000 kr/månad.',
  },
  {
    slug: 'butik',
    name: 'Butiksmedarbetare',
    plural: 'butiksmedarbetare',
    asForm: 'i butik',
    category: 'Handel & butik',
    intro: 'Tusentals butiksjobb läggs ut varje vecka i Sverige – heltid, deltid och extra. Hitta lediga butiksjobb här.',
    tasks: ['Kundservice och rådgivning', 'Kassaarbete', 'Påfyllning av varor', 'Visuell merchandising', 'Lagerhantering'],
    skills: ['Servicekänsla', 'Stresstålig och positiv', 'Erfarenhet av handel meriterande', 'Helgarbete förekommer'],
    salary: 'Genomsnittlig lön i butik i Sverige är cirka 26 000–30 000 kr/månad enligt Handels.',
  },
  {
    slug: 'chauffor',
    name: 'Chaufför',
    plural: 'chaufförer',
    asForm: 'som chaufför',
    category: 'Transport & logistik',
    intro: 'Sverige har stor brist på chaufförer – både lastbil och budbil. Hitta lediga chaufförsjobb här.',
    tasks: ['Lastning och lossning', 'Leveranser till företag och privatpersoner', 'Körjournal och dokumentation', 'Service av fordon'],
    skills: ['C-, CE- eller B-körkort beroende på roll', 'YKB (yrkeskompetensbevis)', 'ADR meriterande', 'Digital färdskrivare'],
    salary: 'Genomsnittlig lön för lastbilschaufför är cirka 30 000–36 000 kr/månad.',
  },
  {
    slug: 'stadare',
    name: 'Städare',
    plural: 'städare',
    asForm: 'som städare',
    category: 'Städ & fastighet',
    intro: 'Städjobb finns över hela Sverige – kontor, hem, hotell och industri. Hitta lediga städjobb här.',
    tasks: ['Daglig kontorsstädning', 'Hemstädning hos privatkunder', 'Storstädning och fönsterputs', 'Användning av städmaskiner', 'Påfyllning av förbrukningsmaterial'],
    skills: ['Noggrannhet', 'Inga formella krav i många roller', 'B-körkort meriterande', 'Pratar svenska eller engelska'],
    salary: 'Genomsnittlig lön för städare i Sverige är cirka 24 000–28 000 kr/månad.',
  },
  {
    slug: 'saljare',
    name: 'Säljare',
    plural: 'säljare',
    asForm: 'som säljare',
    category: 'Försäljning',
    intro: 'Säljjobben är många – B2B, B2C, fält och inne. Hitta lediga säljjobb med fast lön och provision.',
    tasks: ['Bearbeta kunder och kundregister', 'Prospektering och mötesbokning', 'Förhandling och avslut', 'Kundvård och merförsäljning', 'CRM-uppdatering'],
    skills: ['Resultatdriven', 'Erfarenhet av sälj meriterande', 'B-körkort vid fältsälj', 'Goda kunskaper i svenska'],
    salary: 'Genomsnittlig lön för säljare är cirka 32 000–45 000 kr/månad inklusive provision.',
  },
  {
    slug: 'kundservice',
    name: 'Kundservicemedarbetare',
    plural: 'kundservicemedarbetare',
    asForm: 'inom kundservice',
    category: 'Kundservice & support',
    intro: 'Många företag söker kundservicemedarbetare – på plats och på distans. Hitta lediga kundservicejobb här.',
    tasks: ['Besvara kundärenden via telefon, mail och chatt', 'Felsökning och reklamationer', 'Beställningar och fakturafrågor', 'Dokumentation i CRM'],
    skills: ['God svenska och engelska', 'Datorvana', 'Servicekänsla och tålamod', 'Distansjobb förekommer'],
    salary: 'Genomsnittlig lön inom kundservice är cirka 26 000–31 000 kr/månad.',
  },
];

export const OCCUPATION_BY_SLUG: Record<string, OccupationData> = OCCUPATIONS.reduce(
  (acc, o) => ({ ...acc, [o.slug]: o }),
  {} as Record<string, OccupationData>,
);

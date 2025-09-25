// Swedish occupations structure based on official job categories
export interface OccupationCategory {
  value: string;
  label: string;
  keywords: string[];
  subcategories: string[];
}

export const OCCUPATION_CATEGORIES: OccupationCategory[] = [
  { 
    value: 'construction', 
    label: 'Bygg och Anläggning', 
    keywords: ['bygg', 'byggare', 'snickare', 'elektriker', 'vvs', 'anläggning', 'målare', 'murare'],
    subcategories: [
      'Anläggningsdykare',
      'Anläggningsmaskinförare m.fl.',
      'Arbetsledare inom bygg, anläggning och gruva',
      'Betongarbetare',
      'Brunnsborrare m.fl.',
      'Bygnads- och ventilationsplåtslagare',
      'Civilingenjörsyrken inom bygg och anläggning',
      'Golvläggare',
      'Grovarbetare inom bygg och anläggning',
      'Gruv- och stenbrottsarbetare',
      'Ingenjörer och tekniker inom bygg och anläggning',
      'Isoleringsmontörer',
      'Kranförare m.fl.',
      'Kyl- och värmepumpstekniker m.fl.',
      'Murare m.fl.',
      'Målare',
      'Stallningsbyggare',
      'Takmontörer',
      'Träarbetare, snickare m.fl.',
      'VVS-montörer m.fl.',
      'Övriga byggnads- och anläggningsarbetare'
    ]
  },
  { 
    value: 'management', 
    label: 'Chefer och Verksamhetsledare', 
    keywords: ['chef', 'ledare', 'verksamhet', 'director', 'manager', 'vd', 'platschef', 'avdelningschef'],
    subcategories: [
      'Chefer inom arkitekt- och ingenjörsverksamhet',
      'Chefer inom bank, finans och försäkring',
      'Chefer inom friskvård, sport och fritid',
      'Chefer inom förskolverksamhet',
      'Chefer inom grund- och gymnasieskola samt vuxenutbildning',
      'Chefer inom handel',
      'Chefer inom hälso- och sjukvård',
      'Chefer inom socialt och kurativt arbete',
      'Chefer inom äldreomsorg',
      'Chefer och ledare inom trossamfund',
      'Chefstjänstemän i intresseorganisationer',
      'Driftchefer inom bygg, anläggning och gruva',
      'Ekonomi- och finanschefer',
      'Fastighets- och förvaltningschefer',
      'Forsknings- och utvecklingschefer',
      'Försäljnings- och marknadschefer',
      'Förvaltare inom skogsbruk och lantbruk m.fl.',
      'General-, landstings- och kommundirektörer m.fl.',
      'Hotell- och konferenschefer',
      'IT-chefer',
      'Informations-, kommunikations- och PR-chefer',
      'Inköps-, logistik- och transportchefer',
      'Personal- och HR-chefer',
      'Politiker',
      'Produktionschefer inom tillverkning',
      'Restaurang- och kökchefer',
      'Verkställande direktörer m.fl.',
      'Övriga administrations- och servicechefer',
      'Övriga chefer inom samhällsservice',
      'Övriga chefer inom utbildning',
      'Övriga chefer inom övrig servicenäring'
    ]
  },
  { 
    value: 'it', 
    label: 'Data/IT', 
    keywords: ['utvecklare', 'programmerare', 'IT', 'data', 'systemadministratör', 'webb', 'mjukvara', 'frontend', 'backend', 'fullstack', 'devops', 'cybersäkerhet'],
    subcategories: [
      'Drifttekniker, IT',
      'IT-säkerhetsspecialister',
      'Mjukvaru- och systemutvecklare m.fl.',
      'Nätverks- och systemtekniker m.fl.',
      'Supporttekniker, IT',
      'Systemadministratörer',
      'Systemanalytiker och IT-arkitekter m.fl.',
      'Systemförvaltare m.fl.',
      'Systemtestare och testledare',
      'Utvecklare inom spel och digitala media',
      'Webbmaster och webbadministratörer',
      'Övriga IT-specialister'
    ]
  },
  { 
    value: 'sales', 
    label: 'Försäljning, Inköp, Marknadsföring', 
    keywords: ['försäljning', 'sales', 'säljare', 'account', 'marketing', 'marknadsföring', 'reklam', 'kommunikation', 'pr', 'inköp'],
    subcategories: [
      'Apotekstekniker',
      'Banktjänstemän',
      'Bensinstationspersonal',
      'Butikssäljare, dagligvaror',
      'Butikssäljare, fackhandel',
      'Evenemangs- och reseproducenter m.fl.',
      'Eventsäljare och butiksdemonistratörer m.fl.',
      'Fastighetsmäklare',
      'Företagssäljare',
      'Guider och resetedare',
      'Inköpare och upphandlare',
      'Inköps- och orderassistenter',
      'Kassapersonal m.fl.',
      'Kundtjänstpersonal',
      'Marknads- och försäljningsassistenter',
      'Marknadsanalytiker och marknadsförare m.fl.',
      'Marknadsundersökare och intervjuare',
      'Optikerassistenter',
      'Ordersamordnare m.fl.',
      'Resesäljare och trafikassistenter m.fl.',
      'Speditörer och transportmäklare',
      'Säljande butikschefer och avdelningschefer i butik',
      'Telefonförsäljare m.fl.',
      'Torg- och marknadsförsäljare m.fl.',
      'Uthyrare',
      'Övriga förmedlare'
    ]
  },
  { 
    value: 'crafts', 
    label: 'Hantverkyrken', 
    keywords: ['hantverk', 'smed', 'keramiker', 'snickare', 'träarbete', 'metallarbete', 'bagare', 'konditor'],
    subcategories: [
      'Bagare och konditorer',
      'Fin-, inrednings- och möbelsnickare',
      'Finmekaniker',
      'Glastekniker',
      'Guld- och silversmeder',
      'Läderhantverkare och skomakare',
      'Manuella ytbehandlare, trä',
      'Musikinstrumentmakare och övriga konsthantverkare',
      'Skräddare och ateljésömmerskor m.fl.',
      'Smeder',
      'Sömmare',
      'Tapetserare'
    ]
  },
  { 
    value: 'restaurant', 
    label: 'Hotell, Restaurang, Storhushåll', 
    keywords: ['kock', 'servitör', 'hotell', 'restaurang', 'storhushåll', 'bagare', 'konditor', 'hovmästare'],
    subcategories: [
      'Bartenders',
      'Croupierer och oddssättare m.fl.',
      'Hotellreceptionister m.fl.',
      'Hovmästare och servitörer',
      'Kafé- och konditorbiträden',
      'Kockar och kallskänkor',
      'Köksmästare och souschefer',
      'Pizzabagare m.fl.',
      'Restaurang- och köksbiträden m.fl.',
      'Serverings- och cafépersonal',
      'Städare och lokalvårdare',
      'Övrig servicepersonal inom hotell och restaurang'
    ]
  },
  { 
    value: 'healthcare', 
    label: 'Hälso- och sjukvård', 
    keywords: ['sjuksköterska', 'läkare', 'vård', 'omsorg', 'tandläkare', 'fysioterapeut', 'undersköterska', 'vårdbiträde', 'hälsa'],
    subcategories: [
      'Arbetsterapeuter',
      'Biomedicinska analytiker',
      'Dietister',
      'Fysioterapeuter',
      'Kiropraktorer',
      'Läkare',
      'Naprapat',
      'Optiker',
      'Psykologer',
      'Röntgensjuksköterskor',
      'Sjuksköterskor',
      'Specialistsjuksköterskor',
      'Tandhygienister',
      'Tandläkare',
      'Tandtekniker',
      'Undersköterskor',
      'Vårdbiträden'
    ]
  },
  { 
    value: 'education', 
    label: 'Utbildning', 
    keywords: ['lärare', 'utbildning', 'skola', 'universitet', 'förskola', 'pedagog', 'barnskötare', 'fritidsledare', 'rektor'],
    subcategories: [
      'Barnskötare',
      'Bibliotekarier och arkivarier',
      'Fritidspedagoger',
      'Förskollärare',
      'Grundskollärare',
      'Gymnasielärare',
      'Idrottsstränare och instruktörer m.fl.',
      'Lärare i yrkesämnen',
      'Professorer',
      'Speciallärare och specialpedagoger m.fl.',
      'Studie- och yrkesvägledare',
      'Trafiklarare',
      'Universitets- och högskolelektorer'
    ]
  },
  { 
    value: 'administration', 
    label: 'Administration, Ekonomi, Juridik', 
    keywords: ['administration', 'ekonomi', 'redovisning', 'controller', 'assistent', 'sekreterare', 'koordinator', 'projektledare', 'hr'],
    subcategories: [
      'Administratörer och sekreterare',
      'Advokater',
      'Bodelningsförrättare m.fl.',
      'Bokförare',
      'Domstolsjurister',
      'Ekonomiassistenter',
      'Ekonomer',
      'HR-specialister',
      'Jurister',
      'Personaladministratörer',
      'Projektledare',
      'Redovisningsekonomer',
      'Revisorer',
      'Skattespecialister'
    ]
  },
  { 
    value: 'logistics', 
    label: 'Transport och Logistik', 
    keywords: ['lager', 'logistik', 'transport', 'distribution', 'chaufför', 'lastbil', 'gaffeltruck', 'leverans'],
    subcategories: [
      'Bilmekaniker och fordonsreparatörer',
      'Buss- och spårvagnsförare',
      'Chaufförer och kurirer',
      'Flygledare m.fl.',
      'Fordonsförare m.fl.',
      'Godshanterare',
      'Hamnarbetare',
      'Lagerarbetare',
      'Lastbilsförare',
      'Lokförare m.fl.',
      'Maskinoperatörer, lyft- och transportutrustning',
      'Post- och brevbärare',
      'Trafiklärare'
    ]
  },
  { 
    value: 'service', 
    label: 'Personlig service och säkerhet', 
    keywords: ['kundtjänst', 'service', 'support', 'reception', 'värdinna', 'säkerhet', 'städ', 'bemötande'],
    subcategories: [
      'Barberare, frisörer och skönhetsterapeuter',
      'Begravningsentreprenörer m.fl.',
      'Brandmän',
      'Fastighetsskötare m.fl.',
      'Ordningsvakter',
      'Personliga assistenter',
      'Poliser',
      'Receptionister m.fl.',
      'Städare och lokalvårdare',
      'Väktare',
      'Övrig servicepersonal'
    ]
  },
  { 
    value: 'creative', 
    label: 'Kultur, Media, Design', 
    keywords: ['design', 'grafisk', 'kreativ', 'media', 'journalist', 'fotograf', 'video', 'kultur', 'konstnär', 'ux', 'ui'],
    subcategories: [
      'Artister inom musik, sång och dans',
      'Bibliotekarier och arkivarier',
      'Chefsreportrar och redaktörer',
      'Dekoratörer och scenografer',
      'Designers och formgivare',
      'Fil- och TV-producenter m.fl.',
      'Fotografer',
      'Grafiska formgivare och illustratörer',
      'Journalister',
      'Konstnärer',
      'Museichefer och antikvarie',
      'Sångare, musiker och kompositörer',
      'Översättare, tolkar och lingvister m.fl.',
      'Övriga designer och formgivare',
      'Övriga yrken inom kultur och underhållning'
    ]
  },
  { 
    value: 'industry', 
    label: 'Tillverkning och Industri', 
    keywords: ['industri', 'tillverkning', 'produktion', 'maskinoperatör', 'kvalitet', 'process', 'tekniker'],
    subcategories: [
      'Gjutare',
      'Industrirobotoperatörer',
      'Kemitekniker',
      'Maskinoperatörer, kemisk och farmaceutisk tillverkning',
      'Maskinoperatörer, livsmedelstillverkning',
      'Maskinoperatörer, metall- och mineralproduktindustri',
      'Maskinoperatörer, textil-, skinn- och läderindustri',
      'Maskinoperatörer, trä- och pappersindustri',
      'Maskinställare och maskinoperatörer',
      'Processoperatörer, petroleum- och naturgasindustri',
      'Produktionsarbetare',
      'Skärare, svetsare och plåtslagare',
      'Slaktare och styckare',
      'Svetslärare m.fl.',
      'Verktygsmakare m.fl.'
    ]
  }
];

// Get all occupations as a flat list for search functionality
export const getAllOccupations = (): string[] => {
  const allOccupations: string[] = [];
  OCCUPATION_CATEGORIES.forEach(category => {
    allOccupations.push(...category.subcategories);
  });
  return allOccupations.sort();
};

// Search occupations by term
export const searchOccupations = (searchTerm: string): string[] => {
  if (!searchTerm || searchTerm.length < 2) {
    return [];
  }
  
  const term = searchTerm.toLowerCase();
  const allOccupations = getAllOccupations();
  
  return allOccupations.filter(occupation => 
    occupation.toLowerCase().includes(term)
  ).slice(0, 10); // Limit to 10 results
};
// SEO-data för Sveriges största städer.
// Volymsiffror är ungefärliga sökvolymer/månad enligt Semrush ("lediga jobb {stad}").
// Varje stad får en egen sida (/jobb/{slug}) via JobbCity-mallen.

export type CityData = {
  slug: string;          // URL-segment (lowercase, utan ä/ö/å)
  name: string;          // Visningsnamn (med ä/ö/å)
  inForm: string;        // Böjd form: "i Stockholm", "i Göteborg"
  county: string;        // Län
  areas: string[];       // Stadsdelar/närliggande kommuner
  intro: string;         // Kort intro-text till hero (1-2 meningar)
};

export const CITIES: CityData[] = [
  {
    slug: 'stockholm',
    name: 'Stockholm',
    inForm: 'i Stockholm',
    county: 'Stockholms län',
    areas: ['Stockholm City', 'Södermalm', 'Norrmalm', 'Östermalm', 'Vasastan', 'Kungsholmen', 'Solna', 'Sundbyberg', 'Bromma', 'Hammarby Sjöstad', 'Liljeholmen', 'Kista'],
    intro: 'Stockholm är Sveriges största arbetsmarknad. Här finns lediga jobb inom allt från restaurang och vård till bygg, tech och försäljning.',
  },
  {
    slug: 'goteborg',
    name: 'Göteborg',
    inForm: 'i Göteborg',
    county: 'Västra Götalands län',
    areas: ['Centrum', 'Majorna', 'Linné', 'Hisingen', 'Lundby', 'Angered', 'Mölndal', 'Partille', 'Kungsbacka', 'Lerum', 'Backaplan', 'Frölunda'],
    intro: 'Göteborg är västkustens jobbmotor med starka arbetsgivare inom industri, handel, restaurang och vård. Hitta lediga jobb i Göteborg som matchar dig.',
  },
  {
    slug: 'malmo',
    name: 'Malmö',
    inForm: 'i Malmö',
    county: 'Skåne län',
    areas: ['Centrum', 'Västra Hamnen', 'Möllevången', 'Limhamn', 'Hyllie', 'Rosengård', 'Lund', 'Burlöv', 'Kävlinge', 'Vellinge', 'Triangeln', 'Bunkeflo'],
    intro: 'Malmö växer snabbt och behöver fler medarbetare inom hotell, restaurang, vård, transport och bygg. Hitta lediga jobb i Malmö direkt i Parium.',
  },
  {
    slug: 'uppsala',
    name: 'Uppsala',
    inForm: 'i Uppsala',
    county: 'Uppsala län',
    areas: ['Centrum', 'Luthagen', 'Fålhagen', 'Sala backe', 'Gottsunda', 'Sävja', 'Storvreta', 'Knivsta', 'Bälinge', 'Vaksala'],
    intro: 'Uppsala kombinerar universitetsstad med en stark privat arbetsmarknad. Hitta lediga jobb i Uppsala inom vård, handel, restaurang och tjänster.',
  },
  {
    slug: 'linkoping',
    name: 'Linköping',
    inForm: 'i Linköping',
    county: 'Östergötlands län',
    areas: ['Centrum', 'Vasastaden', 'Ryd', 'Berga', 'Lambohov', 'Mjärdevi', 'Ekholmen', 'Tornby'],
    intro: 'Linköping har en stark teknisk industri och växande tjänstesektor. Hitta lediga jobb i Linköping inom industri, handel, vård och service.',
  },
  {
    slug: 'orebro',
    name: 'Örebro',
    inForm: 'i Örebro',
    county: 'Örebro län',
    areas: ['Centrum', 'Norr', 'Söder', 'Väster', 'Vivalla', 'Brickebacken', 'Hovsta', 'Kumla', 'Hallsberg'],
    intro: 'Örebro är ett logistik- och handelsnav i mellersta Sverige. Hitta lediga jobb i Örebro inom lager, transport, handel, restaurang och vård.',
  },
  {
    slug: 'vasteras',
    name: 'Västerås',
    inForm: 'i Västerås',
    county: 'Västmanlands län',
    areas: ['Centrum', 'Bäckby', 'Skiljebo', 'Hammarby', 'Skallberget', 'Önsta', 'Hallstahammar', 'Surahammar'],
    intro: 'Västerås har starka arbetsgivare inom industri, energi och tjänster. Hitta lediga jobb i Västerås direkt i Parium.',
  },
  {
    slug: 'helsingborg',
    name: 'Helsingborg',
    inForm: 'i Helsingborg',
    county: 'Skåne län',
    areas: ['Centrum', 'Söder', 'Olympia', 'Drottninghög', 'Maria Park', 'Råå', 'Höganäs', 'Ängelholm'],
    intro: 'Helsingborg är en aktiv handels- och hamnstad. Hitta lediga jobb i Helsingborg inom logistik, restaurang, handel och vård.',
  },
  {
    slug: 'norrkoping',
    name: 'Norrköping',
    inForm: 'i Norrköping',
    county: 'Östergötlands län',
    areas: ['Centrum', 'Hageby', 'Navestad', 'Vrinnevi', 'Klockaretorpet', 'Smedby', 'Lindö'],
    intro: 'Norrköping växer som logistik- och handelsstad. Hitta lediga jobb i Norrköping inom lager, transport, vård och tjänster.',
  },
  {
    slug: 'jonkoping',
    name: 'Jönköping',
    inForm: 'i Jönköping',
    county: 'Jönköpings län',
    areas: ['Centrum', 'Råslätt', 'Liljeholmen', 'Öxnehaga', 'Huskvarna', 'A6', 'Bankeryd'],
    intro: 'Jönköping är ett starkt logistik- och industricentrum. Hitta lediga jobb i Jönköping inom lager, industri, handel och restaurang.',
  },
  {
    slug: 'umea',
    name: 'Umeå',
    inForm: 'i Umeå',
    county: 'Västerbottens län',
    areas: ['Centrum', 'Ålidhem', 'Carlshem', 'Berghem', 'Mariehem', 'Ersboda', 'Holmsund'],
    intro: 'Umeå är norra Sveriges största universitetsstad med stark tillväxt. Hitta lediga jobb i Umeå inom vård, handel, restaurang och service.',
  },
  {
    slug: 'lund',
    name: 'Lund',
    inForm: 'i Lund',
    county: 'Skåne län',
    areas: ['Centrum', 'Norra Fäladen', 'Klostergården', 'Gunnesbo', 'Linero', 'Dalby', 'Södra Sandby'],
    intro: 'Lund kombinerar forskning, tech och en levande handelssektor. Hitta lediga jobb i Lund som passar dig.',
  },
];

export const CITY_BY_SLUG = Object.fromEntries(CITIES.map((c) => [c.slug, c]));

export const POPULAR_ROLES = [
  'Servitör', 'Lagerarbetare', 'Lärare', 'Sjuksköterska',
  'Snickare', 'Truckförare', 'Kock', 'Elektriker',
  'Säljare', 'Städare', 'Kassörska', 'Bartender',
];

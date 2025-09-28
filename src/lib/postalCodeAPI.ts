// API för alla svenska postnummer
export interface PostalCodeResponse {
  postalCode: string;
  city: string;
  municipality: string;
  county: string;
  area?: string;
}

// Cache interface
interface CacheEntry {
  data: PostalCodeResponse | null;
  timestamp: number;
}

// Cache för att undvika för många API-anrop
const postalCodeCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 60 * 60 * 1000; // 1 timme

// Lokal databas med vanliga svenska postnummer som fallback
const localPostalCodes: Record<string, PostalCodeResponse> = {
  '11120': { postalCode: '111 20', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11121': { postalCode: '111 21', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11122': { postalCode: '111 22', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11123': { postalCode: '111 23', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11124': { postalCode: '111 24', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11125': { postalCode: '111 25', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11126': { postalCode: '111 26', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11127': { postalCode: '111 27', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11128': { postalCode: '111 28', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11129': { postalCode: '111 29', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11130': { postalCode: '111 30', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11131': { postalCode: '111 31', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11132': { postalCode: '111 32', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11133': { postalCode: '111 33', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11134': { postalCode: '111 34', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11135': { postalCode: '111 35', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11136': { postalCode: '111 36', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11137': { postalCode: '111 37', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11138': { postalCode: '111 38', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11139': { postalCode: '111 39', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11140': { postalCode: '111 40', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11141': { postalCode: '111 41', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11142': { postalCode: '111 42', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11143': { postalCode: '111 43', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11144': { postalCode: '111 44', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11145': { postalCode: '111 45', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11146': { postalCode: '111 46', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11147': { postalCode: '111 47', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11148': { postalCode: '111 48', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11149': { postalCode: '111 49', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11150': { postalCode: '111 50', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11151': { postalCode: '111 51', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11152': { postalCode: '111 52', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11153': { postalCode: '111 53', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11154': { postalCode: '111 54', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11155': { postalCode: '111 55', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11156': { postalCode: '111 56', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11157': { postalCode: '111 57', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11158': { postalCode: '111 58', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11159': { postalCode: '111 59', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '11160': { postalCode: '111 60', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Norrmalm' },
  '13655': { postalCode: '136 55', city: 'Stockholm', municipality: 'Stockholm', county: 'Stockholms län', area: 'Vega' },
  '41118': { postalCode: '411 18', city: 'Göteborg', municipality: 'Göteborg', county: 'Västra Götalands län', area: 'Linnéstaden' },
  '97125': { postalCode: '971 25', city: 'Luleå', municipality: 'Luleå', county: 'Norrbottens län', area: 'Centrum' }
};

// Försök med flera API-källor
// Komplett svensk postnummer-databas (16,000+ postnummer)
let swedishPostalDatabase: Record<string, string> | null = null;

// Ladda komplett svensk postnummer-databas
async function loadSwedishPostalDatabase(): Promise<Record<string, string>> {
  if (swedishPostalDatabase) {
    return swedishPostalDatabase;
  }

  try {
    const response = await fetch('/swedish-postal-codes.csv');
    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    
    swedishPostalDatabase = {};
    
    // Skippa header-raden
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const [zipCode, city] = line.split(',');
          if (zipCode && city) {
            // Formatera postnummer till 5 siffror utan mellanslag
            const cleanZip = zipCode.replace(/\D/g, '');
            if (cleanZip.length === 5) {
              swedishPostalDatabase[cleanZip] = formatCityName(city.replace(/"/g, ''));
            }
          }
      }
    }
    
    console.log(`✅ Loaded ${Object.keys(swedishPostalDatabase).length} Swedish postal codes from complete database`);
    return swedishPostalDatabase;
  } catch (error) {
    console.error('❌ Failed to load Swedish postal database:', error);
    swedishPostalDatabase = {};
    return swedishPostalDatabase;
  }
}

async function tryMultipleApis(postalCode: string): Promise<PostalCodeResponse | null> {
  const cleanedCode = postalCode.replace(/\s+/g, '');
  
  // 1. Försök komplett svensk databas först (16,000+ postnummer)
  try {
    const database = await loadSwedishPostalDatabase();
    const city = database[cleanedCode];
    if (city) {
      return {
        postalCode: formatPostalCodeDisplay(cleanedCode),
        city: formatCityName(city),
        municipality: formatCityName(city),
        county: getCountyByPostalCode(cleanedCode),
        area: formatCityName(city)
      };
    }
  } catch (error) {
    console.log('✅ Swedish postal database failed, trying PAPILITE...');
  }
  
  // 2. Försök PAPILITE API (proffsig svensk tjänst)
  try {
    const response = await fetch(`https://api.papilite.se/v1/se/${cleanedCode}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.city) {
        return {
          postalCode: formatPostalCodeDisplay(cleanedCode),
          city: formatCityName(data.city),
          municipality: formatCityName(data.municipality || data.city),
          county: data.county || getCountyByPostalCode(cleanedCode),
          area: formatCityName(data.city)
        };
      }
    }
  } catch (error) {
    console.log('📡 PAPILITE failed, trying Zippopotam...');
  }

  // 3. Försök Zippopotam
  try {
    const response = await fetch(`https://api.zippopotam.us/SE/${cleanedCode}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.places && data.places.length > 0) {
        const place = data.places[0];
        return {
          postalCode: formatPostalCodeDisplay(data['post code']),
          city: formatCityName(place['place name']),
          municipality: formatCityName(place['place name']),
          county: place['state'],
          area: formatCityName(place['place name'])
        };
      }
    }
  } catch (error) {
    console.log('🌍 Zippopotam failed, trying local database...');
  }
  
  // 4. Försök lokal databas (begränsad)
  const localData = localPostalCodes[cleanedCode];
  if (localData) {
    return localData;
  }
  
  // 5. Sista utvägen: regionuppskattning
  const regionCode = cleanedCode.substring(0, 3);
  const regionEstimate = getRegionEstimate(regionCode);
  if (regionEstimate) {
    return {
      postalCode: formatPostalCodeDisplay(cleanedCode),
      city: formatCityName(regionEstimate.city),
      municipality: formatCityName(regionEstimate.city),
      county: regionEstimate.county,
      area: formatCityName(regionEstimate.area)
    };
  }
  
  return null;
}

// Regionuppskattning baserat på första 3 siffrorna i postnumret
// Förbättrad funktion för att få län baserat på postnummer
function getCountyByPostalCode(postalCode: string): string {
  const code = parseInt(postalCode.substring(0, 3));
  
  if (code >= 100 && code <= 199) return 'Stockholms län';
  if (code >= 200 && code <= 299) return 'Skåne län';
  if (code >= 300 && code <= 399) return 'Hallands län';
  if (code >= 400 && code <= 499) return 'Västra Götalands län';
  if (code >= 500 && code <= 599) return 'Jönköpings län';
  if (code >= 600 && code <= 699) return 'Östergötlands län';
  if (code >= 700 && code <= 799) return 'Västmanlands län';
  if (code >= 800 && code <= 899) return 'Dalarnas län';
  if (code >= 900 && code <= 999) return 'Norrbottens län';
  
  return 'Sverige'; // Fallback
}

function getRegionEstimate(regionCode: string): { city: string; county: string; area: string } | null {
  const regions: Record<string, { city: string; county: string; area: string }> = {
    '100': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '101': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '102': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '103': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '104': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '105': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '106': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '107': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '108': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '109': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '110': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '111': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '112': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '113': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '114': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '115': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '116': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '117': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '118': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '119': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '120': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '121': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '122': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '123': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '124': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '125': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '126': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '127': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '128': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '129': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '130': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '131': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '132': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '133': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '134': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '135': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '136': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '137': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '138': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '139': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '140': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '141': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '142': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '143': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '144': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '145': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '146': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '147': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '148': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '149': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '150': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '151': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '152': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '153': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '154': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '155': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '156': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '157': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '158': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '159': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '160': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '161': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '162': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '163': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '164': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '165': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '166': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '167': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '168': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '169': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '170': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '171': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '172': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '173': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '174': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '175': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '176': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '177': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '178': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '179': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '180': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '181': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '182': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '183': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '184': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '185': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '186': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '187': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '188': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '189': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '190': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '191': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '192': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '193': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '194': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '195': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '196': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '197': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '198': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '199': { city: 'Stockholm', county: 'Stockholms län', area: 'Stockholm' },
    '200': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '201': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '202': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '203': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '204': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '205': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '206': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '207': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '208': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '209': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '210': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '211': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '212': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '213': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '214': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '215': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '216': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '217': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '218': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '219': { city: 'Malmö', county: 'Skåne län', area: 'Malmö' },
    '400': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '401': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '402': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '403': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '404': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '405': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '406': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '407': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '408': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '409': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '410': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '411': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '412': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '413': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '414': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '415': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '416': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '417': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '418': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '419': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '420': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '421': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '422': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '423': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '424': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '425': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '426': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '427': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '428': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '429': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '430': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '431': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '432': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '433': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '434': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '435': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '436': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '437': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '438': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '439': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '440': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '441': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '442': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '443': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '444': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '445': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '446': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '447': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '448': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '449': { city: 'Göteborg', county: 'Västra Götalands län', area: 'Göteborg' },
    '970': { city: 'Luleå', county: 'Norrbottens län', area: 'Luleå' },
    '971': { city: 'Luleå', county: 'Norrbottens län', area: 'Luleå' },
    '972': { city: 'Luleå', county: 'Norrbottens län', area: 'Luleå' },
    '973': { city: 'Luleå', county: 'Norrbottens län', area: 'Luleå' },
    '974': { city: 'Luleå', county: 'Norrbottens län', area: 'Luleå' },
    '975': { city: 'Luleå', county: 'Norrbottens län', area: 'Luleå' }
  };
  
  return regions[regionCode] || null;
}

// Funktion för att hämta postnummer från svensk postnummerservice
export const fetchPostalCodeInfo = async (postalCode: string): Promise<PostalCodeResponse | null> => {
  try {
    return await tryMultipleApis(postalCode);
  } catch (error) {
    console.error('Error fetching postal code:', error);
    return null;
  }
};

// Alternativ API för mer detaljerad information
export const fetchDetailedPostalCodeInfo = async (postalCode: string): Promise<PostalCodeResponse | null> => {
  try {
    const cleanedCode = postalCode.replace(/\s+/g, '');
    
    // Backup: Använd svensk postal API eller fallback till lokal data
    // Detta kan utökas med andra svenska postnummer-APIs
    
    return await fetchPostalCodeInfo(postalCode);
  } catch (error) {
    console.error('Error fetching detailed postal code:', error);
    return null;
  }
};

// Hjälpfunktion för att formatera postnummer för visning
export const formatPostalCodeDisplay = (code: string): string => {
  const digits = code.replace(/\D/g, '');
  if (digits.length === 5) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return code;
};

// Hjälpfunktion för att formatera ortnamn till Title Case
export const formatCityName = (cityName: string): string => {
  if (!cityName) return cityName;
  
  return cityName
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Hantera svenska specialfall
      if (word === 'i' || word === 'på' || word === 'av' || word === 'och' || word === 'under') {
        return word; // Behåll dessa ord i lowercase (om de inte är första ordet)
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

export const getCachedPostalCodeInfo = async (postalCode: string): Promise<PostalCodeResponse | null> => {
  const cleanedCode = postalCode.replace(/\s+/g, '');
  const cacheKey = cleanedCode;
  
  // Kolla cache först
  const cached = postalCodeCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
    return cached.data;
  }
  
  // Hämta från API
  const result = await fetchPostalCodeInfo(postalCode);
  
  // Spara i cache
  postalCodeCache.set(cacheKey, {
    data: result,
    timestamp: Date.now()
  });
  
  return result;
};

// Validering av svenskt postnummer
export const isValidSwedishPostalCode = (postalCode: string): boolean => {
  const cleanedCode = postalCode.replace(/\s+/g, '');
  return /^\d{5}$/.test(cleanedCode);
};

// Formatera postnummer medan användaren skriver
export const formatPostalCodeInput = (input: string): string => {
  const digits = input.replace(/\D/g, '');
  if (digits.length >= 3) {
    return digits.slice(0, 3) + (digits.length > 3 ? ' ' + digits.slice(3, 5) : '');
  }
  return digits;
};
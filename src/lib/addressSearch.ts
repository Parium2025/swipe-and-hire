// Swedish address search functionality using real Swedish address data
export interface AddressResult {
  street: string;
  number?: string;
  postalCode: string;
  city: string;
  municipality?: string;
  fullAddress: string;
}

interface AddressApiResponse {
  addresses: Array<{
    street: string;
    number?: string;
    postalCode: string;
    city: string;
    municipality?: string;
  }>;
}

// Cache för att undvika för många API-anrop
const addressCache = new Map<string, string[]>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuter

/**
 * Search for real Swedish addresses using multiple sources
 * @param query The search term entered by the user
 * @returns Array of real address suggestions
 */
export const searchAddresses = async (query: string): Promise<string[]> => {
  if (!query || query.length < 2) {
    return [];
  }

  // Kontrollera cache först
  const cacheKey = query.toLowerCase().trim();
  if (addressCache.has(cacheKey)) {
    return addressCache.get(cacheKey) || [];
  }

  try {
    // Använd flera källor för svenska adresser
    const suggestions = await Promise.all([
      searchWithNominatim(query),
      searchWithLocalData(query)
    ]);

    // Kombinera och deduplicera resultat
    const allSuggestions = suggestions.flat();
    const uniqueSuggestions = Array.from(new Set(allSuggestions));
    
    // Begränsa till 10 förslag
    const limitedSuggestions = uniqueSuggestions.slice(0, 10);
    
    // Cacha resultatet
    addressCache.set(cacheKey, limitedSuggestions);
    
    // Rensa cache efter 5 minuter
    setTimeout(() => {
      addressCache.delete(cacheKey);
    }, CACHE_DURATION);

    return limitedSuggestions;
  } catch (error) {
    console.error('Address search error:', error);
    
    // Fallback till lokal sökning om API:er misslyckas
    return searchWithLocalData(query);
  }
};

/**
 * Search addresses using Nominatim (OpenStreetMap) API for Swedish addresses
 */
async function searchWithNominatim(query: string): Promise<string[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&countrycodes=se&format=json&addressdetails=1&limit=8`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Parium-Address-Search/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();
    const addresses: string[] = [];

    data.forEach((item: any) => {
      if (item.address) {
        const { house_number, road, postcode, city, town, village, municipality, suburb, neighbourhood, hamlet } = item.address;
        
        // Prioritera gatuadresser och stadsdelar
        if (road || suburb || neighbourhood) {
          const streetName = road || suburb || neighbourhood;
          const houseNumber = house_number || '';
          const locationName = city || town || village || municipality || hamlet || '';
          const postalCode = postcode || '';

          if (locationName && streetName) {
            let fullAddress = streetName;
            if (houseNumber && road) { // Lägg bara till husnummer för riktiga gator
              fullAddress += ` ${houseNumber}`;
            }
            fullAddress += `, ${locationName}`;
            
            if (postalCode && postalCode.match(/^\d{5}$/)) {
              fullAddress += ` ${postalCode.substring(0, 3)} ${postalCode.substring(3)}`;
            }
            
            addresses.push(fullAddress);
          }
        }
        // Hantera stadsdelar och områden utan gatunamn
        else if (suburb || neighbourhood || hamlet) {
          const areaName = suburb || neighbourhood || hamlet;
          const locationName = city || town || village || municipality || '';
          
          if (locationName && areaName) {
            addresses.push(`${areaName}, ${locationName}`);
          }
        }
      }
    });

    return addresses;
  } catch (error) {
    console.error('Nominatim search failed:', error);
    return [];
  }
}

/**
 * Search with enhanced local Swedish address data
 */
function searchWithLocalData(query: string): string[] {
  const searchTerm = query.toLowerCase();
  const suggestions: string[] = [];

  // Omfattande databas med riktiga svenska adresser inklusive stadsdel, gatunamn och områden
  const REAL_SWEDISH_ADDRESSES = [
    // Stockholm - centrala gatunamn och områden
    'Drottninggatan, Stockholm',
    'Kungsgatan, Stockholm', 
    'Sveavägen, Stockholm',
    'Vasagatan, Stockholm',
    'Regeringsgatan, Stockholm',
    'Birger Jarlsgatan, Stockholm',
    'Östermalmsgatan, Stockholm',
    'Hornsgatan, Stockholm',
    'Götgatan, Stockholm',
    'Folkungagatan, Stockholm',
    'Upplandsgatan, Stockholm',
    'Sankt Eriksgatan, Stockholm',
    'Fleminggatan, Stockholm',
    'Odengatan, Stockholm',
    'Skeppsbron, Stockholm',
    'Strandvägen, Stockholm',
    'Hamngatan, Stockholm',
    'Biblioteksgatan, Stockholm',
    'Norrmalmstorg, Stockholm',
    
    // Stockholm - stadsdelar och områden
    'Liljeholmen, Stockholm',
    'Södermalm, Stockholm',
    'Östermalm, Stockholm',
    'Vasastan, Stockholm',
    'Norrmalm, Stockholm',
    'Gamla Stan, Stockholm',
    'Djurgården, Stockholm',
    'Kungsholmen, Stockholm',
    'Bromma, Stockholm',
    'Vällingby, Stockholm',
    'Rinkeby, Stockholm',
    'Tensta, Stockholm',
    'Skärholmen, Stockholm',
    'Farsta, Stockholm',
    'Hägersten, Stockholm',
    'Aspudden, Stockholm',
    'Midsommarkransen, Stockholm',
    'Telefonplan, Stockholm',
    'Fruängen, Stockholm',
    'Vantör, Stockholm',
    'Bandhagen, Stockholm',
    'Hökarängen, Stockholm',
    'Rågsved, Stockholm',
    'Hagsätra, Stockholm',
    'Globen, Stockholm',
    'Skanstull, Stockholm',
    'Medborgarplatsen, Stockholm',
    'Mariatorget, Stockholm',
    'Zinkensdamm, Stockholm',
    'Hornstull, Stockholm',
    'Långholmen, Stockholm',
    'Reimersholme, Stockholm',
    'Söder Mälarstrand, Stockholm',
    'Riddarholmen, Stockholm',
    'Skeppsholmen, Stockholm',
    'Blasieholmen, Stockholm',
    'Kastellholmen, Stockholm',
    'Odenplan, Stockholm',
    'Sankt Eriksplan, Stockholm',
    'Rådmansgatan, Stockholm',
    'Upplands Väsby, Stockholm',
    'Sollentuna, Stockholm',
    'Täby, Stockholm',
    'Danderyd, Stockholm',
    'Lidingö, Stockholm',
    'Värmdö, Stockholm',
    'Nacka, Stockholm',
    'Tyresö, Stockholm',
    'Huddinge, Stockholm',
    'Botkyrka, Stockholm',
    'Salem, Stockholm',
    'Haninge, Stockholm',
    'Nynäshamn, Stockholm',
    'Södertälje, Stockholm',
    'Nykvarn, Stockholm',
    'Järfälla, Stockholm',
    'Ekerö, Stockholm',
    'Norrtälje, Stockholm',
    'Sigtuna, Stockholm',
    'Märsta, Stockholm',
    'Arlanda, Stockholm',
    
    // Göteborg - gatunamn och områden
    'Kungsportsavenyn, Göteborg',
    'Linnégatan, Göteborg',
    'Vasagatan, Göteborg', 
    'Avenyn, Göteborg',
    'Fredsgatan, Göteborg',
    'Magasinsgatan, Göteborg',
    'Tredje Långgatan, Göteborg',
    'Andra Långgatan, Göteborg',
    'Järntorget, Göteborg',
    'Nordstan, Göteborg',
    'Klippan, Göteborg',
    'Haga Nygata, Göteborg',
    'Inom Vallgraven, Göteborg',
    'Majorna, Göteborg',
    'Linnéstaden, Göteborg',
    'Haga, Göteborg',
    'Annedal, Göteborg',
    'Masthugget, Göteborg',
    'Stigberget, Göteborg',
    'Olivedal, Göteborg',
    'Johanneberg, Göteborg',
    'Guldheden, Göteborg',
    'Högsbo, Göteborg',
    'Frölunda, Göteborg',
    'Biskopsgården, Göteborg',
    'Backa, Göteborg',
    'Bergsjön, Göteborg',
    'Rinkeby, Göteborg',
    'Rosengård, Göteborg',
    'Kortedala, Göteborg',
    'Gamlestaden, Göteborg',
    'Centrum, Göteborg',
    
    // Malmö - gatunamn och områden
    'Södergatan, Malmö',
    'Stortorget, Malmö',
    'Lilla Torg, Malmö',
    'Västra Hamngatan, Malmö',
    'Triangeln, Malmö',
    'Möllevångstorget, Malmö',
    'Davidshallstorg, Malmö',
    'Lugnet, Malmö',
    'Limhamn, Malmö',
    'Värnhem, Malmö',
    'Gamla Staden, Malmö',
    'Innerstaden, Malmö',
    'Västra Innerstaden, Malmö',
    'Östra Innerstaden, Malmö',
    'Centrum, Malmö',
    'Möllevången, Malmö',
    'Sofielund, Malmö',
    'Seved, Malmö',
    'Persborg, Malmö',
    'Rosengård, Malmö',
    'Hermodsdal, Malmö',
    'Holma, Malmö',
    'Kroksbäck, Malmö',
    'Oxie, Malmö',
    'Tygelsjö, Malmö',
    'Fosie, Malmö',
    'Bunkeflostrand, Malmö',
    'Hyllie, Malmö',
    'Husie, Malmö',
    'Arlöv, Malmö',
    
    // Uppsala
    'Sankt Eriksgatan, Uppsala',
    'Dragarbrunnsgatan, Uppsala', 
    'Västra Ågatan, Uppsala',
    'Kungsgatan, Uppsala',
    'Svartbäcksgatan, Uppsala',
    'Östra Ågatan, Uppsala',
    'Centrum, Uppsala',
    'Luthagen, Uppsala',
    'Fålhagen, Uppsala',
    'Eriksberg, Uppsala',
    'Stabby, Uppsala',
    'Sunnersta, Uppsala',
    'Valsätra, Uppsala',
    'Gottsunda, Uppsala',
    'Björkbacken, Uppsala',
    'Librobäck, Uppsala',
    
    // Linköping
    'Stora Torget, Linköping',
    'Klostergatan, Linköping', 
    'Järnvägsgatan, Linköping',
    'Platensgatan, Linköping',
    'Centrum, Linköping',
    'Innerstaden, Linköping',
    'Vasastaden, Linköping',
    'Berg, Linköping',
    'Ryd, Linköping',
    'Lambohov, Linköping',
    'Tornby, Linköping',
    'Skäggetorp, Linköping',
    'Berga, Linköping',
    'Hackefors, Linköping',
    
    // Örebro
    'Drottninggatan, Örebro',
    'Järnvägsgatan, Örebro',
    'Stortorget, Örebro',
    'Centrum, Örebro',
    'Norr, Örebro',
    'Söder, Örebro',
    'Vivalla, Örebro',
    'Brickebacken, Örebro',
    'Adolfsberg, Örebro',
    'Marieberg, Örebro',
    'Lundby, Örebro',
    
    // Västerås
    'Kopparbergsvägen, Västerås',
    'Stora Torget, Västerås',
    'Centrum, Västerås',
    'Malmaberg, Västerås',
    'Hälla, Västerås',
    'Bäckby, Västerås',
    'Råby, Västerås',
    'Vallby, Västerås',
    'Pettersberg, Västerås',
    'Björnö, Västerås',
    
    // Norrköping  
    'Drottninggatan, Norrköping',
    'Holmens Gata, Norrköping',
    'Centrum, Norrköping',
    'Innerstaden, Norrköping',
    'Östermalm, Norrköping',
    'Navestad, Norrköping',
    'Hageby, Norrköping',
    'Rinkeby, Norrköping',
    'Vrinnevi, Norrköping',
    'Lindö, Norrköping',
    
    // Helsingborg
    'Kullagatan, Helsingborg',
    'Järnvägsgatan, Helsingborg',
    'Stortorget, Helsingborg',
    'Centrum, Helsingborg',
    'Söder, Helsingborg',
    'Norr, Helsingborg',
    'Drottninghög, Helsingborg',
    'Fredriksdal, Helsingborg',
    'Rydebäck, Helsingborg',
    'Ramlösa, Helsingborg',
    
    // Jönköping
    'Västra Storgatan, Jönköping',
    'Östra Storgatan, Jönköping',
    'Centrum, Jönköping',
    'Östermalm, Jönköping',
    'Väster, Jönköping',
    'Söder, Jönköping',
    'Rosenlund, Jönköping',
    'Råslätt, Jönköping',
    'Huskvarna, Jönköping',
    
    // Lund
    'Stora Södergatan, Lund',
    'Sankt Petri Kyrkogata, Lund',
    'Klostergatan, Lund',
    'Centrum, Lund',
    'Nöbbelöv, Lund',
    'Vikhem, Lund',
    'Gunnesbo, Lund',
    'Parentuna, Lund',
    'Värpinge, Lund',
    
    // Umeå
    'Storgatan, Umeå',
    'Rådhusesplanaden, Umeå',
    'Centrum, Umeå',
    'Västerslätt, Umeå',
    'Ersboda, Umeå',
    'Mariehem, Umeå',
    'Sandbacka, Umeå',
    'Holmsund, Umeå',
    
    // Gävle
    'Drottninggatan, Gävle',
    'Nygatan, Gävle',
    'Centrum, Gävle',
    'Norr, Gävle',
    'Söder, Gävle',
    'Brynäs, Gävle',
    'Strömsbro, Gävle',
    'Sätra, Gävle',
    'Andersberg, Gävle',
    
    // Borås
    'Allégatan, Borås',
    'Stora Torget, Borås',
    'Centrum, Borås',
    'Norrby, Borås',
    'Sjöbo, Borås',
    'Hulta, Borås',
    'Trandared, Borås',
    'Dalsjöfors, Borås',
    
    // Eskilstuna
    'Drottninggatan, Eskilstuna',
    'Rademachergatan, Eskilstuna',
    'Centrum, Eskilstuna',
    'Norr, Eskilstuna',
    'Söder, Eskilstuna',
    'Väster, Eskilstuna',
    'Östermalm, Eskilstuna',
    'Fröslunda, Eskilstuna',
    'Årby, Eskilstuna',
    'Vilsta, Eskilstuna',
    
    // Karlstad
    'Västra Torggatan, Karlstad',
    'Tingvallagatan, Karlstad',
    'Centrum, Karlstad',
    'Kronoparken, Karlstad',
    'Våxnäs, Karlstad',
    'Bellevue, Karlstad',
    'Herrhagen, Karlstad',
    'Rud, Karlstad'
  ];

  // Sök efter matchande gatunamn
  REAL_SWEDISH_ADDRESSES.forEach(address => {
    if (address.toLowerCase().includes(searchTerm)) {
      suggestions.push(address);
    }
  });

  // Lägg till gatunamn med husnummer för mer realistiska förslag
  if (searchTerm.length >= 3) {
    const matchingStreets = suggestions.slice(0, 3);
    const commonNumbers = ['1', '2', '3', '5', '10', '12', '15', '20'];
    
    matchingStreets.forEach(street => {
      commonNumbers.slice(0, 2).forEach(num => {
        const [streetName, city] = street.split(', ');
        suggestions.push(`${streetName} ${num}, ${city}`);
      });
    });
  }

  return suggestions.slice(0, 8);
}

/**
 * Parse an address string into components
 */
export const parseAddress = (address: string): AddressResult | null => {
  try {
    const parts = address.split(', ');
    
    if (parts.length >= 2) {
      const streetPart = parts[0].trim();
      const locationPart = parts[1].trim();
      
      // Extrahera husnummer om det finns
      const streetMatch = streetPart.match(/^(.+?)(\s+\d+.*)?$/);
      const street = streetMatch ? streetMatch[1].trim() : streetPart;
      const number = streetMatch && streetMatch[2] ? streetMatch[2].trim() : undefined;
      
      // Hantera postnummer i locationPart
      const postalMatch = locationPart.match(/^(.+?)\s+(\d{3}\s?\d{2})$/);
      const city = postalMatch ? postalMatch[1].trim() : locationPart;
      const postalCode = postalMatch ? postalMatch[2].replace(/\s/g, '') : '';
      
      return {
        street,
        number,
        postalCode,
        city,
        fullAddress: address
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error parsing address:', error);
    return null;
  }
};

/**
 * Format address for display
 */
export const formatAddress = (address: string | AddressResult): string => {
  if (typeof address === 'string') {
    return address;
  }
  
  let formatted = address.street;
  if (address.number) {
    formatted += ` ${address.number}`;
  }
  if (address.city) {
    formatted += `, ${address.city}`;
  }
  if (address.postalCode) {
    formatted += ` ${address.postalCode.substring(0, 3)} ${address.postalCode.substring(3)}`;
  }
  
  return formatted;
};
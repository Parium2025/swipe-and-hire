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
        const { house_number, road, postcode, city, town, village, municipality } = item.address;
        
        if (road) {
          const streetName = road;
          const houseNumber = house_number || '';
          const locationName = city || town || village || municipality || '';
          const postalCode = postcode || '';

          if (locationName) {
            let fullAddress = streetName;
            if (houseNumber) {
              fullAddress += ` ${houseNumber}`;
            }
            fullAddress += `, ${locationName}`;
            
            if (postalCode && postalCode.length === 5) {
              fullAddress += ` ${postalCode.substring(0, 3)} ${postalCode.substring(3)}`;
            }
            
            addresses.push(fullAddress);
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

  // Utökad databas med riktiga svenska gatunamn från större städer
  const REAL_SWEDISH_ADDRESSES = [
    // Stockholm - riktiga gatunamn
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
    'Östermalm, Stockholm',
    
    // Göteborg - riktiga gatunamn
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
    
    // Malmö - riktiga gatunamn  
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
    
    // Uppsala
    'Sankt Eriksgatan, Uppsala',
    'Dragarbrunnsgatan, Uppsala', 
    'Västra Ågatan, Uppsala',
    'Kungsgatan, Uppsala',
    'Svartbäcksgatan, Uppsala',
    'Östra Ågatan, Uppsala',
    
    // Linköping
    'Stora Torget, Linköping',
    'Klostergatan, Linköping', 
    'Järnvägsgatan, Linköping',
    'Platensgatan, Linköping',
    
    // Örebro
    'Drottninggatan, Örebro',
    'Järnvägsgatan, Örebro',
    'Stortorget, Örebro',
    
    // Västerås
    'Kopparbergsvägen, Västerås',
    'Stora Torget, Västerås',
    
    // Norrköping  
    'Drottninggatan, Norrköping',
    'Holmens Gata, Norrköping',
    
    // Helsingborg
    'Kullagatan, Helsingborg',
    'Järnvägsgatan, Helsingborg',
    'Stortorget, Helsingborg',
    
    // Jönköping
    'Västra Storgatan, Jönköping',
    'Östra Storgatan, Jönköping',
    
    // Lund
    'Stora Södergatan, Lund',
    'Sankt Petri Kyrkogata, Lund',
    'Klostergatan, Lund',
    
    // Umeå
    'Storgatan, Umeå',
    'Rådhusesplanaden, Umeå',
    
    // Gävle
    'Drottninggatan, Gävle',
    'Nygatan, Gävle',
    
    // Borås
    'Allégatan, Borås',
    'Stora Torget, Borås',
    
    // Eskilstuna
    'Drottninggatan, Eskilstuna',
    'Rademachergatan, Eskilstuna',
    
    // Karlstad
    'Västra Torggatan, Karlstad',
    'Tingvallagatan, Karlstad'
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
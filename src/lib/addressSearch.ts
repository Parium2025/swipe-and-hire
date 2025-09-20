// Swedish address search functionality
export interface AddressResult {
  street: string;
  number?: string;
  postalCode: string;
  city: string;
  fullAddress: string;
}

// Common Swedish street names and cities for autocomplete
const COMMON_STREETS = [
  // Stockholm
  'Storgatan, Stockholm',
  'Drottninggatan, Stockholm', 
  'Kungsgatan, Stockholm',
  'Sveavägen, Stockholm',
  'Vasagatan, Stockholm',
  'Regeringsgatan, Stockholm',
  'Birger Jarlsgatan, Stockholm',
  'Östermalmsgatan, Stockholm',
  'Södermalmsallén, Stockholm',
  'Hornsgatan, Stockholm',
  'Götgatan, Stockholm',
  'Folkungagatan, Stockholm',
  'Upplandsgatan, Stockholm',
  'Sankt Eriksgatan, Stockholm',
  'Fleminggatan, Stockholm',
  'Kungsholmsgatan, Stockholm',
  
  // Göteborg  
  'Storgatan, Göteborg',
  'Kungsgatan, Göteborg',
  'Avenyn, Göteborg',
  'Nordstan, Göteborg',
  'Linnégatan, Göteborg',
  'Vasagatan, Göteborg',
  'Järntorget, Göteborg',
  'Fredsgatan, Göteborg',
  'Magasinsgatan, Göteborg',
  'Tredje Långgatan, Göteborg',
  
  // Malmö
  'Stortorget, Malmö',
  'Södergatan, Malmö', 
  'Kungsgatan, Malmö',
  'Västra Hamnen, Malmö',
  'Triangeln, Malmö',
  'Möllevången, Malmö',
  'Davidshall, Malmö',
  'Limhamn, Malmö',
  
  // Uppsala
  'Storgatan, Uppsala',
  'Kungsgatan, Uppsala',
  'Sankt Eriksgatan, Uppsala',
  'Dragarbrunnsgatan, Uppsala',
  'Västra Ågatan, Uppsala',
  
  // Linköping  
  'Storgatan, Linköping',
  'Kungsgatan, Linköping',
  'Järnvägsgatan, Linköping',
  'Klostergatan, Linköping',
  
  // Örebro
  'Storgatan, Örebro',
  'Kungsgatan, Örebro',
  'Järnvägsgatan, Örebro',
  'Drottninggatan, Örebro',
  
  // Västerås
  'Storgatan, Västerås',
  'Kopparbergsvägen, Västerås',
  'Kungsgatan, Västerås',
  
  // Norrköping
  'Storgatan, Norrköping',
  'Kungsgatan, Norrköping',
  'Drottninggatan, Norrköping',
  
  // Helsingborg
  'Stortorget, Helsingborg',
  'Kullagatan, Helsingborg', 
  'Järnvägsgatan, Helsingborg',
  
  // Jönköping
  'Storgatan, Jönköping',
  'Kungsgatan, Jönköping',
  'Västra Storgatan, Jönköping',
  
  // Lund
  'Stortorget, Lund',
  'Kungsgatan, Lund',
  'Sankt Petri Kyrkogata, Lund',
  'Klostergatan, Lund',
  
  // Umeå
  'Storgatan, Umeå',
  'Kungsgatan, Umeå',
  'Rådhusesplanaden, Umeå',
  
  // Gävle
  'Stortorget, Gävle',
  'Drottninggatan, Gävle',
  'Kungsgatan, Gävle',
  
  // Borås
  'Storgatan, Borås',
  'Allegatan, Borås',
  'Järnvägsgatan, Borås',
  
  // Eskilstuna
  'Kungsgatan, Eskilstuna',
  'Drottninggatan, Eskilstuna',
  'Rademachergatan, Eskilstuna',
  
  // Södertälje
  'Storgatan, Södertälje',
  'Järnvägsgatan, Södertälje',
  
  // Karlstad
  'Storgatan, Karlstad',
  'Kungsgatan, Karlstad',
  'Västra Torggatan, Karlstad'
];

// Add numbers to streets for more realistic suggestions
const generateStreetSuggestions = (searchTerm: string): string[] => {
  const suggestions: string[] = [];
  
  // First add exact matches
  COMMON_STREETS.forEach(street => {
    if (street.toLowerCase().includes(searchTerm.toLowerCase())) {
      suggestions.push(street);
    }
  });
  
  // Then add numbered variations for generic searches
  if (searchTerm.length >= 3) {
    const commonNumbers = ['1', '2', '3', '4', '5', '10', '15', '20', '25', '30'];
    
    if (suggestions.length > 0) {
      suggestions.slice(0, 3).forEach(baseSuggestion => {
        const [street, city] = baseSuggestion.split(', ');
        commonNumbers.slice(0, 3).forEach(num => {
          const numberedStreet = `${street} ${num}, ${city}`;
          if (!suggestions.includes(numberedStreet)) {
            suggestions.push(numberedStreet);
          }
        });
      });
    }
  }
  
  return suggestions.slice(0, 10); // Limit to 10 suggestions
};

/**
 * Search for Swedish addresses based on user input
 * @param query The search term entered by the user
 * @returns Array of address suggestions
 */
export const searchAddresses = async (query: string): Promise<string[]> => {
  if (!query || query.length < 2) {
    return [];
  }
  
  const suggestions = generateStreetSuggestions(query);
  
  // If no suggestions found, provide some generic ones based on the input
  if (suggestions.length === 0 && query.length >= 2) {
    const cities = ['Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Linköping'];
    return cities.map(city => `${query.charAt(0).toUpperCase() + query.slice(1)}gatan, ${city}`).slice(0, 5);
  }
  
  return suggestions;
};

/**
 * Parse an address string into components
 * @param address The full address string
 * @returns Parsed address components
 */
export const parseAddress = (address: string): AddressResult | null => {
  try {
    // Simple parsing for Swedish addresses
    // Format: "Street Number, City" or "Street, City"
    const parts = address.split(', ');
    
    if (parts.length >= 2) {
      const streetPart = parts[0].trim();
      const city = parts[1].trim();
      
      // Extract street number if present
      const streetMatch = streetPart.match(/^(.+?)(\s+\d+.*)?$/);
      const street = streetMatch ? streetMatch[1].trim() : streetPart;
      const number = streetMatch && streetMatch[2] ? streetMatch[2].trim() : undefined;
      
      return {
        street,
        number,
        postalCode: '', // Will be filled if needed
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
 * @param address Address components or full string
 * @returns Formatted address string
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
  
  return formatted;
};
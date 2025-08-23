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

// Funktion för att hämta postnummer från svensk postnummerservice
export const fetchPostalCodeInfo = async (postalCode: string): Promise<PostalCodeResponse | null> => {
  try {
    const cleanedCode = postalCode.replace(/\s+/g, '');
    
    // Använd Zippopotam.us API för svenska postnummer (gratis och öppen)
    const response = await fetch(`https://api.zippopotam.us/SE/${cleanedCode}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    if (data && data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        postalCode: formatPostalCodeDisplay(data['post code']),
        city: place['place name'],
        municipality: place['place name'], // Ofta samma som city
        county: place['state'],
        area: place['place name']
      };
    }
    
    return null;
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
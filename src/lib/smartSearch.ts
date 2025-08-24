// Smart search system that understands synonyms and related terms
export interface SearchSynonyms {
  [key: string]: string[];
}

export const jobSearchSynonyms: SearchSynonyms = {
  // Chef-relaterade termer
  'chef': ['chef', 'ledare', 'manager', 'direktör', 'föreståndare', 'ansvarig', 'överordnad', 'boss', 'supervisor', 'teamledare', 'avdelningschef', 'sektionschef', 'driftchef', 'produktionschef', 'verksamhetschef', 'enhetschef', 'gruppchef'],
  
  // Militär-relaterade termer
  'militär': ['militär', 'försvar', 'soldat', 'officer', 'specialistofficerare', 'värnplikt', 'försvarsmakt', 'krigsmakt', 'armé', 'marin', 'flygvapen'],
  
  // Account manager-relaterade termer
  'account': ['account manager', 'key account manager', 'säljare', 'försäljningschef', 'kundansvarig', 'affärsområdeschef', 'säljrepresentant', 'business developer', 'klientansvarig'],
  
  // IT-relaterade termer
  'utvecklare': ['utvecklare', 'programmerare', 'developer', 'kodare', 'mjukvaruutvecklare', 'systemutvecklare', 'webbutvecklare', 'apputvecklare', 'frontend', 'backend', 'fullstack'],
  
  // Design-relaterade termer
  'design': ['designer', 'formgivare', 'grafisk designer', 'ux designer', 'ui designer', 'kreativ', 'art director', 'digital designer', 'webdesigner'],
  
  // Ekonomi-relaterade termer
  'ekonomi': ['ekonom', 'redovisning', 'controller', 'finansiell', 'bokföring', 'budget', 'kalkyl', 'revision', 'accounting'],
  
  // Vård-relaterade termer
  'vård': ['sjuksköterska', 'undersköterska', 'vårdbiträde', 'läkare', 'medicin', 'hälsa', 'behandling', 'omvårdnad', 'patient'],
  
  // Lärare-relaterade termer
  'lärare': ['lärare', 'pedagog', 'utbildare', 'instruktör', 'rektor', 'förskollärare', 'barnskötare', 'fritidspedagog', 'specialpedagog'],
  
  // Ingenjör-relaterade termer
  'ingenjör': ['ingenjör', 'tekniker', 'konstruktör', 'projektör', 'teknisk specialist', 'civilingenjör', 'högskoleingenjör'],
  
  // Konsult-relaterade termer
  'konsult': ['konsult', 'rådgivare', 'expert', 'specialist', 'senior konsult', 'management consultant', 'affärskonsult'],
  
  // Transport-relaterade termer
  'transport': ['chaufför', 'förare', 'lastbilsförare', 'bussförare', 'logistik', 'distribution', 'leverans', 'kör'],
  
  // Service-relaterade termer
  'service': ['kundtjänst', 'support', 'helpdesk', 'reception', 'värdinna', 'säkerhet', 'städ', 'bemötande'],
  
  // Kök/restaurang-relaterade termer
  'kök': ['kock', 'kökschef', 'souschef', 'konditor', 'bagare', 'servitör', 'servitris', 'hovmästare', 'restaurang', 'storhushåll']
};

// Function to expand search terms with synonyms
export const expandSearchTerms = (searchTerm: string): string[] => {
  const normalizedTerm = searchTerm.toLowerCase().trim();
  const expandedTerms = new Set<string>();
  
  // Add the original term
  expandedTerms.add(normalizedTerm);
  
  // Check for exact matches and partial matches in synonyms
  for (const [key, synonyms] of Object.entries(jobSearchSynonyms)) {
    // Check if the search term matches the key or any synonym
    if (key.includes(normalizedTerm) || normalizedTerm.includes(key) || 
        synonyms.some(synonym => 
          synonym.toLowerCase().includes(normalizedTerm) || 
          normalizedTerm.includes(synonym.toLowerCase())
        )) {
      // Add all related terms
      synonyms.forEach(synonym => expandedTerms.add(synonym.toLowerCase()));
      expandedTerms.add(key);
    }
  }
  
  return Array.from(expandedTerms);
};

// Function to create smart search conditions for Supabase
export const createSmartSearchConditions = (searchTerm: string): string => {
  if (!searchTerm.trim()) return '';
  
  const expandedTerms = expandSearchTerms(searchTerm);
  const conditions: string[] = [];
  
  expandedTerms.forEach(term => {
    conditions.push(`company_name.ilike.%${term}%`);
    conditions.push(`description.ilike.%${term}%`);
    conditions.push(`title.ilike.%${term}%`);
    conditions.push(`location.ilike.%${term}%`);
  });
  
  return conditions.join(',');
};

// Function to highlight search matches in text
export const highlightSearchMatches = (text: string, searchTerm: string): string => {
  if (!searchTerm.trim()) return text;
  
  const expandedTerms = expandSearchTerms(searchTerm);
  let highlightedText = text;
  
  expandedTerms.forEach(term => {
    const regex = new RegExp(`(${term})`, 'gi');
    highlightedText = highlightedText.replace(regex, '<mark class="bg-yellow-200 text-yellow-800 px-1 rounded">$1</mark>');
  });
  
  return highlightedText;
};
// Smart search system that understands synonyms and related terms
export interface SearchSynonyms {
  [key: string]: string[];
}

export const jobSearchSynonyms: SearchSynonyms = {
  // Chef-relaterade termer
  'chef': ['chef', 'ledare', 'manager', 'direktör', 'föreståndare', 'ansvarig', 'överordnad', 'boss', 'supervisor', 'teamledare', 'avdelningschef', 'sektionschef', 'driftchef', 'produktionschef', 'verksamhetschef', 'enhetschef', 'gruppchef'],
  
  // Rekrytering
  'rekryterare': ['rekryterare', 'hr', 'human resources', 'personalansvarig', 'talent acquisition', 'headhunter', 'recruiter', 'personalchef', 'hr-chef', 'hr-specialist', 'hr-partner', 'bemanningsansvarig'],
  
  // Militär-relaterade termer
  'militär': ['militär', 'försvar', 'soldat', 'officer', 'specialistofficerare', 'värnplikt', 'försvarsmakt', 'krigsmakt', 'armé', 'marin', 'flygvapen'],
  
  // Account manager-relaterade termer
  'account': ['account manager', 'key account manager', 'säljare', 'försäljningschef', 'kundansvarig', 'affärsområdeschef', 'säljrepresentant', 'business developer', 'klientansvarig', 'kundansvarig', 'säljchef'],
  
  // IT-relaterade termer
  'utvecklare': ['utvecklare', 'programmerare', 'developer', 'kodare', 'mjukvaruutvecklare', 'systemutvecklare', 'webbutvecklare', 'apputvecklare', 'frontend', 'backend', 'fullstack', 'it-specialist', 'it-tekniker'],
  
  // Design-relaterade termer
  'design': ['designer', 'formgivare', 'grafisk designer', 'ux designer', 'ui designer', 'kreativ', 'art director', 'digital designer', 'webdesigner', 'produktdesigner'],
  
  // Ekonomi-relaterade termer
  'ekonomi': ['ekonom', 'redovisning', 'controller', 'finansiell', 'bokföring', 'budget', 'kalkyl', 'revision', 'accounting', 'redovisningsekonom', 'finansekonom', 'ekonomiassistent', 'bokförare'],
  
  // Vård-relaterade termer
  'vård': ['sjuksköterska', 'undersköterska', 'vårdbiträde', 'läkare', 'medicin', 'hälsa', 'behandling', 'omvårdnad', 'patient', 'sjukvård', 'hemtjänst', 'äldrevård'],
  
  // Lärare-relaterade termer
  'lärare': ['lärare', 'pedagog', 'utbildare', 'instruktör', 'rektor', 'förskollärare', 'barnskötare', 'fritidspedagog', 'specialpedagog', 'skolledare', 'undervisning'],
  
  // Ingenjör-relaterade termer
  'ingenjör': ['ingenjör', 'tekniker', 'konstruktör', 'projektör', 'teknisk specialist', 'civilingenjör', 'högskoleingenjör', 'drifttekniker', 'servicetekniker'],
  
  // Konsult-relaterade termer
  'konsult': ['konsult', 'rådgivare', 'expert', 'specialist', 'senior konsult', 'management consultant', 'affärskonsult', 'it-konsult', 'ekonomikonsult'],
  
  // Transport-relaterade termer
  'transport': ['chaufför', 'förare', 'lastbilsförare', 'bussförare', 'logistik', 'distribution', 'leverans', 'kör', 'transportör', 'kurirförare'],
  
  // Service-relaterade termer
  'service': ['kundtjänst', 'support', 'helpdesk', 'reception', 'värdinna', 'säkerhet', 'städ', 'bemötande', 'kundservice', 'kundsupport', 'receptionist'],
  
  // Kök/restaurang-relaterade termer
  'kök': ['kock', 'kökschef', 'souschef', 'konditor', 'bagare', 'servitör', 'servitris', 'hovmästare', 'restaurang', 'storhushåll', 'cateringpersonal'],
  
  // Platser (Helsingborg och andra större städer)
  'helsingborg': ['helsingborg', '252', '254', '256', 'norra hamnen', 'västra hamnen', 'fredriksdal'],
  'malmö': ['malmö', '200', '201', '202', '203', '204', '205', '206', '207', '208', '209', '21'],
  'stockholm': ['stockholm', '100', '101', '102', '103', '104', '105', '106', '107', '108', '109', '11', '12', '13', '14', '15', '16'],
  'göteborg': ['göteborg', '400', '401', '402', '403', '404', '405', '406', '407', '408', '409', '41', '42', '43'],
  
  // Anställningstyper
  'heltid': ['heltid', '100%', 'hel tjänst', 'full time', 'fulltime'],
  'deltid': ['deltid', '50%', '75%', 'part time', 'parttime', 'halvtid'],
  'visstid': ['visstid', 'tillfällig', 'projektanställning', 'vikariat', 'temporary'],
  'tillsvidare': ['tillsvidare', 'permanent', 'fast anställning', 'stadigvarande'],
  
  // Arbetssätt
  'distans': ['distans', 'remote', 'hemifrån', 'hemarbete', 'distansarbete'],
  'kontor': ['kontor', 'på plats', 'office', 'kontorsarbete'],
  'hybrid': ['hybrid', 'flexibelt', 'blandad arbetsplats'],
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
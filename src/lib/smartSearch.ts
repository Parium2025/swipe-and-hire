// Smart search system that understands synonyms, related terms, and salary searches
export interface SearchSynonyms {
  [key: string]: string[];
}

export interface SalarySearchResult {
  isSalarySearch: boolean;
  targetSalary: number | null;
  rangeMin: number;
  rangeMax: number;
  isMinimumSearch: boolean; // For "100000+" style searches
}

// Detect if search term is a salary search (number like 32500, 55000, 100000+, etc.)
export const detectSalarySearch = (searchTerm: string): SalarySearchResult => {
  let normalizedTerm = searchTerm.trim().toLowerCase();
  
  // Check for "+" or "plus" suffix (e.g., "100000+", "100000 plus", "100000+kr")
  const isMinimumSearch = /\+|plus/i.test(normalizedTerm);
  
  // Remove common suffixes and clean up
  normalizedTerm = normalizedTerm
    .replace(/\s+/g, '')
    .replace(/kr/gi, '')
    .replace(/\+/g, '')
    .replace(/plus/gi, '');
  
  // Check if it's a number
  const numericValue = parseInt(normalizedTerm, 10);
  
  // Consider it a salary search if it's a number >= 10000 (reasonable salary threshold)
  if (!isNaN(numericValue) && numericValue >= 10000) {
    if (isMinimumSearch) {
      // "100000+" means 100000 or more - no upper limit
      return {
        isSalarySearch: true,
        targetSalary: numericValue,
        rangeMin: numericValue,
        rangeMax: Infinity,
        isMinimumSearch: true,
      };
    }
    
    // Regular salary search - find jobs where this salary falls within their range
    // No artificial range expansion needed - just check if target is within job's range
    return {
      isSalarySearch: true,
      targetSalary: numericValue,
      rangeMin: numericValue,
      rangeMax: numericValue,
      isMinimumSearch: false,
    };
  }
  
  return {
    isSalarySearch: false,
    targetSalary: null,
    rangeMin: 0,
    rangeMax: 0,
    isMinimumSearch: false,
  };
};

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

// ============================================
// CANDIDATE SMART SEARCH
// ============================================

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// Normalize Swedish characters for matching
function normalizeSwedish(text: string): string {
  return text
    .toLowerCase()
    .replace(/å/g, 'a')
    .replace(/ä/g, 'a')
    .replace(/ö/g, 'o')
    .replace(/é/g, 'e')
    .replace(/è/g, 'e');
}

// Check if a string fuzzy-matches the query
function fuzzyMatch(text: string, query: string, maxDistance: number = 2): { match: boolean; score: number } {
  if (!text || !query) return { match: false, score: 0 };
  
  const normalizedText = normalizeSwedish(text.toLowerCase().trim());
  const normalizedQuery = normalizeSwedish(query.toLowerCase().trim());
  
  // Exact match = highest score
  if (normalizedText === normalizedQuery) {
    return { match: true, score: 100 };
  }
  
  // Contains match = high score
  if (normalizedText.includes(normalizedQuery)) {
    return { match: true, score: 90 };
  }
  
  // Word starts with query = high score
  const words = normalizedText.split(/\s+/);
  for (const word of words) {
    if (word.startsWith(normalizedQuery)) {
      return { match: true, score: 85 };
    }
  }
  
  // Fuzzy match for typos - only for queries of 3+ characters
  if (normalizedQuery.length >= 3) {
    // Check each word in text
    for (const word of words) {
      if (word.length >= 2) {
        const distance = levenshteinDistance(word, normalizedQuery);
        const allowedDistance = Math.min(maxDistance, Math.floor(normalizedQuery.length / 3));
        if (distance <= allowedDistance) {
          return { match: true, score: 70 - distance * 10 };
        }
      }
    }
    
    // Check if query is close to any substring
    for (let i = 0; i <= normalizedText.length - normalizedQuery.length; i++) {
      const substring = normalizedText.substring(i, i + normalizedQuery.length);
      const distance = levenshteinDistance(substring, normalizedQuery);
      if (distance <= 1) {
        return { match: true, score: 60 };
      }
    }
  }
  
  return { match: false, score: 0 };
}

// Parse custom_answers to searchable text
function extractCustomAnswersText(customAnswers: any): string {
  if (!customAnswers) return '';
  
  try {
    let parsed = customAnswers;
    if (typeof customAnswers === 'string') {
      parsed = JSON.parse(customAnswers);
    }
    
    const parts: string[] = [];
    
    // Handle array of answers
    if (Array.isArray(parsed)) {
      parsed.forEach((item: any) => {
        if (typeof item === 'string') {
          parts.push(item);
        } else if (typeof item === 'object') {
          // { question: "...", answer: "..." } format
          if (item.answer !== undefined) {
            const answerStr = Array.isArray(item.answer) 
              ? item.answer.join(' ') 
              : String(item.answer);
            parts.push(answerStr);
          }
          if (item.question) {
            parts.push(String(item.question));
          }
        }
      });
    }
    // Handle object format { questionId: answer }
    else if (typeof parsed === 'object') {
      Object.values(parsed).forEach((value: any) => {
        if (typeof value === 'string') {
          parts.push(value);
        } else if (Array.isArray(value)) {
          parts.push(value.join(' '));
        }
      });
    }
    
    return parts.join(' ');
  } catch {
    return '';
  }
}

export interface CandidateSearchFields {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  job_title?: string | null;
  notes?: string | null;
  bio?: string | null;
  custom_answers?: any;
  employment_status?: string | null;
  work_schedule?: string | null;
  availability?: string | null;
}

interface CandidateSearchResult<T> {
  item: T;
  score: number;
  matchedFields: string[];
}

// Field weights for ranking
const CANDIDATE_FIELD_WEIGHTS = {
  first_name: 20,
  last_name: 20,
  full_name: 25,
  email: 15,
  phone: 15,
  job_title: 18,
  location: 12,
  notes: 10,
  bio: 8,
  custom_answers: 10,
  employment_status: 5,
  work_schedule: 5,
  availability: 5,
};

/**
 * Perform smart search on candidates
 * Features:
 * - Fuzzy matching (handles typos)
 * - Multi-field search (name, email, phone, location, job, notes, custom answers)
 * - Intelligent ranking
 * - Swedish character support
 * 
 * Returns sorted results by relevance score
 */
export function smartSearchCandidates<T extends CandidateSearchFields>(
  candidates: T[],
  query: string
): T[] {
  if (!query || query.trim().length === 0) {
    return candidates;
  }

  const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(t => t.length > 0);
  
  const results: CandidateSearchResult<T>[] = [];

  for (const candidate of candidates) {
    let totalScore = 0;
    const matchedFields: string[] = [];

    // Build searchable fields
    const fields: Record<string, string> = {
      first_name: candidate.first_name || '',
      last_name: candidate.last_name || '',
      full_name: `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim(),
      email: candidate.email || '',
      phone: (candidate.phone || '').replace(/\D/g, ''), // Numbers only for phone
      phone_formatted: candidate.phone || '', // Keep original format too
      job_title: candidate.job_title || '',
      location: candidate.location || '',
      notes: candidate.notes || '',
      bio: candidate.bio || '',
      custom_answers: extractCustomAnswersText(candidate.custom_answers),
      employment_status: candidate.employment_status || '',
      work_schedule: candidate.work_schedule || '',
      availability: candidate.availability || '',
    };

    // Check each search term
    for (const term of searchTerms) {
      let termMatched = false;
      let bestScore = 0;

      // Check phone number separately (handle spaces, dashes, etc.)
      if (/^\d+$/.test(term)) {
        // Search term is numeric - match against phone
        if (fields.phone.includes(term)) {
          bestScore = Math.max(bestScore, 80 * CANDIDATE_FIELD_WEIGHTS.phone);
          termMatched = true;
          if (!matchedFields.includes('phone')) matchedFields.push('phone');
        }
      }

      // Check each field
      for (const [fieldName, fieldValue] of Object.entries(fields)) {
        if (!fieldValue || fieldName === 'phone') continue; // Phone handled above
        
        const weight = CANDIDATE_FIELD_WEIGHTS[fieldName as keyof typeof CANDIDATE_FIELD_WEIGHTS] || 5;
        const { match, score } = fuzzyMatch(fieldValue, term);
        
        if (match) {
          const weightedScore = score * weight;
          bestScore = Math.max(bestScore, weightedScore);
          termMatched = true;
          
          // Track which fields matched
          const displayField = fieldName === 'full_name' ? 'name' : 
                              fieldName === 'phone_formatted' ? 'phone' : 
                              fieldName;
          if (!matchedFields.includes(displayField)) {
            matchedFields.push(displayField);
          }
        }
      }

      if (termMatched) {
        totalScore += bestScore;
      } else {
        // If any term doesn't match, candidate is excluded
        totalScore = 0;
        break;
      }
    }

    if (totalScore > 0) {
      // Bonus for matching multiple terms
      totalScore *= (1 + (searchTerms.length - 1) * 0.2);
      
      results.push({
        item: candidate,
        score: totalScore,
        matchedFields,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.map(r => r.item);
}

/**
 * Check if a candidate matches the search query
 */
export function candidateMatchesSearch<T extends CandidateSearchFields>(
  candidate: T,
  query: string
): boolean {
  if (!query || query.trim().length === 0) return true;
  
  const results = smartSearchCandidates([candidate], query);
  return results.length > 0;
}
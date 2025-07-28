// Utility function to automatically categorize jobs based on title and description
export const categorizeJob = (title: string, description: string): string => {
  const combinedText = `${title} ${description}`.toLowerCase();
  
  // Job categories with keywords for automatic categorization
  const categories = [
    { 
      value: 'it', 
      keywords: ['utvecklare', 'programmerare', 'it', 'data', 'systemadministratör', 'webb', 'mjukvara', 'frontend', 'backend', 'fullstack', 'devops', 'cybersäkerhet', 'java', 'python', 'javascript', 'react', 'vue', 'angular'] 
    },
    { 
      value: 'administration', 
      keywords: ['administration', 'ekonomi', 'redovisning', 'controller', 'assistent', 'sekreterare', 'koordinator', 'projektledare', 'hr', 'personaladministratör'] 
    },
    { 
      value: 'sales', 
      keywords: ['försäljning', 'sales', 'säljare', 'account', 'marketing', 'marknadsföring', 'reklam', 'kommunikation', 'pr', 'kundansvarig'] 
    },
    { 
      value: 'healthcare', 
      keywords: ['sjuksköterska', 'läkare', 'vård', 'omsorg', 'tandläkare', 'fysioterapeut', 'undersköterska', 'vårdbiträde', 'hälsa'] 
    },
    { 
      value: 'education', 
      keywords: ['lärare', 'utbildning', 'skola', 'universitet', 'förskola', 'pedagog', 'barnskötare', 'fritidsledare', 'rektor'] 
    },
    { 
      value: 'construction', 
      keywords: ['bygg', 'snickare', 'elektriker', 'anläggning', 'murare', 'målare', 'byggledare', 'platschef', 'vvs', 'construction'] 
    },
    { 
      value: 'consulting', 
      keywords: ['konsult', 'rådgivare', 'expert', 'specialist', 'senior', 'lead', 'arkitekt', 'strategisk', 'management'] 
    },
    { 
      value: 'logistics', 
      keywords: ['lager', 'logistik', 'transport', 'distribution', 'chaufför', 'lastbil', 'gaffeltruck', 'leverans', 'warehouse'] 
    },
    { 
      value: 'service', 
      keywords: ['kundtjänst', 'service', 'support', 'reception', 'värdinna', 'säkerhet', 'städ', 'bemötande', 'helpdesk'] 
    },
    { 
      value: 'restaurant', 
      keywords: ['kock', 'servitör', 'hotell', 'restaurang', 'storhushåll', 'bagare', 'konditor', 'hovmästare', 'chef'] 
    },
    { 
      value: 'industry', 
      keywords: ['industri', 'tillverkning', 'produktion', 'maskinoperatör', 'kvalitet', 'process', 'tekniker', 'manufacturing'] 
    },
    { 
      value: 'creative', 
      keywords: ['design', 'grafisk', 'kreativ', 'media', 'journalist', 'fotograf', 'video', 'kultur', 'konstnär', 'ux', 'ui'] 
    }
  ];

  // Find the category with the most keyword matches
  let bestMatch = { category: 'service', matches: 0 }; // Default to service
  
  for (const category of categories) {
    const matches = category.keywords.filter(keyword => 
      combinedText.includes(keyword)
    ).length;
    
    if (matches > bestMatch.matches) {
      bestMatch = { category: category.value, matches };
    }
  }
  
  return bestMatch.category;
};
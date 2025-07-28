import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MapPin, Clock, Building, Filter, Heart, ExternalLink, X, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Job {
  id: string;
  title: string;
  company_name: string;
  location: string;
  employment_type: string;
  salary_min?: number;
  salary_max?: number;
  description: string;
  created_at: string;
}

const SearchJobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [jobTitleSearch, setJobTitleSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all-locations');
  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [selectedSubcategory, setSelectedSubcategory] = useState('');
  const [selectedEmploymentType, setSelectedEmploymentType] = useState('all-types');

  // Job categories with subcategories - based on AF structure
  const jobCategories = [
    { 
      value: 'administration', 
      label: 'Administration, ekonomi, juridik', 
      icon: '📊',
      keywords: ['administration', 'ekonomi', 'redovisning', 'controller', 'assistent', 'sekreterare', 'koordinator', 'projektledare', 'juridik', 'advokat'],
      subcategories: [
        'Administratörer och sekreterare',
        'Apotekare m.fl.',
        'Arkivarier och bibliotekarier m.fl.',
        'Assistenter och administratörer',
        'Banktjänstemän och försäkringsrådgivare',
        'Controllers och analytiker',
        'Ekonomiassistenter och redovisningsekonomer', 
        'Företagsledare',
        'Jurister',
        'Löne- och personaladministratörer',
        'Projektledare',
        'Sekreterare och kontorspersonal',
        'Skatteexperter och redovisningskonsulter'
      ]
    },
    { 
      value: 'construction', 
      label: 'Bygg och anläggning', 
      icon: '🏗️',
      keywords: ['bygg', 'snickare', 'elektriker', 'anläggning', 'murare', 'målare', 'byggledare', 'platschef', 'vvs'],
      subcategories: [
        'Anläggningsarbetare',
        'Betongarbetare',
        'Byggarbetsledare',
        'Byggnadsingenjörer och arkitekter',
        'Byggplåtslagare',
        'Byggnadsarbetare',
        'Elektriker',
        'Fasadarbetare', 
        'Glas- och fönstermontörer',
        'Golvläggare',
        'Isoleringsmontörer',
        'Kranförare',
        'Målare',
        'Murare',
        'Plattsättare',
        'Rörmokare och VVS-montörer',
        'Snickare',
        'Takläggare',
        'Väg- och anläggningsarbetare'
      ]
    },
    { 
      value: 'management', 
      label: 'Chefer och verksamhetsledare', 
      icon: '👔',
      keywords: ['chef', 'ledare', 'verksamhet', 'director', 'manager', 'vd', 'platschef', 'avdelningschef'],
      subcategories: [
        'Administrationschefer',
        'Driftchefer inom industri',
        'Ekonomichefer',
        'Finanschefer',
        'Försäljnings- och marknadschefer',
        'HR-chefer',
        'IT-chefer',
        'Produktionschefer',
        'Projektchefer',
        'Restaurang- och hotellchefer',
        'Säljchefer',
        'Teknikchefer',
        'Utbildningschefer',
        'VD och koncernchefer',
        'Verksamhetschefer'
      ]
    },
    { 
      value: 'it', 
      label: 'Data/IT', 
      icon: '💻',
      keywords: ['utvecklare', 'programmerare', 'IT', 'data', 'systemadministratör', 'webb', 'mjukvara', 'frontend', 'backend', 'fullstack', 'devops', 'cybersäkerhet'],
      subcategories: [
        'Applikationsutvecklare',
        'Business analysts',
        'Databasadministratörer',
        'DevOps-ingenjörer',
        'Frontend-utvecklare',
        'Backend-utvecklare',
        'Fullstack-utvecklare',
        'IT-arkitekter',
        'IT-konsulter',
        'IT-projektledare',
        'IT-säkerhetsspecialister',
        'Mjukvaruingenjörer',
        'Nätverksadministratörer',
        'Systemadministratörer',
        'Systemanalytiker',
        'Testare och QA-specialister',
        'UX/UI-designers',
        'Webbutvecklare'
      ]
    },
    { 
      value: 'sales', 
      label: 'Försäljning, inköp, marknadsföring', 
      icon: '📈',
      keywords: ['försäljning', 'sales', 'säljare', 'account', 'marketing', 'marknadsföring', 'reklam', 'kommunikation', 'pr', 'inköp'],
      subcategories: [
        'Account managers',
        'Butikssäljare',
        'Digital marknadsförare',
        'E-handelsspecialister',
        'Event- och mässorganisatörer',
        'Försäljningsrepresentanter',
        'Inköpare',
        'Kommunikatörer',
        'Kundansvariga',
        'Marknadsanalytiker',
        'Marknadsförare',
        'PR-specialister',
        'Reklamproducenter',
        'Säljare inom detaljhandel',
        'Säljchefer',
        'Telefonförsäljare'
      ]
    },
    { 
      value: 'crafts', 
      label: 'Hantverkyrken', 
      icon: '🔨',
      keywords: ['hantverk', 'smed', 'keramiker', 'snickare', 'träarbete', 'metallarbete'],
      subcategories: [
        'Barberare och frisörer',
        'Bagare och konditorer',
        'Båtbyggare',
        'Dekoratörer och florister',
        'Finsnickar',
        'Glas- och keramikarbetare',
        'Guldsmed er',
        'Instrumentmakare',
        'Juvelerare',
        'Korgmakare',
        'Kött- och fiskberedare',
        'Läderhantverkare',
        'Möbelsnickare',
        'Musikinstrumentmakare',
        'Optiker',
        'Silversmeder',
        'Slaktare',
        'Träsnidare',
        'Urmakare'
      ]
    },
    { 
      value: 'restaurant', 
      label: 'Hotell, restaurang, storhushåll', 
      icon: '🍽️',
      keywords: ['kock', 'servitör', 'hotell', 'restaurang', 'storhushåll', 'bagare', 'konditor', 'hovmästare'],
      subcategories: [
        'Bagare och konditorer',
        'Bartenders',
        'Cateringpersonal',
        'Hovmästare',
        'Hotellreceptionister',
        'Kockar',
        'Kökspersonal',
        'Restaurangchefer',
        'Servitörer',
        'Sommelier',
        'Storhushållspersonal',
        'Städpersonal inom hotell'
      ]
    },
    { 
      value: 'healthcare', 
      label: 'Hälso- och sjukvård', 
      icon: '🏥',
      keywords: ['sjuksköterska', 'läkare', 'vård', 'omsorg', 'tandläkare', 'fysioterapeut', 'undersköterska', 'vårdbiträde'],
      subcategories: [
        'Ambulanspersonal',
        'Apotekstekniker',
        'Arbetsterapeuter',
        'Barnmorskor',
        'Biomedicinska analytiker',
        'Dietister',
        'Fysioterapeuter',
        'Hörselskadetekniker',
        'Kuratorer',
        'Läkare',
        'Medicintekniker',
        'Naprapat er',
        'Optiker',
        'Ortopedtekniker',
        'Röntgensjuksköterskor',
        'Sjukgymnaster',
        'Sjuksköterskor',
        'Tandhygienister',
        'Tandläkare',
        'Tandtekniker',
        'Undersköterskor',
        'Vårdbiträden'
      ]
    },
    { 
      value: 'industry', 
      label: 'Industriell tillverkning', 
      icon: '🏭',
      keywords: ['industri', 'tillverkning', 'produktion', 'maskinoperatör', 'kvalitet', 'process', 'tekniker'],
      subcategories: [
        'Fordonsreparatörer',
        'Gjutare och formgjutare',
        'Industriarbetare',
        'Kemitekniker',
        'Maskinoperatörer',
        'Maskinreparatörer',
        'Metallarbetare',
        'Monteringsarbetare',
        'Packare',
        'Plastarbetare',
        'Processtekniker',
        'Produktionsarbetare',
        'Kvalitetskon trollanter',
        'Svetsa re',
        'Textilarbetare',
        'Träarbetare',
        'Verktygsm akare'
      ]
    },
    { 
      value: 'installation', 
      label: 'Installation, drift, underhåll', 
      icon: '⚙️',
      keywords: ['installation', 'drift', 'underhåll', 'reparatör', 'tekniker', 'service'],
      subcategories: [
        'Anläggningsreparatörer',
        'Automationstekniker',
        'Drifttekn iker',
        'El- och teletekniker',
        'Fastighetssk ötare',
        'Fastighetstekniker',
        'Hissmontörer',
        'HVAC-tekniker',
        'Industri elektriker',
        'Installations tekniker',
        'Kraftverkstekniker',
        'Kyltekn iker',
        'Maskinmontörer',
        'Reparatörer',
        'Servicetekniker',
        'Underhållstekniker',
        'Ventilationsmontörer'
      ]
    },
    { 
      value: 'logistics', 
      label: 'Transport', 
      icon: '🚛',
      keywords: ['lager', 'logistik', 'transport', 'distribution', 'chaufför', 'lastbil', 'gaffeltruck', 'leverans'],
      subcategories: [
        'Arbetsledare inom lager och terminal',
        'Bangårdspersonal', 
        'Brevbärare och postterminalarbetare',
        'Buss- och spårvagnsförare',
        'Fartygsbefäl m.fl.',
        'Flygledare',
        'Hamnarbetare',
        'Kabinpersonal m.fl.',
        'Lager- och terminalpersonal', 
        'Lastbilsförare m.fl.',
        'Lokförare',
        'Maskinbefäl',
        'Matroser och jungman m.fl.',
        'Piloter m.fl.',
        'Ramppersonal, flyttkarlar och varupåfyllare m.fl.',
        'Reklamutdelare och tidningsdistributörer',
        'Taxiförare m.fl.',
        'Transportledare och transportsamordnare',
        'Truckförare',
        'Tågvärdar och ombordansvariga m.fl.'
      ]
    },
    { 
      value: 'beauty', 
      label: 'Kropps- och skönhetsvård', 
      icon: '💄',
      keywords: ['frisör', 'skönhet', 'massage', 'naglar', 'kosmetolog'],
      subcategories: [
        'Barberare',
        'Frisörer',
        'Hudterapeuter',
        'Kosmetologer',
        'Massörer',
        'Nageltekniker',
        'Skönhetsterapeuter'
      ]
    },
    { 
      value: 'creative', 
      label: 'Kultur, media, design', 
      icon: '🎨',
      keywords: ['design', 'grafisk', 'kreativ', 'media', 'journalist', 'fotograf', 'video', 'kultur', 'konstnär'],
      subcategories: [
        'Artister och musiker',
        'Dansare och koreografer',
        'Designers',
        'Filmproducenter',
        'Fotografer',
        'Grafiska formgivare',
        'Illustratörer',
        'Journalister',
        'Konstnärer',
        'Kulturarrangörer',
        'Ljudtekniker',
        'Museipersonal',
        'Redaktörer',
        'Scentekniker',
        'Skådespelare',
        'Videoproducenter',
        'Webdesigners'
      ]
    },
    { 
      value: 'military', 
      label: 'Militärt arbete', 
      icon: '🎖️',
      keywords: ['militär', 'försvar', 'soldat', 'officer'],
      subcategories: [
        'Befäl',
        'Gruppbefäl',
        'Officerare',
        'Soldater',
        'Specialister'
      ]
    },
    { 
      value: 'agriculture', 
      label: 'Naturbruk', 
      icon: '🌾',
      keywords: ['lantbruk', 'jordbruk', 'skog', 'djur', 'trädgård'],
      subcategories: [
        'Djurskötare',
        'Fiskare',
        'Jägare',
        'Jordbruksarbetare',
        'Lantarbetare',
        'Skogsarbetare',
        'Trädgårdsarbetare',
        'Veterinärer'
      ]
    },
    { 
      value: 'science', 
      label: 'Naturvetenskapligt arbete', 
      icon: '🔬',
      keywords: ['forskning', 'vetenskap', 'laboratorium', 'kemi', 'biologi'],
      subcategories: [
        'Biologer',
        'Forskare',
        'Fysiker',
        'Kemister',
        'Laboratorieassistenter',
        'Matematiker',
        'Meteorologer'
      ]
    },
    { 
      value: 'education', 
      label: 'Pedagogiskt arbete', 
      icon: '📚',
      keywords: ['lärare', 'utbildning', 'skola', 'universitet', 'förskola', 'pedagog', 'barnskötare', 'fritidsledare'],
      subcategories: [
        'Doktorander',
        'Elevassistenter m.fl.',
        'Forskarassistenter m.fl.',
        'Fritidspedagoger',
        'Förskollärare',
        'Grundskollärare',
        'Gymnasielärare',
        'Idrottsstränare och instruktörer m.fl.',
        'Lärare i yrkesämnen',
        'Professionella idrottutövare',
        'Professorer',
        'Speciallärare och specialpedagoger m.fl.',
        'Studie- och yrkesvägledare',
        'Trafiklarare',
        'Universitets- och högskolelektorer',
        'Övriga pedagoger med teoretisk specialistkompetens',
        'Övriga universitets- och högskolelärare',
        'Övriga utbildare och instruktörer'
      ]
    },
    { 
      value: 'cleaning', 
      label: 'Sanering och renhållning', 
      icon: '🧹',
      keywords: ['städ', 'rengöring', 'sanering', 'renhållning', 'lokalvård', 'skorstensfejare'],
      subcategories: [
        'Bilrekonditionerare, fönsterputsare m.fl.',
        'Renhållnings- och återvinningsarbetare',
        'Saneringsarbetare m.fl.',
        'Skorstensfjejare',
        'Städare',
        'Städledare och husfruar',
        'Övrig hemservicepersonal m.fl.'
      ]
    },
    { 
      value: 'social', 
      label: 'Socialt arbete', 
      icon: '🤝',
      keywords: ['social', 'socialtjänst', 'stöd', 'hjälp', 'omsorg', 'kurator', 'behandling'],
      subcategories: [
        'Barnskötare',
        'Begravnings- och krematoriepersonal',
        'Behandlingsassistenter och socialpedagoger m.fl.',
        'Biståndshandläggare m.fl.',
        'Diakoner',
        'Friskvårdskonsulenter och hälsopedagoger m.fl.',
        'Fritidsledare m.fl.',
        'Kuratorer',
        'Pastorer m.fl.',
        'Personliga assistenter',
        'Präster',
        'Socialsekreterare',
        'Vårdare, boendestödjare',
        'Övrig servicepersonal',
        'Övriga yrken inom socialt arbete'
      ]
    },
    { 
      value: 'security', 
      label: 'Säkerhetsarbete', 
      icon: '🛡️',
      keywords: ['säkerhet', 'vakt', 'polis', 'brandman', 'ordning', 'bevakning'],
      subcategories: [
        'Arbetsmiljöingenjörer, yrkes- och miljöhygieniker',
        'Brandingenjörer och byggnadsinspektörer m.fl.',
        'Brandmän',
        'Kriminalvårdare',
        'Poliser',
        'SOS-operatörer m.fl.',
        'Säkerhetsinspektörer m.fl.',
        'Tull- och kustbevakningtjänstemän',
        'Väktare och ordningsvakter',
        'Övrig bevaknings- och säkerhetspersonal'
      ]
    },
    { 
      value: 'technical', 
      label: 'Tekniskt arbete', 
      icon: '🔧',
      keywords: ['ingenjör', 'tekniker', 'konstruktör', 'design', 'utveckling', 'arkitekt', 'civilingenjör'],
      subcategories: [
        'Arkitekter m.fl.',
        'Civilingenjörsyrken inom elektroteknik',
        'Civilingenjörsyrken inom gruvteknik och metallurgi',
        'Civilingenjörsyrken inom kemi och kemiteknik',
        'Civilingenjörsyrken inom logistik och produktionsplanering',
        'Civilingenjörsyrken inom maskinteknik',
        'Fastighetsförvaltare',
        'Flygtekniker',
        'GIS- och kartingenjörer',
        'Ingenjörer och tekniker inom elektroteknik',
        'Ingenjörer och tekniker inom gruvteknik och metallurgi',
        'Ingenjörer och tekniker inom industri, logistik och produktionsplanering',
        'Ingenjörer och tekniker inom kemi och kemiteknik',
        'Ingenjörer och tekniker inom maskinteknik',
        'Laboratorieingenjörer',
        'Landskapsarkitekter',
        'Lantmätare',
        'Planeringsarkitekter m.fl.',
        'Tandtekniker och ortopedingenjörer m.fl.',
        'Tekniker, bilddiagnostik och medicinteknisk utrustning',
        'Övriga civilingenjörsyrken',
        'Övriga ingenjörer och tekniker'
      ]
    }
  ];

  const locations = [
    'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 
    'Linköping', 'Helsingborg', 'Jönköping', 'Norrköping', 'Lund', 'Umeå'
  ];

  const employmentTypes = [
    { value: 'Heltid', label: 'Heltid' },
    { value: 'Deltid', label: 'Deltid' },
    { value: 'Konsult', label: 'Konsultuppdrag' },
    { value: 'Praktik', label: 'Praktik' },
    { value: 'Tillfällig', label: 'Vikariat' }
  ];

  const fetchJobs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('job_postings')
        .select(`
          *,
          profiles!job_postings_employer_id_fkey(company_name)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Apply search filters
      if (searchTerm) {
        query = query.or(`company_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      // Apply job title search
      if (jobTitleSearch) {
        query = query.ilike('title', `%${jobTitleSearch}%`);
      }

      // Apply subcategory filter (more specific than category)
      if (selectedSubcategory) {
        query = query.ilike('title', `%${selectedSubcategory}%`);
      } else if (selectedCategory && selectedCategory !== 'all-categories') {
        // Apply category filter only if no subcategory is selected
        const category = jobCategories.find(cat => cat.value === selectedCategory);
        if (category) {
          const keywordConditions = category.keywords.map(keyword => 
            `title.ilike.%${keyword}%,description.ilike.%${keyword}%`
          ).join(',');
          query = query.or(keywordConditions);
        }
      }

      if (selectedLocation && selectedLocation !== 'all-locations') {
        query = query.ilike('location', `%${selectedLocation}%`);
      }

      if (selectedEmploymentType && selectedEmploymentType !== 'all-types') {
        query = query.eq('employment_type', selectedEmploymentType);
      }

      const { data, error } = await query.limit(20);
      
      if (error) throw error;
      
      // Transform the data to match our Job interface
      const transformedJobs = (data || []).map(job => ({
        ...job,
        company_name: job.profiles?.company_name || 'Okänt företag'
      }));
      
      setJobs(transformedJobs);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [searchTerm, jobTitleSearch, selectedLocation, selectedCategory, selectedSubcategory, selectedEmploymentType]);

  const formatSalary = (min?: number, max?: number) => {
    if (min && max) {
      return `${min.toLocaleString()} - ${max.toLocaleString()} kr/mån`;
    } else if (min) {
      return `Från ${min.toLocaleString()} kr/mån`;
    } else if (max) {
      return `Upp till ${max.toLocaleString()} kr/mån`;
    }
    return 'Enligt överenskommelse';
  };

  const handleQuickCategory = (category: string) => {
    setSelectedCategory(category);
    setSelectedSubcategory(''); // Clear subcategory when selecting main category
    setSearchTerm('');
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
          Hitta ditt drömjobb
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Enkel, smart och snabb jobbsökning. Välj kategori eller sök fritt - vi hjälper dig hitta rätt.
        </p>
      </div>

      {/* Smart Category Grid */}
      <Card className="border-0 shadow-lg bg-gradient-to-br from-background to-muted/30">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl">Välj yrkesområde</CardTitle>
          <CardDescription className="text-lg">
            Klicka på ett område för att se alla lediga jobb
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {jobCategories.map((category) => (
              <DropdownMenu key={category.value}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={selectedCategory === category.value ? "default" : "outline"}
                    size="lg"
                    className={`h-20 flex flex-col items-center gap-2 transition-all duration-200 hover:scale-105 ${
                      selectedCategory === category.value 
                        ? 'shadow-lg border-primary' 
                        : 'hover:shadow-md hover:border-primary/50'
                    }`}
                  >
                    <span className="text-2xl">{category.icon}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium text-center leading-tight">
                        {category.label}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 max-h-96 overflow-y-auto bg-popover border shadow-lg">
                  <DropdownMenuItem
                    onClick={() => handleQuickCategory(category.value)}
                    className="font-medium text-primary cursor-pointer"
                  >
                    {category.icon} Alla inom {category.label}
                  </DropdownMenuItem>
                  <Separator className="my-1" />
                  {category.subcategories.map((subcategory) => (
                    <DropdownMenuItem
                      key={subcategory}
                      onClick={() => {
                        setSelectedCategory(category.value);
                        setSelectedSubcategory(subcategory);
                        setSearchTerm('');
                      }}
                      className="text-sm cursor-pointer"
                    >
                      {subcategory}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Search - Collapsible */}
      <Card className="border-primary/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5" />
            Avancerad sökning
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* General Search Term */}
            <div className="space-y-3">
              <Label htmlFor="search" className="text-base font-medium">Sök på företag eller beskrivning</Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="T.ex. 'Volvo' eller 'hemarbete'"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 text-base"
                />
              </div>
            </div>

            {/* Job Title Search - NEW */}
            <div className="space-y-3">
              <Label htmlFor="jobTitleSearch" className="text-base font-medium">Specifik jobbtitel</Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="jobTitleSearch"
                  placeholder="T.ex. 'Lastbilsförare' eller 'Truckförare'"
                  value={jobTitleSearch}
                  onChange={(e) => setJobTitleSearch(e.target.value)}
                  className="pl-12 h-12 text-base"
                />
              </div>
            </div>

            {/* Location - Enhanced */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Välj plats</Label>
              <Select value={selectedLocation} onValueChange={(value) => setSelectedLocation(value === 'all-locations' ? '' : value)}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Alla platser i Sverige" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-locations">🇸🇪 Alla platser</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location} value={location}>
                      📍 {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employment Type - Enhanced */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Anställningsform</Label>
              <Select value={selectedEmploymentType} onValueChange={(value) => setSelectedEmploymentType(value === 'all-types' ? '' : value)}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Alla anställningsformer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-types">💼 Alla typer</SelectItem>
                  {employmentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.value === 'Heltid' ? '🕘' : 
                       type.value === 'Deltid' ? '🕐' : 
                       type.value === 'Konsult' ? '💻' : 
                       type.value === 'Praktik' ? '🎓' : '⏰'} {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <p className="text-lg font-medium">
                <span className="text-primary">{jobs.length}</span> jobb hittades
              </p>
              {(searchTerm || jobTitleSearch || selectedLocation !== 'all-locations' || selectedCategory !== 'all-categories' || selectedSubcategory || selectedEmploymentType !== 'all-types') && (
                <Badge variant="secondary" className="text-sm">
                  Filter aktiva
                </Badge>
              )}
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setSearchTerm('');
                setJobTitleSearch('');
                setSelectedLocation('all-locations');
                setSelectedCategory('all-categories');
                setSelectedSubcategory('');
                setSelectedEmploymentType('all-types');
              }}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Rensa alla filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Section */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-lg text-muted-foreground">Söker bland tusentals jobb...</p>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <div className="space-y-4">
                <div className="text-6xl">🔍</div>
                <h3 className="text-xl font-semibold">Inga jobb hittades</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Inga jobb matchade dina sökkriterier. Prova att ändra dina filter eller sökord.
                </p>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setJobTitleSearch('');
                    setSelectedLocation('all-locations');
                    setSelectedCategory('all-categories');
                    setSelectedSubcategory('');
                    setSelectedEmploymentType('all-types');
                  }}
                >
                  Visa alla jobb
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Results Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">
                {selectedCategory !== 'all-categories' 
                  ? `${jobCategories.find(cat => cat.value === selectedCategory)?.label} Jobb`
                  : 'Alla Jobb'
                }
              </h2>
              <Select value="newest" onValueChange={() => {}}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Sortera efter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Senast publicerade</SelectItem>
                  <SelectItem value="relevant">Mest relevanta</SelectItem>
                  <SelectItem value="salary">Högsta lönen</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Job Cards */}
            <div className="grid gap-6">
              {jobs.map((job) => (
                <Card key={job.id} className="group hover:shadow-xl transition-all duration-300 border-l-4 border-l-transparent hover:border-l-primary">
                  <CardContent className="p-8">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 space-y-4">
                        {/* Job Header */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <h3 className="text-2xl font-bold group-hover:text-primary transition-colors">
                              {job.title}
                            </h3>
                            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
                              <div className="flex items-center gap-2 font-medium">
                                <Building className="h-5 w-5" />
                                {job.company_name}
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                {job.location}
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                {job.employment_type}
                              </div>
                            </div>
                          </div>
                          
                          {/* Category Badge */}
                          {selectedCategory !== 'all-categories' && (
                            <Badge className="bg-primary/10 text-primary border-primary/20">
                              {jobCategories.find(cat => cat.value === selectedCategory)?.icon} {' '}
                              {jobCategories.find(cat => cat.value === selectedCategory)?.label}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Job Description */}
                        <p className="text-muted-foreground text-lg leading-relaxed">
                          {job.description.length > 200 
                            ? `${job.description.substring(0, 200)}...` 
                            : job.description
                          }
                        </p>
                        
                        {/* Job Footer */}
                        <div className="flex items-center justify-between pt-4 border-t">
                          <div className="flex items-center gap-4">
                            <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-base px-3 py-1">
                              💰 {formatSalary(job.salary_min, job.salary_max)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              📅 {new Date(job.created_at).toLocaleDateString('sv-SE', {
                                day: 'numeric',
                                month: 'long'
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-col gap-3 ml-8">
                        <Button size="lg" className="px-8">
                          <ExternalLink className="h-5 w-5 mr-2" />
                          Ansök nu
                        </Button>
                        <Button variant="outline" size="lg">
                          <Heart className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SearchJobs;
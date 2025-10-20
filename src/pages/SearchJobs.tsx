import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MapPin, Clock, Building, Filter, Heart, ExternalLink, X, ChevronDown, Check, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';

import { createSmartSearchConditions, expandSearchTerms } from '@/lib/smartSearch';
import { getEmploymentTypeLabel } from '@/lib/employmentTypes';
import { SEARCH_EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { swedishCities } from '@/lib/swedishCities';
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
  profiles?: {
    company_name: string | null;
  };
}

const SearchJobs = () => {
  const { user, profile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('all-locations');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedEmploymentTypes, setSelectedEmploymentTypes] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const isMobile = useIsMobile();
  
  const dropdownAlignOffset = 0;
  // Job categories with subcategories - using existing working data structure
  const jobCategories = [
    { 
      value: 'administration', 
      label: 'Administration, Ekonomi, Juridik',
      icon: '',
      keywords: ['administration', 'ekonomi', 'redovisning', 'controller', 'assistent', 'sekreterare', 'koordinator', 'projektledare', 'juridik', 'advokat', 'receptionist', 'administratör'],
      subcategories: [
        'Advokat', 'Affärs- och företagsjurist', 'Arkivvård- och biblioteksassistent', 'Backofficespecialist', 'Chefssekreterare och VD-assistent', 'Controller', 'Domare', 'Domstols- och juristsekreterare', 'Ekonomiassistent', 'Finansanalytiker och investeringsrådgivare', 'Försäkringssäljare och försäkringsrådgivare', 'Förvaltnings- och organisationsjurist', 'Gruppledare för kontorspersonal', 'Informatör, kommunikatör och PR-specialist', 'Inkasserare och pantlånare', 'Kontorsreceptionist', 'Lednings- och organisationsutvecklare', 'Medicinsk sekreterare, vårdadministratör', 'Mäklare inom finans', 'Nationalekonom och makroanalytiker', 'Personal- och HR-specialist', 'Planerare och utredare', 'Redovisningsekonom', 'Revisor', 'Skadereglerare och värderare', 'Skatthandläggare', 'Socialförsäkringshandläggare', 'Statistiker', 'Telefonist', 'Trader och fondförvaltare', 'Åklagare', 'Övrig ekonom', 'Övrig handläggare', 'Övrig jurist', 'Övrig kontorsassistent och sekreterare'
      ]
    },
    { 
      value: 'construction', 
      label: 'Bygg och Anläggning', 
      icon: '',
      keywords: ['bygg', 'snickare', 'elektriker', 'anläggning', 'murare', 'målare', 'byggledare', 'platschef', 'vvs'],
      subcategories: [
        'Anläggningsarbetare', 'Anläggningsdykare', 'Anläggningsmaskinförare', 'Arbetsledare inom bygg, anläggning och gruva', 'Betongarbetare', 'Brunnsborrare', 'Bygnads- och ventilationsplåtslagare', 'Civilingenjörsyrken inom bygg och anläggning', 'Golvläggare', 'Grovarbetare inom bygg och anläggning', 'Gruv- och stenbrottsarbetare', 'Ingenjör och tekniker inom bygg och anläggning', 'Isoleringsmontör', 'Kranförare', 'Kyl- och värmepumpstekniker', 'Murare', 'Målare', 'Stallningsbyggare', 'Takmontör', 'Träarbetare, snickare', 'VVS-montör', 'Övrig byggnads- och anläggningsarbetare'
      ]
    },
    { 
      value: 'management', 
      label: 'Chefer och Verksamhetsledare', 
      icon: '',
      keywords: ['chef', 'ledare', 'verksamhet', 'director', 'manager', 'vd', 'platschef', 'avdelningschef'],
      subcategories: [
        'Chef inom arkitekt- och ingenjörsverksamhet', 'Chef inom bank, finans och försäkring', 'Chef inom friskvård, sport och fritid', 'Chef inom förskolverksamhet', 'Chef inom grund- och gymnasieskola samt vuxenutbildning', 'Chef inom handel', 'Chef inom hälso- och sjukvård', 'Chef inom socialt och kurativt arbete', 'Chef inom äldreomsorg', 'Chef och ledare inom trossamfund', 'Chefstjänsteman i intresseorganisation', 'Driftchef inom bygg, anläggning och gruva', 'Ekonomi- och finanschef', 'Fastighets- och förvaltningschef', 'Forsknings- och utvecklingschef', 'Försäljnings- och marknadschef', 'Förvaltare inom skogsbruk och lantbruk', 'General-, landstings- och kommundirektör', 'Hotell- och konferenschef', 'IT-chef', 'Informations-, kommunikations- och PR-chef', 'Inköps-, logistik- och transportchef', 'Personal- och HR-chef', 'Politiker', 'Produktionschef inom tillverkning', 'Restaurang- och kökschef', 'Verkställande direktör', 'Övrig administrations- och servicechef', 'Övrig chef inom samhällsservice', 'Övrig chef inom utbildning', 'Övrig chef inom övrig servicenäring'
      ]
    },
    { 
      value: 'it', 
      label: 'Data/IT', 
      icon: '',
      keywords: ['utvecklare', 'programmerare', 'IT', 'data', 'systemadministratör', 'webb', 'mjukvara', 'frontend', 'backend', 'fullstack', 'devops', 'cybersäkerhet'],
      subcategories: [
        'Drifttekniker, IT', 'IT-säkerhetsspecialist', 'Mjukvaru- och systemutvecklare', 'Nätverks- och systemtekniker', 'Supporttekniker, IT', 'Systemadministratör', 'Systemanalytiker och IT-arkitekt', 'Systemförvaltare', 'Systemtestare och testledare', 'Utvecklare inom spel och digitala media', 'Webbmaster och webbadministratör', 'Övrig IT-specialist'
      ]
    },
    { 
      value: 'sales', 
      label: 'Försäljning, Inköp, Marknadsföring', 
      icon: '',
      keywords: ['försäljning', 'sales', 'säljare', 'account', 'marketing', 'marknadsföring', 'reklam', 'kommunikation', 'pr', 'inköp'],
      subcategories: [
        'Apotekstekniker', 'Banktjänsteman', 'Bensinstationspersonal', 'Butikssäljare, dagligvaror', 'Butikssäljare, fackhandel', 'Evenemangs- och reseproducent', 'Eventsäljare och butiksdemonistratör', 'Fastighetsmäklare', 'Företagssäljare', 'Guide och resetedare', 'Inköpare och upphandlare', 'Inköps- och orderassistent', 'Kassapersonal', 'Kundtjänstpersonal', 'Marknads- och försäljningsassistent', 'Marknadsanalytiker och marknadsförare', 'Marknadsundersökare och intervjuare', 'Optikerassistent', 'Ordersamordnare', 'Resesäljare och trafikassistent', 'Speditör och transportmäklare', 'Säljande butikschef och avdelningschef i butik', 'Telefonförsäljare', 'Torg- och marknadsförsäljare', 'Uthyrare', 'Övrig förmedlare'
      ]
    },
    { 
      value: 'crafts', 
      label: 'Hantverkyrken', 
      icon: '',
      keywords: ['hantverk', 'smed', 'keramiker', 'snickare', 'träarbete', 'metallarbete', 'bagare', 'konditor'],
      subcategories: [
        'Bagare och konditor', 'Fin-, inrednings- och möbelsnickare', 'Finmekaniker', 'Glastekniker', 'Guld- och silversmed', 'Läderhantverkare och skomakare', 'Manuell ytbehandlare, trä', 'Musikinstrumentmakare och övrig konsthantverkare', 'Skräddare och ateljésömmerska', 'Smed', 'Sömmare', 'Tapetserare'
      ]
    },
    { 
      value: 'restaurant', 
      label: 'Hotell, Restaurang, Storhushåll', 
      icon: '',
      keywords: ['kock', 'servitör', 'hotell', 'restaurang', 'storhushåll', 'bagare', 'konditor', 'hovmästare'],
      subcategories: [
        'Bartender', 'Croupier och oddssättare', 'Hotellreceptionist', 'Hovmästare och servitör', 'Kafé- och konditorbiträde', 'Kock och kallskänka', 'Köksmästare och souschef', 'Pizzabagare', 'Restaurang- och köksbiträde', 'Storhushållsföreståndare'
      ]
    },
    { 
      value: 'healthcare', 
      label: 'Hälso- och Sjukvård', 
      icon: '',
      keywords: ['sjuksköterska', 'läkare', 'vård', 'omsorg', 'tandläkare', 'fysioterapeut', 'undersköterska', 'vårdbiträde'],
      subcategories: [
        'AT-läkare', 'Ambulanssjuksköterska', 'Ambulanssjukvårdare', 'Anestesisjuksköterska', 'Apotekare', 'Arbetsterapeut', 'Audionom och logoped', 'Barnmorska', 'Barnsjuksköterska', 'Barnsköterska', 'Biomedicinsk analytiker', 'Dietist', 'Distriktssköterska', 'Djursjuksköterska', 'Fysioterapeut och sjukgymnast', 'Företagssköterska', 'Geriatriksjuksköterska', 'Grundutbildad sjuksköterska', 'Intensivvårdssjuksköterska', 'Kiropraktor och naprapat', 'Operationssjuksköterska', 'Optiker', 'Psykiatrisjuksköterska', 'Psykolog', 'Psykoterapeut', 'Receptarie', 'Röntgensjuksköterska', 'ST-läkare', 'Skolsköterska', 'Skötare', 'Specialistläkare', 'Tandhygienist', 'Tandläkare', 'Tandsköterska', 'Terapeut inom alternativmedicin', 'Undersköterska, hemsjukvård, äldreboende och habilitering', 'Undersköterska, vård- och specialavdelning och mottagning', 'Veterinär', 'Vårdbiträde', 'Övrig vård- och omsorgspersonal', 'Övrig läkare', 'Övrig specialist inom hälso- och sjukvård', 'Övrig specialistsjuksköterska'
      ]
    },
    { 
      value: 'industry', 
      label: 'Industriell Tillverkning', 
      icon: '',
      keywords: ['industri', 'tillverkning', 'produktion', 'maskinoperatör', 'kvalitet', 'process', 'tekniker'],
      subcategories: [
        'Arbetsledare inom tillverkning', 'Bergsprängare', 'Bobindare', 'Fordonsmontör', 'Gjutare', 'Handpaketerare och andra fabriksarbetare', 'Lackerare och industrimålare', 'Maskinoperatör inom ytbehandling, trä', 'Maskinoperatör, blekning, färgning och tvättning', 'Maskinoperatör, cement-, sten- och betongvaror', 'Maskinoperatör, farmaceutiska produkter', 'Maskinoperatör, gummiindustri', 'Maskinoperatör, kemisk-tekniska och fotografiska produkter', 'Maskinoperatör, kvarn-, bageri- och konfektyrindustri', 'Maskinoperatör, kött- och fiskberedningsindustri', 'Maskinoperatör, mejeri', 'Maskinoperatör, plastindustri', 'Maskinoperatör, pappersvaruindustri', 'Maskinoperatör, pappersindustri', 'Maskinoperatör, påfyllning, packning och märkning', 'Maskinställare och maskinoperatör, metallarbete', 'Maskinsnickare och maskinoperatör, träindustri', 'Montör, elektrisk och elektronisk utrustning', 'Montör, metall-, gummi- och plastprodukter', 'Montör, träprodukter', 'Operatör inom sågverk, hyvleri och plywood', 'Prepress tekniker', 'Processoperatör, papper', 'Processoperatör, pappersmassa', 'Processoperatör, stenkross- och malmförädling', 'Provsmakare och kvalitetsbedömare', 'Slaktare och styckare', 'Slipare', 'Stenhuggare', 'Stålkonstruktionsmontör och grovplåtslagare', 'Svetsare och gasskärare', 'Tryckare', 'Tunnplåtslagare', 'Valsverksoperatör', 'Verktygsmakare', 'Övrig maskin- och processoperatör vid stål- och metallverk', 'Övrig maskinoperatör, livsmedelsindustri', 'Övrig maskinoperatör, textil-, skinn- och läderindustri', 'Övrig montör', 'Övrig process- och maskinoperatör'
      ]
    },
    { 
      value: 'installation', 
      label: 'Installation, Drift, Underhåll', 
      icon: '',
      keywords: ['installation', 'drift', 'underhåll', 'reparatör', 'tekniker', 'service', 'elektriker', 'fastighet'],
      subcategories: [
        'Distributionselektriker', 'Drifttekniker vid värme- och vattenverk', 'Elektronikreaparatör och kommunikationselektriker', 'Fastighetsskötare', 'Flygmekaniker', 'Industrielektriker', 'Installations- och serviceelektriker', 'Motorfordonsmekaniker och fordonsreparatör', 'Processövervakare, kemisk industri', 'Processövervakare, metallproduktion', 'Underhållsmekaniker och maskinreparatör', 'Vaktmästare', 'Övrig drifttekniker och processövervakare', 'Övrig servicearbetare'
      ]
    },
    { 
      value: 'logistics', 
      label: 'Transport', 
      icon: '',
      keywords: ['lager', 'logistik', 'transport', 'distribution', 'chaufför', 'lastbil', 'gaffeltruck', 'leverans'],
      subcategories: [
        'Arbetsledare inom lager och terminal', 'Bangårdspersonal', 'Brevbärare och postterminalarbetare', 'Buss- och spårvagnsförare', 'Distributionschaufför', 'Fartygsbefäl', 'Flygledare', 'Hamnarbetare', 'Kabinpersonal', 'Lager- och terminalpersonal', 'Lastbilsförare', 'Lokförare', 'Maskinbefäl', 'Matros och jungman', 'Pilot', 'Ramppersonal, flyttkarl och varupåfyllare', 'Reklamutdelare och tidningsdistributör', 'Taxiförare', 'Transportledare och transportsamordnare', 'Truckförare', 'Tågvärd och ombordansvarig'
      ]
    },
    { 
      value: 'beauty', 
      label: 'Kropps- och Skönhetsvård', 
      icon: '',
      keywords: ['frisör', 'skönhet', 'massage', 'naglar', 'kosmetolog', 'fotvård', 'hudterapeut'],
      subcategories: [
        'Fotterapeut', 'Frisör', 'Hudterapeut', 'Massör och massageterapeut', 'Övrig skönhets- och kroppsterapeut'
      ]
    },
    { 
      value: 'creative', 
      label: 'Kultur, Media, Design', 
      icon: '',
      keywords: ['design', 'grafisk', 'kreativ', 'media', 'journalist', 'fotograf', 'video', 'kultur', 'konstnär', 'bibliotek'],
      subcategories: [
        'Bibliotekarie och arkivarie', 'Bild- och sändningstekniker', 'Bildkonstnär', 'Designer inom spel och digitala medier', 'Fotograf', 'Författare', 'Grafisk formgivare', 'Industridesigner', 'Inredare, dekoratör och scenograf', 'Inspicient och scriptör', 'Journalist', 'Koreograf och dansare', 'Ljus-, ljud- och scentekniker', 'Museiintendent', 'Programledare och underhållare', 'Reklamtekniker', 'Scenograf och kostymör', 'Skådespelare', 'Översättare och tolkar', 'Övrig konstnär'
      ]
    },
    { 
      value: 'agriculture', 
      label: 'Naturbruk', 
      icon: '',
      keywords: ['jordbruk', 'skogsbruk', 'lantbruk', 'djur', 'odling', 'natur', 'fiske', 'veterinär'],
      subcategories: [
        'Djuruppfödare', 'Fiskare och fiskodlare', 'Jord- och trädgårdsarbetare', 'Skogsarbetare', 'Specialistyrken inom jordbruk'
      ]
    },
    { 
      value: 'education', 
      label: 'Pedagogiskt Arbete', 
      icon: '',
      keywords: ['lärare', 'pedagog', 'utbildning', 'skola', 'förskola', 'universitet', 'undervisning'],
      subcategories: [
        'Barnskötare', 'Fritidsledare', 'Förskollärare', 'Grundskollärare', 'Gymnasielärare', 'Handledarutbildare', 'Legitimerad läkare inom utbildning', 'Professor', 'Speciallärare', 'Specialpedagog', 'Universitetslektor', 'Yrkeslärare'
      ]
    },
    { 
      value: 'security', 
      label: 'Säkerhet', 
      icon: '',
      keywords: ['säkerhet', 'ordningsvakt', 'brandman', 'räddningstjänst', 'militär', 'polis'],
      subcategories: [
        'Brandman', 'Fångvårdare och häktespersonal', 'Ordningsvakt', 'Polis', 'Räddningspersonal', 'Säkerhetskontrollant', 'Militär personal', 'Tull- och gränspolis'
      ]
    },
    { 
      value: 'social', 
      label: 'Socialt Arbete', 
      icon: '',
      keywords: ['socialarbetare', 'kurator', 'behandling', 'omsorg', 'stöd', 'rådgivning'],
      subcategories: [
        'Behandlingsassistent', 'Familjerådgivare och terapeut', 'Fritidsledare', 'Kurator', 'Socialsekreterare', 'Socionom', 'Behandlare inom kriminalvård'
      ]
    },
    { 
      value: 'science', 
      label: 'Naturvetenskap', 
      icon: '',
      keywords: ['forskning', 'vetenskap', 'labb', 'kemi', 'biologi', 'fysik', 'miljö'],
      subcategories: [
        'Analytiker', 'Biolog', 'Forskare', 'Kemist', 'Laboratorieassistent', 'Miljöspecialist', 'Kvalitetskontrollant'
      ]
    }
  ];

  const locations = [
    'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 
    'Norrköping', 'Lund', 'Umeå', 'Gävle', 'Borås', 'Eskilstuna', 'Södertälje', 'Karlstad', 'Växjö', 
    'Halmstad', 'Sundsvall', 'Luleå', 'Trollhättan', 'Östersund', 'Borlänge', 'Falun', 'Kristianstad', 
    'Kalmar', 'Karlskrona', 'Skövde', 'Uddevalla', 'Motala', 'Landskrona', 'Nyköping', 
    'Trelleborg', 'Örnsköldsvik', 'Karlskoga', 'Skellefteå', 'Mariestad', 'Sandviken', 'Ängelholm', 
    'Falkenberg', 'Ystad', 'Köping', 'Katrineholm', 'Varberg', 'Lidköping', 'Piteå', 'Kumla', 
    'Karlshamn', 'Arvika', 'Enköping', 'Tranås', 'Åmål', 'Bollnäs', 'Kiruna', 'Sala', 
    'Värnamo', 'Flen', 'Tibro', 'Markaryd', 'Kungälv', 'Kungsbacka', 'Solna'
  ];

  // Employment types for filtering - using centralized configuration
  const employmentTypes = SEARCH_EMPLOYMENT_TYPES;

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

      // Apply search filters with smart synonyms
      if (searchTerm) {
        const smartSearchConditions = createSmartSearchConditions(searchTerm);
        query = query.or(smartSearchConditions);
      }

      // Apply search filtering - prioritize company selection
      if (selectedCompany) {
        // If a specific company is selected, filter only by that company
        query = query.ilike('company_name', selectedCompany);
      } else if (searchTerm) {
        // General search across both company and job title
        query = query.or(`company_name.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%`);
      }

      // Apply subcategory filter (more specific than category)
      if (selectedSubcategories.length > 0) {
        // Fix SQL parsing issues by using proper escaping
        selectedSubcategories.forEach((subcategory, index) => {
          if (index === 0) {
            query = query.ilike('title', `%${subcategory}%`);
          }
        });
      } else if (selectedCategory && selectedCategory !== 'all-categories') {
        // Apply category filter only if no subcategory is selected
        const category = jobCategories.find(cat => cat.value === selectedCategory);
        if (category) {
          // Use individual filter operations for keywords as well
          if (category.keywords.length === 1) {
            const cleanKeyword = category.keywords[0].replace(/[%_]/g, '\\$&');
            query = query.or(`title.ilike.%${cleanKeyword}%,description.ilike.%${cleanKeyword}%`);
          } else {
            // For multiple keywords, apply them one by one
            let hasFilter = false;
            category.keywords.forEach((keyword) => {
              const cleanKeyword = keyword.replace(/[%_]/g, '\\$&');
              if (!hasFilter) {
                query = query.or(`title.ilike.%${cleanKeyword}%,description.ilike.%${cleanKeyword}%`);
                hasFilter = true;
              }
            });
          }
        }
      }

      if (selectedLocations.length > 0) {
        // Create OR conditions for all selected locations
        const locationConditions = selectedLocations.map(location => 
          `location.ilike.%${location}%`
        ).join(',');
        query = query.or(locationConditions);
      } else if (selectedLocation && selectedLocation !== 'all-locations') {
        // Apply single location filter from dropdown
        query = query.ilike('location', `%${selectedLocation}%`);
      }

      if (selectedEmploymentTypes.length > 0) {
        // Convert search labels to database codes if needed
        const employmentCodes = selectedEmploymentTypes.map(type => {
          const foundType = SEARCH_EMPLOYMENT_TYPES.find(t => t.value === type);
          return foundType?.code || type; // Use code if available, fallback to original value
        });
        query = query.in('employment_type', employmentCodes);
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
  }, [searchTerm, selectedLocations, selectedCategory, selectedSubcategories, selectedEmploymentTypes, selectedCompany]);

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
    setSelectedSubcategories([]); // Clear subcategories when selecting main category
    setSearchTerm('');
  };

  const handleSelectAllInCategory = (categoryValue: string) => {
    const category = jobCategories.find(cat => cat.value === categoryValue);
    if (category) {
      setSelectedCategory(categoryValue);
      
      // Check if all subcategories are already selected
      const allSelected = category.subcategories.every(sub => selectedSubcategories.includes(sub));
      
      if (allSelected) {
        // If all are selected, deselect all
        setSelectedSubcategories([]);
        setSelectedCategory('all-categories');
      } else {
        // If not all are selected, select all
        setSelectedSubcategories(category.subcategories);
      }
      
      setSearchTerm('');
    }
  };

  const toggleSubcategory = (category: string, subcategory: string) => {
    setSelectedCategory(category);
    
    const isCurrentlySelected = selectedSubcategories.includes(subcategory);
    if (isCurrentlySelected) {
      // Remove from selection
      setSelectedSubcategories(prev => prev.filter(s => s !== subcategory));
    } else {
      // Add to selection
      setSelectedSubcategories(prev => [...prev, subcategory]);
    }
    setSearchTerm('');
  };


  // Get suggestions for job title autocomplete with smart synonyms
  const getJobTitleSuggestions = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    
    const searchLower = searchTerm.toLowerCase().trim();
    const expandedTerms = expandSearchTerms(searchTerm);
    const suggestions: Array<{title: string, category: any}> = [];
    
    // Collect all subcategories that match the search term or its synonyms
    jobCategories.forEach(category => {
      category.subcategories.forEach(subcategory => {
        const subcategoryLower = subcategory.toLowerCase();
        
        // Check if the subcategory matches the original search term or any synonym
        const matches = expandedTerms.some(term => 
          subcategoryLower.includes(term) || term.includes(subcategoryLower)
        );
        
        if (matches || subcategoryLower.includes(searchLower)) {
          suggestions.push({
            title: subcategory,
            category: category
          });
        }
      });
      
      // Also check category keywords for matches
      if (category.keywords) {
        const keywordMatches = expandedTerms.some(term => 
          category.keywords.some(keyword => keyword.toLowerCase().includes(term))
        );
        
        if (keywordMatches) {
          // Add a few representative subcategories from this category
          category.subcategories.slice(0, 3).forEach(subcategory => {
            if (!suggestions.some(s => s.title === subcategory)) {
              suggestions.push({
                title: subcategory,
                category: category
              });
            }
          });
        }
      }
    });
    
    // Sort by relevance (exact start match first, then contains)
    return suggestions.sort((a, b) => {
      const aStarts = a.title.toLowerCase().startsWith(searchLower);
      const bStarts = b.title.toLowerCase().startsWith(searchLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return a.title.localeCompare(b.title);
    }).slice(0, 8); // Limit to 8 suggestions
  };

  // Get company suggestions from existing jobs
  const getCompanySuggestions = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    
    const searchLower = searchTerm.toLowerCase().trim();
    const companyNames = new Set<string>();
    
    // Extract unique company names from jobs that match search
    jobs.forEach(job => {
      if (job.company_name && job.company_name.toLowerCase().includes(searchLower)) {
        companyNames.add(job.company_name);
      }
    });
    
    return Array.from(companyNames)
      .sort((a, b) => {
        const aStarts = a.toLowerCase().startsWith(searchLower);
        const bStarts = b.toLowerCase().startsWith(searchLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.localeCompare(b);
      })
      .slice(0, 5) // Limit to 5 company suggestions
      .map(company => ({ name: company, jobCount: jobs.filter(j => j.company_name === company).length }));
  };

  const jobTitleSuggestions = getJobTitleSuggestions(searchTerm);
  const companySuggestions = getCompanySuggestions(searchTerm);

  return (
    <div className="max-w-7xl mx-auto space-y-4 relative smooth-scroll touch-pan" style={{ WebkitOverflowScrolling: 'touch' }}>
      
      {/* Main content */}
      {/* Hero Section */}
      <div className="text-center space-y-2 py-3">
        <h1 className="text-2xl font-bold text-white">
          Ditt nästa steg
        </h1>
        <p className="text-sm text-white/90 max-w-2xl mx-auto">
          Enkel, smart och snabb jobbsökning. Välj yrkesområde eller sök fritt - vi hjälper dig hitta rätt
        </p>
      </div>

      {/* Advanced Search - Modern & Integrated */}
      <Card className="bg-white/5 backdrop-blur-sm border-white/20">
        <CardHeader className="pb-3">
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Combined Job and Company Search */}
            <div className="space-y-2 relative z-[10000]">
              <Label htmlFor="search" className="text-xs font-medium text-white flex items-center gap-2">
                <Search className="h-3 w-3" />
                Sök
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  id="search"
                  placeholder="Sök yrke eller företag..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="pl-10 h-10 text-sm bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                
                {/* Enhanced Autocomplete with Companies */}
                {showSuggestions && (jobTitleSuggestions.length > 0 || companySuggestions.length > 0) && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700/95 backdrop-blur-md border border-white/20 rounded-lg shadow-xl z-[999999] overflow-hidden">
                    
                    {/* Company Suggestions */}
                    {companySuggestions.length > 0 && (
                      <div>
                        <div className="p-2 border-b border-white/10 text-xs text-white/70 font-medium flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          Företag
                        </div>
                        {companySuggestions.map((company, index) => (
                          <div
                            key={`company-${index}`}
                            className="flex items-center justify-between p-3 hover:bg-white/10 cursor-pointer border-b border-white/5 transition-colors"
                            onClick={() => {
                              setSearchTerm(company.name);
                              setSelectedCompany(company.name);
                              setShowSuggestions(false);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                                <Building className="h-4 w-4 text-white/50" />
                              </div>
                              <div>
                                <div className="font-medium text-sm text-white">{company.name}</div>
                                <div className="text-xs text-white/60">
                                  {company.jobCount} {company.jobCount === 1 ? 'jobb' : 'jobb'}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-white/50">Välj →</div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Job Title Suggestions */}
                    {jobTitleSuggestions.length > 0 && (
                      <div>
                        <div className="p-2 border-b border-white/10 text-xs text-white/70 font-medium flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Yrken
                        </div>
                        {jobTitleSuggestions.map((suggestion, index) => (
                          <div
                            key={`job-${index}`}
                            className="flex items-center justify-between p-3 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-b-0 transition-colors"
                            onClick={() => {
                              setSearchTerm(suggestion.title);
                              setSelectedCompany(null);
                              setShowSuggestions(false);
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                                <Briefcase className="h-4 w-4 text-white/50" />
                              </div>
                              <div>
                                <div className="font-medium text-sm text-white">{suggestion.title}</div>
                                <div className="text-xs text-white/60">
                                  {suggestion.category.label}
                                </div>
                              </div>
                            </div>
                            <div className="text-xs text-white/50">Välj →</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>
              
            </div>

            {/* Yrke Filter - Direct dropdown */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white flex items-center gap-2">
                <Briefcase className="h-3 w-3" />
                Yrkesområde
              </Label>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-10 bg-white/5 border-white/10 text-white hover:bg-white/10 justify-between text-sm"
                  >
                    <span className="truncate">
                      {selectedSubcategories.length > 0 
                        ? `${selectedSubcategories.length} valda`
                        : 'Välj yrkeso...'
                      }
                    </span>
                    <div className="flex items-center gap-2">
                      {selectedSubcategories.length > 0 && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className={`w-80 bg-slate-700/95 backdrop-blur-md border-slate-500/30 shadow-xl z-50 rounded-lg text-white ${isMobile ? 'max-h-[60vh]' : 'max-h-96'} overflow-y-auto overscroll-contain`}
                  side="bottom"
                  align="center"
                  alignOffset={0}
                  sideOffset={6}
                  avoidCollisions={false}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  {/* Clear selection option */}
                  {(selectedCategory !== 'all-categories' || selectedSubcategories.length > 0) && (
                    <>
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedCategory('all-categories');
                          setSelectedSubcategories([]);
                        }}
                        className="font-medium cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 text-red-300 border-b border-slate-600/30"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Rensa val
                      </DropdownMenuItem>
                    </>
                  )}
                  
                  {/* Job categories with subcategory dropdowns */}
                  <div className="max-h-80 overflow-y-auto">
                    {jobCategories.map((category) => (
                      <div key={category.value}>
                        <DropdownMenuItem
                          onSelect={(e) => e.preventDefault()}
                          onClick={() => {
                            if (selectedCategory === category.value) {
                              setSelectedCategory('all-categories');
                              setSelectedSubcategories([]);
                            } else {
                              setSelectedCategory(category.value);
                              setSelectedSubcategories([]);
                            }
                          }}
                          className="font-medium cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white flex items-center justify-between border-b border-slate-600/30"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{category.icon}</span>
                            <span>{category.label}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedCategory === category.value && (
                              <Check className="h-4 w-4 text-white" />
                            )}
                            {category.subcategories.some(sub => selectedSubcategories.includes(sub)) && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                        </DropdownMenuItem>
                        
                        {/* Show subcategories if category is selected or has selected subcategories */}
                        {(selectedCategory === category.value || category.subcategories.some(sub => selectedSubcategories.includes(sub))) && (
                          <div className="bg-slate-800/50 border-l-2 border-slate-600/50 ml-4">
                            <DropdownMenuItem
                              onSelect={(e) => e.preventDefault()}
                              onClick={() => {
                                if (selectedSubcategories.length === category.subcategories.length && 
                                    category.subcategories.every(sub => selectedSubcategories.includes(sub))) {
                                  // All selected, deselect all from this category
                                  setSelectedSubcategories(prev => prev.filter(sub => !category.subcategories.includes(sub)));
                                } else {
                                  // Select all from this category
                                  setSelectedSubcategories(prev => {
                                    const filtered = prev.filter(sub => !category.subcategories.includes(sub));
                                    return [...filtered, ...category.subcategories];
                                  });
                                }
                              }}
                              className="text-sm cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 text-white/90 italic"
                            >
                              <span className="ml-4">
                                {category.subcategories.every(sub => selectedSubcategories.includes(sub))
                                  ? 'Avmarkera alla'
                                  : 'Välj alla'
                                }
                              </span>
                            </DropdownMenuItem>
                            {category.subcategories.map((subcategory) => (
                              <DropdownMenuItem
                                key={subcategory}
                                onSelect={(e) => e.preventDefault()}
                                onClick={() => {
                                  const isSelected = selectedSubcategories.includes(subcategory);
                                  if (isSelected) {
                                    setSelectedSubcategories(prev => prev.filter(s => s !== subcategory));
                                  } else {
                                    setSelectedSubcategories(prev => [...prev, subcategory]);
                                    setSelectedCategory(category.value);
                                  }
                                }}
                                className="text-sm cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 text-white flex items-center justify-between"
                              >
                                <span className="ml-6">{subcategory}</span>
                                {selectedSubcategories.includes(subcategory) && (
                                  <Check className="h-4 w-4 text-white" />
                                )}
                              </DropdownMenuItem>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Multi-Select Location */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white flex items-center gap-2">
                <MapPin className="h-3 w-3" />
                Plats
              </Label>
              <div className="relative">
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full h-10 bg-white/5 border-white/10 text-white hover:bg-white/10 justify-between text-sm"
                    >
                       <span className="truncate">
                         {selectedLocations.length === 0 
                           ? 'Välj ort eller...'
                           : selectedLocations.length === 1 
                           ? selectedLocations[0]
                           : `${selectedLocations.length} valda`
                         }
                       </span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                   <DropdownMenuContent 
                     className={`w-80 bg-slate-700/95 backdrop-blur-md border-slate-500/30 shadow-xl z-[60] rounded-lg text-white ${isMobile ? 'max-h-[50vh]' : 'max-h-80'} overflow-y-auto overscroll-contain`}
                     side="bottom"
                     align="center"
                     alignOffset={0}
                     sideOffset={6}
                     avoidCollisions={false}
                     onCloseAutoFocus={(e) => e.preventDefault()}
                   >
                    {/* Search input */}
                    <div className="p-2 border-b border-slate-600/30">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/50" />
                        <Input
                          placeholder="Sök stad..."
                          value={locationSearchTerm}
                          onChange={(e) => setLocationSearchTerm(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          className="pl-10 bg-slate-600/50 border-slate-500/50 text-white placeholder:text-white/50"
                        />
                      </div>
                    </div>
                    
                    {/* Clear all button */}
                    {selectedLocations.length > 0 && (
                      <DropdownMenuItem
                        onClick={() => setSelectedLocations([])}
                        className="font-medium cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 text-red-300 border-b border-slate-600/30"
                      >
                        <X className="h-4 w-4 mr-2" />
                        Rensa alla ({selectedLocations.length})
                      </DropdownMenuItem>
                    )}
                    
                    {/* Location list */}
                    <div className="max-h-60 overflow-y-auto">
                      {locations
                        .filter(location => 
                          location.toLowerCase().includes(locationSearchTerm.toLowerCase())
                        )
                        .map((location) => (
                          <DropdownMenuItem
                            key={location}
                            onClick={() => {
                              const isSelected = selectedLocations.includes(location);
                              if (isSelected) {
                                setSelectedLocations(prev => prev.filter(l => l !== location));
                              } else {
                                setSelectedLocations(prev => [...prev, location]);
                              }
                            }}
                            className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 text-white flex items-center justify-between"
                          >
                            <span>{location}</span>
                            {selectedLocations.includes(location) && (
                              <Check className="h-4 w-4 text-white" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      
                      {locations.filter(location => 
                        location.toLowerCase().includes(locationSearchTerm.toLowerCase())
                      ).length === 0 && (
                        <div className="p-4 text-center text-white/50">
                          Ingen stad hittades för "{locationSearchTerm}"
                        </div>
                      )}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              {/* Selected locations preview */}
              {selectedLocations.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedLocations.slice(0, 3).map((location) => (
                    <Badge key={location} variant="secondary" className="text-xs bg-white/10 text-white border-white/20">
                      {location}
                    </Badge>
                  ))}
                  {selectedLocations.length > 3 && (
                    <Badge variant="secondary" className="text-xs bg-white/10 text-white border-white/20">
                      +{selectedLocations.length - 3} till
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Employment Type */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-white flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Anställning
              </Label>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-10 bg-white/5 border-white/10 text-white hover:bg-white/10 justify-between text-sm"
                  >
                    <span className="truncate">
                      {selectedEmploymentTypes.length === 0 
                        ? 'Alla typer' 
                        : selectedEmploymentTypes.length === 1 
                          ? employmentTypes.find(type => type.value === selectedEmploymentTypes[0])?.label 
                          : `${selectedEmploymentTypes.length} valda`
                      }
                    </span>
                    <ChevronDown className="h-4 w-4 flex-shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className={`w-72 bg-slate-700/95 backdrop-blur-md border-slate-500/30 shadow-xl z-50 rounded-lg text-white ${isMobile ? 'max-h-[45vh]' : 'max-h-80'} overflow-y-auto overscroll-contain`}
                  style={{ 
                    WebkitOverflowScrolling: 'touch',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#64748b #334155'
                  }}
                  side="top"
                  align="center"
                  alignOffset={0}
                  sideOffset={6}
                  avoidCollisions={false}
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <DropdownMenuItem
                    onClick={() => setSelectedEmploymentTypes([])}
                    className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white flex items-center justify-between"
                  >
                    <span>Alla typer</span>
                    {selectedEmploymentTypes.length === 0 && (
                      <Check className="h-4 w-4 text-white" />
                    )}
                  </DropdownMenuItem>
                  {employmentTypes.map((type) => {
                    const isSelected = selectedEmploymentTypes.includes(type.value);
                    return (
                      <DropdownMenuItem
                        key={type.value}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedEmploymentTypes(prev => prev.filter(t => t !== type.value));
                          } else {
                            setSelectedEmploymentTypes(prev => [...prev, type.value]);
                          }
                        }}
                        className="cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-3 text-white flex items-center justify-between"
                      >
                        <span>{type.label}</span>
                        {isSelected && (
                          <Check className="h-4 w-4 text-white" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              
              {/* Selected employment types preview */}
              {selectedEmploymentTypes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedEmploymentTypes.slice(0, 3).map((typeValue) => {
                    const typeLabel = employmentTypes.find(t => t.value === typeValue)?.label || typeValue;
                    return (
                      <Badge 
                        key={typeValue} 
                        variant="secondary" 
                        className="text-xs bg-white/10 text-white border-white/20 gap-2 hover:bg-white/20 cursor-pointer" 
                        onClick={() => {
                          setSelectedEmploymentTypes(prev => prev.filter(t => t !== typeValue));
                        }}
                      >
                        <span>{typeLabel}</span>
                        <X className="h-3 w-3" />
                      </Badge>
                    );
                  })}
                  {selectedEmploymentTypes.length > 3 && (
                    <Badge variant="secondary" className="text-xs bg-white/10 text-white border-white/20">
                      +{selectedEmploymentTypes.length - 3} till
                    </Badge>
                  )}
                </div>
              )}
               
              {/* Moved clear all filters button to after categories */}
            </div>
          </div>

          {/* Selected Job Categories - Fixed position section */}
          {selectedSubcategories.length > 0 && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex flex-wrap gap-2">
                {selectedSubcategories.map((subcategory) => (
                  <Badge key={subcategory} variant="secondary" className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20">
                    <span className="text-xs">{subcategory}</span>
                    <button 
                      onClick={() => {
                        const newSubcategories = selectedSubcategories.filter(s => s !== subcategory);
                        setSelectedSubcategories(newSubcategories);
                        // Reset category if no subcategories left
                        if (newSubcategories.length === 0) {
                          setSelectedCategory('all-categories');
                        }
                      }}
                      className="ml-1 hover:bg-white/20 rounded p-0.5"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Clear all filters button - moved here to come after all selections */}
          {(searchTerm || selectedLocation !== 'all-locations' || selectedLocations.length > 0 || selectedCategory !== 'all-categories' || selectedSubcategories.length > 0 || selectedEmploymentTypes.length > 0 || selectedCompany) && (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                    setSearchTerm('');
                    setSelectedLocation('all-locations');
                    setSelectedCompany(null);
                    setSelectedLocations([]);
                    setSelectedCategory('all-categories');
                    setSelectedSubcategories([]);
                    setSelectedEmploymentTypes([]);
                  }}
                className="text-white/70 hover:text-white hover:bg-white/10 border border-white/20"
              >
                <X className="h-4 w-4 mr-1" />
                Rensa alla
              </Button>
            </div>
          )}

          {/* Results Summary */}
          <div className={`flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-white/10 ${jobs.length === 0 ? 'justify-center' : 'justify-between'}`}>
            <div className={`flex items-center gap-2 flex-wrap ${jobs.length === 0 ? 'justify-center text-center mx-auto' : ''}`}>
              <span className="text-xl font-bold text-white">{jobs.length}</span>
              <span className="text-sm text-white">jobb hittades</span>
              {(searchTerm || selectedLocations.length > 0 || selectedCategory !== 'all-categories' || selectedSubcategories.length > 0 || selectedEmploymentTypes.length > 0) && (
                <>
                  <span className="text-white/70">•</span>
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    Filtrerade resultat
                  </Badge>
                </>
              )}
            </div>
            
            {jobs.length > 0 && (
              <Button
                variant="outline"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                onClick={() => {
                  // Scroll to results or trigger some action
                  const resultsSection = document.querySelector('[data-results]');
                  if (resultsSection) {
                    resultsSection.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                Se alla jobb →
              </Button>
            )}
          </div>
          
          {/* No jobs found helper text and actions */}
          {jobs.length === 0 && (
            <div className="text-center -mt-4 sm:-mt-2">
              <p className="text-white max-w-md mx-auto text-sm">
                Inga jobb matchade dina sökkriterier Prova att ändra dina filter eller sökord
              </p>
              <div className="pt-3">
                <Button 
                  variant="outline"
                  className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedLocations([]);
                    setSelectedCategory('all-categories');
                    setSelectedSubcategories([]);
                    setSelectedEmploymentTypes([]);
                    setSelectedCompany(null);
                  }}
                >
                  Visa alla jobb
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Removed collapsible job categories section - now handled in dropdown above */}

      {/* Results Section */}
      <div className="space-y-4 max-w-4xl mx-auto" data-results>
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              <p className="text-sm text-white/70">Söker bland tusentals jobb...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Job Cards */}
            <div className="grid gap-4">
              {jobs.map((job) => (
                <Card key={job.id} className="group bg-white/5 backdrop-blur-sm border-white/20 hover:bg-white/10 transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Job Header */}
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-white group-hover:text-white/90 transition-colors">
                            {job.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 text-white text-sm">
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {job.profiles?.company_name || 'Okänt företag'}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {job.location}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {getEmploymentTypeLabel(job.employment_type)}
                            </div>
                          </div>
                        </div>
                        
                        {/* Job Description */}
                        <p className="text-white text-sm leading-relaxed">
                          {job.description.length > 150 
                            ? `${job.description.substring(0, 150)}...` 
                            : job.description
                          }
                        </p>
                        
                        {/* Job Footer */}
                        <div className="flex items-center gap-3 pt-2 border-t border-white/10">
                          <Badge variant="outline" className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                            {formatSalary(job.salary_min, job.salary_max)}
                          </Badge>
                          <span className="text-xs text-white">
                            {new Date(job.created_at).toLocaleDateString('sv-SE', {
                              day: 'numeric',
                              month: 'short'
                            })}
                          </span>
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2">
                        <Button size="sm" className="h-8 px-3 text-xs">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Ansök nu
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-white/5 border-white/20 hover:bg-white/10">
                          <Heart className="h-3 w-3" />
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
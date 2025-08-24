import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MapPin, Clock, Building, Filter, Heart, ExternalLink, X, ChevronDown, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { createSmartSearchConditions, expandSearchTerms } from '@/lib/smartSearch';
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
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [locationSearchTerm, setLocationSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all-categories');
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedEmploymentType, setSelectedEmploymentType] = useState('all-types');
  const isMobile = useIsMobile();
  const dropdownAlignOffset = 0;

  // Job categories with subcategories - based on AF structure
  const jobCategories = [
    { 
      value: 'administration', 
      label: 'Administration, Ekonomi, Juridik',
      icon: '',
      keywords: ['administration', 'ekonomi', 'redovisning', 'controller', 'assistent', 'sekreterare', 'koordinator', 'projektledare', 'juridik', 'advokat'],
      subcategories: [
        'Advokater',
        'Affärs- och företagsjurister',
        'Arbetsmärke',
        'Arkivvård- och biblioteksassistenter m.fl.',
        'Arkiv- och biblioteksassistenter m.fl.',
        'Backofficespecialister m.fl.',
        'Chefssekreterare och VD-assistenter m.fl.',
        'Controller',
        'Domare',
        'Domstols- och juristsekreterare m.fl.',
        'Ekonomiassistenter m.fl.',
        'Finansanalytiker och investeringsrådgivare m.fl.',
        'Försäkringssäljare och försäkringsrådgivare',
        'Förvaltnings- och organisationsjurister',
        'Gruppledare för kontorspersonal',
        'Informatörer, kommunikatörer och PR-specialister',
        'Inkasserare och pantlånare m.fl.',
        'Kontorsreceptionister',
        'Lednings- och organisationsutvecklare',
        'Medicinska sekreterare, vårdadministratörer m.fl.',
        'Mäklare inom finans',
        'Nationalekonomer och makroanalytiker m.fl.',
        'Personal- och HR-specialister',
        'Planerade och utredare m.fl.',
        'Redovisningsekonomer',
        'Revisorer m.fl.',
        'Skadereglerare och värderare',
        'Skatthandläggare',
        'Socialförsäkringshandläggare',
        'Statistiker',
        'Telefonister',
        'Traders och fondförvaltare',
        'Åklagare',
        'Övriga ekonomer',
        'Övriga handläggare',
        'Övriga jurister',
        'Övriga kontorsassistenter och sekreterare'
      ]
    },
    { 
      value: 'construction', 
      label: 'Bygg och Anläggning', 
      icon: '',
      keywords: ['bygg', 'snickare', 'elektriker', 'anläggning', 'murare', 'målare', 'byggledare', 'platschef', 'vvs'],
      subcategories: [
        'Anläggningsarbetare',
        'Anläggningsdykare',
        'Anläggningsmaskinförare m.fl.',
        'Arbetsledare inom bygg, anläggning och gruva',
        'Betongarbetare',
        'Brunnsborrare m.fl.',
        'Bygnads- och ventilationsplåtslagare',
        'Civilingenjörsyrken inom bygg och anläggning',
        'Golvläggare',
        'Grovarbetare inom bygg och anläggning',
        'Gruv- och stenbrottsarbetare',
        'Ingenjörer och tekniker inom bygg och anläggning',
        'Isoleringsmontörer',
        'Kranförare m.fl.',
        'Kyl- och värmepumpstekniker m.fl.',
        'Murare m.fl.',
        'Målare',
        'Stallningsbyggare',
        'Takmontörer',
        'Träarbetare, snickare m.fl.',
        'VVS-montörer m.fl.',
        'Övriga byggnads- och anläggningsarbetare'
      ]
    },
    { 
      value: 'management', 
      label: 'Chefer och Verksamhetsledare', 
      icon: '',
      keywords: ['chef', 'ledare', 'verksamhet', 'director', 'manager', 'vd', 'platschef', 'avdelningschef'],
      subcategories: [
        'Chefer inom arkitekt- och ingenjörsverksamhet',
        'Chefer inom bank, finans och försäkring',
        'Chefer inom friskvård, sport och fritid',
        'Chefer inom förskolverksamhet',
        'Chefer inom grund- och gymnasieskola samt vuxenutbildning',
        'Chefer inom handel',
        'Chefer inom hälso- och sjukvård',
        'Chefer inom socialt och kurativt arbete',
        'Chefer inom äldreomsorg',
        'Chefer och ledare inom trossamfund',
        'Chefstjänstemän i intresseorganisationer',
        'Driftchefer inom bygg, anläggning och gruva',
        'Ekonomi- och finanschefer',
        'Fastighets- och förvaltningschefer',
        'Forsknings- och utvecklingschefer',
        'Försäljnings- och marknadschefer',
        'Förvaltare inom skogsbruk och lantbruk m.fl.',
        'General-, landstings- och kommundirektörer m.fl.',
        'Hotell- och konferenschefer',
        'IT-chefer',
        'Informations-, kommunikations- och PR-chefer',
        'Inköps-, logistik- och transportchefer',
        'Personal- och HR-chefer',
        'Politiker',
        'Produktionschefer inom tillverkning',
        'Restaurang- och kökchefer',
        'Verkställande direktörer m.fl.',
        'Övriga administrations- och servicechefer',
        'Övriga chefer inom samhällsservice',
        'Övriga chefer inom utbildning',
        'Övriga chefer inom övrig servicenäring'
      ]
    },
    { 
      value: 'it', 
      label: 'Data/IT', 
      icon: '',
      keywords: ['utvecklare', 'programmerare', 'IT', 'data', 'systemadministratör', 'webb', 'mjukvara', 'frontend', 'backend', 'fullstack', 'devops', 'cybersäkerhet'],
      subcategories: [
        'Drifttekniker, IT',
        'IT-säkerhetsspecialister',
        'Mjukvaru- och systemutvecklare m.fl.',
        'Nätverks- och systemtekniker m.fl.',
        'Supporttekniker, IT',
        'Systemadministratörer',
        'Systemanalytiker och IT-arkitekter m.fl.',
        'Systemförvaltare m.fl.',
        'Systemtestare och testledare',
        'Utvecklare inom spel och digitala media',
        'Webbmaster och webbadministratörer',
        'Övriga IT-specialister'
      ]
    },
    { 
      value: 'sales', 
      label: 'Försäljning, Inköp, Marknadsföring', 
      icon: '',
      keywords: ['försäljning', 'sales', 'säljare', 'account', 'marketing', 'marknadsföring', 'reklam', 'kommunikation', 'pr', 'inköp'],
      subcategories: [
        'Apotekstekniker',
        'Banktjänstemän',
        'Bensinstationspersonal',
        'Butikssäljare, dagligvaror',
        'Butikssäljare, fackhandel',
        'Evenemangs- och reseproducenter m.fl.',
        'Eventsäljare och butiksdemonistratörer m.fl.',
        'Fastighetsmäklare',
        'Företagssäljare',
        'Guider och resetedare',
        'Inköpare och upphandlare',
        'Inköps- och orderassistenter',
        'Kassapersonal m.fl.',
        'Kundtjänstpersonal',
        'Marknads- och försäljningsassistenter',
        'Marknadsanalytiker och marknadsförare m.fl.',
        'Marknadsundersökare och intervjuare',
        'Optikerassistenter',
        'Ordersamordnare m.fl.',
        'Resesäljare och trafikassistenter m.fl.',
        'Speditörer och transportmäklare',
        'Säljande butikschefer och avdelningschefer i butik',
        'Telefonförsäljare m.fl.',
        'Torg- och marknadsförsäljare m.fl.',
        'Uthyrare',
        'Övriga förmedlare'
      ]
    },
    { 
      value: 'crafts', 
      label: 'Hantverkyrken', 
      icon: '',
      keywords: ['hantverk', 'smed', 'keramiker', 'snickare', 'träarbete', 'metallarbete', 'bagare', 'konditor'],
      subcategories: [
        'Bagare och konditorer',
        'Fin-, inrednings- och möbelsnickare',
        'Finmekaniker',
        'Glastekniker',
        'Guld- och silversmeder',
        'Läderhantverkare och skomakare',
        'Manuella ytbehandlare, trä',
        'Musikinstrumentmakare och övriga konsthantverkare',
        'Skräddare och ateljésömmerskor m.fl.',
        'Smeder',
        'Sömmare',
        'Tapetserare'
      ]
    },
    { 
      value: 'restaurant', 
      label: 'Hotell, Restaurang, Storhushåll', 
      icon: '',
      keywords: ['kock', 'servitör', 'hotell', 'restaurang', 'storhushåll', 'bagare', 'konditor', 'hovmästare'],
      subcategories: [
        'Bartenders',
        'Croupierer och oddssättare m.fl.',
        'Hotellreceptionister m.fl.',
        'Hovmästare och servitörer',
        'Kafé- och konditorbiträden',
        'Kockar och kallskänkor',
        'Köksmästare och souschefer',
        'Pizzabagare m.fl.',
        'Restaurang- och köksbiträden m.fl.',
        'Storhushållsföreståndare'
      ]
    },
    { 
      value: 'healthcare', 
      label: 'Hälso- och Sjukvård', 
      icon: '',
      keywords: ['sjuksköterska', 'läkare', 'vård', 'omsorg', 'tandläkare', 'fysioterapeut', 'undersköterska', 'vårdbiträde'],
      subcategories: [
        'AT-läkare',
        'Ambulanssjuksköterskor m.fl.',
        'Ambulanssjukvårdare',
        'Anestesisjuksköterskor',
        'Apotekare',
        'Arbetsterapeuter',
        'Audionomer och logopeder',
        'Barnmorskor',
        'Barnsjuksköterskor',
        'Barnsköterskor',
        'Biomedicinska analytiker m.fl.',
        'Dietister',
        'Distriktssköterskor',
        'Djursjuksköterskor m.fl.',
        'Fysioterapeuter och sjukgymnaster',
        'Företagssköterskor',
        'Geriatriksjuksköterskor',
        'Grundutbildade sjuksköterskor',
        'Intensivvårdssjuksköterskor',
        'Kiropraktorer och naprapater m.fl.',
        'Operationssjuksköterskor',
        'Optiker',
        'Psykiatrisjuksköterskor',
        'Psykologer',
        'Psykoterapeuter',
        'Receptarier',
        'Röntgensjuksköterskor',
        'ST-läkare',
        'Skolsköterskor',
        'Skötare',
        'Specialistläkare',
        'Tandhygienister',
        'Tandläkare',
        'Tandsköterskor',
        'Terapeuter inom alternativmedicin',
        'Undersköterskor, hemsjukvård, äldreboende och habilitering',
        'Undersköterskor, vård- och specialavdelning och mottagning',
        'Veterinärer',
        'Vårdbiträden',
        'Övrig vård- och omsorgspersonal',
        'Övriga läkare',
        'Övriga specialister inom hälso- och sjukvård',
        'Övriga specialistsjuksköterskor'
      ]
    },
    { 
      value: 'industry', 
      label: 'Industriell Tillverkning', 
      icon: '',
      keywords: ['industri', 'tillverkning', 'produktion', 'maskinoperatör', 'kvalitet', 'process', 'tekniker'],
      subcategories: [
        'Arbetsledare inom tillverkning',
        'Bergsprängare',
        'Bobindare m.fl.',
        'Fordonsmontörer',
        'Gjutare',
        'Handpaketerare och andra fabriksarbetare',
        'Lackerare och industrimålare',
        'Maskinoperatörer inom ytbehandling, trä',
        'Maskinoperatörer, blekning, färgning och tvättning',
        'Maskinoperatörer, cement-, sten- och betongvaror',
        'Maskinoperatörer, farmaceutiska produkter',
        'Maskinoperatörer, gummiindustri',
        'Maskinoperatörer, kemisktekniska och fotografiska produkter',
        'Maskinoperatörer, kvarn-, bageri- och konfektyrindustri',
        'Maskinoperatörer, kött- och fiskberedningsindustri',
        'Maskinoperatörer, mejeri',
        'Maskinoperatörer, plastindustri',
        'Maskinoperatörer, pappersvaruindustri',
        'Maskinoperatörer, pappersindustri',
        'Maskinoperatörer, påfyllning, packning och märkning',
        'Maskinoperatörer, ytbehandling, trä',
        'Maskinställare och maskinoperatörer, metallarbete',
        'Maskinsnickare och maskinoperatörer, träindustri',
        'Montörer, elektrisk och elektronisk utrustning',
        'Montörer, metall-, gummi- och plastprodukter',
        'Montörer, träprodukter',
        'Operatörer inom sågverk, hyvleri och plywood m.m.',
        'Prepress tekniker',
        'Processoperatörer, papper',
        'Processoperatörer, pappersmassa',
        'Processoperatörer, stenkross- och malmförädling',
        'Provsmakare och kvalitetsbedömare',
        'Slaktare och styckare m.fl.',
        'Slipare m.fl.',
        'Stenhuggare m.fl.',
        'Stålkonstruktionsmontörer och grovplåtslagare',
        'Svetsare och gasskärare',
        'Tryckare',
        'Tunnplåtslagare',
        'Valsverksoperatörer',
        'Verktygsmakare',
        'Övriga maskin- och processoperatörer vid stål- och metallverk',
        'Övriga maskinoperatörer, livsmedelsindustri m.m.',
        'Övriga maskinoperatörer, textil-, skinn- och läderindustri',
        'Övriga montörer',
        'Övriga process- och maskinoperatörer'
      ]
    },
    { 
      value: 'installation', 
      label: 'Installation, Drift, Underhåll', 
      icon: '',
      keywords: ['installation', 'drift', 'underhåll', 'reparatör', 'tekniker', 'service', 'elektriker', 'fastighet'],
      subcategories: [
        'Distributionselektriker',
        'Drifttekniker vid värme- och vattenverk',
        'Elektronikreparatörer och kommunikationselektriker m.fl.',
        'Fastighetsskötare',
        'Flygmekaniker m.fl.',
        'Industrielektriker',
        'Installations- och serviceelektriker',
        'Motorfordonsmekaniker och fordonsreparatörer',
        'Processövervakare, kemisk industri',
        'Processövervakare, metallproduktion',
        'Underhållsmekaniker och maskinreparatörer',
        'Vaktmästare m.fl.',
        'Övriga drifttekniker och processövervakare',
        'Övriga servicearbetare'
      ]
    },
    { 
      value: 'logistics', 
      label: 'Transport', 
      icon: '',
      keywords: ['lager', 'logistik', 'transport', 'distribution', 'chaufför', 'lastbil', 'gaffeltruck', 'leverans'],
      subcategories: [
        'Arbetsledare inom lager och terminal',
        'Bangårdspersonal', 
        'Brevbärare och postterminalarbetare',
        'Buss- och spårvagnsförare',
        'Distributionschaufför',
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
      label: 'Kropps- och Skönhetsvård', 
      icon: '',
      keywords: ['frisör', 'skönhet', 'massage', 'naglar', 'kosmetolog', 'fotvård', 'hudterapeut'],
      subcategories: [
        'Fotterapeuter',
        'Frisörer',
        'Hudterapeuter',
        'Massörer och massageterapeuter',
        'Övriga skönhets- och kroppsterapeuter'
      ]
    },
    { 
      value: 'creative', 
      label: 'Kultur, Media, Design', 
      icon: '',
      keywords: ['design', 'grafisk', 'kreativ', 'media', 'journalist', 'fotograf', 'video', 'kultur', 'konstnär', 'bibliotek'],
      subcategories: [
        'Bibliotekarier och arkivarier',
        'Bild- och sandningstekniker',
        'Bildkonstnärer m.fl.',
        'Designer inom spel och digitala medier',
        'Fotografer',
        'Författare m.fl.',
        'Grafiska formgivare m.fl.',
        'Industridesigner',
        'Inredare, dekoratörer och scenografer m.fl.',
        'Inspicienter och scriptör m.fl.',
        'Journalister m.fl.',
        'Koreografer och dansare',
        'Ljus-, ljud- och scentekniker',
        'Museiintendenter m.fl.',
        'Musiker, sångare och kompositörer',
        'Regissörer och producenter av film, teater m.m.',
        'Skådespelare',
        'Översättare, tolkar och lingvister m.fl.',
        'Övriga designer och formgivare',
        'Övriga yrken inom kultur och underhållning'
      ]
    },
    { 
      value: 'military', 
      label: 'Militärt Arbete', 
      icon: '',
      keywords: ['militär', 'försvar', 'soldat', 'officer', 'specialistofficerare'],
      subcategories: [
        'Officerare',
        'Soldater m.fl.',
        'Specialistofficerare'
      ]
    },
    { 
      value: 'agriculture', 
      label: 'Naturbruk', 
      icon: '',
      keywords: ['lantbruk', 'jordbruk', 'skog', 'djur', 'trädgård', 'fiske', 'skogsarbete'],
      subcategories: [
        'Bärplockare och plantörer m.fl.',
        'Fiskare',
        'Fiskodlare',
        'Förare av jordbruks- och skogsmaskiner',
        'Odlare av jordbruksväxter, frukt och bär',
        'Skogsarbetare',
        'Specialister och rådgivare inom lantbruk m.m.',
        'Specialister och rådgivare inom skogsbruk',
        'Trädgårdsanläggare m.fl.',
        'Trädgårdsodlare',
        'Uppfödare och skötare av lantbrukets husdjur',
        'Uppfödare och skötare av sällskapsdjur',
        'Växtodlare och djuruppfödare, blandad drift',
        'Övriga djuruppfödare och djurskötare'
      ]
    },
    { 
      value: 'science', 
      label: 'Naturvetenskapligt Arbete', 
      icon: '',
      keywords: ['forskning', 'vetenskap', 'laboratorium', 'kemi', 'biologi', 'fysik', 'matematik'],
      subcategories: [
        'Cell- och molekylärbiologer m.fl.',
        'Farmakologer och biomedicinare',
        'Fysiker och astronomer',
        'Geologer och geofysiker m.fl.',
        'Kemister',
        'Matematiker och aktuarier',
        'Meteorologer',
        'Miljö- och hälsoskyddsinspektörer',
        'Specialister inom miljöskydd och miljöteknik',
        'Växt- och djurbiologer'
      ]
    },
    { 
      value: 'education', 
      label: 'Pedagogiskt Arbete', 
      icon: '',
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
      label: 'Sanering och Renhållning', 
      icon: '',
      keywords: ['städ', 'rengöring', 'sanering', 'renhållning', 'lokalvård', 'skorstensfejare'],
      subcategories: [
        'Bilrekonditionerare, fönsterputsare m.fl.',
        'Renhållnings- och återvinningsarbetare',
        'Renhållningschaufför',
        'Saneringsarbetare m.fl.',
        'Skorstensfjejare',
        'Städare',
        'Städledare och husfruar',
        'Övrig hemservicepersonal m.fl.'
      ]
    },
    { 
      value: 'social', 
      label: 'Socialt Arbete', 
      icon: '',
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
      icon: '',
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
      label: 'Tekniskt Arbete', 
      icon: '',
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
    'Stockholm', 'Göteborg', 'Malmö', 'Uppsala', 'Västerås', 'Örebro', 'Linköping', 'Helsingborg', 'Jönköping', 
    'Norrköping', 'Lund', 'Umeå', 'Gävle', 'Borås', 'Eskilstuna', 'Södertälje', 'Karlstad', 'Växjö', 
    'Halmstad', 'Sundsvall', 'Luleå', 'Trollhättan', 'Östersund', 'Borlänge', 'Falun', 'Kristianstad', 
    'Kalmar', 'Karlskrona', 'Skövde', 'Uddevalla', 'Motala', 'Landskrona', 'Nyköping', 
    'Trelleborg', 'Örnsköldsvik', 'Karlskoga', 'Skellefteå', 'Mariestad', 'Sandviken', 'Ängelholm', 
    'Falkenberg', 'Ystad', 'Köping', 'Katrineholm', 'Varberg', 'Lidköping', 'Piteå', 'Kumla', 
    'Karlshamn', 'Arvika', 'Enköping', 'Tranås', 'Åmål', 'Bollnäs', 'Kiruna', 'Sala', 
    'Värnamo', 'Flen', 'Tibro', 'Markaryd', 'Kungälv', 'Kungsbacka', 'Solna'
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

      // Apply search filters with smart synonyms
      if (searchTerm) {
        const smartSearchConditions = createSmartSearchConditions(searchTerm);
        query = query.or(smartSearchConditions);
      }

      // Apply job title search
      if (jobTitleSearch) {
        query = query.ilike('title', `%${jobTitleSearch}%`);
      }

      // Apply subcategory filter (more specific than category)
      if (selectedSubcategories.length > 0) {
        // Create OR conditions for all selected subcategories
        const subcategoryConditions = selectedSubcategories.map(subcategory => 
          `title.ilike.%${subcategory}%`
        ).join(',');
        query = query.or(subcategoryConditions);
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

      if (selectedLocations.length > 0) {
        // Create OR conditions for all selected locations
        const locationConditions = selectedLocations.map(location => 
          `location.ilike.%${location}%`
        ).join(',');
        query = query.or(locationConditions);
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
  }, [searchTerm, jobTitleSearch, selectedLocations, selectedCategory, selectedSubcategories, selectedEmploymentType]);

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

  // New function to find matching category and subcategory for a job title search
  const findMatchingRole = (searchTitle: string) => {
    if (!searchTitle.trim()) return null;
    
    const searchLower = searchTitle.toLowerCase().trim();
    
    // FIRST: Try exact matches (highest priority)
    for (const category of jobCategories) {
      for (const subcategory of category.subcategories) {
        const subcategoryLower = subcategory.toLowerCase();
        
        // Exact match
        if (subcategoryLower === searchLower) {
          console.log('🎯 Exact match found:', subcategory);
          return {
            category: category,
            subcategory: subcategory,
            matchType: 'subcategory'
          };
        }
      }
    }
    
    // SECOND: Try close matches (contains, but prefer longer matches)
    let bestMatch = null;
    let bestScore = 0;
    
    for (const category of jobCategories) {
      for (const subcategory of category.subcategories) {
        const subcategoryLower = subcategory.toLowerCase();
        
        // Calculate match score (longer overlaps get higher scores)
        let score = 0;
        if (subcategoryLower.includes(searchLower)) {
          score = searchLower.length; // Full search term found
        } else if (searchLower.includes(subcategoryLower.replace(/\s*m\.fl\.$/, ''))) {
          score = subcategoryLower.replace(/\s*m\.fl\.$/, '').length; // Subcategory name found
        }
        
        if (score > bestScore) {
          bestScore = score;
          bestMatch = {
            category: category,
            subcategory: subcategory,
            matchType: 'subcategory'
          };
        }
      }
    }
    
    if (bestMatch) {
      console.log('🎯 Best contains match found:', bestMatch.subcategory, 'score:', bestScore);
      return bestMatch;
    }
    
    // THIRD: Try fuzzy matching and keywords (lowest priority)
    for (const category of jobCategories) {
      // Check keywords first
      for (const keyword of category.keywords) {
        const keywordLower = keyword.toLowerCase();
        if (
          keywordLower.includes(searchLower) || 
          searchLower.includes(keywordLower)
        ) {
          console.log('🎯 Keyword match found:', category.label);
          return {
            category: category,
            subcategory: null,
            matchType: 'keyword'
          };
        }
      }
    }
    
    return null;
  };

  // Simple Levenshtein distance function for fuzzy matching
  const levenshteinDistance = (str1: string, str2: string): number => {
    if (str1.length < str2.length) [str1, str2] = [str2, str1];
    if (str2.length === 0) return str1.length;
    
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  };

  // Get the matching role for current job title search
  const matchingRole = findMatchingRole(jobTitleSearch);
  
  // Debug logging
  console.log('🔍 Debug - jobTitleSearch:', jobTitleSearch);
  console.log('🔍 Debug - matchingRole:', matchingRole);
  
  // Let's also check if "Renhållningschaufför" exists in our categories
  const cleaningCategory = jobCategories.find(cat => cat.value === 'cleaning');
  console.log('🔍 Debug - cleaning category subcategories:', cleaningCategory?.subcategories);

  // Auto-apply matching role to filters when a match is found
  const handleAutoApplyRole = () => {
    if (matchingRole) {
      setSelectedCategory(matchingRole.category.value);
      if (matchingRole.subcategory) {
        setSelectedSubcategories([matchingRole.subcategory]);
      }
      setJobTitleSearch(''); // Clear the search since we're now using category filters
    }
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

  const jobTitleSuggestions = getJobTitleSuggestions(jobTitleSearch);
  const [showSuggestions, setShowSuggestions] = useState(false);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl font-extrabold text-white">
          Hitta ditt nästa steg
        </h1>
        <p className="text-xl text-white/90 max-w-2xl mx-auto">
          Enkel, smart och snabb jobbsökning. Välj kategori eller sök fritt - vi hjälper dig hitta rätt.
        </p>
      </div>

      {/* Smart Category Grid */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20 shadow-lg">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-2xl text-white">Välj yrkesområde</CardTitle>
          <CardDescription className="text-lg text-white">
            Klicka på ett område för att se alla lediga jobb
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {jobCategories.map((category) => (
              <DropdownMenu key={category.value}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="lg"
                    className={`relative h-auto min-h-[80px] sm:h-20 flex flex-col items-center gap-1 sm:gap-2 p-3 sm:p-4 transition-all duration-200 hover:scale-105 bg-white/10 backdrop-blur-sm border border-white/30 text-white hover:bg-white/20 ${
                      selectedCategory === category.value 
                        ? 'shadow-lg border-white/50 bg-white/20' 
                        : 'hover:shadow-md hover:border-white/50'
                    }`}
                  >
                    {/* Selection indicator */}
                    {category.subcategories.some(sub => selectedSubcategories.includes(sub)) && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-slate-700 rounded-full"></div>
                      </div>
                    )}
                    <span className="text-xl sm:text-2xl">{category.icon}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs sm:text-sm font-medium text-center leading-tight px-1">
                        {category.label}
                      </span>
                      <ChevronDown className="h-3 w-3 flex-shrink-0" />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  className="w-64 max-h-80 overflow-y-auto bg-slate-700/90 backdrop-blur-md border-slate-500/30 shadow-xl z-50 rounded-lg text-white"
                  side="bottom"
                  align="start"
                  alignOffset={-28}
                  sideOffset={6}
                  avoidCollisions={false}
                >
                  <DropdownMenuItem
                    onClick={() => handleSelectAllInCategory(category.value)}
                    className="font-medium cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 text-white"
                  >
                    Allt inom {category.label}
                  </DropdownMenuItem>
                  <Separator className="my-1 bg-slate-600/30" />
                  <div className="max-h-60 overflow-y-auto scrollbar-thin">
                    {category.subcategories.map((subcategory) => (
                      <DropdownMenuItem
                        key={subcategory}
                        onClick={() => toggleSubcategory(category.value, subcategory)}
                        className="text-sm cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 py-2 text-white flex items-center justify-between"
                      >
                        <span>{subcategory}</span>
                        {selectedSubcategories.includes(subcategory) && (
                          <Check className="h-4 w-4 text-white" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Advanced Search - Modern & Integrated */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-white">
              <Filter className="h-5 w-5" />
              Avancerad sökning
            </CardTitle>
            {(searchTerm || jobTitleSearch || selectedLocation !== 'all-locations' || selectedCategory !== 'all-categories' || selectedSubcategories.length > 0 || selectedEmploymentType !== 'all-types') && (
              <Button
                variant="ghost" 
                size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setJobTitleSearch('');
                    setSelectedLocations([]);
                    setSelectedCategory('all-categories');
                    setSelectedSubcategories([]);
                    setSelectedEmploymentType('all-types');
                  }}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4 mr-1" />
                Rensa alla
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Active Filters Summary */}
          {(selectedCategory !== 'all-categories' || selectedSubcategories.length > 0 || searchTerm || jobTitleSearch || selectedLocations.length > 0) && (
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-white">Aktiva filter:</span>
                <Badge variant="secondary" className="text-xs">
                  {[
                    selectedCategory !== 'all-categories' ? 1 : 0,
                    selectedSubcategories.length,
                    searchTerm ? 1 : 0,
                    jobTitleSearch ? 1 : 0,
                    selectedLocations.length,
                    selectedEmploymentType !== 'all-types' ? 1 : 0
                  ].reduce((a, b) => a + b, 0)} aktiva
                </Badge>
              </div>
                
                {selectedLocations.map((location) => (
                  <Badge key={location} variant="secondary" className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20">
                    <span className="text-xs">{location}</span>
                    <button 
                      onClick={() => setSelectedLocations(prev => prev.filter(l => l !== location))}
                      className="ml-1 hover:bg-white/20 rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              <div className="flex flex-wrap gap-2">
                {selectedCategory !== 'all-categories' && (
                <Badge variant="default" className="gap-2 bg-white/20 hover:bg-white/30 text-white border-white/30">
                    <span className="text-xs">{jobCategories.find(cat => cat.value === selectedCategory)?.label}</span>
                    <button 
                      onClick={() => {
                        setSelectedCategory('all-categories');
                        setSelectedSubcategories([]);
                      }}
                      className="ml-1 hover:bg-white/20 rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                
                {selectedSubcategories.map((subcategory) => (
                  <Badge key={subcategory} variant="secondary" className="gap-2 bg-white/10 hover:bg-white/20 text-white border-white/20">
                    <span className="text-xs">{subcategory}</span>
                    <button 
                      onClick={() => setSelectedSubcategories(prev => prev.filter(s => s !== subcategory))}
                      className="ml-1 hover:bg-white/20 rounded p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                
                {searchTerm && (
                  <Badge variant="outline" className="gap-2 text-white border-white/30">
                    <Search className="h-3 w-3" />
                    <span className="text-xs">"{searchTerm}"</span>
                    <button onClick={() => setSearchTerm('')} className="ml-1 hover:bg-white/20 rounded p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                
                {jobTitleSearch && (
                  <Badge variant="outline" className="gap-2 text-white border-white/30">
                    <span className="text-xs">"{jobTitleSearch}"</span>
                    <button onClick={() => setJobTitleSearch('')} className="ml-1 hover:bg-white/20 rounded p-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Search Fields Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* General Search Term */}
            <div className="space-y-3">
              <Label htmlFor="search" className="text-base font-medium text-white flex items-center gap-2">
                <Search className="h-4 w-4" />
                Sök företag/beskrivning
              </Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/50" />
                <Input
                  id="search"
                  placeholder="T.ex. 'Volvo' eller 'hemarbete'"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 text-base bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 hover:bg-white/10 focus:bg-white/10 transition-colors"
                />
                {searchTerm && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Job Title Search with Smart Integration */}
            <div className="space-y-3 relative">
              <Label htmlFor="jobTitleSearch" className="text-base font-medium text-white flex items-center gap-2">
                Specifik roll
              </Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/50" />
                <Input
                  id="jobTitleSearch"
                  placeholder="T.ex. 'sjuksköterska' eller 'snickare'"
                  value={jobTitleSearch}
                  onChange={(e) => {
                    setJobTitleSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="pl-12 h-12 text-base bg-white/5 backdrop-blur-sm border-white/20 text-white placeholder:text-white/50 hover:bg-white/10 focus:bg-white/10 transition-colors"
                />
                {jobTitleSearch && (
                  <button 
                    onClick={() => setJobTitleSearch('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                
                {/* Enhanced Autocomplete */}
                {showSuggestions && jobTitleSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700/95 backdrop-blur-md border border-white/20 rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto">
                    <div className="p-2 border-b border-white/10 text-xs text-white/70 font-medium">
                      Förslag baserat på din sökning
                    </div>
                    {jobTitleSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 hover:bg-white/10 cursor-pointer border-b border-white/5 last:border-b-0 transition-colors"
                        onClick={() => {
                          setJobTitleSearch(suggestion.title);
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
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
              
              {/* Smart Role Match */}
              {matchingRole && jobTitleSearch && (
                <div className="mt-3 p-3 bg-white/10 border border-white/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm mb-2">
                    <span className="text-white font-medium">Smart match:</span>
                    <Badge variant="secondary" className="text-xs">
                      {matchingRole.matchType === 'subcategory' ? 'Exakt roll' : 'Kategori'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-white text-sm">{matchingRole.category.label}</span>
                  </div>
                  {matchingRole.subcategory && (
                    <div className="ml-6 text-sm text-white/70 mb-2">
                      → {matchingRole.subcategory}
                    </div>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 text-xs text-white hover:bg-white/10"
                    onClick={handleAutoApplyRole}
                  >
                    Använd som filter
                  </Button>
                </div>
              )}
            </div>

            {/* Multi-Select Location */}
            <div className="space-y-3">
              <Label className="text-base font-medium text-white flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Plats ({selectedLocations.length > 0 ? selectedLocations.length : 'alla'})
              </Label>
              <div className="relative">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="outline" 
                      className="w-full h-12 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-colors justify-between"
                    >
                      <span className="truncate">
                        {selectedLocations.length === 0 
                          ? 'Alla platser i Sverige'
                          : selectedLocations.length === 1 
                          ? selectedLocations[0]
                          : `${selectedLocations.length} orter valda`
                        }
                      </span>
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    className="w-80 max-h-80 overflow-hidden bg-slate-700/95 backdrop-blur-md border-slate-500/30 shadow-xl z-50 rounded-lg text-white"
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
            <div className="space-y-3">
              <Label className="text-base font-medium text-white flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Anställning
              </Label>
              <Select value={selectedEmploymentType} onValueChange={(value) => setSelectedEmploymentType(value === 'all-types' ? 'all-types' : value)}>
                <SelectTrigger className="h-12 bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 transition-colors">
                  <SelectValue placeholder="Alla anställningsformer" />
                </SelectTrigger>
                <SelectContent 
                  className="bg-slate-700/95 backdrop-blur-md text-white border-white/20"
                  side="bottom"
                  align="start"
                  alignOffset={-20}
                  avoidCollisions={false}
                >
                  <SelectItem value="all-types" className="hover:bg-white/10 focus:bg-white/10">
                    Alla typer
                  </SelectItem>
                  {employmentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="hover:bg-white/10 focus:bg-white/10">
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">{jobs.length}</span>
                <span className="text-white/70">jobb hittades</span>
              </div>
              {(searchTerm || jobTitleSearch || selectedLocations.length > 0 || selectedCategory !== 'all-categories' || selectedSubcategories.length > 0 || selectedEmploymentType !== 'all-types') && (
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  Filtrerade resultat
                </Badge>
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
        </CardContent>
      </Card>

      {/* Results Section */}
      <div className="space-y-6" data-results>
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
                <h3 className="text-xl font-semibold">Inga jobb hittades</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Inga jobb matchade dina sökkriterier. Prova att ändra dina filter eller sökord.
                </p>
                <Button 
                  variant="outline"
                  onClick={() => {
                    setSearchTerm('');
                    setJobTitleSearch('');
                    setSelectedLocations([]);
                    setSelectedCategory('all-categories');
                    setSelectedSubcategories([]);
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
                              {formatSalary(job.salary_min, job.salary_max)}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(job.created_at).toLocaleDateString('sv-SE', {
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
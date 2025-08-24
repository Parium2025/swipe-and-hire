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
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
  const [selectedEmploymentType, setSelectedEmploymentType] = useState('all-types');
  const isMobile = useIsMobile();
  const dropdownAlignOffset = 0;

  // Job categories with subcategories - based on AF structure
  const jobCategories = [
    { 
      value: 'administration', 
      label: 'Administration, Ekonomi, Juridik',
      icon: '📊',
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
      icon: '🏗️',
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
      icon: '👔',
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
      icon: '💻',
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
      icon: '📈',
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
      icon: '🔨',
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
      icon: '🍽️',
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
      icon: '🏥',
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
      icon: '🏭',
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
      icon: '⚙️',
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
      icon: '🚛',
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
      icon: '💄',
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
      icon: '🎨',
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
      icon: '🎖️',
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
      icon: '🌾',
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
      icon: '🔬',
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
      label: 'Sanering och Renhållning', 
      icon: '🧹',
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
      label: 'Tekniskt Arbete', 
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
  }, [searchTerm, jobTitleSearch, selectedLocation, selectedCategory, selectedSubcategories, selectedEmploymentType]);

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

  // Get suggestions for job title autocomplete
  const getJobTitleSuggestions = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) return [];
    
    const searchLower = searchTerm.toLowerCase().trim();
    const suggestions: Array<{title: string, category: any}> = [];
    
    // Collect all subcategories that match the search term
    jobCategories.forEach(category => {
      category.subcategories.forEach(subcategory => {
        if (subcategory.toLowerCase().includes(searchLower)) {
          suggestions.push({
            title: subcategory,
            category: category
          });
        }
      });
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
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full"></div>
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
                    onClick={() => handleQuickCategory(category.value)}
                    className="font-medium cursor-pointer hover:bg-slate-700/70 focus:bg-slate-700/70 text-white"
                  >
                    {category.icon} Allt inom {category.label}
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
                          <Check className="h-4 w-4 text-green-400" />
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

      {/* Advanced Search - Collapsible */}
      <Card className="bg-white/10 backdrop-blur-sm border-white/20">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg text-white">
            <Filter className="h-5 w-5" />
            Avancerad sökning
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* General Search Term */}
            <div className="space-y-3">
              <Label htmlFor="search" className="text-base font-medium text-white">Sök på företag eller beskrivning</Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="search"
                  placeholder="T.ex. 'Volvo' eller 'hemarbete'"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 text-base bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70"
                />
              </div>
            </div>

            {/* Job Title Search with Autocomplete */}
            <div className="space-y-3 relative">
              <Label htmlFor="jobTitleSearch" className="text-base font-medium text-white">Specifik jobbtitel</Label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-white/70" />
                <Input
                  id="jobTitleSearch"
                  placeholder="T.ex. 'renhållning' eller 'lastbils'"
                  value={jobTitleSearch}
                  onChange={(e) => {
                    setJobTitleSearch(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="pl-12 h-12 text-base bg-white/10 backdrop-blur-sm border-white/30 text-white placeholder:text-white/70"
                />
                
                {/* Autocomplete Suggestions Dropdown */}
                {showSuggestions && jobTitleSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto text-foreground">
                    <div className="p-2 border-b border-border text-xs text-muted-foreground font-medium">
                      💡 Klicka för att välja jobbtitel
                    </div>
                    {jobTitleSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 hover:bg-accent cursor-pointer border-b border-border last:border-b-0"
                        onClick={() => {
                          setJobTitleSearch(suggestion.title);
                          setShowSuggestions(false);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{suggestion.category.icon}</span>
                          <div>
                            <div className="font-medium text-sm text-white">{suggestion.title}</div>
                            <div className="text-xs text-primary-foreground/70">
                              {suggestion.category.label}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-white">Välj →</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Role Match Indicator */}
              {matchingRole && jobTitleSearch && (
                <div className="mt-3 p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-primary font-medium">🎯 Rollmatch:</span>
                    <span className="text-muted-foreground">
                      {matchingRole.matchType === 'subcategory' ? 'Exakt roll hittad' : 'Kategori match'}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{matchingRole.category.icon}</span>
                      <span className="font-medium text-primary">{matchingRole.category.label}</span>
                    </div>
                    {matchingRole.subcategory && (
                      <div className="ml-6 text-sm text-muted-foreground">
                        → {matchingRole.subcategory}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-xs"
                      onClick={handleAutoApplyRole}
                    >
                      🔄 Använd som filter
                    </Button>
                    {matchingRole.matchType === 'keyword' && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-xs"
                        onClick={() => {
                          setSelectedCategory(matchingRole.category.value);
                          setJobTitleSearch('');
                        }}
                      >
                        📂 Visa hela kategorin
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Location - Enhanced */}
            <div className="space-y-3">
              <Label className="text-base font-medium text-white">Välj plats</Label>
              <Select value={selectedLocation} onValueChange={(value) => setSelectedLocation(value === 'all-locations' ? '' : value)}>
                <SelectTrigger className="h-12 bg-white/10 backdrop-blur-sm border-white/30 text-white">
                  <SelectValue placeholder="Alla platser i Sverige" />
                </SelectTrigger>
                <SelectContent className="bg-card text-foreground border-border">
                  <SelectItem value="all-locations" className="hover:bg-accent">🇸🇪 Alla platser</SelectItem>
                  {locations.map((location) => (
                    <SelectItem key={location} value={location} className="hover:bg-accent">
                      📍 {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employment Type - Enhanced */}
            <div className="space-y-3">
              <Label className="text-base font-medium text-white">Anställningsform</Label>
              <Select value={selectedEmploymentType} onValueChange={(value) => setSelectedEmploymentType(value === 'all-types' ? '' : value)}>
                <SelectTrigger className="h-12 bg-white/10 backdrop-blur-sm border-white/30 text-white">
                  <SelectValue placeholder="Alla anställningsformer" />
                </SelectTrigger>
                <SelectContent className="bg-card text-foreground border-border">
                  <SelectItem value="all-types" className="hover:bg-accent">💼 Alla typer</SelectItem>
                  {employmentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value} className="hover:bg-accent">
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

          {/* Active Filters Display */}
          {(selectedCategory !== 'all-categories' || selectedSubcategories.length > 0) && (
            <div className="pt-4 border-t">
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">Aktiva filter:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedCategory !== 'all-categories' && (
                  <Badge variant="default" className="gap-2">
                    <span>{jobCategories.find(cat => cat.value === selectedCategory)?.icon}</span>
                    <span>{jobCategories.find(cat => cat.value === selectedCategory)?.label}</span>
                    <button 
                      onClick={() => {
                        setSelectedCategory('all-categories');
                        setSelectedSubcategories([]);
                      }}
                      className="ml-1 hover:bg-accent rounded p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {selectedSubcategories.map((subcategory) => (
                  <Badge key={subcategory} variant="secondary" className="gap-2">
                    <span>🎯</span>
                    <span>{subcategory}</span>
                    <button 
                      onClick={() => setSelectedSubcategories(prev => prev.filter(s => s !== subcategory))}
                      className="ml-1 hover:bg-secondary-foreground/20 rounded p-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Search Actions */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t">
            <div className="flex items-center gap-4">
              <p className="text-lg font-medium">
                <span className="text-primary">{jobs.length}</span> jobb hittades
              </p>
              {(searchTerm || jobTitleSearch || selectedLocation !== 'all-locations' || selectedCategory !== 'all-categories' || selectedSubcategories.length > 0 || selectedEmploymentType !== 'all-types') && (
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
                setSelectedSubcategories([]);
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
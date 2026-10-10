/**
 * Gemensam sökordlista för Parium: stavfelsrättning + synonymkluster.
 * EN källa för både livesökningen i appen och bevakningsmatchningen
 * (check-saved-searches), så att en sparad sökning träffar exakt det
 * som sökrutan hade hittat. Ren TypeScript — inga importer (körs i Deno och Vite).
 */
// prettier-ignore
export const typoCorrections: Record<string, string> = {
  // ── IT / utvecklare ──
  utveklare: 'utvecklare', utvekalre: 'utvecklare', utvecklre: 'utvecklare',
  utveckalre: 'utvecklare', utveckare: 'utvecklare', utvekare: 'utvecklare',
  utveckalare: 'utvecklare', utveclare: 'utvecklare',
  programerare: 'programmerare', programmare: 'programmerare', programör: 'programmerare',
  programeare: 'programmerare', progammerare: 'programmerare',
  utveckelare: 'utvecklare', develloper: 'developer', devloper: 'developer',
  frontent: 'frontend', frontendd: 'frontend', bakend: 'backend', backendd: 'backend',
  fullstak: 'fullstack', fulstack: 'fullstack',
  systemutveklare: 'systemutvecklare', webbutveklare: 'webbutvecklare',
  ittekniker: 'it-tekniker', supprttekniker: 'supporttekniker', helpddesk: 'helpdesk',
  // ── Sälj ──
  saljare: 'säljare', saeljare: 'säljare', seljare: 'säljare', sälare: 'säljare',
  sälgare: 'säljare', säljjare: 'säljare',
  telefonsaljare: 'telefonförsäljare', telefonsäljare: 'telefonförsäljare',
  butikssaljare: 'butikssäljare', innesaljare: 'innesäljare', utesaljare: 'utesäljare',
  faltsaljare: 'fältsäljare',
  // ── Ingenjör ──
  ingenjor: 'ingenjör', ingenior: 'ingenjör', ingenjorr: 'ingenjör', injengör: 'ingenjör',
  ingengör: 'ingenjör', ingenjeur: 'ingenjör', ingnjör: 'ingenjör',
  civilingenjor: 'civilingenjör', hogskoleingenjor: 'högskoleingenjör',
  // ── Vård & omsorg ──
  sjukskotare: 'sjuksköterska', sjukskoetrska: 'sjuksköterska', sjukskoterska: 'sjuksköterska',
  sjuksköterksa: 'sjuksköterska', sjuksköterrska: 'sjuksköterska', sjuksköterksa2: 'sjuksköterska',
  sjukskötare: 'sjuksköterska', sjukskoeterska: 'sjuksköterska',
  underskoterska: 'undersköterska', underskotare: 'undersköterska', undersköterksa: 'undersköterska',
  underskötare: 'undersköterska', undersskoterska: 'undersköterska',
  vardbitrade: 'vårdbiträde', vårdbitrade: 'vårdbiträde', vårdbiträ: 'vårdbiträde',
  personligassisten: 'personlig assistent', persoligassistent: 'personlig assistent',
  personligassitent: 'personlig assistent',
  barnskotare: 'barnskötare', barskotare: 'barnskötare',
  forskollarare: 'förskollärare', förskolärare: 'förskollärare', förskollärar: 'förskollärare',
  fysoterapeut: 'fysioterapeut', sjukgymanst: 'sjukgymnast',
  tandskoterska: 'tandsköterska', tandlakare: 'tandläkare', tandhyginist: 'tandhygienist',
  socionomm: 'socionom', socialsekreterrare: 'socialsekreterare',
  // ── Lärare / skola ──
  larare: 'lärare', laerare: 'lärare', lerare: 'lärare', lärarr: 'lärare', läärare: 'lärare',
  grundskolelarare: 'grundskollärare', gymnasielärar: 'gymnasielärare',
  amneslarare: 'ämneslärare', speciallarare: 'speciallärare',
  elevassitent: 'elevassistent',
  // ── Kontor / admin ──
  bokforing: 'bokföring', bokforare: 'bokförare', bokförare: 'bokförare',
  marknadsforing: 'marknadsföring', marknadforing: 'marknadsföring',
  kundtjanst: 'kundtjänst', kundtjenst: 'kundtjänst', kundserive: 'kundservice',
  projektledning: 'projektledare', projekletdare: 'projektledare',
  adminstrator: 'administratör', administrator: 'administratör', administratör: 'administratör',
  adminstratör: 'administratör', administratör2: 'administratör',
  assitent: 'assistent', assistent: 'assistent', assistant: 'assistent', assitant: 'assistent',
  konsullt: 'konsult', konsulnt: 'konsult', konsultt: 'konsult',
  recptionist: 'receptionist', recepsionist: 'receptionist', receptionst: 'receptionist',
  reseptonist: 'receptionist',
  sektreterare: 'sekreterare', sektretare: 'sekreterare',
  handlaggare: 'handläggare', handläggre: 'handläggare',
  koordinatr: 'koordinator', koordniator: 'koordinator',
  controler: 'controller', kontroler: 'controller',
  redovsiningsekonom: 'redovisningsekonom', ekonomassistent: 'ekonomiassistent',
  loneadministrator: 'löneadministratör', lonespecialist: 'lönespecialist',
  rekyterare: 'rekryterare', rekrytter: 'rekryterare',
  // ── Chef / ledning ──
  chef: 'chef', cheff: 'chef', shef: 'chef', schef: 'chef',
  ledre: 'ledare', ledrare: 'ledare', lder: 'ledare',
  vdd: 'vd', ceoo: 'ceo',
  // ── Transport ──
  chauffeur: 'chaufför', chauffor: 'chaufför', chauför: 'chaufför', chafför: 'chaufför',
  chuafför: 'chaufför', shufför: 'chaufför', shofför: 'chaufför', schaufför: 'chaufför',
  chuffor: 'chaufför', chuffør: 'chaufför',
  forare: 'förare', förar: 'förare', förere: 'förare', förarre: 'förare',
  lastbilschauffor: 'lastbilschaufför', lastbilsforare: 'lastbilsförare',
  lastbilschafför: 'lastbilschaufför',
  taxichauffor: 'taxichaufför', bussforare: 'bussförare', busschauffor: 'busschaufför',
  yrkeschauffor: 'yrkeschaufför', distributionsforare: 'distributionsförare',
  bubil: 'budbil', budbilsforare: 'budbilsförare', budbilschauffor: 'budbilschaufför',
  kuir: 'kurir', kurirbud: 'kurir',
  akare: 'åkare', utkorare: 'utkörare', leveransforare: 'leveransförare',
  truckforare: 'truckförare', gafffeltruck: 'gaffeltruck',
  // ── Tekniker ──
  teknker: 'tekniker', tekiker: 'tekniker', teknikker: 'tekniker', tekniiker: 'tekniker',
  servicetkeniker: 'servicetekniker', fordonstekniker2: 'fordonstekniker',
  mekniker: 'mekaniker', mekaanker: 'mekaniker', mekanker: 'mekaniker',
  bilmekniker: 'bilmekaniker',
  // ── Restaurang ──
  kokschef: 'kökschef', kock: 'kock', kokk: 'kock', kokc: 'kock',
  souschef2: 'souschef', kallskanka: 'kallskänka',
  servitor: 'servitör', servitris: 'servitör', servitör2: 'servitör', servitø: 'servitör',
  diskare: 'diskare', diskar: 'diskare', diskre: 'diskare',
  koksbitrade: 'köksbiträde', köksbitrade: 'köksbiträde', köksbiträ: 'köksbiträde',
  bartendr: 'bartender', baritsa: 'barista', barrista: 'barista',
  bagre: 'bagare', konditr: 'konditor',
  // ── Städ / bygg ──
  stadare: 'städare', stadning: 'städning', lokalvard: 'lokalvårdare', lokalvardare: 'lokalvårdare',
  loklavårdare: 'lokalvårdare', hemstadare: 'hemstädare', kontorsstadare: 'kontorsstädare',
  snikare: 'snickare', snickar: 'snickare', snikkare: 'snickare',
  elektikker: 'elektriker', eletriker: 'elektriker', elektricker: 'elektriker',
  elktriker: 'elektriker', elinstallator: 'elinstallatör',
  malare: 'målare', mallare: 'målare', målar: 'målare',
  murare: 'murare', muraree: 'murare', golvläggare2: 'golvläggare',
  rormokare: 'rörmokare', rørmokare: 'rörmokare', vvsmontor: 'vvs-montör',
  vvsinstalatör: 'vvsinstallatör',
  svetare: 'svetsare', svettsare: 'svetsare',
  betongarbetae: 'betongarbetare', anlaggningsarbetare: 'anläggningsarbetare',
  byggnadsabretare: 'byggnadsarbetare', bygare: 'byggare', hantverkae: 'hantverkare',
  timmerman2: 'timmerman',
  // ── Lager & industri ──
  lagerabetare: 'lagerarbetare', lageraretare: 'lagerarbetare', lagerarbetae: 'lagerarbetare',
  lageararbetare: 'lagerarbetare', laagerarbetare: 'lagerarbetare',
  plockar: 'plockare', orderplokare: 'orderplockare', orderplockar: 'orderplockare',
  packae: 'packare', pakare: 'packare',
  terminalabetare: 'terminalarbetare', godshanterare: 'godshanterare',
  industriabretare: 'industriarbetare', prodkutionsarbetare: 'produktionsarbetare',
  produktionabretare: 'produktionsarbetare', operatr: 'operatör', operatoer: 'operatör',
  maskinoperator: 'maskinoperatör', processoperator: 'processoperatör',
  montor: 'montör', monter: 'montör', kvalitetstekniker2: 'kvalitetstekniker',
  // ── Säkerhet ──
  vaktare: 'väktare', vaktarr: 'väktare', ordningsvakt2: 'ordningsvakt',
  sakerhetsvakt: 'säkerhetsvakt', dorrvakt: 'dörrvakt', entrevard: 'entrévärd',
  brandmn: 'brandman', raddningstjanst: 'räddningstjänst',
  // ── Marknad & kommunikation ──
  marknadsforare: 'marknadsförare', markandsförare: 'marknadsförare',
  kommunikator: 'kommunikatör', kommunikatr: 'kommunikatör',
  copyriter: 'copywriter', kopywriter: 'copywriter',
  contentcreater: 'content creator', socialmediamanager: 'socialmediemanager',
  redaktor: 'redaktör', informator: 'informatör',
  // ── Design ──
  uxdesigner: 'ux-designer', uidesigner: 'ui-designer',
  produkdesigner: 'produktdesigner', grafiskdesignr: 'grafiskdesigner',
  // ── HR ──
  personaladmin: 'personaladministratör', personaladministratr: 'personaladministratör',
  hrspecialist2: 'hr-specialist', hrpartner2: 'hrpartner',
  // ── Övrigt ──
  frisor: 'frisör', frisör2: 'frisör', friisör: 'frisör', frissör: 'frisör',
  massor: 'massör', massoer: 'massör',
  florst: 'florist', fotoggraf: 'fotograf', fotgraf: 'fotograf',
  personligtranare: 'personlig tränare', gyminstruktor: 'gyminstruktör',
  // ── Städer ──
  stocholm: 'stockholm', stockolm: 'stockholm', stokholm: 'stockholm', stockhlm: 'stockholm',
  stckholm: 'stockholm', stockhllm: 'stockholm',
  goteborg: 'göteborg', goeteborg: 'göteborg', götborg: 'göteborg', gtbg: 'göteborg',
  gøteborg: 'göteborg', gotteborg: 'göteborg',
  malmo: 'malmö', malmoe: 'malmö', mallmö: 'malmö', malmø: 'malmö',
  helsingbrog: 'helsingborg', hellsingborg: 'helsingborg', helsingbourg: 'helsingborg',
  helsingborj: 'helsingborg',
  linkoping: 'linköping', linkoepping: 'linköping', linjöping: 'linköping',
  jonkoping: 'jönköping', jonkoeping: 'jönköping',
  norrkoping: 'norrköping', norkoping: 'norrköping',
  orebro: 'örebro', oerebro: 'örebro', örrebro: 'örebro',
  vasteras: 'västerås', vaesteras: 'västerås', västras: 'västerås',
  umea: 'umeå', umeaa: 'umeå', umeo: 'umeå',
  lulea: 'luleå', luleaa: 'luleå',
  sundvall: 'sundsvall', sunsvall: 'sundsvall',
  karlsatd: 'karlstad', karltad: 'karlstad',
  vaxjo: 'växjö', vaexjoe: 'växjö', vaeksjo: 'växjö',
  uppsla: 'uppsala', uppsal: 'uppsala', uppsalla: 'uppsala',
  eskilstua: 'eskilstuna', halmastad: 'halmstad', gvle: 'gävle', gavle: 'gävle',
  boras: 'borås', boraas: 'borås',
  ostersund: 'östersund', oestersund: 'östersund',
  vasterbotten: 'västerbotten', vasternorrland: 'västernorrland',
};

export const SYNONYM_CLUSTERS: string[][] = [
  // ── TRANSPORT & LOGISTIK ──
  [
    'chaufför', 'chauffor', 'förare', 'forare', 'bud', 'budbil', 'budbilsförare',
    'budbilsforare', 'kurir', 'kurirförare', 'leverans', 'leveransförare',
    'leveransforare', 'utkörare', 'åkare', 'akare', 'taxichaufför', 'taxichauffor',
    'taxi', 'lastbilschaufför', 'lastbilschauffor', 'lastbilsförare', 'lastbilsforare',
    'yrkeschaufför', 'yrkeschauffor', 'distributionsförare', 'distributionsforare',
    'bussförare', 'bussforare', 'busschaufför', 'busschauffor',
  ],
  ['truckförare', 'truckforare', 'truck', 'truckförare/lager', 'gaffeltruck', 'truckchaufför', 'motviktstruck', 'skjutstativtruck', 'forklift', 'forklift operator'],
  ['lagerarbetare', 'lager', 'lagermedarbetare', 'lagerpersonal', 'plockare', 'packare', 'orderplockare', 'lagerplockare', 'warehouse worker', 'warehouse', 'plock och pack', 'plockpackare', 'inleveransarbetare', 'utleveransarbetare'],
  ['terminalarbetare', 'terminal', 'godsmottagning', 'godshantering', 'godshanterare', 'lossare', 'lastare', 'hamnarbetare', 'stuveriarbetare'],
  ['logistiker', 'logistik', 'logistikkoordinator', 'transportledare', 'transportplanerare', 'speditör', 'speditor', 'logistics coordinator', 'supply chain'],
  ['pilot', 'flygkapten', 'flygvärdinna', 'flygvärd', 'cabin crew', 'kabinpersonal', 'flygtekniker'],
  ['sjöman', 'sjoman', 'matros', 'däcksman', 'befälhavare'],

  // ── BYGG & HANTVERK ──
  ['snickare', 'byggare', 'bygg', 'byggnadsarbetare', 'hantverkare', 'timmerman', 'träarbetare', 'trarbetare', 'byggarbetare', 'byggnadssnickare', 'inredningssnickare', 'carpenter'],
  ['elektriker', 'el', 'elinstallatör', 'elinstallator', 'servicetekniker-el', 'installationselektriker', 'industrielektriker', 'servicelektriker', 'electrician', 'eltekniker', 'elmontör'],
  ['vvs-montör', 'vvsmontor', 'vvs', 'rörmokare', 'rormokare', 'rörläggare', 'rorlaggare', 'vvsinstallatör', 'vvstekniker', 'plumber', 'värme och sanitet', 'kyltekniker', 'ventilationsmontör'],
  ['målare', 'malare', 'byggmålare', 'industrimålare', 'painter', 'lackerare', 'billackerare'],
  ['betongarbetare', 'betong', 'anläggningsarbetare', 'anlaggningsarbetare', 'markarbetare', 'grundläggare', 'asfaltarbetare', 'väg och anläggning', 'väg- och anläggningsarbetare'],
  ['svetsare', 'svets', 'mig-svetsare', 'tig-svetsare', 'mag-svetsare', 'welder', 'svetsspecialist', 'rörssvetsare'],
  ['mekaniker', 'mekanik', 'bilmekaniker', 'servicetekniker', 'fordonstekniker', 'fordonsmekaniker', 'lastbilsmekaniker', 'däcktekniker', 'mechanic', 'motorreparatör', 'skadereparatör'],
  ['plåtslagare', 'platslagare', 'takläggare', 'taklaggare', 'byggplåtslagare'],
  ['golvläggare', 'golvlaggare', 'golvarbetare', 'plattsättare', 'plattsattare', 'kakelsättare', 'kakelsattare'],
  ['murare', 'murararbete', 'mason', 'stenläggare'],
  ['glasmästare', 'glasmastare', 'glasare'],
  ['arkitekt', 'byggnadsingenjör', 'byggnadsingenjor', 'byggingenjör', 'projekteringsingenjör', 'konstruktör', 'konstruktor', 'architect'],

  // ── RESTAURANG & LIVSMEDEL ──
  ['kock', 'kokk', 'kökschef', 'kokschef', 'souschef', 'kallskänka', 'kallskanka', 'restaurangbiträde', 'chef de partie', 'linjekock', 'pizzabagare', 'pizzabakare', 'sushikock', 'cook'],
  ['servitör', 'servitor', 'servitris', 'servis', 'restaurangpersonal', 'runner', 'hovmästare', 'hovmastare', 'waiter', 'waitress', 'serveringspersonal', 'restaurangvärd'],
  ['bartender', 'barpersonal', 'baristor', 'barista', 'coffee', 'baristo', 'kafépersonal', 'cafepersonal'],
  ['diskare', 'köksbiträde', 'koksbitrade', 'kokspersonal', 'kökspersonal', 'dishwasher'],
  ['bagare', 'konditor', 'bageri', 'baker', 'pastry chef', 'brödbagare'],
  ['livsmedelsarbetare', 'charkuterist', 'slaktare', 'köttskärare', 'fiskhandlare'],

  // ── HANDEL & SÄLJ ──
  [
    'säljare', 'saljare', 'butikssäljare', 'butikssaljare', 'butik', 'butiksmedarbetare',
    'butikspersonal', 'shopmedarbetare', 'säljmedarbetare', 'säljkonsulent',
    'telefonförsäljare', 'telefonsaljare', 'telemarketing', 'innesäljare', 'innesaljare',
    'utesäljare', 'utesaljare', 'fältsäljare', 'faltsaljare', 'account manager',
    'accountmanager', 'kam', 'keyaccount', 'affärsutvecklare', 'affarsutvecklare',
    'affärsområdeschef', 'affarsomradeschef', 'säljchef', 'saljchef', 'sales',
    'sales representative', 'sales manager', 'sales executive', 'account executive',
    'business developer', 'bdr', 'sdr', 'säljare b2b', 'säljare b2c', 'säljande',
    'butiksansvarig', 'shop assistant', 'retail', 'demonstratör',
  ],
  ['kassör', 'kassor', 'kassa', 'kassabiträde', 'kassabitrade', 'kassapersonal', 'cashier'],
  ['butikschef', 'butikssamordnare', 'store manager', 'storemanager', 'shop manager', 'assistant store manager'],
  ['inköpare', 'inkopare', 'inköp', 'inkop', 'purchaser', 'procurement', 'category manager', 'sortimentschef'],
  ['visual merchandiser', 'vm', 'butiksinredare', 'skyltdockare'],
  ['e-handel', 'ehandel', 'e-commerce', 'ecommerce', 'e-handelschef', 'e-commerce manager'],

  // ── VÅRD & OMSORG ──
  [
    'sjuksköterska', 'sjukskoterska', 'ssk', 'legitimeradsjuksköterska', 'grundutbildadsjuksköterska',
    'distriktssköterska', 'distriktsskoterska', 'anestesisjuksköterska', 'operationssjuksköterska',
    'barnsjuksköterska', 'iva-sjuksköterska', 'akutsjuksköterska', 'nurse', 'registered nurse', 'rn',
    'skolsjuksköterska', 'psykiatrisjuksköterska',
  ],
  ['undersköterska', 'underskoterska', 'usk', 'vårdbiträde', 'vardbitrade', 'omsorgspersonal', 'vårdare', 'vardare', 'nurse assistant', 'omsorgsassistent', 'stödassistent', 'stodassistent', 'boendestödjare', 'boendestodjare'],
  ['personlig assistent', 'personligassistent', 'personligassisent', 'assistent', 'personal assistant', 'ledsagare', 'pa'],
  ['barnskötare', 'barnskotare', 'förskollärare', 'forskollarare', 'fritidspedagog', 'fritidsledare', 'dagbarnvårdare', 'preschool teacher', 'nanny', 'au pair', 'barnvakt'],
  ['läkare', 'lakare', 'doktor', 'st-läkare', 'stlakare', 'allmänläkare', 'specialistläkare', 'överläkare', 'ol', 'physician', 'doctor', 'md', 'at-läkare'],
  ['fysioterapeut', 'sjukgymnast', 'arbetsterapeut', 'physiotherapist', 'occupational therapist', 'kiropraktor', 'naprapat'],
  ['tandläkare', 'tandlakare', 'tandsköterska', 'tandskoterska', 'tandhygienist', 'dentist', 'dental hygienist'],
  ['socialsekreterare', 'socionom', 'kurator', 'behandlingsassistent', 'behandlare', 'familjebehandlare', 'social worker', 'skolkurator'],
  ['psykolog', 'psykoterapeut', 'terapeut', 'psychologist', 'legitimerad psykolog', 'pt-legitimation'],
  ['optiker', 'optometrist', 'ögonläkare'],
  ['veterinär', 'veterinar', 'djursjukvårdare', 'djurskötare', 'vet', 'veterinary'],
  ['farmaceut', 'apotekare', 'apotekstekniker', 'pharmacist'],

  // ── SKOLA & PEDAGOGIK ──
  ['lärare', 'larare', 'grundskollärare', 'gymnasielärare', 'ämneslärare', 'amneslarare', 'speciallärare', 'sva-lärare', 'teacher', 'mattelärare', 'sva-pedagog', 'idrottslärare', 'musiklärare', 'språklärare', 'engelsklärare'],
  ['förskollärare', 'forskollarare', 'förskolechef', 'rektor', 'skolledare', 'biträdande rektor', 'preschool teacher', 'principal'],
  ['elevassistent', 'skolassistent', 'resurspedagog', 'fritidspedagog', 'teacher assistant'],
  ['studie- och yrkesvägledare', 'syv', 'studievägledare', 'career counsellor'],

  // ── STÄD & FASTIGHET ──
  ['lokalvårdare', 'lokalvardare', 'städare', 'stadare', 'städ', 'stad', 'städpersonal', 'stadpersonal', 'lokalvård', 'kontorsstädare', 'hemstädare', 'cleaner', 'cleaning', 'hotellstädare', 'byggstädare'],
  ['fastighetsskötare', 'fastighetsskotare', 'fastighet', 'vaktmästare', 'vaktmastare', 'fastighetstekniker', 'facility manager', 'building manager', 'fastighetsansvarig', 'fastighetsförvaltare'],
  ['trädgårdsarbetare', 'tradgardsarbetare', 'trädgårdsmästare', 'markskötare', 'gardener', 'anläggare', 'parkarbetare'],

  // ── IT / TEKNIK ──
  [
    'utvecklare', 'developer', 'dev', 'programmerare', 'kodare', 'software engineer',
    'softwareengineer', 'systemutvecklare', 'systemutveklare', 'apputvecklare',
    'webbutvecklare', 'webutvecklare', 'software developer', 'engineer', 'coder',
    'mjukvaruutvecklare', 'javautvecklare', 'javautveklare', '.net-utvecklare',
    'pythonutvecklare', 'nodeutvecklare', 'reactutvecklare', 'iosutvecklare',
    'androidutvecklare', 'mobilutvecklare', 'mobile developer', 'embedded developer',
    'inbyggnadsutvecklare',
  ],
  ['frontendutvecklare', 'frontend', 'frontendutveklare', 'frontend-utvecklare', 'ui-utvecklare', 'frontend developer', 'reactutvecklare', 'vue-utvecklare', 'angularutvecklare', 'client-side'],
  ['backendutvecklare', 'backend', 'backend-utvecklare', 'server-utvecklare', 'backend developer', 'nodejs-utvecklare', 'server-side', 'api-utvecklare'],
  ['fullstackutvecklare', 'fullstack', 'full-stack', 'full-stackutvecklare', 'fullstack developer', 'full stack developer'],
  ['devops', 'sre', 'plattformsingenjör', 'plattformsingenjor', 'devopsingenjör', 'site reliability engineer', 'platform engineer', 'cloud engineer', 'kubernetes-ingenjör', 'infrastrukturingenjör'],
  ['dataengineer', 'data engineer', 'datatekniker', 'dataarkitekt', 'datavetare', 'dataingenjör', 'etl-utvecklare', 'bi-utvecklare', 'business intelligence'],
  ['datascientist', 'data scientist', 'ml-ingenjör', 'ai-ingenjör', 'aiingenjor', 'machine learning engineer', 'ai engineer', 'ml engineer', 'dataanalytiker', 'data analyst', 'analytiker'],
  ['systemadministratör', 'systemadministrator', 'sysadmin', 'it-tekniker', 'ittekniker', 'supporttekniker', 'helpdesk', 'it-support', 'servicedesk', 'it support', 'nätverkstekniker', 'natverkstekniker', 'network engineer', 'itansvarig'],
  ['produktägare', 'produktagare', 'product owner', 'productowner', 'produktchef', 'produktledare', 'product manager', 'po', 'pm', 'produktstrateg'],
  ['projektledare', 'projekt', 'projektchef', 'projectmanager', 'programledare', 'project manager', 'program manager', 'delivery manager', 'teknisk projektledare', 'byggprojektledare'],
  ['scrummaster', 'scrum master', 'agilcoach', 'agile coach', 'kanban master'],
  ['ux-designer', 'ux', 'ui-designer', 'ui', 'produktdesigner', 'interaktionsdesigner', 'grafiskdesigner', 'formgivare', 'graphic designer', 'motion designer', 'illustratör', 'illustrator', 'brand designer', 'ux researcher', 'ux writer'],
  ['säkerhetsingenjör', 'informationssäkerhet', 'it-säkerhet', 'cybersäkerhet', 'security engineer', 'infosec', 'soc-analytiker', 'penetrationstestare', 'pentester'],
  ['qa-testare', 'qa', 'testare', 'testautomatiserare', 'test automation', 'quality assurance', 'test engineer', 'kvalitetstestare'],
  ['tech lead', 'techlead', 'lead developer', 'utvecklingschef', 'cto', 'engineering manager', 'utvecklingsledare'],

  // ── EKONOMI / HR ──
  ['ekonom', 'ekonomi', 'ekonomiassistent', 'ekonomichef', 'controller', 'redovisningsekonom', 'redovisningskonsult', 'business controller', 'financial controller', 'cfo', 'finance manager', 'ekonomiansvarig'],
  ['bokförare', 'bokforare', 'bokföring', 'bokforing', 'redovisning', 'accountant', 'accounting'],
  ['revisor', 'revision', 'revisorsassistent', 'auktoriseradrevisor', 'auditor', 'internrevisor'],
  ['hr', 'hr-generalist', 'hrpartner', 'hrchef', 'hr-specialist', 'personaladministratör', 'personalchef', 'rekryterare', 'talent acquisition', 'talentacquisition', 'hr business partner', 'hrbp', 'people partner', 'recruiter', 'talent partner', 'people & culture'],
  ['löneadministratör', 'loneadministrator', 'lönespecialist', 'lonespecialist', 'lön', 'lon', 'payroll specialist', 'löneassistent'],
  ['jurist', 'advokat', 'bolagsjurist', 'legal counsel', 'affärsjurist', 'notarie', 'paralegal'],
  ['bank', 'banktjänsteman', 'banktjansteman', 'kundrådgivare', 'kundradgivare', 'privatrådgivare', 'företagsrådgivare', 'financial advisor', 'investment banker'],
  ['försäkringstjänsteman', 'försäkringsförmedlare', 'insurance broker', 'skadereglerare'],

  // ── MARKNAD & KOMMUNIKATION ──
  ['marknadsförare', 'marknadsforare', 'marknadsföring', 'marknadsforing', 'marknadschef', 'marknadskoordinator', 'marketing', 'marketing manager', 'marknadsassistent', 'marketing coordinator', 'brand manager', 'varumärkeschef'],
  ['kommunikatör', 'kommunikator', 'kommunikation', 'informatör', 'informator', 'presskontakt', 'pr', 'communications manager', 'kommunikationschef', 'pressekreterare'],
  ['sociala medier', 'socialmedia', 'social media', 'socialmediemanager', 'content creator', 'contentcreator', 'copywriter', 'skribent', 'redaktör', 'redaktor', 'community manager', 'content manager', 'content strategist', 'contentstrateg', 'seo-specialist', 'seo specialist', 'sem-specialist', 'growth marketer', 'performance marketer', 'digital marknadsförare'],
  ['event', 'eventkoordinator', 'eventansvarig', 'event manager', 'projektledare event', 'mötesbokare', 'event planner'],

  // ── KONTOR / ADMINISTRATION ──
  ['administratör', 'administratoer', 'administrator', 'sekreterare', 'kontorsassistent', 'kanslist', 'handläggare', 'handlaggare', 'office coordinator', 'office manager', 'kontorsansvarig', 'executive assistant', 'ea', 'kontorschef', 'ledningsassistent'],
  ['receptionist', 'reception', 'kontorsreceptionist', 'front office', 'frontoffice', 'receptionschef', 'hotellreceptionist'],
  ['kundtjänst', 'kundtjanst', 'kundservice', 'kundsupport', 'customer support', 'customersupport', 'customer success', 'customer service', 'customer experience', 'cx', 'kundservicemedarbetare', 'kundtjänstmedarbetare', 'servicerådgivare', 'call center'],

  // ── SÄKERHET ──
  ['väktare', 'vaktare', 'ordningsvakt', 'säkerhetsvakt', 'sakerhetsvakt', 'skyddsvakt', 'entrévärd', 'entrevard', 'dörrvakt', 'dorrvakt', 'security guard', 'securitas', 'crossbar', 'butikskontrollant'],
  ['parkeringsvakt', 'parkering', 'p-vakt', 'parkeringsövervakare'],
  ['brandman', 'räddningstjänst', 'raddningstjanst', 'firefighter', 'brandingenjör'],
  ['polis', 'polisassistent', 'kriminalinspektör', 'police officer'],

  // ── INDUSTRI ──
  ['industriarbetare', 'industri', 'produktionsarbetare', 'produktion', 'operatör', 'operator', 'processoperatör', 'maskinoperatör', 'maskinoperator', 'production worker', 'produktionstekniker', 'linjearbetare'],
  ['montör', 'montor', 'montering', 'assembly worker', 'monteringstekniker', 'slutmontör', 'elektronikmontör'],
  ['kvalitetskontrollant', 'kvalitet', 'kvalitetstekniker', 'kvalitetsingenjör', 'quality engineer', 'quality inspector', 'kvalitetsansvarig'],
  ['maskiningenjör', 'maskiningenjor', 'produktionsingenjör', 'productionengineer', 'mechanical engineer', 'processingenjör'],
  ['underhållstekniker', 'underhallstekniker', 'maintenance technician', 'reparatör', 'reparator', 'servicetekniker industri'],

  // ── LANTBRUK / SKOG ──
  ['lantbrukare', 'bonde', 'jordbrukare', 'lantarbetare', 'farmer', 'skogsarbetare', 'skogshuggare', 'skogsmaskinförare'],
  ['djurskötare', 'djurskotare', 'stallpersonal', 'ridinstruktör', 'hovslagare'],

  // ── ÖVRIGT ──
  ['frisör', 'frisor', 'stylist', 'barberare', 'hairdresser', 'barber', 'hårstylist'],
  ['massör', 'massor', 'massage', 'terapeut', 'massage therapist', 'spaterapeut'],
  ['personaltrainer', 'personlig tränare', 'ptr', 'gyminstruktör', 'gyminstruktor', 'personal trainer', 'pt', 'fitness coach', 'träningskonsulent', 'gruppträningsinstruktör'],
  ['florist', 'blomsterdekoratör', 'florist assistant'],
  ['fotograf', 'videograf', 'filmare', 'photographer', 'videographer', 'kameraman', 'filmproducent', 'editor', 'videoklippare'],
  ['tolk', 'översättare', 'oversattare', 'translator', 'interpreter', 'auktoriserad tolk'],
  ['taxichaufför', 'uber', 'bolt', 'taxi'],
];

export const SEARCH_STOP_WORDS = new Set([
  'i', 'pa', 'på', 'vid', 'och', 'eller', 'med', 'som', 'till', 'for', 'för', 'av', 'en', 'ett', 'den', 'det',
  'jobb', 'tjanst', 'tjanster', 'inom',
]);

export const normalizeToken = (t: string): string =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/\s+/g, '');

export const stripSwedishEnding = (value: string): string => {
  if (value.length <= 4) return value;
  return value
    .replace(/(ets|ens)$/i, '')
    .replace(/(arnas|ernas|ornas)$/i, '')
    .replace(/(arna|erna|orna)$/i, '')
    .replace(/(ande|ende)$/i, '')
    .replace(/(het|en|et|ar|er|or|s)$/i, '');
};

export const levenshtein = (a: string, b: string, max = 2): number => {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (rowMin > max) return max + 1;
    prev = curr;
  }
  return prev[b.length];
};

/** Normaliserat ord → alla normaliserade medlemmar i dess kluster. */
const NORM_CLUSTER: Map<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const cluster of SYNONYM_CLUSTERS) {
    const forms = new Set<string>();
    for (const term of cluster) {
      forms.add(normalizeToken(term));
      for (const part of term.toLowerCase().split(/[\s,/()&+-]+/)) {
        if (part.length >= 3) forms.add(normalizeToken(part));
      }
    }
    const members = [...forms].filter((f) => f.length >= 2 && !SEARCH_STOP_WORDS.has(f));
    for (const f of members) if (!m.has(f)) m.set(f, members);
  }
  return m;
})();

const CANONICAL_POOL: string[] = [...new Set([
  ...Object.values(typoCorrections).map(normalizeToken),
  ...NORM_CLUSTER.keys(),
])].filter((t) => t.length >= 4);

/** Närmaste kända ord vid okänt stavfel (5+ tecken). */
export const fuzzyFindKnownTerm = (norm: string, extraPool: string[] = []): string | null => {
  if (norm.length < 5) return null;
  const allowed = norm.length >= 8 ? 2 : 1;
  let best: { term: string; dist: number } | null = null;
  for (const term of extraPool.length ? CANONICAL_POOL.concat(extraPool) : CANONICAL_POOL) {
    if (Math.abs(term.length - norm.length) > allowed) continue;
    if (allowed < 2 && term[0] !== norm[0]) continue;
    const dist = levenshtein(term, norm, allowed);
    if (dist <= allowed && (!best || dist < best.dist)) best = { term, dist };
  }
  return best ? best.term : null;
};

/**
 * Expandera ETT sökord till alla normaliserade termer som räknas som träff:
 * originalet, böjningsfri form, stavfelsrättning, hela synonymklustret och
 * vid behov närmaste kända ord via Levenshtein.
 */
export const expandSearchToken = (token: string, extraPool: string[] = []): string[] => {
  const norm = normalizeToken(token);
  if (!norm) return [];
  const out = new Set<string>([norm]);
  const stripped = stripSwedishEnding(norm);
  if (stripped.length >= 3) out.add(stripped);
  const keys = [norm, stripped];
  for (const k of [norm, stripped]) {
    const fixed = typoCorrections[k];
    if (fixed) { const f = normalizeToken(fixed); out.add(f); keys.push(f); }
  }
  let foundCluster = false;
  for (const k of keys) {
    const c = NORM_CLUSTER.get(k);
    if (c) { foundCluster = true; c.forEach((t) => out.add(t)); }
  }
  if (!foundCluster && keys.length === 2) {
    const fuzzy = fuzzyFindKnownTerm(norm, extraPool) || fuzzyFindKnownTerm(stripped, extraPool);
    if (fuzzy) { out.add(fuzzy); NORM_CLUSTER.get(fuzzy)?.forEach((t) => out.add(t)); }
  }
  return [...out].filter((t) => t.length >= 2);
};

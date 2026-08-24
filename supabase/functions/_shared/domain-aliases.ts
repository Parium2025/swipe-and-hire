// ─────────────────────────────────────────────────────────────
// Domän-aliasdatabas för urvalskriterier
//
// Syfte: ge AI-utvärderingen ett GARANTERAT säkerhetsnät för
// fackuttryck, förkortningar och certifikat inom alla vanliga
// yrkesområden — istället för att lita på modellens allmänbildning.
//
// Användning: matchAliasGroups(criteriaTexts) plockar ut endast de
// grupper som är relevanta för rekryterarens kriterier, och
// buildAliasPromptBlock() renderar dem som ett kompakt promptavsnitt.
// Det håller prompten liten men täckningen hög.
// ─────────────────────────────────────────────────────────────

export interface AliasGroup {
  /** Kanoniskt namn som visas i prompten */
  canonical: string;
  /** Alla ord/uttryck som betyder samma sak (gemener) */
  terms: string[];
  /** Valfri extra instruktion till modellen */
  note?: string;
}

export const ALIAS_GROUPS: AliasGroup[] = [
  // ── KÖRKORT & TRANSPORT ───────────────────────────────────
  { canonical: 'B-körkort', terms: ['b-kort', 'b-körkort', 'körkort b', 'personbilskörkort', 'bilkörkort', 'har körkort', 'driving licence b', 'körkortsbehörighet b'], note: 'I Sverige betyder "har körkort" utan bokstav normalt B.' },
  { canonical: 'A/A1/A2-körkort (motorcykel)', terms: ['a-kort', 'a-körkort', 'mc-körkort', 'motorcykelkörkort', 'a1', 'a2'] },
  { canonical: 'C/C1-körkort (lastbil)', terms: ['c-kort', 'c-körkort', 'c1', 'lastbilskörkort', 'tungt körkort', 'tung lastbil'] },
  { canonical: 'CE-körkort (lastbil med släp)', terms: ['ce-kort', 'ce-körkort', 'c1e', 'lastbil med släp', 'tungt släp'] },
  { canonical: 'D/D1-körkort (buss)', terms: ['d-kort', 'd-körkort', 'd1', 'busskörkort', 'bussförarbehörighet'] },
  { canonical: 'BE-körkort (släp)', terms: ['be-kort', 'be-körkort', 'släpvagnskörkort', 'körkort med släp'] },
  { canonical: 'YKB (yrkeskompetensbevis)', terms: ['ykb', 'yrkeskompetensbevis', 'yrkesförarkompetens'] },
  { canonical: 'ADR (farligt gods)', terms: ['adr', 'farligt gods', 'adr 1.3', 'adr grund', 'dangerous goods'] },
  { canonical: 'Digital färdskrivare', terms: ['färdskrivare', 'digital färdskrivare', 'tachograph', 'förarkort'] },

  // ── TRUCK, LYFT, MASKIN ───────────────────────────────────
  { canonical: 'Truckkort', terms: ['truckkort', 'truckförarintyg', 'truckkörkort', 'truckbehörighet', 'tlp10', 'motviktstruck', 'skjutstativtruck', 'ledstaplare', 'forklift'], note: 'Klass A, B och C är olika trucktyper — A1–A4, B1–B4, C.' },
  { canonical: 'Liftkort / mobila arbetsplattformar', terms: ['liftkort', 'lift', 'saxlift', 'skylift', 'bomlift', 'mobil arbetsplattform', 'lla', 'liftutbildning'] },
  { canonical: 'Travers / lyftkran', terms: ['travers', 'traverskort', 'kranförarbevis', 'mobilkran', 'tornkran', 'lyftkran', 'lyftanordning'] },
  { canonical: 'Fallskydd & säkra lyft', terms: ['fallskydd', 'säkra lyft', 'lyftteknik', 'anhuggning', 'stroppning', 'signalman'] },
  { canonical: 'Hjullastare / anläggningsmaskin', terms: ['hjullastare', 'grävmaskin', 'grävmaskinist', 'anläggningsmaskin', 'maskinförarbevis', 'yrkesbevis maskinförare'] },

  // ── BYGG & INDUSTRI ───────────────────────────────────────
  { canonical: 'Heta arbeten', terms: ['heta arbeten', 'hetarbete', 'brandfarliga arbeten', 'svetstillstånd'] },
  { canonical: 'Ställningsbyggnad', terms: ['ställningsbygg', 'ställningsbyggnad', 'ställningsutbildning', 'byggnadsställning', 'allmän ställning', 'särskild ställning'] },
  { canonical: 'Arbete på väg / vägarbete', terms: ['arbete på väg', 'apv', 'väg 1', 'steg 1.1', 'steg 2.2', 'trafikvakt', 'vägarbete'] },
  { canonical: 'BAS-P / BAS-U (byggarbetsmiljö)', terms: ['bas-p', 'bas-u', 'byggarbetsmiljösamordnare', 'byggarbetsmiljö'] },
  { canonical: 'Svetslicens', terms: ['svets', 'svetsare', 'svetslicens', 'mig', 'mag', 'tig', 'pinnsvets', 'mma', 'rörsvets', 'welding'] },
  { canonical: 'CNC & maskinbearbetning', terms: ['cnc', 'cnc-operatör', 'fanuc', 'heidenhain', 'svarv', 'fräs', 'maskinoperatör'] },
  { canonical: 'Snickeri & bygg', terms: ['snickare', 'träarbetare', 'byggnadsarbetare', 'betongarbetare', 'murare', 'plattsättare', 'takläggare', 'yrkesbevis bygg'] },
  { canonical: 'VVS & rör', terms: ['vvs', 'rörmokare', 'rörläggare', 'vvs-montör', 'kyltekniker', 'ventilation', 'säker vatten'] },

  // ── EL & AUTOMATION ───────────────────────────────────────
  { canonical: 'Elbehörighet / auktorisation', terms: ['elbehörighet', 'behörighet el', 'auktorisation el', 'allmän behörighet', 'ab-behörighet', 'begränsad auktorisation', 'elsäkerhetsverket', 'elinstallatör'] },
  { canonical: 'Elektriker', terms: ['elektriker', 'elmontör', 'servicetekniker el', 'installationselektriker', 'industrielektriker', 'ecy-certifikat'] },
  { canonical: 'ESA / arbete med elrisk', terms: ['esa', 'esa 14', 'esa 19', 'elsäkerhet', 'elrisk', 'skötsel av elanläggning'] },
  { canonical: 'Automation & PLC', terms: ['plc', 'automation', 'siemens s7', 'tia portal', 'codesys', 'beckhoff', 'scada', 'hmi', 'abb robot', 'robotprogrammering'] },

  // ── IT: SPRÅK & RAMVERK ───────────────────────────────────
  { canonical: 'C# / .NET', terms: ['c#', 'c-sharp', 'csharp', 'dotnet', '.net', 'asp.net', 'net core', 'blazor', 'entity framework'] },
  { canonical: 'C / C++', terms: ['c++', 'cpp', 'c-plus-plus', 'embedded c'] },
  { canonical: 'Java', terms: ['java', 'spring', 'spring boot', 'jvm', 'kotlin'] },
  { canonical: 'JavaScript / TypeScript', terms: ['javascript', 'js', 'typescript', 'ts', 'node', 'node.js', 'nodejs', 'deno', 'bun'] },
  { canonical: 'React & frontend-ramverk', terms: ['react', 'react.js', 'reactjs', 'next.js', 'nextjs', 'vue', 'angular', 'svelte', 'frontend', 'front-end', 'klientsida'] },
  { canonical: 'Python', terms: ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy'] },
  { canonical: 'PHP', terms: ['php', 'laravel', 'symfony', 'wordpress-utveckling'] },
  { canonical: 'Backend & API', terms: ['backend', 'back-end', 'server-side', 'serversidan', 'api', 'rest', 'restful', 'graphql', 'mikrotjänster', 'microservices'] },
  { canonical: 'Databaser & SQL', terms: ['sql', 'mysql', 'postgres', 'postgresql', 'mssql', 'oracle', 'databas', 'mongodb', 'nosql', 'redis', 'databasadministration', 'dba'] },
  { canonical: 'Mobilutveckling', terms: ['ios', 'android', 'swift', 'objective-c', 'react native', 'flutter', 'mobilutveckling', 'apputveckling'] },

  // ── IT: DRIFT, MOLN, SÄKERHET ─────────────────────────────
  { canonical: 'DevOps & CI/CD', terms: ['devops', 'ci/cd', 'cicd', 'jenkins', 'github actions', 'gitlab ci', 'terraform', 'ansible', 'infrastructure as code', 'iac'] },
  { canonical: 'Container & orkestrering', terms: ['docker', 'kubernetes', 'k8s', 'container', 'openshift', 'helm'] },
  { canonical: 'Moln', terms: ['aws', 'azure', 'gcp', 'google cloud', 'molntjänster', 'cloud', 'moln'] },
  { canonical: 'IT-support & drift', terms: ['it-support', 'helpdesk', 'servicedesk', 'första linjen', 'andra linjen', '1st line', 'systemadministratör', 'sysadmin', 'active directory', 'windows server', 'linux'] },
  { canonical: 'Nätverk', terms: ['nätverk', 'network', 'ccna', 'cisco', 'tcp/ip', 'brandvägg', 'firewall', 'vpn', 'switch', 'router'] },
  { canonical: 'IT-säkerhet', terms: ['it-säkerhet', 'cybersäkerhet', 'informationssäkerhet', 'cyber security', 'penetrationstest', 'pentest', 'soc', 'siem', 'iso 27001', 'nis2'] },
  { canonical: 'Data & AI', terms: ['data science', 'dataanalys', 'maskininlärning', 'machine learning', 'ml', 'ai', 'llm', 'data engineer', 'etl', 'power bi', 'tableau', 'bi', 'business intelligence', 'qlik'] },
  { canonical: 'Test & QA', terms: ['test', 'testare', 'qa', 'kvalitetssäkring', 'testautomatisering', 'selenium', 'cypress', 'playwright', 'istqb'] },
  { canonical: 'Agila metoder', terms: ['agil', 'agile', 'scrum', 'scrum master', 'kanban', 'safe', 'produktägare', 'product owner', 'po'] },

  // ── VÅRD & OMSORG ─────────────────────────────────────────
  { canonical: 'Sjuksköterska', terms: ['ssk', 'sjuksköterska', 'leg. sjuksköterska', 'legitimerad sjuksköterska', 'nurse', 'grundutbildad sjuksköterska'] },
  { canonical: 'Specialistsjuksköterska', terms: ['specialistsjuksköterska', 'iva-sjuksköterska', 'anestesisjuksköterska', 'operationssjuksköterska', 'distriktssköterska', 'barnmorska'] },
  { canonical: 'Undersköterska', terms: ['usk', 'undersköterska', 'skyddad yrkestitel undersköterska', 'vårdbiträde'] },
  { canonical: 'Läkare', terms: ['läkare', 'leg. läkare', 'st-läkare', 'at-läkare', 'specialistläkare', 'överläkare', 'md'] },
  { canonical: 'Övriga legitimerade yrken', terms: ['fysioterapeut', 'sjukgymnast', 'arbetsterapeut', 'psykolog', 'logoped', 'dietist', 'tandläkare', 'tandhygienist', 'biomedicinsk analytiker', 'bma', 'apotekare', 'farmaceut', 'receptarie'] },
  { canonical: 'HLR & akutvård', terms: ['hlr', 'hjärt-lungräddning', 'hjärt och lungräddning', 'a-hlr', 's-hlr', 'd-hlr', 'första hjälpen', 'l-abcde', 'cpr'] },
  { canonical: 'Delegering & läkemedel', terms: ['delegering', 'delegerad', 'läkemedelsdelegering', 'läkemedelshantering', 'insulin', 'såromläggning'] },
  { canonical: 'Journalsystem', terms: ['journalsystem', 'cosmic', 'takecare', 'melior', 'obstetrix', 'treserva', 'procapita', 'combine', 'lifecare'] },
  { canonical: 'Socialt arbete', terms: ['socionom', 'socialsekreterare', 'biståndshandläggare', 'behandlingsassistent', 'stödassistent', 'boendestödjare', 'lss'] },

  // ── EKONOMI & ADMIN ───────────────────────────────────────
  { canonical: 'Redovisning & bokslut', terms: ['redovisning', 'bokföring', 'bokslut', 'årsredovisning', 'årsbokslut', 'månadsbokslut', 'k2', 'k3', 'huvudbok', 'avstämning'], note: 'Att ett bifogat dokument HETER årsredovisning bevisar inte erfarenhet.' },
  { canonical: 'Lön', terms: ['lön', 'löneadministratör', 'lönespecialist', 'payroll', 'hogia lön', 'kontek', 'agda', 'flex hrm'] },
  { canonical: 'Revision & skatt', terms: ['revision', 'revisor', 'auktoriserad revisor', 'skatt', 'moms', 'deklaration', 'skatterätt'] },
  { canonical: 'Affärssystem', terms: ['affärssystem', 'erp', 'sap', 'visma', 'fortnox', 'business central', 'navision', 'dynamics', 'ifs', 'monitor', 'pyramid', 'unit4', 'agresso'] },
  { canonical: 'Controlling & analys', terms: ['controller', 'business controller', 'financial controller', 'budget', 'prognos', 'forecast', 'kalkyl', 'nyckeltal', 'kpi'] },
  { canonical: 'Office & administration', terms: ['excel', 'pivottabell', 'letarad', 'xletauppgift', 'vlookup', 'office-paketet', 'microsoft 365', 'word', 'powerpoint', 'administration', 'orderhantering', 'fakturering'] },

  // ── HR, FÖRSÄLJNING, SERVICE ──────────────────────────────
  { canonical: 'HR & rekrytering', terms: ['hr', 'human resources', 'personalfrågor', 'rekrytering', 'talent acquisition', 'ta', 'kompetensförsörjning', 'arbetsrätt', 'las', 'mbl', 'kollektivavtal', 'facklig förhandling'] },
  { canonical: 'Försäljning', terms: ['försäljning', 'säljare', 'sälj', 'b2b', 'b2c', 'account manager', 'kam', 'key account', 'nykundsbearbetning', 'prospektering', 'merförsäljning', 'budgetansvar sälj'] },
  { canonical: 'CRM', terms: ['crm', 'salesforce', 'hubspot', 'dynamics 365', 'pipedrive', 'lime', 'upsales'] },
  { canonical: 'Kundtjänst & service', terms: ['kundtjänst', 'kundservice', 'kundsupport', 'call center', 'reception', 'ärendehantering', 'zendesk', 'freshdesk'] },
  { canonical: 'Marknadsföring', terms: ['marknadsföring', 'marknad', 'digital marknadsföring', 'seo', 'sökmotoroptimering', 'sem', 'google ads', 'meta ads', 'sociala medier', 'content', 'copywriting', 'e-post', 'newsletter', 'analytics', 'ga4'] },
  { canonical: 'Design & UX', terms: ['ux', 'ui', 'användarupplevelse', 'gränssnitt', 'figma', 'adobe', 'photoshop', 'illustrator', 'indesign', 'grafisk design', 'prototyp', 'wireframe'] },

  // ── LOGISTIK, HANDEL, RESTAURANG ──────────────────────────
  { canonical: 'Lager & logistik', terms: ['lager', 'lagerarbetare', 'logistik', 'plock', 'plock och pack', 'inleverans', 'utleverans', 'wms', 'inventering', 'spedition', 'terminal'] },
  { canonical: 'Inköp & supply chain', terms: ['inköp', 'inköpare', 'purchasing', 'supply chain', 'leverantörsförhandling', 'sourcing', 'avtalsförhandling'] },
  { canonical: 'Butik & handel', terms: ['butik', 'butikssäljare', 'kassa', 'kassavana', 'visual merchandising', 'butikschef', 'exponering'] },
  { canonical: 'Restaurang & storkök', terms: ['kock', 'kallskänka', 'servitör', 'servitris', 'barista', 'bartender', 'storkök', 'haccp', 'egenkontroll', 'livsmedelshygien'] },
  { canonical: 'Städ & lokalvård', terms: ['lokalvård', 'städ', 'städare', 'lokalvårdare', 'sry', 'prykl'] },

  // ── UTBILDNING & FORSKNING ────────────────────────────────
  { canonical: 'Lärare & pedagogik', terms: ['lärare', 'lärarlegitimation', 'förskollärare', 'fritidspedagog', 'barnskötare', 'speciallärare', 'specialpedagog', 'elevassistent', 'studie- och yrkesvägledare', 'syv'] },
  { canonical: 'Utbildningsnivå', terms: ['gymnasium', 'gymnasieutbildning', 'gymnasieexamen', 'högskola', 'universitet', 'yh', 'yrkeshögskola', 'kandidatexamen', 'bsc', 'magister', 'masterexamen', 'msc', 'civilingenjör', 'högskoleingenjör', 'doktorand', 'phd', 'disputerad'] },

  // ── INGENJÖR & ARKITEKTUR ─────────────────────────────────
  { canonical: 'CAD & ritningar', terms: ['cad', 'autocad', 'revit', 'solidworks', 'catia', 'inventor', 'creo', 'archicad', 'sketchup', 'bim', 'ritningsläsning', 'ritningsunderlag', 'tekla', 'magicad'] },
  { canonical: 'Arkitektur & samhällsbyggnad', terms: ['arkitekt', 'inredningsarkitekt', 'landskapsarkitekt', 'planarkitekt', 'bygglov', 'detaljplan', 'pbl', 'stadsbyggnad', 'kontrollansvarig', 'ka'] },
  { canonical: 'Konstruktion & beräkning', terms: ['konstruktör', 'hållfasthet', 'fem', 'ansys', 'beräkningsingenjör', 'dimensionering', 'eurokod', 'byggkonstruktion'] },
  { canonical: 'Projektledning', terms: ['projektledning', 'projektledare', 'projektchef', 'pmp', 'prince2', 'ipma', 'byggledare', 'platschef', 'arbetsledare', 'entreprenad', 'ab04', 'abt06', 'ama'] },
  { canonical: 'Kvalitet, miljö & arbetsmiljö', terms: ['kvalitetsledning', 'iso 9001', 'iso 14001', 'iso 45001', 'lean', 'six sigma', '5s', 'systematiskt arbetsmiljöarbete', 'sam', 'skyddsombud', 'miljösamordnare'] },

  // ── JURIDIK & OFFENTLIG SEKTOR ────────────────────────────
  { canonical: 'Juridik', terms: ['jurist', 'jur.kand', 'juristexamen', 'advokat', 'bolagsjurist', 'avtalsrätt', 'gdpr', 'dataskydd', 'dpo', 'dataskyddsombud', 'compliance', 'lou', 'offentlig upphandling'] },

  // ── SPRÅK ─────────────────────────────────────────────────
  { canonical: 'Svenska', terms: ['svenska', 'flytande svenska', 'obehindrad svenska', 'modersmål svenska', 'svenska i tal och skrift', 'sfi'], note: 'Bedöm NIVÅ, inte bara att språket nämns.' },
  { canonical: 'Engelska', terms: ['engelska', 'english', 'engelska i tal och skrift', 'professionell engelska', 'fluent english'] },
  { canonical: 'Övriga språk', terms: ['arabiska', 'somaliska', 'persiska', 'dari', 'tigrinja', 'spanska', 'tyska', 'franska', 'polska', 'finska', 'ukrainska', 'ryska', 'turkiska', 'kurdiska', 'thai', 'mandarin'] },

  // ── ARBETSTID, ANSTÄLLNING, ÖVRIGT ────────────────────────
  { canonical: 'Skift & obekväm arbetstid', terms: ['skift', 'skiftarbete', '2-skift', '3-skift', 'roterande arbetstid', 'ob', 'obekväm arbetstid', 'nattarbete', 'natt', 'helg', 'helgarbete', 'jour', 'beredskap'] },
  { canonical: 'Omfattning', terms: ['heltid', 'deltid', '100%', '75%', '50%', 'timanställning', 'vikariat', 'behovsanställning', 'extraarbete'] },
  { canonical: 'Registerutdrag & säkerhet', terms: ['belastningsregister', 'utdrag ur belastningsregistret', 'registerutdrag', 'säkerhetsprövning', 'säkerhetsklassning', 'sekretess'] },
  { canonical: 'Ledarskap', terms: ['ledarskap', 'chef', 'teamledare', 'gruppchef', 'personalansvar', 'budgetansvar', 'resultatansvar', 'coachning', 'arbetsledande'] },
  { canonical: 'Erfarenhetsnivå', terms: ['junior', 'senior', 'års erfarenhet', 'årig erfarenhet', 'erfarenhet av'], note: 'Räkna faktiska år från CV:ts tjänstgöringsperioder (t.ex. 2019–2024 ≈ 5 år). Junior ≈ 0–2 år, senior ≈ 5+ år.' },
];

const NON_WORD = /[^a-zA-ZåäöÅÄÖ0-9+#./ -]/g;

function normalize(text: string): string {
  return ` ${text.toLowerCase().replace(NON_WORD, ' ').replace(/\s+/g, ' ')} `;
}

/**
 * Plockar ut de aliasgrupper som är relevanta för rekryterarens kriterier.
 * Deterministisk (bevarar ALIAS_GROUPS-ordning) så cache-hashen blir stabil.
 */
export function matchAliasGroups(criteriaTexts: string[], maxGroups = 20): AliasGroup[] {
  const haystack = normalize(criteriaTexts.filter(Boolean).join(' \n '));
  if (haystack.trim().length === 0) return [];

  const matched: AliasGroup[] = [];
  for (const group of ALIAS_GROUPS) {
    const hit = group.terms.some((term) => {
      const t = term.toLowerCase().trim();
      if (t.length === 0) return false;
      // Korta termer (≤3 tecken, t.ex. "ob", "hr", "ml") kräver ordgräns
      if (t.length <= 3) return haystack.includes(` ${t} `);
      return haystack.includes(t);
    });
    if (hit) matched.push(group);
    if (matched.length >= maxGroups) break;
  }
  return matched;
}

/**
 * Renderar matchade grupper som ett kompakt promptavsnitt.
 * Tom sträng om inget matchar → prompten växer inte i onödan.
 */
export function buildAliasPromptBlock(criteriaTexts: string[]): string {
  const groups = matchAliasGroups(criteriaTexts);
  if (groups.length === 0) return '';

  const lines = groups.map((g) => {
    const terms = g.terms.join(' = ');
    return `• ${g.canonical}: ${terms}${g.note ? `\n  ↳ ${g.note}` : ''}`;
  });

  return `
═══════════════════════════════════════════════════
📚 SYNONYMLEXIKON FÖR DESSA KRITERIER (auktoritativt)
═══════════════════════════════════════════════════
Termerna på varje rad betyder SAMMA sak. Om kandidaten använder NÅGON av dem
räknas det som samma kompetens som rekryterarens formulering. Detta lexikon
går före din egen gissning — men bevisreglerna nedan gäller fortfarande
(ett omnämnande utan att kandidaten själv säger sig ha kompetensen är inte bevis).

${lines.join('\n')}
`;
}

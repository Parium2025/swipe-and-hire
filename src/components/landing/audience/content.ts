import { Brain, MessageCircle, ShieldCheck, Sparkles, Zap, BriefcaseBusiness, Filter, Target, Heart, Bell, Users, BarChart3, LayoutGrid, FileText } from 'lucide-react';

export type AudienceRole = 'job_seeker' | 'employer';

type AudienceContent = {
  eyebrow: string;
  hero: { headline: string[]; subtitle: string; cta: string };
  intro: { title: string; paragraphs: string[] };
  statement: { kicker: string; title: string; body: string };
  steps: { title: string; description: string }[];
  featuresIntro: string;
  features: { title: string; description: string; icon: typeof Brain }[];
  proof: { value: string; label: string }[];
  finalCta: { title: string; body: string; cta: string };
};

export const audienceContent: Record<AudienceRole, AudienceContent> = {
  job_seeker: {
    eyebrow: 'För jobbsökare',
    hero: {
      headline: ['Hitta jobb', 'som faktiskt', 'passar dig!'],
      subtitle: 'Söka jobb ska vara enkelt och smidigt. Här får du allt i en plattform. Vi finns både på webben och som en nedladdningsbar app.',
      cta: 'Skapa jobbsökarprofil',
    },
    intro: {
      title: 'Vi har gjort det enkelt för alla!',
      paragraphs: [
        'Med Parium hittar du jobbannonser från hela Sverige. Sök och ansök snabbt — i appen eller på webben.',
        'Samla erfarenhet, utbildning och personlighet. Ditt CV och din profil — på ett och samma ställe. Lägg upp din grund en gång.',
        'Skapa sedan olika presentationer med rätt bild, video och budskap för varje roll du vill söka. Rätt intryck till rätt arbetsgivare — varje gång.',
        'I nästa sektion ser du exempel på yrken som tar Sverige framåt.',
      ],
    },
    statement: {
      kicker: 'Tänk större om karriären',
      title: 'Söka jobb ska kännas enkelt.',
      body: 'Bygg en profil en gång. Få relevanta jobb i ditt flöde, spara det som lockar och starta dialogen direkt när intresset är ömsesidigt. Mindre administration. Mer av rollerna som faktiskt betyder något för dig.',
    },
    steps: [
      { title: 'Skapa din profil', description: 'Visa vem du är, vad du kan och vad du söker — utan långrandiga formulär.' },
      { title: 'Utforska alla jobb', description: 'Bläddra bland alla lediga roller och filtrera efter det som är viktigt för dig.' },
      { title: 'Visa intresse', description: 'Ett tryck räcker. Är intresset ömsesidigt öppnas dialogen direkt.' },
      { title: 'Ta nästa steg', description: 'Chatta med arbetsgivaren och kom till ett samtal — utan mellanled.' },
    ],
    featuresIntro: 'En genomtänkt upplevelse, designad för alla enheter — så att du alltid kan upptäcka möjligheter, skapa kontakter och ta nästa steg, oavsett var du befinner dig i din karriär.',
    features: [
      { title: 'Du bestämmer', description: 'Din profil, dina villkor. Du väljer vad som visas.', icon: ShieldCheck },
      { title: 'Profil framför CV', description: 'Visa vem du är med video, bilder och egna ord — en levande profil som kompletterar ditt CV.', icon: Sparkles },
      { title: 'Sök smart', description: 'Filtrera på plats, roll och erfarenhet. Hitta rätt jobb utan att scrolla i evighet.', icon: Brain },
      { title: 'Swipa & spara', description: 'Bläddra jobben med ett svep. Spara de du gillar och återvänd när du vill.', icon: Heart },
      { title: 'Jobbevakningar', description: 'Spara din sökning och få notis när en ny roll matchar.', icon: Bell },
      { title: 'Få kontakt direkt', description: 'Med premium får du tillgång till arbetsgivarens mejl och kan bli kontaktad direkt av arbetsgivaren i appen.', icon: MessageCircle },
    ],
    proof: [
      { value: 'En profil', label: 'för alla ansökningar' },
      { value: 'Mobil först', label: 'fungerar lika bra på webben' },
      { value: 'Utan CV-mallar', label: 'visa vem du faktiskt är' },
    ],
    finalCta: {
      title: 'Din nästa roll börjar här.',
      body: 'Skapa din profil idag — det är gratis. Ditt nästa jobb är bara en swipe bort.',
      cta: 'Kom igång gratis',
    },
  },
  employer: {
    eyebrow: 'För arbetsgivare',
    hero: {
      headline: ['Hitta rätta', 'kandidater', 'snabbare!'],
      subtitle: 'Möt kandidater som vill prata med just er. Annonsera, nå rätt och kom till samtal — utan onödiga mellansteg.',
      cta: 'Skapa arbetsgivarkonto',
    },
    intro: {
      title: 'Vi gör det tillsammans',
      paragraphs: [
        'Med Parium når ni kandidater i hela Sverige — och hanterar hela rekryteringen oavsett enhet.\u00a0',
        'Skapa anonnser/annonsen på några minuter med bild och ett tydligt budskap. Lägg upp den direkt och nå rätt kandidater utan krångel.',
        'Granska kandidaternas profiler, erfarenhet och kompetens i ett strukturerat flöde. När ni ser rätt kandidat väljer ni själva när ni vill öppna dialogen — utan onödiga mellanled.',
        'I nästa sektion ser ni exempel på yrken som tar Sverige framåt.',
      ],
    },
    statement: {
      kicker: 'Rekrytering, omtänkt',
      title: 'Bygg ett team utan att tappa fart.',
      body: 'Mindre administration, mer människor. Parium lyfter fram kandidaterna som passar rollen och tar er från första intresse till bokat samtal — i ett flöde som funkar lika bra från mobilen som från skrivbordet.',
    },
    steps: [
      { title: 'Lägg upp rollen', description: 'Definiera vad ni söker på minuter — vi sköter strukturen.' },
      { title: 'Få matchade kandidater', description: 'De mest relevanta profilerna lyfts fram först.' },
      { title: 'Filtrera och välj', description: 'Granska, sortera och besluta i ett snabbt, mobilt flöde.' },
      { title: 'Boka samtal', description: 'När intresset är ömsesidigt öppnas dialogen direkt.' },
    ],
    featuresIntro: 'Allt ni behöver för att hitta, utvärdera och anställa rätt person — i en plattform byggd för moderna team.',
    features: [
      { title: 'Relevanta kandidater', description: 'Här finner du kandidater som faktiskt vill ha ett jobb.\u00a0', icon: Target },
      { title: '\n', description: 'Granska, sortera och svara direkt i mobilen. Hela rekryteringen följer med er — vart ni än är.', icon: Filter },
      { title: 'Beslut i team', description: 'Bjud in kollegor, dela kandidater och fatta beslut tillsammans i en gemensam Kanban-vy.', icon: Users },
      { title: 'Direkt dialog', description: 'Öppna chatten med kandidater som vill prata. Ta nästa steg utan att lämna plattformen.', icon: Zap },
      { title: 'Strukturerade profiler', description: 'Video, bild, erfarenhet och AI-sammanfattningar — beslutsunderlag samlat på ett ställe.', icon: FileText },
      { title: 'Insikter i realtid', description: 'Följ annonsens räckvidd, ansökningstakt och kandidatflöde löpande. Optimera utan att gissa.', icon: BarChart3 },
    ],
    proof: [
      { value: 'Mobilt urval', label: 'rekrytera vart ni än är' },
      { value: 'Beslut i team', label: 'tillsammans i en delad vy' },
      { value: 'Insikter live', label: 'följ flödet i realtid' },
    ],
    finalCta: {
      title: 'Nästa anställning börjar här.',
      body: 'Skapa ert arbetsgivarkonto och möt kandidaterna som passar rollen — redan idag.',
      cta: 'Kom igång nu',
    },
  },
};

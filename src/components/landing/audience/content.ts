import { Brain, MessageCircle, ShieldCheck, Sparkles, Zap, BriefcaseBusiness, Filter, Target, Heart, Bell, Users, BarChart3, LayoutGrid, FileText } from 'lucide-react';

export type AudienceRole = 'job_seeker' | 'employer';

type AudienceContent = {
  eyebrow: string;
  hero: { headline: string[]; subtitle: string; cta: string };
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
    statement: {
      kicker: 'Tänk större om karriären',
      title: 'Söka jobb ska kännas enkelt.',
      body: 'Bygg en profil en gång. Få relevanta jobb i ditt flöde, spara det som lockar och starta dialogen direkt när intresset är ömsesidigt. Mindre administration. Mer av rollerna som faktiskt betyder något för dig.',
    },
    steps: [
      { title: 'Skapa din profil', description: 'Visa vem du är, vad du kan och vad du söker — utan långrandiga formulär.' },
      { title: 'Få matchningar', description: 'Vi visar roller som passar din erfarenhet, dina mål och din plats.' },
      { title: 'Visa intresse', description: 'Ett tryck räcker. Är intresset ömsesidigt öppnas dialogen direkt.' },
      { title: 'Ta nästa steg', description: 'Chatta med arbetsgivaren och kom till ett samtal — utan mellanled.' },
    ],
    featuresIntro: 'En genomtänkt upplevelse, byggd för mobilen — så att du kan söka, jämföra och svara där livet händer.',
    features: [
      { title: 'Smart matchning', description: 'Vi förstår mer än nyckelord. Du får roller som ligger nära din erfarenhet, dina mål och din plats.', icon: Brain },
      { title: 'Swipa & spara', description: 'Bläddra genom jobben med ett svep. Spara de intressanta och återvänd när du är redo.', icon: Heart },
      { title: 'Profil framför CV', description: 'Visa personlighet med profilvideo, bilder och egna ord. En modernare bild av dig än ett PDF-CV.', icon: Sparkles },
      { title: 'Direkt dialog', description: 'När båda visar intresse öppnas chatten direkt med arbetsgivaren. Inga mellanled — bara ett samtal.', icon: MessageCircle },
      { title: 'Jobbevakningar', description: 'Spara din sökning och få notis när en ny roll matchar. Du missar inget — utan att leta dagligen.', icon: Bell },
      { title: 'Du bestämmer', description: 'Din profil, dina villkor. Bestäm vad som visas, för vem och när. Avsluta eller pausa när du vill.', icon: ShieldCheck },
    ],
    proof: [
      { value: 'En profil', label: 'för alla ansökningar' },
      { value: 'Mobil först', label: 'fungerar lika bra på webben' },
      { value: 'Utan CV-mallar', label: 'visa vem du faktiskt är' },
    ],
    finalCta: {
      title: 'Din nästa roll börjar här.',
      body: 'Skapa din profil idag — det är gratis, och första matchningen är bara en swipe bort.',
      cta: 'Kom igång gratis',
    },
  },
  employer: {
    eyebrow: 'För arbetsgivare',
    hero: {
      headline: ['Hitta rätt', 'människor', 'snabbare!'],
      subtitle: 'Möt kandidater som vill prata med just er. Publicera, matcha och kom till samtal — utan att fastna i urvalet.',
      cta: 'Skapa arbetsgivarkonto',
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
      { title: 'Relevanta kandidater', description: 'Smart matchning lyfter fram profilerna som faktiskt passar rollen — så ni slipper bläddra för att hitta dem.', icon: Target },
      { title: 'Mobilt urval', description: 'Granska, sortera och svara direkt i mobilen. Hela rekryteringen följer med er — vart ni än är.', icon: Filter },
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

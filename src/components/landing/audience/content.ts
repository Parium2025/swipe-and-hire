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
      kicker: 'Karriär utan brus',
      title: 'Söka jobb ska kännas enkelt.',
      body: 'Parium samlar dina ansökningar, sparade favoriter och matchningar på ett ställe — utan långa formulär, kopierade CV:n eller onödigt brus. Du fokuserar på rollerna som faktiskt passar dig.',
    },
    steps: [
      { title: 'Skapa din profil', description: 'Visa vem du är, vad du kan och vad du söker — på minuter, inte timmar.' },
      { title: 'Få matchningar', description: 'Vi visar relevanta roller baserat på dina mål, erfarenhet och plats.' },
      { title: 'Visa intresse', description: 'Ett tryck räcker. Är intresset ömsesidigt öppnas dialogen direkt.' },
      { title: 'Ta nästa steg', description: 'Chatta med arbetsgivaren och boka samtal utan onödiga mellansteg.' },
    ],
    featuresIntro: 'Allt du behöver för att söka, jämföra och landa nästa jobb — samlat i en upplevelse byggd för mobilen.',
    features: [
      { title: 'Smart matchning', description: 'AI som förstår vad du faktiskt söker — inte bara nyckelord. Du får roller som matchar mål, erfarenhet och plats.', icon: Brain },
      { title: 'Swipa & spara', description: 'Bläddra genom jobben med ett svep. Spara intressanta roller och kom tillbaka när du är redo att söka.', icon: Heart },
      { title: 'Profil framför CV', description: 'Visa personlighet med profilvideo, bilder och egna ord. Ett modernt alternativ till det traditionella CV:t.', icon: Sparkles },
      { title: 'Direkt dialog', description: 'När intresset är ömsesidigt öppnas chatten direkt med arbetsgivaren. Inga mellanled, inga långa väntetider.', icon: MessageCircle },
      { title: 'Jobbevakningar', description: 'Spara dina sökningar och få notis så snart en ny roll matchar dina kriterier. Du missar aldrig rätt tillfälle.', icon: Bell },
      { title: 'Full kontroll', description: 'Du bestämmer vad som visas, för vem och när. Profilen är din — alltid skyddad och redigerbar.', icon: ShieldCheck },
    ],
    proof: [
      { value: '60s', label: 'till första matchning' },
      { value: '10x', label: 'snabbare dialog' },
      { value: '0', label: 'långa formulär' },
    ],
    finalCta: {
      title: 'Din nästa roll är ett swipe bort.',
      body: 'Skapa din profil idag och se relevanta jobb direkt.',
      cta: 'Kom igång gratis',
    },
  },
  employer: {
    eyebrow: 'För arbetsgivare',
    hero: {
      headline: ['Hitta rätt', 'människor', 'snabbare!'],
      subtitle: 'Få kvalificerade kandidater direkt i flödet och kom till samtal utan att fastna i urvalet.',
      cta: 'Skapa arbetsgivarkonto',
    },
    statement: {
      kicker: 'Rekrytera utan friktion',
      title: 'Bygg ett team utan att tappa fart.',
      body: 'Färre formulär, mer människor. Parium hjälper dig att fokusera på kandidaterna som faktiskt passar rollen — och tar dig snabbare från första intresse till bokat samtal.',
    },
    steps: [
      { title: 'Lägg upp rollen', description: 'Definiera vad du söker på minuter — vi sköter strukturen.' },
      { title: 'Få matchade kandidater', description: 'Smart matchning visar de mest relevanta först.' },
      { title: 'Filtrera och välj', description: 'Granska profiler i ett snabbt, mobilt flöde.' },
      { title: 'Boka samtal', description: 'När intresset är ömsesidigt öppnas dialogen direkt.' },
    ],
    featuresIntro: 'Allt du behöver för att hitta, utvärdera och anställa rätt person — i en plattform byggd för moderna team.',
    features: [
      { title: 'Kvalificerade kandidater', description: 'Smart matchning lyfter fram de mest relevanta först, så du slipper bläddra genom irrelevanta profiler.', icon: Target },
      { title: 'Mobilt urval', description: 'Granska, sortera och svara direkt i mobilen. Hela rekryteringen följer med dig — varhelst du är.', icon: Filter },
      { title: 'Team-samarbete', description: 'Bjud in kollegor, dela kandidater och fatta beslut tillsammans i en gemensam Kanban-vy.', icon: Users },
      { title: 'Direkt dialog', description: 'Öppna chatten med kandidater som vill prata. Boka intervjuer direkt utan att lämna plattformen.', icon: Zap },
      { title: 'Strukturerade profiler', description: 'Video, bild, erfarenhet och AI-genererade sammanfattningar — allt du behöver för att fatta beslut snabbt.', icon: FileText },
      { title: 'Insikter & statistik', description: 'Följ annonsernas räckvidd, ansökningstakt och kandidatflöde i realtid. Optimera utan att gissa.', icon: BarChart3 },
    ],
    proof: [
      { value: '60s', label: 'till första kandidat' },
      { value: '5x', label: 'snabbare urval' },
      { value: '100%', label: 'mobilanpassat' },
    ],
    finalCta: {
      title: 'Nästa anställning börjar här.',
      body: 'Skapa ditt arbetsgivarkonto och hitta kandidater idag.',
      cta: 'Kom igång nu',
    },
  },
};

import { Brain, MessageCircle, ShieldCheck, Sparkles, Zap, BriefcaseBusiness, Filter, Target } from 'lucide-react';

export type AudienceRole = 'job_seeker' | 'employer';

type AudienceContent = {
  eyebrow: string;
  hero: { headline: string[]; subtitle: string; cta: string };
  statement: { kicker: string; title: string; body: string };
  steps: { title: string; description: string }[];
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
      title: 'En tydligare väg till nästa steg.',
      body: 'Parium filtrerar bort bruset så att du kan fokusera på jobben som faktiskt matchar dig — på riktigt.',
    },
    steps: [
      { title: 'Skapa din profil', description: 'Visa vem du är, vad du kan och vad du söker — på minuter, inte timmar.' },
      { title: 'Få matchningar', description: 'Vi visar relevanta roller baserat på dina mål, erfarenhet och plats.' },
      { title: 'Visa intresse', description: 'Ett tryck räcker. Är intresset ömsesidigt öppnas dialogen direkt.' },
      { title: 'Ta nästa steg', description: 'Chatta med arbetsgivaren och boka samtal utan onödiga mellansteg.' },
    ],
    features: [
      { title: 'Smart matchning', description: 'AI som förstår vad du söker — inte bara nyckelord.', icon: Brain },
      { title: 'Snabb dialog', description: 'Direkt chat med arbetsgivare när intresset är ömsesidigt.', icon: MessageCircle },
      { title: 'Profil > CV', description: 'Visa personlighet, motivation och kompetens i ett format.', icon: Sparkles },
      { title: 'Trygg process', description: 'Du bestämmer vad som visas, för vem och när.', icon: ShieldCheck },
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
      headline: ['Hitta rätt', 'människor', 'snabbare.'],
      subtitle: 'Få kvalificerade kandidater direkt i flödet och kom till samtal utan att fastna i urvalet.',
      cta: 'Skapa arbetsgivarkonto',
    },
    statement: {
      kicker: 'Rekrytering på 60 sekunder',
      title: 'Bygg ett team utan att tappa fart.',
      body: 'Färre formulär, mer människor. Parium hjälper dig att fokusera på kandidaterna som faktiskt passar rollen.',
    },
    steps: [
      { title: 'Lägg upp rollen', description: 'Definiera vad du söker på minuter — vi sköter strukturen.' },
      { title: 'Få matchade kandidater', description: 'Smart matchning visar de mest relevanta först.' },
      { title: 'Filtrera och välj', description: 'Granska profiler i ett snabbt, mobilt flöde.' },
      { title: 'Boka samtal', description: 'När intresset är ömsesidigt öppnas dialogen direkt.' },
    ],
    features: [
      { title: 'Kvalificerade kandidater', description: 'Smart matchning som filtrerar bort bruset.', icon: Target },
      { title: 'Smidigare urval', description: 'Granska, sortera och svara i ett mobilt flöde.', icon: Filter },
      { title: 'Snabb dialog', description: 'Direkt kontakt med kandidater som vill prata.', icon: Zap },
      { title: 'Tydligare nästa steg', description: 'Strukturerade profiler och tydliga signaler.', icon: BriefcaseBusiness },
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

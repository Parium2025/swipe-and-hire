import { Helmet } from 'react-helmet-async';
import type { AudienceRole } from '@/components/landing/audience/content';

type SEOConfig = {
  title: string;
  description: string;
  canonical: string;
  ogImage?: string;
};

const SEO: Record<AudienceRole, SEOConfig> = {
  job_seeker: {
    title: 'Hitta jobb som passar dig – jobbapp & lediga jobb | Parium',
    description:
      'Hitta lediga jobb som faktiskt passar dig. Skapa profil gratis, matcha med arbetsgivare och chatta direkt i jobbappen Parium.',
    canonical: 'https://parium.se/jobbsokare',
  },
  employer: {
    title: 'Rekrytering på 60 sekunder – hitta rätt kandidater | Parium',
    description:
      'Snabbare rekrytering med smart matchning. Få kvalificerade kandidater i flödet, granska mobilt och boka samtal direkt. Testa Parium gratis.',
    canonical: 'https://parium.se/arbetsgivare',
  },
};

const faqsJobSeeker = [
  {
    q: 'Är Parium gratis för jobbsökare?',
    a: 'Ja. Att skapa profil, matcha med arbetsgivare och chatta är helt gratis för dig som söker jobb.',
  },
  {
    q: 'Hur hittar jag jobb som passar mig?',
    a: 'Skapa din profil på minuter. Parium matchar dig automatiskt med lediga jobb baserat på dina mål, erfarenhet och plats.',
  },
  {
    q: 'Finns Parium som app?',
    a: 'Ja, Parium fungerar både på webben och som jobbapp i mobilen.',
  },
];

const faqsEmployer = [
  {
    q: 'Hur snabbt kan jag börja rekrytera med Parium?',
    a: 'Du kan publicera en roll och få första matchningarna inom 60 sekunder.',
  },
  {
    q: 'Hur fungerar matchningen?',
    a: 'Vår smarta matchning visar de mest relevanta kandidaterna först, baserat på kraven du satt för rollen.',
  },
  {
    q: 'Vad kostar Parium för arbetsgivare?',
    a: 'Du kan skapa konto och testa Parium gratis. Se aktuella planer i appen.',
  },
];

export function AudienceSEO({ audience }: { audience: AudienceRole }) {
  const cfg = SEO[audience];
  const faqs = audience === 'job_seeker' ? faqsJobSeeker : faqsEmployer;

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <Helmet>
      <title>{cfg.title}</title>
      <meta name="description" content={cfg.description} />
      <link rel="canonical" href={cfg.canonical} />
      <meta property="og:title" content={cfg.title} />
      <meta property="og:description" content={cfg.description} />
      <meta property="og:url" content={cfg.canonical} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={cfg.title} />
      <meta name="twitter:description" content={cfg.description} />
      <script type="application/ld+json">{JSON.stringify(faqLd)}</script>
    </Helmet>
  );
}

export default AudienceSEO;

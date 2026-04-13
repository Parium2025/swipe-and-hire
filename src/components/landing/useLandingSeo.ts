import { useEffect } from 'react';

const LANDING_URL = 'https://parium-ab.lovable.app';
const OG_IMAGE = `${LANDING_URL}/lovable-uploads/parium-logo-transparent.png`;

const title = 'Parium | Premium AI-rekrytering i Norden';
const description =
  'Parium är en AI-rekryteringsplattform för Sverige och Norden med jobbmatchning, video, screening och direktdialog för företag och kandidater.';
const keywords =
  'AI-rekrytering, premium rekryteringsplattform, rekryteringsverktyg, jobbmatchning, video CV, video profiler, kandidatmatchning, hiring platform, HR tech, recruitment software, rekrytering Sverige, rekrytering Norden, hitta kandidater, hitta jobb, screening, intervjuverktyg, talangplattform, employer branding, direktdialog, rekryteringsapp';

const faqEntities = [
  {
    '@type': 'Question',
    name: 'Vad är Parium?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Parium är en AI-driven rekryteringsplattform för företag och kandidater i Sverige och Norden med jobbmatchning, video, screening och direktdialog i samma system.',
    },
  },
  {
    '@type': 'Question',
    name: 'Hur fungerar AI-rekrytering i Parium?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Parium använder AI-screening, strukturerade urvalsflöden och direktdialog för att korta tiden från första intresse till intervju och anställning.',
    },
  },
  {
    '@type': 'Question',
    name: 'Är Parium byggt för mobil, surfplatta och desktop?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Ja, Parium är byggt för touch, mus, Android, iPhone, surfplatta, laptop och stora skärmar med samma premiumupplevelse på alla enheter.',
    },
  },
  {
    '@type': 'Question',
    name: 'Kan både företag och kandidater använda Parium?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Ja, plattformen är byggd för både arbetsgivare och kandidater med separata flöden för att hitta rätt jobb, rätt kandidat och snabbare boka intervju.',
    },
  },
  {
    '@type': 'Question',
    name: 'Vad gör Parium annorlunda jämfört med traditionella jobbsajter?',
    acceptedAnswer: {
      '@type': 'Answer',
      text: 'Parium kombinerar AI-screening, jobbmatchning, video, direktdialog och intervjuflöden i en mer sammanhängande premiumupplevelse än traditionella jobbsajter och äldre rekryteringssystem.',
    },
  },
];

export const useLandingSeo = () => {
  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string, attr: 'name' | 'property' = 'name') => {
      let element = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;

      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }

      element.setAttribute('content', content);
    };

    const setLink = (rel: string, href: string, extra?: Record<string, string>) => {
      const selector = extra
        ? `link[rel="${rel}"][${Object.entries(extra)
            .map(([key, value]) => `${key}="${value}"`)
            .join('][')}]`
        : `link[rel="${rel}"]`;

      let element = document.querySelector(selector) as HTMLLinkElement | null;

      if (!element) {
        element = document.createElement('link');
        element.rel = rel;
        Object.entries(extra ?? {}).forEach(([key, value]) => element?.setAttribute(key, value));
        document.head.appendChild(element);
      }

      element.href = href;
    };

    setMeta('description', description);
    setMeta('keywords', keywords);
    setMeta('author', 'Parium AB');
    setMeta('robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setMeta('theme-color', 'hsl(215 100% 12%)');
    setMeta('application-name', 'Parium');
    setMeta('apple-mobile-web-app-title', 'Parium');
    setMeta('format-detection', 'telephone=no');

    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:type', 'website', 'property');
    setMeta('og:locale', 'sv_SE', 'property');
    setMeta('og:site_name', 'Parium', 'property');
    setMeta('og:url', LANDING_URL, 'property');
    setMeta('og:image', OG_IMAGE, 'property');
    setMeta('og:image:alt', 'Parium rekryteringsplattform', 'property');

    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    setMeta('twitter:image', OG_IMAGE);

    setLink('canonical', LANDING_URL);
    setLink('alternate', LANDING_URL, { hreflang: 'sv' });

    const softwareSchema = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Parium',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Recruitment Platform',
      operatingSystem: 'Web, iOS, Android',
      description,
      url: LANDING_URL,
      image: OG_IMAGE,
      inLanguage: ['sv', 'en'],
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'SEK',
        availability: 'https://schema.org/InStock',
        description: 'Tidigt tillträde till Parium utan kreditkort under lanseringsfasen.',
      },
      featureList: ['AI-screening', 'Jobbmatchning', 'Video-profiler', 'Direktmeddelanden', 'Intervjuflöden', 'Nordisk rekrytering'],
      publisher: {
        '@type': 'Organization',
        name: 'Parium AB',
        url: LANDING_URL,
      },
    };

    const organizationSchema = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Parium AB',
      url: LANDING_URL,
      logo: OG_IMAGE,
      description,
      foundingDate: '2025',
      areaServed: ['SE', 'NO', 'DK', 'FI'],
      knowsLanguage: ['sv', 'en'],
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'SE',
        addressLocality: 'Stockholm',
      },
    };

    const faqSchema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqEntities,
    };

    const websiteSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'Parium',
      url: LANDING_URL,
      description,
      inLanguage: 'sv',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${LANDING_URL}/search-jobs?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
      publisher: {
        '@type': 'Organization',
        name: 'Parium AB',
      },
    };

    const webPageSchema = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      url: LANDING_URL,
      description,
      inLanguage: 'sv-SE',
      isPartOf: {
        '@type': 'WebSite',
        name: 'Parium',
        url: LANDING_URL,
      },
      about: ['AI-rekrytering', 'jobbmatchning', 'rekryteringsplattform', 'video-profiler', 'kandidatdialog'],
    };

    const schemas = [
      { id: 'ld-software', data: softwareSchema },
      { id: 'ld-organization', data: organizationSchema },
      { id: 'ld-faq', data: faqSchema },
      { id: 'ld-website', data: websiteSchema },
      { id: 'ld-webpage', data: webPageSchema },
    ];

    schemas.forEach(({ id, data }) => {
      let script = document.querySelector(`#${id}`) as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement('script');
        script.id = id;
        script.type = 'application/ld+json';
        document.head.appendChild(script);
      }

      script.textContent = JSON.stringify(data);
    });

    return () => {
      schemas.forEach(({ id }) => document.querySelector(`#${id}`)?.remove());
      document.querySelector('link[rel="canonical"]')?.remove();
      document.querySelector('link[rel="alternate"][hreflang="sv"]')?.remove();
    };
  }, []);
};

export default useLandingSeo;

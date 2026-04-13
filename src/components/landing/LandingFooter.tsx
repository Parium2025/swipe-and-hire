import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

const links = [
  { label: 'Plattform', href: '#plattform' },
  { label: 'Bevis', href: '#bevis' },
  { label: 'Flöden', href: '#floden' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Kontakt', href: '#kontakt' },
];

const LandingFooter = () => {
  return (
    <footer className="relative border-t border-[hsl(var(--landing-border)/0.12)] px-5 py-12 sm:px-6 sm:py-16 md:px-12 lg:px-24" role="contentinfo">
      <div className="mx-auto max-w-7xl">
        <div className="landing-footer-shell rounded-[1.8rem] p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:justify-between">
            <div className="max-w-[30rem]">
              <a href="#top" className="inline-flex items-center" aria-label="Tillbaka till toppen">
                <img
                  src={pariumLogo}
                  alt="Parium logotyp"
                  className="h-auto w-24 sm:w-28"
                  loading="lazy"
                  width={128}
                  height={128}
                />
              </a>
              <p className="mt-4 text-sm leading-7 text-pure-white">
                AI-rekrytering, jobbmatchning, video, screening och direktdialog i ett premiumflöde byggt i Sverige för Norden.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <span className="landing-signal-pill">AI-rekrytering</span>
                <span className="landing-signal-pill">Nordisk produkt</span>
                <span className="landing-signal-pill">Mobil först, skala överallt</span>
              </div>
            </div>

            <nav aria-label="Sidfot-navigation">
              <ul className="list-none flex flex-wrap gap-x-6 gap-y-3 text-sm sm:gap-x-8">
                {links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="landing-footer-link flex min-h-[44px] items-center font-semibold text-pure-white transition-opacity duration-200 hover:opacity-100">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-3 text-sm text-pure-white sm:flex-row">
          <p>© {new Date().getFullYear()} Parium AB. Alla rättigheter reserverade.</p>
          <p>Byggd i Sverige för en nordisk marknad med fokus på SEO, känsla och hastighet.</p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;

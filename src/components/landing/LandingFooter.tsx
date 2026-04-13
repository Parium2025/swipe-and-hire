import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

const links = [
  { label: 'Funktioner', href: '#funktioner' },
  { label: 'Om oss', href: '#om-oss' },
  { label: 'Kontakt', href: '#kontakt' },
  { label: 'Support', href: '#support' },
  { label: 'Integritetspolicy', href: '#privacy' },
];

const LandingFooter = () => {
  return (
    <footer className="relative py-12 sm:py-16 px-5 sm:px-6 md:px-12 lg:px-24 border-t border-white/[0.05]" role="contentinfo">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <img
              src={pariumLogo}
              alt="Parium logotyp"
              className="h-auto w-24 md:w-32 opacity-60"
              loading="lazy"
              width={128}
              height={128}
            />
            <p className="text-white/25 text-xs">
              Framtidens rekrytering, idag.
            </p>
          </div>

          <nav aria-label="Sidfot-navigation">
            <ul className="flex flex-wrap justify-center gap-5 sm:gap-7 text-sm list-none">
              {links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/35 hover:text-white/60 transition-colors min-h-[44px] flex items-center text-[13px]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row justify-between items-center gap-3 text-white/20 text-xs">
          <p>© {new Date().getFullYear()} Parium AB. Alla rättigheter reserverade.</p>
          <p>Byggd i Sverige 🇸🇪</p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;

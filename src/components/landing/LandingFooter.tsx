import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

const links = [
  { label: 'Funktioner', href: '#funktioner' },
  { label: 'Kontakt', href: '#kontakt' },
  { label: 'Integritetspolicy', href: '#privacy' },
];

const LandingFooter = () => {
  return (
    <footer className="relative py-12 sm:py-16 px-5 sm:px-6 md:px-12 lg:px-24 border-t border-white/[0.04]" role="contentinfo">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center md:items-start gap-2">
            <img
              src={pariumLogo}
              alt="Parium logotyp"
              className="h-auto w-24 md:w-28 opacity-50"
              loading="lazy"
              width={128}
              height={128}
            />
            <p className="text-white/20 text-xs">Framtidens rekrytering, idag.</p>
          </div>
          <nav aria-label="Sidfot-navigation">
            <ul className="flex flex-wrap justify-center gap-6 text-sm list-none">
              {links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-white/30 hover:text-white/50 transition-colors min-h-[44px] flex items-center text-[13px]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-10 pt-6 border-t border-white/[0.03] flex flex-col sm:flex-row justify-between items-center gap-3 text-white/15 text-xs">
          <p>© {new Date().getFullYear()} Parium AB. Alla rättigheter reserverade.</p>
          <p>Byggd i Sverige 🇸🇪</p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;

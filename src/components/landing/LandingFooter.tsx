import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

const links = [
  { label: 'Funktioner', href: '#funktioner' },
  { label: 'Hur det fungerar', href: '#hur-det-fungerar' },
  { label: 'Kontakt', href: '#kontakt' },
  { label: 'Integritetspolicy', href: '#privacy' },
];

const LandingFooter = () => (
  <footer className="relative py-12 sm:py-16 px-5 sm:px-6 md:px-12 lg:px-24 border-t border-white/[0.03]" role="contentinfo">
    <div className="max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
        <div className="flex flex-col items-center md:items-start gap-2">
          <img
            src={pariumLogo}
            alt="Parium logotyp"
            className="h-auto w-24 md:w-28 opacity-40"
            loading="lazy"
            width={128}
            height={128}
          />
          <p className="text-white/15 text-xs tracking-wide">Framtidens rekrytering, idag.</p>
        </div>
        <nav aria-label="Sidfot-navigation">
          <ul className="flex flex-wrap justify-center gap-6 text-sm list-none">
            {links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.href}
                  className="text-white/20 hover:text-white/40 transition-colors text-[13px] font-medium"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="mt-10 pt-6 border-t border-white/[0.02] flex flex-col sm:flex-row justify-between items-center gap-3 text-white/10 text-xs tracking-wide">
        <p>© {new Date().getFullYear()} Parium AB. Alla rättigheter reserverade.</p>
        <p>Byggd i Sverige 🇸🇪</p>
      </div>
    </div>
  </footer>
);

export default LandingFooter;

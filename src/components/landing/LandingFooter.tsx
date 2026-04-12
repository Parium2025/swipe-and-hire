import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

const links = [
  { label: 'Funktioner', href: '#funktioner' },
  { label: 'Hur det funkar', href: '#hur-det-funkar' },
  { label: 'Kontakt', href: '#kontakt' },
  { label: 'Integritetspolicy', href: '#privacy' },
];

const LandingFooter = () => {
  return (
    <footer className="relative border-t border-white/[0.04] px-5 py-12 sm:px-6 sm:py-16 md:px-12 lg:px-24" role="contentinfo">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
          <div className="flex flex-col items-center gap-2 md:items-start">
            <img
              src={pariumLogo}
              alt="Parium logotyp"
              className="h-auto w-24 opacity-60 md:w-32"
              loading="lazy"
              width={128}
              height={128}
            />
            <p className="text-xs text-white/74">Framtidens rekrytering, idag.</p>
          </div>

          <nav aria-label="Sidfot-navigation">
            <ul className="list-none flex flex-wrap justify-center gap-5 text-sm sm:gap-7">
              {links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="flex min-h-[44px] items-center text-[13px] text-white/76 transition-colors hover:text-white">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/[0.04] pt-6 text-xs text-white/68 sm:flex-row">
          <p>© {new Date().getFullYear()} Parium AB. Alla rättigheter reserverade.</p>
          <p>Byggd i Sverige 🇸🇪</p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;

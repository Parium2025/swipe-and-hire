import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

const LandingFooter = () => {
  return (
    <footer className="relative py-12 sm:py-16 px-6 md:px-12 lg:px-24 border-t border-white/[0.06]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          {/* Logo */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <img
              src={pariumLogo}
              alt="Parium"
              className="h-auto w-28 md:w-36 opacity-70"
              loading="lazy"
            />
            <p className="text-white/30 text-xs">
              Framtidens rekrytering, idag.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center gap-6 md:gap-8 text-sm">
            {['Om oss', 'Kontakt', 'Support', 'Integritetspolicy'].map((label) => (
              <button
                key={label}
                className="text-white/40 hover:text-white/70 transition-colors min-h-[44px] flex items-center"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-white/25 text-xs">
            © {new Date().getFullYear()} Parium AB. Alla rättigheter reserverade.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default LandingFooter;

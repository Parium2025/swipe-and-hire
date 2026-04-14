import { motion } from 'framer-motion';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

const ease = [0.22, 1, 0.36, 1] as const;

const links = [
  { label: 'Funktioner', href: '#funktioner' },
  { label: 'Hur det fungerar', href: '#hur-det-fungerar' },
  { label: 'Kontakt', href: '#kontakt' },
  { label: 'Integritetspolicy', href: '#privacy' },
];

const socialLinks = [
  { label: 'LinkedIn', href: '#' },
  { label: 'Instagram', href: '#' },
  { label: 'Twitter', href: '#' },
];

const LandingFooter = () => (
  <footer className="relative overflow-hidden border-t border-white/[0.04]" role="contentinfo">
    {/* Large bold statement */}
    <div className="py-16 sm:py-24 px-5 sm:px-6 md:px-12 lg:px-24">
      <div className="max-w-[1400px] mx-auto">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease }}
        >
          <p className="text-[1.5rem] sm:text-[2.5rem] md:text-[4rem] lg:text-[5rem] font-black tracking-[-0.04em] text-white/[0.06] uppercase leading-[0.95] select-none">
            Alltid redo.
            <br />
            <span className="bg-gradient-to-r from-secondary/20 to-[hsl(190_100%_55%/0.20)] bg-clip-text text-transparent">
              Alltid matchande.
            </span>
          </p>
        </motion.div>
      </div>
    </div>

    {/* Footer content */}
    <div className="py-12 sm:py-16 px-5 sm:px-6 md:px-12 lg:px-24 bg-white/[0.01]">
      <div className="max-w-[1400px] mx-auto">
        <div className="grid md:grid-cols-3 gap-10 md:gap-8 items-start">
          {/* Logo + tagline */}
          <div className="flex flex-col items-center md:items-start gap-3">
            <img
              src={pariumLogo}
              alt="Parium logotyp"
              className="h-auto w-24 md:w-28 opacity-40"
              loading="lazy"
              width={128}
              height={128}
            />
            <p className="text-white/20 text-xs tracking-wide">Framtidens rekrytering, idag.</p>
          </div>

          {/* Navigation */}
          <div className="text-center">
            <p className="text-white/25 text-[10px] font-semibold tracking-[0.2em] uppercase mb-4">Sidor</p>
            <nav aria-label="Sidfot-navigation">
              <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm list-none">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-white/30 hover:text-secondary transition-colors text-[13px] font-medium"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          {/* Social */}
          <div className="text-center md:text-right">
            <p className="text-white/25 text-[10px] font-semibold tracking-[0.2em] uppercase mb-4">Följ oss</p>
            <div className="flex justify-center md:justify-end gap-6">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-white/30 hover:text-secondary transition-colors text-sm font-semibold uppercase tracking-wide"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-white/[0.03] flex flex-col sm:flex-row justify-between items-center gap-3 text-white/15 text-xs tracking-wide">
          <p>© {new Date().getFullYear()} Parium AB. Alla rättigheter reserverade.</p>
          <p>Byggd i Sverige 🇸🇪</p>
        </div>
      </div>
    </div>
  </footer>
);

export default LandingFooter;

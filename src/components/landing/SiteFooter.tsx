import { Link } from 'react-router-dom';

/**
 * Klassisk företagsfooter – företagsinfo, copyright och ®.
 * Används på alla publika landningssidor (AudienceLanding, OmOss).
 */
const SiteFooter = () => {
  const year = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      className="relative border-t border-white/10 bg-primary/95 px-5 py-10 text-white sm:px-8 sm:py-12"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 text-center md:flex-row md:items-start md:justify-between md:text-left">
        {/* Brand + claim */}
        <div className="flex flex-col items-center gap-2 md:items-start">
          <Link to="/" className="text-lg font-semibold tracking-tight text-white">
            Parium<span aria-label="registrerat varumärke" className="ml-0.5 align-super text-[0.55em] text-white/70">®</span>
          </Link>
          <p className="max-w-xs text-sm leading-6 text-white/65">
            Jobbappen som matchar dig med rätt jobb eller rätt kandidat på sekunder.
          </p>
        </div>

        {/* Företagsinfo */}
        <div className="text-sm leading-6 text-white/70">
          <p className="font-medium text-white">Parium AB</p>
          {/* TODO: Fyll i org.nr och postadress när dessa är klara */}
          <p>Org.nr: 559XXX-XXXX</p>
          <p>
            <a
              href="mailto:hej@parium.se"
              className="text-white/85 underline-offset-4 hover:text-white hover:underline"
            >
              hej@parium.se
            </a>
          </p>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-[1200px] border-t border-white/10 pt-6 text-center text-xs text-white/55 sm:text-left">
        © {year} Parium AB. Alla rättigheter förbehållna.
      </div>
    </footer>
  );
};

export default SiteFooter;

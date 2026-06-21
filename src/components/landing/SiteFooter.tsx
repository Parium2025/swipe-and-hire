import { Link } from 'react-router-dom';
import { saveScrollNow } from '@/lib/scrollRestoration';

type ColLink = { label: string; to: string };

const cityLinks: ColLink[] = [
  { label: 'Stockholm', to: '/jobb/stockholm' },
  { label: 'Göteborg', to: '/jobb/goteborg' },
  { label: 'Malmö', to: '/jobb/malmo' },
  { label: 'Uppsala', to: '/jobb/uppsala' },
  { label: 'Linköping', to: '/jobb/linkoping' },
  { label: 'Alla kommuner', to: '/kommuner' },
];

const occupationLinks: ColLink[] = [
  { label: 'Undersköterska', to: '/yrke/underskoterska' },
  { label: 'Elektriker', to: '/yrke/elektriker' },
  { label: 'Snickare', to: '/yrke/snickare' },
  { label: 'Lagerarbetare', to: '/yrke/lagerarbetare' },
  { label: 'Säljare', to: '/yrke/saljare' },
  { label: 'Alla yrken', to: '/yrken' },
];

const guideLinks: ColLink[] = [
  { label: 'Genomsnittslön Sverige 2026', to: '/guider/genomsnittslon-sverige-2026' },
  { label: 'Tips inför anställningsintervjun', to: '/guider/anstallningsintervju-tips' },
  { label: 'Personligt brev 2026', to: '/guider/personligt-brev-2026' },
  { label: 'Vanligaste intervjufrågorna', to: '/guider/jobbintervju-fragor-svar' },
  { label: 'Lönesamtal – så lyckas du', to: '/guider/lonesamtal-tips' },
  { label: 'Alla guider', to: '/guider' },
];

const companyLinks: ColLink[] = [
  { label: 'Om oss', to: '/om-oss' },
  { label: 'För jobbsökare', to: '/jobbsokare' },
  { label: 'För arbetsgivare', to: '/arbetsgivare' },
  { label: 'Lediga jobb', to: '/jobb' },
];

function Column({ title, links }: { title: string; links: ColLink[] }) {
  return (
    <div>
      <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
        {title}
      </h3>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="inline-block min-h-touch text-[15px] font-medium leading-6 text-white transition-colors hover:text-secondary"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SiteFooter = () => {
  return (
    <footer className="relative w-full bg-primary text-white">
      {/* Hairline top edge */}
      <div className="h-px w-full bg-white/10" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-10 pt-14 sm:px-8 sm:pt-16">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4">
          <Column title="Hitta jobb" links={cityLinks} />
          <Column title="Yrken" links={occupationLinks} />
          <Column title="Guider" links={guideLinks} />
          <Column title="Företaget" links={companyLinks} />
        </div>

        {/* Bottom bar */}
        <div className="mt-14 border-t border-white/10 pt-6 text-center text-[13px] font-medium text-white">
          <p>© {new Date().getFullYear()} Parium AB. Alla rättigheter förbehållna.</p>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;

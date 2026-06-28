import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { preloadAboutPageAssets } from '@/lib/aboutPagePreload';
import { saveScrollNow } from '@/lib/scrollRestoration';

// Apple-style premium entry — samma timing/easing som AboutPage så
// hela sajten har symmetrisk rörelsekänsla.
const FOOTER_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];
const footerColumnVariants: Variants = {
  hidden: { opacity: 0, y: 18, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: FOOTER_EASE },
  },
};
const footerContainerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};


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
  { label: 'Genomsnittslön 2026', to: '/guider/genomsnittslon-sverige-2026' },
  { label: 'Intervjutips', to: '/guider/anstallningsintervju-tips' },
  { label: 'Personligt brev', to: '/guider/personligt-brev-2026' },
  { label: 'Intervjufrågor', to: '/guider/jobbintervju-fragor-svar' },
  { label: 'Lönesamtal', to: '/guider/lonesamtal-tips' },
  { label: 'Alla guider', to: '/guider' },
];

const companyLinks: ColLink[] = [
  { label: 'Om oss', to: '/om-oss' },
  { label: 'För jobbsökare', to: '/jobbsokare' },
  { label: 'För arbetsgivare', to: '/arbetsgivare' },
  { label: 'Lediga jobb', to: '/jobb' },
];

function useRememberFooterOrigin() {
  return (to: string) => {
    try {
      saveScrollNow(window.location.pathname, {
        restoreSource: 'footer',
        restoreTargetPath: to,
      });
    } catch { /* ignore */ }
  };
}

function FooterLink({ link }: { link: ColLink }) {
  const remember = useRememberFooterOrigin();
  const warmTarget = () => {
    if (link.to === '/om-oss') void preloadAboutPageAssets('low');
  };

  return (
    <Link
      to={link.to}
      state={typeof window !== 'undefined' ? { footerOriginPath: window.location.pathname } : undefined}
      onPointerEnter={warmTarget}
      onFocus={warmTarget}
      onPointerDown={() => {
        warmTarget();
        remember(link.to);
      }}
      onClick={() => remember(link.to)}
      className="inline-flex min-h-11 items-center whitespace-nowrap text-[15px] font-medium leading-none text-white transition-colors hover:text-secondary"
    >
      {link.label}
    </Link>
  );
}

function ColumnHeader({ title }: { title: string }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-secondary">
      {title}
    </h3>
  );
}

function MobileSection({ title, links }: { title: string; links: ColLink[] }) {
  return (
    <div>
      <ColumnHeader title={title} />
      <ul className="mt-2 space-y-0">
        {links.map((link) => (
          <li key={link.to}>
            <FooterLink link={link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Row-aligned pair: both columns share the same fixed-height grid rows,
 * so every link sits on the exact same baseline across columns.
 * Apple-style symmetry — no drift, no asymmetric gaps.
 */
function ColumnPair({
  leftTitle,
  leftLinks,
  rightTitle,
  rightLinks,
}: {
  leftTitle: string;
  leftLinks: ColLink[];
  rightTitle: string;
  rightLinks: ColLink[];
}) {
  const rows = Math.max(leftLinks.length, rightLinks.length);
  return (
    <div
      className="grid grid-cols-2 gap-x-8"
      style={{
        gridTemplateRows: `auto repeat(${rows}, 44px)`,
      }}
    >
      <ColumnHeader title={leftTitle} />
      <ColumnHeader title={rightTitle} />

      {Array.from({ length: rows }).map((_, i) => (
        <Fragment key={i}>
          <div className="flex items-center">
            {leftLinks[i] ? <FooterLink link={leftLinks[i]} /> : null}
          </div>
          <div className="flex items-center">
            {rightLinks[i] ? <FooterLink link={rightLinks[i]} /> : null}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

const SiteFooter = () => {
  const { pathname } = useLocation();
  const filteredCompanyLinks = companyLinks.filter((l) => l.to !== pathname);
  const reduce = useReducedMotion();

  const motionProps = reduce
    ? {}
    : {
        initial: 'hidden' as const,
        whileInView: 'show' as const,
        viewport: { once: true, margin: '0px 0px -10% 0px' },
        variants: footerContainerVariants,
      };
  const itemVariants = reduce ? undefined : footerColumnVariants;

  return (
    <footer className="relative w-full bg-primary text-white">
      {/* Hairline top edge */}
      <div className="h-px w-full bg-white/10" />

      <div className="mx-auto w-full max-w-7xl px-6 pb-10 pt-14 sm:px-8 sm:pt-16">
        {/* Mobile: single column, section by section */}
        <motion.div className="grid grid-cols-1 gap-8 md:hidden" {...motionProps}>
          <motion.div variants={itemVariants}>
            <MobileSection title="Hitta jobb i" links={cityLinks} />
          </motion.div>
          <div className="h-px bg-white/10" aria-hidden="true" />
          <motion.div variants={itemVariants}>
            <MobileSection title="Yrken" links={occupationLinks} />
          </motion.div>
          <div className="h-px bg-white/10" aria-hidden="true" />
          <motion.div variants={itemVariants}>
            <MobileSection title="Guider" links={guideLinks} />
          </motion.div>
          <div className="h-px bg-white/10" aria-hidden="true" />
          <motion.div variants={itemVariants}>
            <MobileSection title="Företaget" links={filteredCompanyLinks} />
          </motion.div>
        </motion.div>

        {/* Desktop: aligned two-column pairs */}
        <motion.div
          className="hidden md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-12"
          {...motionProps}
        >
          <motion.div variants={itemVariants}>
            <ColumnPair
              leftTitle="Hitta jobb i"
              leftLinks={cityLinks}
              rightTitle="Yrken"
              rightLinks={occupationLinks}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <ColumnPair
              leftTitle="Guider"
              leftLinks={guideLinks}
              rightTitle="Företaget"
              rightLinks={filteredCompanyLinks}
            />
          </motion.div>
        </motion.div>

        {/* Bottom bar */}
        <div className="mt-14 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-[13px] font-medium text-white sm:flex-row sm:gap-4">
          <p className="text-center sm:text-left">© {new Date().getFullYear()} Parium AB. Alla rättigheter förbehållna.</p>
          <Link
            to="/auth"
            className="inline-flex min-h-11 items-center text-[13px] font-semibold text-white transition-colors hover:text-secondary"
          >
            Logga in här →
          </Link>
        </div>
      </div>
    </footer>
  );
};


export default SiteFooter;

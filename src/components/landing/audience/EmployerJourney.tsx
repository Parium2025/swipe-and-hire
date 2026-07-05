import type React from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  PenLine,
  Users,
  LayoutGrid,
  UserPlus,
  MessagesSquare,
  Mail,
  type LucideIcon,
} from 'lucide-react';



type JourneyStep = {
  title: string;
  body: string;
  icon: LucideIcon;
};

const steps: JourneyStep[] = [
  {
    title: 'Skapa annonsen på några minuter',
    body: 'Bygg en tydlig och professionell jobbannons direkt i appen eller i webben — steg för steg, utan krångliga mallar.',
    icon: PenLine,
  },
  {
    title: 'Möt kandidater som verkligen vill',
    body: 'Ni ser bara kandidater som aktivt sökt just er roll — inga slumpmässiga profiler eller kalla listor.',
    icon: Users,
  },
  {
    title: 'Samla favoriterna\u00a0',
    body: 'Lägg till kandidaterna ni vill gå vidare med och flytta dem mellan era egna steg i en tydlig vy.',
    icon: LayoutGrid,
  },
  {
    title: 'Rekrytera tillsammans med teamet',
    body: 'Med våra Premium-paket bjuder ni in kollegor och arbetar tillsammans i samma vy — välj antal användare efter behov.',
    icon: UserPlus,
  },
  {
    title: 'Öppna dialogen direkt',
    body: 'Chatta med kandidater som vill vidare, ställ följdfrågor och boka in intervju när det känns rätt.',
    icon: MessagesSquare,
  },
  {
    title: 'Ge alla kandidater ett svar',
    body: 'När processen är klar skickar Parium ett automatiskt mejl till de kandidater som inte gått vidare. Välj vår förinställda text eller skriv ert helt egna meddelande — så ingen lämnas utan återkoppling.',
    icon: Mail,
  },
];

export function EmployerJourney({
  steps: stepsProp,
  mobileClassMode = false,
}: { steps?: JourneyStep[]; mobileClassMode?: boolean } = {}) {
  const listRef = useRef<HTMLOListElement | null>(null);
  const activeSteps = stepsProp ?? steps;

  useLayoutEffect(() => {
    if (mobileClassMode) return;
    const list = listRef.current;
    if (!list) return;

    const items = Array.from(
      list.querySelectorAll<HTMLLIElement>('[data-journey-step]'),
    );
    if (items.length === 0) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    if (prefersReduced) {
      items.forEach((el) => el.setAttribute('data-journey-shown', 'true'));
      return;
    }

    items.forEach((el) => el.setAttribute('data-journey-shown', 'false'));

    const scrollRoot = list.closest('[data-landing-scroll-root]') as HTMLElement | null;
    let cancelled = false;
    let raf = 0;
    const timers: number[] = [];

    const reveal = (el: HTMLLIElement) => {
      el.setAttribute('data-journey-shown', 'true');
    };

    const shouldRevealList = () => {
      const rootRect = scrollRoot?.getBoundingClientRect() ?? {
        top: 0,
        bottom: window.innerHeight || document.documentElement.clientHeight,
      };
      const rect = list.getBoundingClientRect();
      const rootHeight = rootRect.bottom - rootRect.top;
      return rect.bottom > rootRect.top + 16 && rect.top < rootRect.top + rootHeight * 0.92;
    };

    const syncVisible = () => {
      if (cancelled) return;
      if (!shouldRevealList()) return;
      items.forEach((el) => {
        if (el.getAttribute('data-journey-shown') !== 'true') reveal(el);
      });
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        syncVisible();
      });
    };

    const start = () => {
      schedule();
      timers.push(window.setTimeout(syncVisible, 80), window.setTimeout(syncVisible, 260), window.setTimeout(syncVisible, 900));
    };

    const isCookieBannerOpen = () => document.documentElement.dataset.cookieBannerOpen === 'true';
    if (isCookieBannerOpen()) {
      const onConsent = () => {
        window.removeEventListener('parium:cookie-consent-updated', onConsent);
        window.setTimeout(start, 50);
      };
      window.addEventListener('parium:cookie-consent-updated', onConsent);
      return () => {
        cancelled = true;
        window.removeEventListener('parium:cookie-consent-updated', onConsent);
        if (raf) window.cancelAnimationFrame(raf);
        timers.forEach((timer) => window.clearTimeout(timer));
      };
    }

    start();
    scrollRoot?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
      timers.forEach((timer) => window.clearTimeout(timer));
      scrollRoot?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [mobileClassMode]);

  // Touch: låt "glowen" följa scrollen istället för hover. Aktivt steg = det
  // vars kort ligger närmast en fast ankare-linje ~38% ned i viewporten.
  // Ändras kontinuerligt vid scroll så glowen hoppar mellan stegen både
  // framåt och bakåt. Ingen effekt på hover-enheter.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(hover: none)').matches) return;

    const scrollRoot = list.closest('[data-landing-scroll-root]') as HTMLElement | null;
    let raf = 0;
    let currentActive = -1;

    const compute = () => {
      raf = 0;
      const items = Array.from(list.querySelectorAll<HTMLLIElement>('li'));
      if (!items.length) return;
      const rootRect = scrollRoot?.getBoundingClientRect() ?? {
        top: 0,
        bottom: window.innerHeight || document.documentElement.clientHeight,
      };
      const rootHeight = rootRect.bottom - rootRect.top;
      const anchorY = rootRect.top + rootHeight * 0.38;

      let bestIdx = -1;
      let bestDist = Infinity;
      items.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        // Bara steg som faktiskt är i (eller nära) viewporten får bli aktiva
        if (rect.bottom < rootRect.top || rect.top > rootRect.bottom) return;
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(center - anchorY);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = idx;
        }
      });

      if (bestIdx === currentActive) return;
      currentActive = bestIdx;
      items.forEach((el, idx) => {
        if (idx === bestIdx) el.setAttribute('data-journey-active', 'true');
        else el.removeAttribute('data-journey-active');
      });
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(compute);
    };

    schedule();
    scrollRoot?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      scrollRoot?.removeEventListener('scroll', schedule);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, [mobileClassMode, activeSteps]);


  return (
    <div className="relative mt-10 sm:mt-14">
      {/* Vertikal tidslinje — synlig från md och uppåt */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-[27px] top-2 hidden h-[calc(100%-16px)] w-px bg-gradient-to-b from-secondary/60 via-secondary/25 to-transparent md:block"
      />

      <ol ref={listRef} className="space-y-6 md:space-y-8">
        {activeSteps.map((step, idx) => {
          const Icon = step.icon;
          const number = String(idx + 1);
          return (
            <li
              key={step.title}
              {...(mobileClassMode
                ? {}
                : {
                    'data-journey-step': true as unknown as string,
                    'data-journey-side': idx % 2 === 0 ? 'left' : 'right',
                  })}
              style={
                mobileClassMode
                  ? ({
                      ['--lf-x' as string]: idx % 2 === 0 ? '-46px' : '46px',
                      ['--lf-y' as string]: '0px',
                      // Kort stagger (max ~240ms). Eftersom varje steg triggas
                      // när det scrollas in – inte alla samtidigt – räcker en
                      // liten fördröjning för att undvika synkronrörelse när
                      // två steg råkar synas i samma svep.
                      ['--lf-delay' as string]: `${Math.min(idx, 3) * 80}ms`,
                      willChange: 'opacity, transform',
                    } as React.CSSProperties)
                  : { transitionDelay: `${Math.min(idx, 5) * 110}ms` }
              }
              className={`employer-journey-step relative${mobileClassMode ? ' landing-feature-mobile-in' : ''}`}
            >


              <div className="grid gap-5 md:grid-cols-[56px_1fr] md:gap-8">
                {/* Nummer / ikon-kolumn */}
                <div className="relative flex md:justify-center">
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary bg-gradient-to-br from-secondary/25 to-secondary/5 text-secondary shadow-[0_10px_30px_-16px_hsl(var(--secondary)/0.6)] [@media_(hover:hover)]:backdrop-blur-xl">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                    <span className="employer-journey-icon-glow pointer-events-none absolute inset-0 hidden rounded-2xl bg-secondary/20 opacity-0 blur-xl transition-opacity duration-500 [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:none)]:block" />
                  </div>
                </div>



                {/* Textkort */}
                <article className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.055] to-white/[0.02] p-6 transition-[border-color,box-shadow,transform] duration-500 hover:-translate-y-0.5 hover:border-secondary/35 hover:shadow-[0_28px_60px_-30px_hsl(var(--secondary)/0.55)] sm:p-8 [@media_(hover:hover)]:backdrop-blur-xl">
                  <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-secondary/60 to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-100" />
                  <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,hsl(var(--secondary)/0.16),transparent_65%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] font-semibold tracking-[0.28em] text-secondary/80">
                      STEG {number}
                    </span>
                    <span className="h-px flex-1 bg-gradient-to-r from-secondary/30 to-transparent" />
                  </div>

                  <h3 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[15px] leading-7 text-white sm:text-base">
                    {step.body}
                  </p>
                </article>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export default EmployerJourney;


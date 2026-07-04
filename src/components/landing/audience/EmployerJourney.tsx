import { useEffect, useRef } from 'react';
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

export function EmployerJourney({ steps: stepsProp }: { steps?: JourneyStep[] } = {}) {
  const listRef = useRef<HTMLOListElement | null>(null);
  const activeSteps = stepsProp ?? steps;

  useEffect(() => {
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

    // Set initial hidden state only now (post-mount) so SSR/no-JS stays visible.
    items.forEach((el) => el.setAttribute('data-journey-shown', 'false'));

    const scrollRoot = list.closest('[data-landing-scroll-root]') as HTMLElement | null;
    let observer: IntersectionObserver | null = null;
    let cancelled = false;
    let rafA = 0;
    let rafB = 0;
    const timers: number[] = [];

    const reveal = (el: HTMLLIElement) => {
      el.setAttribute('data-journey-shown', 'true');
      observer?.unobserve(el);
    };

    const isVisible = (el: HTMLLIElement) => {
      const rootRect = scrollRoot?.getBoundingClientRect() ?? {
        top: 0,
        bottom: window.innerHeight || document.documentElement.clientHeight,
      };
      const rect = el.getBoundingClientRect();
      return rect.bottom > rootRect.top + 16 && rect.top < rootRect.bottom * 0.9;
    };

    const syncVisible = () => {
      if (cancelled) return;
      items.forEach((el) => {
        if (el.getAttribute('data-journey-shown') !== 'true' && isVisible(el)) reveal(el);
      });
    };

    const start = () => {
      rafA = window.requestAnimationFrame(() => {
        rafB = window.requestAnimationFrame(() => {
          if (cancelled) return;
          observer = new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                reveal(entry.target as HTMLLIElement);
              });
            },
            { root: scrollRoot, rootMargin: '0px 0px -10% 0px', threshold: 0.01 },
          );
          items.forEach((el) => observer?.observe(el));
          syncVisible();
          timers.push(window.setTimeout(syncVisible, 250), window.setTimeout(syncVisible, 900));
        });
      });
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
        if (rafA) window.cancelAnimationFrame(rafA);
        if (rafB) window.cancelAnimationFrame(rafB);
        timers.forEach((timer) => window.clearTimeout(timer));
        observer?.disconnect();
      };
    }

    start();
    scrollRoot?.addEventListener('scroll', syncVisible, { passive: true });
    window.addEventListener('resize', syncVisible, { passive: true });
    window.addEventListener('orientationchange', syncVisible, { passive: true });
    window.visualViewport?.addEventListener('resize', syncVisible, { passive: true });

    return () => {
      cancelled = true;
      if (rafA) window.cancelAnimationFrame(rafA);
      if (rafB) window.cancelAnimationFrame(rafB);
      timers.forEach((timer) => window.clearTimeout(timer));
      observer?.disconnect();
      scrollRoot?.removeEventListener('scroll', syncVisible);
      window.removeEventListener('resize', syncVisible);
      window.removeEventListener('orientationchange', syncVisible);
      window.visualViewport?.removeEventListener('resize', syncVisible);
    };
  }, []);

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
              data-journey-step
              style={{ transitionDelay: `${Math.min(idx, 5) * 90}ms` }}
              className="employer-journey-step relative"
            >

              <div className="grid gap-5 md:grid-cols-[56px_1fr] md:gap-8">
                {/* Nummer / ikon-kolumn */}
                <div className="relative flex md:justify-center">
                  <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-secondary bg-gradient-to-br from-secondary/25 to-secondary/5 text-secondary shadow-[0_10px_30px_-16px_hsl(var(--secondary)/0.6)] backdrop-blur-xl">
                    <Icon className="h-6 w-6" strokeWidth={2} />
                    <span className="pointer-events-none absolute inset-0 rounded-2xl bg-secondary/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
                  </div>
                </div>



                {/* Textkort */}
                <article className="group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-b from-white/[0.055] to-white/[0.02] p-6 backdrop-blur-xl transition-[border-color,box-shadow,transform] duration-500 hover:-translate-y-0.5 hover:border-secondary/35 hover:shadow-[0_28px_60px_-30px_hsl(var(--secondary)/0.55)] sm:p-8">
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


import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

export interface LandingNavLink {
  label: string;
  href: string; // e.g. "#hur-det-fungerar"
}

interface LandingNavProps {
  onLoginClick: () => void;
  links?: LandingNavLink[];
}

const LandingNav = ({ onLoginClick, links = [] }: LandingNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pillScrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const goHome = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      sessionStorage.setItem('parium-skip-splash', '1');
      navigate('/');
    }
  };

  // Hjälpare: gemensam smooth-scroll som spelar rent med AudienceLanding-
  // orchestreringen (Observer + scroll-jacking mellan hero ↔ intro ↔ galleri).
  // Använder en egen rAF-tween med ease-out så det känns lugnt men snappy
  // (snabbare än webbläsarens default men inte megasnabbt).
  const smoothScrollTo = (
    target: HTMLElement | Window,
    top: number,
    duration = 620,
  ) => {
    const isWin = target === window;
    const getY = () => (isWin ? window.scrollY : (target as HTMLElement).scrollTop);
    const setY = (y: number) =>
      isWin ? window.scrollTo({ top: y, behavior: 'auto' }) : ((target as HTMLElement).scrollTop = y);
    const startY = getY();
    const delta = top - startY;
    if (Math.abs(delta) < 2) return;
    // Skala duration efter avstånd så korta hopp inte känns sega
    const dist = Math.abs(delta);
    const adjusted = Math.max(380, Math.min(duration, 300 + dist * 0.35));
    const startT = performance.now();
    // easeOutCubic – snabb start, mjuk landning
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const step = (now: number) => {
      const t = Math.min(1, (now - startT) / adjusted);
      setY(startY + delta * ease(t));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActiveId(id);
    window.dispatchEvent(new Event('parium:nav-jump'));
    const scroller = document.querySelector<HTMLElement>('[data-landing-scroll-root]');
    if (scroller) {
      const top = scroller.scrollTop + el.getBoundingClientRect().top;
      smoothScrollTo(scroller, top);
    } else {
      const top = window.scrollY + el.getBoundingClientRect().top;
      smoothScrollTo(window, top);
    }
  };

  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('#')) return;
    e.preventDefault();
    scrollToSection(href.slice(1));
  };


  useEffect(() => {
    // Hitta faktisk scroll-container (fixed inset-0 overflow-y-auto används på audience-sidor)
    const findScroller = (): HTMLElement | Window => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('div'));
      for (const el of candidates) {
        const cs = getComputedStyle(el);
        if (
          (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
          cs.position === 'fixed' &&
          el.scrollHeight > el.clientHeight
        ) {
          return el;
        }
      }
      return window;
    };
    const scroller = findScroller();
    const getY = () =>
      scroller === window ? window.scrollY : (scroller as HTMLElement).scrollTop;
    const onScroll = () => setScrolled(getY() > 40);
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true } as any);
    return () => scroller.removeEventListener('scroll', onScroll as any);
  }, [location.pathname]);

  // Tracka aktiv sektion via scroll-position (mer robust än IntersectionObserver
  // när scroll-containern är fixed inset-0 och sektionerna är höga).
  useEffect(() => {
    if (!links.length) return;
    const ids = links.map((l) => l.href.replace('#', '')).filter(Boolean);

    const findScroller = (): HTMLElement | Window => {
      const candidates = Array.from(document.querySelectorAll<HTMLElement>('div'));
      for (const el of candidates) {
        const cs = getComputedStyle(el);
        if (
          (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
          cs.position === 'fixed' &&
          el.scrollHeight > el.clientHeight
        ) {
          return el;
        }
      }
      return window;
    };
    const scroller = findScroller();
    const isWin = scroller === window;

    const compute = () => {
      const elements = ids
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => Boolean(el));
      if (!elements.length) return;

      // "Linje" 140px från toppen — det är där aktuell sektion ska bytas
      const threshold = 140;
      let currentId: string | null = null;
      for (const el of elements) {
        const top = el.getBoundingClientRect().top;
        if (top - threshold <= 0) currentId = el.id;
        else break;
      }
      setActiveId(currentId);
    };

    compute();
    const onScroll = () => compute();
    scroller.addEventListener('scroll', onScroll, { passive: true } as any);
    window.addEventListener('resize', onScroll);
    return () => {
      scroller.removeEventListener('scroll', onScroll as any);
      window.removeEventListener('resize', onScroll);
    };
  }, [links]);

  // Auto-centrera aktiv chip i pillen när scroll ändrar aktiv sektion
  useEffect(() => {
    const scroller = pillScrollerRef.current;
    if (!scroller || !activeId) return;
    const chip = scroller.querySelector<HTMLElement>(`a[href="#${activeId}"]`);
    if (!chip) return;
    const target =
      chip.offsetLeft - scroller.clientWidth / 2 + chip.offsetWidth / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [activeId]);

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 bg-transparent"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)' }}
        aria-label="Huvudnavigation"
      >
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 md:px-6 lg:px-24">
          <div className="flex items-center h-16 sm:h-[72px] gap-2 sm:gap-4 md:gap-3 lg:gap-6">
            <a
              href="/"
              onPointerDown={goHome}
              onClick={(e) => e.preventDefault()}
              aria-label="Tillbaka till start"
              className="cursor-pointer touch-manipulation select-none transition-opacity active:opacity-70 hover:opacity-80 shrink-0"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <img
                src={pariumLogo}
                alt="Parium"
                width={256}
                height={256}
                draggable={false}
                loading="eager"
                decoding="sync"
                // @ts-expect-error - fetchpriority is a valid HTML attribute
                fetchpriority="high"
                className="h-auto w-36 sm:w-32 md:w-36 lg:w-40 pointer-events-none"
              />
            </a>

            {/* Mobil: dropdown-meny. Från tablet-bredd visas hela list-pillen så layout styrs av tillgänglig bredd, inte enhetsnamn. */}
            {links.length > 0 && (
              <div className="flex-1 min-w-0 flex justify-center md:hidden">
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Öppna sektionsmeny"
                      className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl px-4 text-[15px] font-medium text-white shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-colors hover:bg-white/[0.08] active:bg-white/[0.10] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                    >
                      <span className="whitespace-nowrap max-w-[160px] truncate">
                        {links.find((l) => l.href.replace('#', '') === activeId)?.label ?? 'Meny'}
                      </span>
                      <svg
                        width="12" height="12" viewBox="0 0 12 12" fill="none"
                        className={`shrink-0 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      >
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" sideOffset={8} className="min-w-[200px]">
                    {links.map((l) => {
                      const id = l.href.replace('#', '');
                      const isActive = activeId === id;
                      return (
                        <DropdownMenuItem
                          key={l.href}
                          onSelect={(e) => {
                            e.preventDefault();
                            setMenuOpen(false);
                            // Vänta tills menyn stängts så scroll inte avbryts av focus-return
                            requestAnimationFrame(() => scrollToSection(id));
                          }}
                          className={isActive ? 'bg-accent/60 font-semibold' : ''}
                        >
                          {l.label}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}




            {links.length > 0 && (
              <div className="hidden flex-1 min-w-0 justify-center md:flex">
                <div
                  ref={pillScrollerRef}
                  className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl px-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {links.map((l) => {
                    const id = l.href.replace('#', '');
                    const isActive = activeId === id;
                    return (
                      <a
                        key={l.href}
                        href={l.href}
                        onClick={(e) => {
                          handleAnchor(e, l.href);
                          requestAnimationFrame(() => {
                            const target = e.currentTarget as HTMLElement | null;
                            target?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                          });
                        }}
                        aria-current={isActive ? 'true' : undefined}
                        className={`relative whitespace-nowrap rounded-full px-3 py-1.5 md:px-2.5 md:py-2 lg:px-4 text-[12px] lg:text-[13px] font-medium transition-colors ${
                          isActive ? 'text-white' : 'text-white/65 hover:text-white'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="nav-bubble"
                            className="absolute inset-0 -z-0 rounded-full bg-white/[0.10] border border-white/[0.10] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
                            transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.6 }}
                          />
                        )}
                        <span className="relative z-10">{l.label}</span>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Logga in — alltid längst till höger */}
            <div className="shrink-0 ml-auto">
              <Button
                onClick={onLoginClick}
                size="sm"
                className="rounded-full px-7 sm:px-6 md:px-5 lg:px-7 h-11 sm:h-10 md:h-11 bg-white/[0.04] border border-white/[0.08] text-white text-[15px] sm:text-[13px] lg:text-[14px] font-medium hover:bg-secondary/20 hover:border-secondary/45 hover:shadow-[0_0_30px_hsl(var(--secondary)/0.28)] transition-all duration-300"
              >
                Logga in
              </Button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default LandingNav;

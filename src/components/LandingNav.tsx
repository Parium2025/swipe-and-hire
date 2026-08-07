import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import pariumLogoRings from '@/assets/parium-logo-rings.png';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';
import { fetchPriority } from '@/lib/fetchPriority';

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
  // Döljer "Meny"-knappen medan man scrollar; den fadar in igen när scrollen stannar.
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollIdleTimer = useRef<number | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  // Hela sidan är mörkblå nu — håll alltid nav i mörkt glas-läge
  const isLightSection = false;

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


  // Hitta faktisk scroll-container (fixed inset-0 overflow-y-auto används på audience-sidor)
  const findScroller = (): HTMLElement | Window => {
    return document.querySelector<HTMLElement>('[data-landing-scroll-root]') ?? window;
  };

  useEffect(() => {
    const scroller = findScroller();
    const isWin = scroller === window;
    const getY = () => (isWin ? window.scrollY : (scroller as HTMLElement).scrollTop);

    const ids = links.map((l) => l.href.replace('#', '')).filter(Boolean);

    const computeActive = () => {
      if (!ids.length) return;
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

    let frame = 0;
    const updateScrollState = () => {
      frame = 0;
      setScrolled(getY() > 40);
      computeActive();
      setIsScrolling((current) => current || true);
      if (scrollIdleTimer.current) window.clearTimeout(scrollIdleTimer.current);
      scrollIdleTimer.current = window.setTimeout(() => setIsScrolling(false), 220);
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScrollState);
    };

    updateScrollState();
    scroller.addEventListener('scroll', onScroll, { passive: true } as any);
    window.addEventListener('resize', onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', onScroll as any);
      window.removeEventListener('resize', onScroll);
      if (scrollIdleTimer.current) window.clearTimeout(scrollIdleTimer.current);
    };
  }, [location.pathname, links]);





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
                alt="Parium logotyp – lediga jobb och rekrytering"
                width={256}
                height={256}
                draggable={false}
                loading="eager"
                decoding="sync"
                {...fetchPriority('high')}
                className="h-auto w-36 sm:w-32 md:w-36 lg:w-40 pointer-events-none"
              />
            </a>

            {/* Mobil: dropdown-meny. Från tablet-bredd visas hela list-pillen så layout styrs av tillgänglig bredd, inte enhetsnamn. */}
            {links.length > 0 && (
              <div className="flex-1 min-w-0 flex justify-center md:hidden -translate-x-3 sm:-translate-x-2">

                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Öppna sektionsmeny"
                      className={`group relative inline-flex h-11 items-center gap-1.5 overflow-hidden rounded-full border px-5 text-[15px] font-medium transition-colors duration-200 hover:border-white/80 focus:outline-none focus-visible:outline-none ${
                        isLightSection
                          ? 'border-primary/10 bg-background/80 text-primary'
                          : 'border-white bg-white/[0.045] text-white'
                      }`}
                    >
                      <span className="pointer-events-none absolute -inset-px rounded-full bg-[linear-gradient(135deg,hsl(var(--secondary)/0.65),hsl(var(--secondary)/0.14)_44%,hsl(var(--primary)/0.34))] opacity-65" />
                      <span className="relative z-10 whitespace-nowrap">
                        Meny
                      </span>
                      <svg
                        width="12" height="12" viewBox="0 0 12 12" fill="none"
                        className={`relative z-10 shrink-0 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      >
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent
                    align="center"
                    sideOffset={8}
                    className="relative min-w-[260px] overflow-hidden rounded-[28px] border border-white/10 bg-primary p-2 shadow-none"
                  >

                    <div className="relative z-10 flex flex-col gap-1">
                      {links.map((l) => {
                        const isAnchor = l.href.startsWith('#');
                        const id = isAnchor ? l.href.slice(1) : l.href;
                        const isActive = isAnchor
                          ? activeId === id
                          : location.pathname === l.href;
                        return (
                          <DropdownMenuItem
                            key={l.href}
                            onSelect={(e) => {
                              e.preventDefault();
                              setMenuOpen(false);
                              if (isAnchor) {
                                // Vänta tills menyn stängts så scroll inte avbryts av focus-return
                                requestAnimationFrame(() => scrollToSection(id));
                              } else {
                                const goTop = () => {
                                  const scroller = document.querySelector<HTMLElement>('[data-landing-scroll-root]');
                                  if (scroller) scroller.scrollTop = 0;
                                  window.scrollTo({ top: 0, behavior: 'auto' });
                                };
                                if (location.pathname === l.href) {
                                  requestAnimationFrame(goTop);
                                } else {
                                  sessionStorage.setItem('parium-skip-splash', '1');
                                  navigate(l.href);
                                  requestAnimationFrame(() => requestAnimationFrame(goTop));
                                }
                              }
                            }}
                            className={cn(
                              'relative flex items-center justify-between rounded-2xl px-5 py-3.5 text-[15px] font-medium transition-none hover:bg-transparent focus:bg-transparent data-[highlighted]:bg-transparent data-[highlighted]:text-white',
                              isActive
                                ? 'bg-white/5 text-white'
                                : 'text-white/70 hover:text-white'
                            )}
                          >
                            <span className="relative z-10">{l.label}</span>
                            {isActive && (
                              <span className="relative z-10 h-1.5 w-1.5 rounded-full bg-secondary" />
                            )}
                          </DropdownMenuItem>
                        );
                      })}
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}




            {links.length > 0 && (
              <div className="hidden flex-1 min-w-0 justify-center md:flex">
                <div
                  ref={pillScrollerRef}
                    className={`flex max-w-full items-center gap-1 overflow-x-auto rounded-full border px-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.25)] [@media_(hover:hover)]:backdrop-blur-xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
                      isLightSection ? 'border-primary/10 bg-background/80' : 'border-white bg-white/[0.045]'
                    }`}
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  {links.map((l) => {
                    const isAnchor = l.href.startsWith('#');
                    const id = isAnchor ? l.href.slice(1) : l.href;
                    const isActive = isAnchor
                      ? activeId === id
                      : location.pathname === l.href;
                    return (
                      <a
                        key={l.href}
                        href={l.href}
                        onClick={(e) => {
                          if (isAnchor) {
                            handleAnchor(e, l.href);
                          } else {
                            e.preventDefault();
                            const goTop = () => {
                              const scroller = document.querySelector<HTMLElement>('[data-landing-scroll-root]');
                              if (scroller) scroller.scrollTop = 0;
                              window.scrollTo({ top: 0, behavior: 'auto' });
                            };
                            if (location.pathname === l.href) {
                              goTop();
                            } else {
                              sessionStorage.setItem('parium-skip-splash', '1');
                              navigate(l.href);
                              requestAnimationFrame(() => requestAnimationFrame(goTop));
                            }
                          }
                          requestAnimationFrame(() => {
                            const target = e.currentTarget as HTMLElement | null;
                            target?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
                          });
                        }}
                        aria-current={isActive ? 'true' : undefined}
                        className={`relative whitespace-nowrap rounded-full px-3 py-1.5 md:px-2.5 md:py-2 lg:px-4 text-[12px] lg:text-[13px] font-medium transition-colors ${
                          isLightSection
                            ? isActive ? 'text-primary' : 'text-primary/60 hover:text-primary'
                            : isActive ? 'text-white' : 'text-white/70 hover:text-white'
                        }`}
                      >
                        {isActive && (
                          <motion.span
                            layoutId="nav-bubble"
                            className={`absolute inset-0 -z-0 overflow-hidden rounded-full border shadow-[0_4px_20px_rgba(0,0,0,0.25)] ${
                              isLightSection ? 'border-primary/10 bg-primary/[0.06]' : 'border-white bg-white/[0.045]'
                            }`}
                            transition={{ type: 'spring', stiffness: 380, damping: 32, mass: 0.6 }}
                          >
                            {!isLightSection && (
                              <>
                                <span className="pointer-events-none absolute -inset-3 hidden rounded-full bg-secondary/24 opacity-100 blur-2xl [@media(hover:hover)]:block" />
                                <span className="pointer-events-none absolute -inset-px rounded-full bg-[linear-gradient(135deg,hsl(var(--secondary)/0.65),hsl(var(--secondary)/0.14)_44%,hsl(var(--primary)/0.34))] opacity-65" />
                              </>
                            )}
                          </motion.span>
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
                className={`group relative h-11 overflow-hidden rounded-full border px-7 text-[15px] font-medium text-white transition-all duration-300 hover:border-white/80 hover:shadow-[0_0_30px_hsl(var(--secondary)/0.28)] ${
                  isLightSection ? 'border-primary/10 bg-background/80 text-primary' : 'border-white bg-white/[0.045]'
                }`}
              >
                <span className="pointer-events-none absolute -inset-3 hidden rounded-full bg-secondary/24 opacity-0 blur-2xl transition-opacity duration-500 ease-out [@media(hover:hover)]:block [@media(hover:hover)]:group-hover:opacity-100" />
                <span className="pointer-events-none absolute -inset-px rounded-full bg-[linear-gradient(135deg,hsl(var(--secondary)/0.65),hsl(var(--secondary)/0.14)_44%,hsl(var(--primary)/0.34))] opacity-65 transition-opacity duration-500 ease-out [@media(hover:hover)]:group-hover:opacity-100" />
                <span className="relative z-10">Logga in</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default LandingNav;

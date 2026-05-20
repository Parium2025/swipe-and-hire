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
import { useIsMobile } from '@/hooks/use-mobile';
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
  const isMobile = useIsMobile();
  const pillScrollerRef = useRef<HTMLDivElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
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

  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('#')) return;
    e.preventDefault();
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el) {
      setActiveId(id);
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Stäng meny vid klick utanför / Escape
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      const el = mobileMenuRef.current;
      if (el && !el.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

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

  // Tracka aktiv sektion baserat på vilken som är synligast
  useEffect(() => {
    if (!links.length) return;
    const ids = links.map((l) => l.href.replace('#', '')).filter(Boolean);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!elements.length) return;

    const visibility = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visibility.set(e.target.id, e.intersectionRatio);
        }
        let bestId: string | null = null;
        let bestRatio = 0;
        visibility.forEach((ratio, id) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        });
        if (bestRatio > 0.15) setActiveId(bestId);
        else setActiveId(null);
      },
      {
        // Lite offset från toppen så aktiv sektion byts när rubriken är under naven
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0, 0.15, 0.3, 0.5, 0.75, 1],
      }
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
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
        <div className="max-w-[1400px] mx-auto px-3 sm:px-5 md:px-12 lg:px-24">
          <div className="flex items-center h-16 sm:h-[72px] gap-2 sm:gap-4 md:gap-6">
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
                width={224}
                height={224}
                draggable={false}
                className="h-auto w-32 sm:w-28 md:w-32 pointer-events-none"
              />
            </a>

            {/* Mobil: dropdown-meny. Desktop (sm+): hela list-pillen. */}
            {links.length > 0 && isMobile && (
              <div className="flex-1 min-w-0 flex justify-center">
                <div ref={mobileMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl px-4 text-[13px] font-medium text-white shadow-[0_8px_30px_rgba(0,0,0,0.25)] transition-colors hover:bg-white/[0.08] active:bg-white/[0.10]"
                  >
                    <span className="whitespace-nowrap">
                      {links.find((l) => l.href.replace('#', '') === activeId)?.label ?? 'Meny'}
                    </span>
                    <svg
                      width="12" height="12" viewBox="0 0 12 12" fill="none"
                      className={`transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    >
                      <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {menuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      role="menu"
                      className="absolute left-1/2 top-full mt-2 -translate-x-1/2 min-w-[200px] rounded-2xl border border-white/[0.10] bg-black/70 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden z-50"
                    >
                      <div className="flex flex-col p-1.5">
                        {links.map((l) => {
                          const id = l.href.replace('#', '');
                          const isActive = activeId === id;
                          return (
                            <a
                              key={l.href}
                              href={l.href}
                              role="menuitem"
                              onClick={(e) => { handleAnchor(e, l.href); setMenuOpen(false); }}
                              className={`rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
                                isActive ? 'text-white bg-white/[0.10]' : 'text-white/80 hover:text-white hover:bg-white/[0.06]'
                              }`}
                            >
                              {l.label}
                            </a>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}



            {links.length > 0 && !isMobile && (
              <div className="flex-1 min-w-0 flex justify-center">
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
                        className={`relative whitespace-nowrap rounded-full px-3 py-1.5 md:px-4 md:py-2 text-[12px] md:text-[13px] font-medium transition-colors ${
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

            {/* Logga in — större på mobil nu när pillen tar mindre plats */}
            <div className="shrink-0">
              <Button
                onClick={onLoginClick}
                size="sm"
                className="rounded-full px-6 sm:px-5 md:px-6 h-10 sm:h-9 bg-white/[0.04] border border-white/[0.08] text-white text-[14px] sm:text-[12px] md:text-[13px] font-medium hover:bg-secondary/20 hover:border-secondary/45 hover:shadow-[0_0_30px_hsl(var(--secondary)/0.28)] transition-all duration-300"
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

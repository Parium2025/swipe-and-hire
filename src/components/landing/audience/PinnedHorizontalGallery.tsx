import { useEffect, useRef, useState } from 'react';
import real1 from '@/assets/landing/jobseeker-real-1.jpg';
import real2 from '@/assets/landing/jobseeker-real-2.jpg';
import real3 from '@/assets/landing/jobseeker-real-3.jpg';
import real4 from '@/assets/landing/jobseeker-real-4.jpg';
import real5 from '@/assets/landing/jobseeker-real-5.jpg';
import real6 from '@/assets/landing/jobseeker-real-6.jpg';
import real7 from '@/assets/landing/jobseeker-real-7.jpg';

/**
 * Apple-style "Så funkar det" sektion.
 * - Centrerad rubrik som kommer in med fade+lyft (ingen dubblett av hero)
 * - En lugn pinned horizontell mediestrip med raffinerade kort (~340px)
 * - Generöst whitespace, subtil rörelse — inte scroll-jacking-overkill
 */

type MediaItem = {
  type: 'image' | 'video';
  src: string;
  poster?: string;
  position?: string;
  eyebrow: string;
  title: string;
};

// VIKTIGT: Alla videos har en poster. Om videon failar att ladda (offline,
// 404, codec-issue) renderas posterbilden istället för en svart ruta —
// användaren ser alltid något meningsfullt i kortet.
const items: MediaItem[] = [
  { type: 'video', src: '/landing/jobseeker-pt.mp4', poster: real1, position: '50% 30%', eyebrow: 'Träning', title: 'Personliga tränare' },
  { type: 'video', src: '/landing/jobseeker-plumber.mp4', poster: real5, position: '50% 30%', eyebrow: 'Hantverk', title: 'Rörmokare & byggare' },
  { type: 'video', src: '/landing/jobseeker-real-center.mp4', poster: real1, eyebrow: 'Affärer', title: 'Yrkespersoner i sitt element' },
  { type: 'video', src: '/landing/jobseeker-real-4.mp4', poster: real2, eyebrow: 'Service', title: 'Mäklare & rådgivare' },
  { type: 'video', src: '/landing/jobseeker-real-3.mp4', poster: real3, eyebrow: 'Restaurang', title: 'Kockar & köksmästare' },
  { type: 'video', src: '/landing/jobseeker-electrician.mp4', poster: real4, position: '50% 28%', eyebrow: 'Elektriker', title: 'Elektriker' },
  { type: 'video', src: '/landing/jobseeker-farmer.mp4', poster: real7, eyebrow: 'Lantbruk', title: 'Bönder & djurskötare' },
  { type: 'video', src: '/landing/jobseeker-nurse.mp4', poster: real6, position: '50% 25%', eyebrow: 'Vård', title: 'Undersköterskor' },
];

type CardItemProps = {
  item: MediaItem;
  index: number;
};

const CardItem = ({ item, index }: CardItemProps) => {
  // failed=true → byt ut <video> mot poster-bild som fallback. Triggas vid
  // network error, 404, codec-fel eller om användaren är offline när videon
  // ska laddas. Användaren ser alltid en relevant bild istället för svart ruta.
  const [failed, setFailed] = useState(false);

  return (
    <div
      className="phg-card phg-card-enter"
      style={{ ['--enter-delay' as string]: `${index * 80}ms`, ['--leave-delay' as string]: `${index * 55}ms` }}
    >
      {item.type === 'video' && !failed ? (
        <video
          src={item.src}
          poster={item.poster}
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setFailed(true)}
          style={{ objectPosition: item.position ?? '50% 50%' }}
        />
      ) : (
        <img
          src={item.type === 'video' ? (item.poster ?? item.src) : item.src}
          alt={item.title}
          loading={index < 3 ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          style={{ objectPosition: item.position ?? '50% 50%' }}
        />
      )}
      <div className="phg-cap">
        <div className="phg-cap-eyebrow">{item.eyebrow}</div>
      </div>
    </div>
  );
};

const PinnedHorizontalGallery = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const targetProgressRef = useRef(0);
  const renderedProgressRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [, setReady] = useState(false);

  useEffect(() => {
    const el = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    containerRef.current = el;
    setReady(true);
  }, []);

  // Längre pin-distans = man MÅSTE scrolla igenom hela strippen, kan inte "fuska förbi".
  // Extra intro-yta inuti samma sticky sektion låter korten glida in utan en hård skarv.
  const SCROLL_VH = 520;

  // Egen RAF-driven progress istället för Framer useScroll. Då läser och skriver
  // galleriet i exakt samma animation-frame som GSAP-scrollen vid 2↔3, utan
  // dubbel scroll-prenumeration som kan ge en frame av skak/jitter.
  useEffect(() => {
    const root = containerRef.current;
    const section = sectionRef.current;
    const strip = stripRef.current;
    if (!root || !section || !strip) return;

    // Under 3→2-returen vill vi INTE att strippens scroll-drivna transform ska
    // uppdateras varje frame — då tävlar den med GSAP-exit-tweenen på de 8 korten
    // och browserns smooth-scroll, och kan ge synligt hack på svagare GPU:er.
    let frozen = false;

    const applyProgress = (progress: number) => {
      const p = Math.min(1, Math.max(0, progress));
      // Mät faktisk overflow så att alla kort alltid exponeras oavsett viewport.
      // Slutposition = visa sista kortet med samma marginal som första kortet får i start.
      const stripWidth = strip.scrollWidth;
      const viewport = window.innerWidth || document.documentElement.clientWidth;
      const startPx = viewport * 0.07; // 7vw inledande marginal (matchar gammal start)
      // Sluta så att sista kortet är helt synligt med samma 7vw marginal till höger
      const endPx = Math.min(startPx, viewport - stripWidth - startPx);
      const xPx = startPx + (endPx - startPx) * p;
      // INGEN Math.round här. Strippen är composited (translate3d på GPU) så
      // sub-pixel-värden re-rastrerar inte. Avrundning gav istället synligt
      // hack på touch där momentum-scroll ger många små deltas — då stannar
      // korten 1px i taget istället för att glida mjukt. Mus märks inte lika
      // mycket eftersom wheel-deltan är större per event.
      strip.style.setProperty('--phg-x', `${xPx.toFixed(2)}px`);
      section.style.setProperty('--phg-progress', `${p}`);
      // Baren ska vara på plats redan vid första kortet (p=0) och hela vägen
      // till sista kortet (p=1). Den fade:as endast ut precis när vi börjar
      // lämna kort-sektionen nedåt, så den följer med smooth åt båda hållen.
      const fadeOut = Math.min(1, Math.max(0, (0.985 - p) / 0.025));
      section.style.setProperty('--phg-bar-opacity', String(fadeOut));
    };

    const measure = () => {
      if (frozen) return;
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, section.offsetHeight - root.clientHeight);
      targetProgressRef.current = Math.min(1, Math.max(0, -rect.top / distance));
      if (rafRef.current === null) rafRef.current = window.requestAnimationFrame(tick);
    };

    const tick = () => {
      rafRef.current = null;
      if (frozen) return;
      const current = renderedProgressRef.current;
      const target = targetProgressRef.current;
      // Lerp 0.35 ger silkeslen följning på touch (momentum-scroll får många
      // små deltas — låg faktor jämnar ut dem) utan att kännas trög på mus.
      const diff = target - current;
      const next = Math.abs(diff) < 0.00005 ? target : current + diff * 0.35;
      renderedProgressRef.current = next;
      applyProgress(next);
      if (next !== target) rafRef.current = window.requestAnimationFrame(tick);
    };

    // Frys vid 3→2 (gallery-leave) och tina vid 2→3 (gallery-enter). Under frysen
    // står strippen still — den ena synliga rörelsen blir kortens GSAP-fade-out
    // samtidigt som intro-lagret slidar in över, vilket är vad designen redan
    // visar. När galleriet återinträder mäter vi om från scrollposition direkt.
    const freeze = () => {
      frozen = true;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    const thaw = () => {
      if (!frozen) return;
      frozen = false;
      measure();
    };
    const resetToStart = () => {
      targetProgressRef.current = 0;
      renderedProgressRef.current = 0;
      applyProgress(0);
    };
    // Pausa kenburns-animationen på kortbilderna under hela 3→2-exiten så att
    // ingen bild "zoomar in och tillbaka" precis innan sidan flyger upp.
    const pauseKenburns = () => {
      strip.classList.add('phg-pause-kenburns');
    };
    const resumeKenburns = () => {
      strip.classList.remove('phg-pause-kenburns');
    };

    applyProgress(0);
    measure();
    root.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('parium:gallery-reset-start', resetToStart);
    window.addEventListener('parium:gallery-leave', freeze);
    window.addEventListener('parium:gallery-enter', thaw);
    window.addEventListener('parium:gallery-exit-start', pauseKenburns);
    window.addEventListener('parium:gallery-enter', resumeKenburns);
    return () => {
      root.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('parium:gallery-reset-start', resetToStart);
      window.removeEventListener('parium:gallery-leave', freeze);
      window.removeEventListener('parium:gallery-enter', thaw);
      window.removeEventListener('parium:gallery-exit-start', pauseKenburns);
      window.removeEventListener('parium:gallery-enter', resumeKenburns);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Trigga staggered fade-in på korten enbart via custom event från
  // AudienceLanding's release-timeline. Tidigare IntersectionObserver kunde
  // starta samma animation för tidigt under den programstyrda 2→3-scrollen.
  // Videos startas EFTER att slide-in-animationen är klar, för att undvika
  // att video-decode konkurrerar med transformen och orsakar skakningar.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;

    let playTimer: number | null = null;
    const warmTimers: number[] = [];
    let disposed = false;
    let warmed = false;
    let entered = false;
    let hasEnteredOnce = false;
    let gsapInstance: typeof import('gsap').default | null = null;

    import('gsap').then(({ default: gsap }) => {
      if (!disposed) gsapInstance = gsap;
    });

    const playSafe = (v: HTMLVideoElement) => {
      v.muted = true;
      v.playsInline = true;
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };

    // Adaptiv warmup: på data-saver eller långsamma nät (2G/3G) warm:ar vi
    // bara de första 4 videorna direkt — resten warm:as först när användaren
    // faktiskt scrollar nära dem. Sparar 50% bandbredd på mobil/sparsam data
    // utan att försämra upplevelsen för dem som har snabbt nät.
    const getNetworkProfile = (): 'slim' | 'full' => {
      try {
        const nav = navigator as Navigator & {
          connection?: { saveData?: boolean; effectiveType?: string };
        };
        const conn = nav.connection;
        if (!conn) return 'full';
        if (conn.saveData) return 'slim';
        const slow = conn.effectiveType && /(^|-)(2g|slow-2g|3g)$/i.test(conn.effectiveType);
        return slow ? 'slim' : 'full';
      } catch {
        return 'full';
      }
    };

    const warmVideos = () => {
      if (warmed) return;
      warmed = true;
      const videos = Array.from(strip.querySelectorAll('video')) as HTMLVideoElement[];
      const profile = getNetworkProfile();
      const initialBatch = profile === 'slim' ? videos.slice(0, 4) : videos;
      initialBatch.forEach((v, index) => {
        warmTimers.push(window.setTimeout(() => {
          try {
            v.preload = 'auto';
            if (v.readyState < 2) v.load();
          } catch {}
        }, index * 140));
      });
    };

    const onWarm = () => warmVideos();

    const enter = () => {
      if (entered) return;
      const shouldAnimateIn = !hasEnteredOnce;
      entered = true;
      hasEnteredOnce = true;
      strip.classList.remove('phg-leaving');
      strip.classList.add('phg-entered');
      warmVideos();
      const cards = Array.from(strip.querySelectorAll('.phg-card-enter')) as HTMLElement[];
      const header = headerRef.current;
      if (gsapInstance) {
        gsapInstance.killTweensOf(cards);
        if (shouldAnimateIn) {
          gsapInstance.fromTo(cards, { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 0.62, stagger: 0.08, ease: 'power2.out', force3D: true });
        } else {
          gsapInstance.set(cards, { y: 0, opacity: 1, force3D: true });
        }
        if (header) {
          gsapInstance.killTweensOf(header);
          if (shouldAnimateIn) {
            gsapInstance.fromTo(header, { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 0.62, ease: 'power2.out', force3D: true });
          } else {
            gsapInstance.set(header, { y: 0, opacity: 1, force3D: true });
          }
        }
      }
      const videos = Array.from(strip.querySelectorAll('video')) as HTMLVideoElement[];
      // Vänta tills slide-in-tween (0.62s) + sista stagger (~640ms) är klar
      // innan videos börjar dekoda — då är allt på plats och ingen jitter.
      if (playTimer) window.clearTimeout(playTimer);
      playTimer = window.setTimeout(() => {
        videos.slice(0, 3).forEach(playSafe);
        window.setTimeout(() => videos.slice(3).forEach(playSafe), 600);
      }, 800);
    };
    const leave = () => {
      if (!entered) return;
      entered = false;
      // Viktigt för 3→2: detta event används även för att frysa galleriets
      // scroll-progress. Korten får därför INTE fade:a ut/resetta här — annars
      // ser de ut att "laddas om" precis innan sidan går tillbaka till intro.
      strip.classList.remove('phg-leaving');
      strip.classList.add('phg-entered');
      const cards = Array.from(strip.querySelectorAll('.phg-card-enter')) as HTMLElement[];
      const header = headerRef.current;
      if (gsapInstance) {
        gsapInstance.killTweensOf(cards);
        gsapInstance.set(cards, { y: 0, opacity: 1, force3D: true });
        if (header) {
          gsapInstance.killTweensOf(header);
          gsapInstance.set(header, { y: 0, opacity: 1, force3D: true });
        }
      }
      // Pausa inte videorna vid 3→2 — de är redan varma och ska kännas levande
      // när användaren går tillbaka igen. Vi stoppar bara eventuell start-timer.
      if (playTimer) { window.clearTimeout(playTimer); playTimer = null; }
    };

    const syncVisibleState = () => {
      const section = sectionRef.current;
      if (!section) return;
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      if (rect.top < vh * 0.92 && rect.bottom > vh * 0.08) enter();
      else if (rect.bottom <= 0 || rect.top >= vh) leave();
    };

    const onEnter = () => enter();
    const onLeave = () => leave();
    window.addEventListener('parium:gallery-warm', onWarm);
    window.addEventListener('parium:gallery-enter', onEnter);
    window.addEventListener('parium:gallery-leave', onLeave);
    const root = containerRef.current ?? document.querySelector('[data-landing-scroll-root]');
    root?.addEventListener('scroll', syncVisibleState, { passive: true });
    window.addEventListener('resize', syncVisibleState);
    syncVisibleState();

    return () => {
      disposed = true;
      if (playTimer) window.clearTimeout(playTimer);
      warmTimers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener('parium:gallery-warm', onWarm);
      window.removeEventListener('parium:gallery-enter', onEnter);
      window.removeEventListener('parium:gallery-leave', onLeave);
      root?.removeEventListener('scroll', syncVisibleState);
      window.removeEventListener('resize', syncVisibleState);
    };
  }, []);

  return (
    <>
      <style>{`
        .phg-section { position: relative; width: 100%; }
        .phg-sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          width: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          contain: layout paint;
        }
        .phg-header {
          padding: clamp(24px, 4vh, 48px) 24px clamp(28px, 4.5vh, 56px);
          text-align: center;
          z-index: 3;
          will-change: transform, opacity;
        }
        .phg-title {
          /* Matchar hero-rubriken "Hitta jobb" för enhetlig storlek + glow */
          font-size: 3.25rem;
          font-weight: 900;
          line-height: 1.04;
          letter-spacing: -0.025em;
          color: #ffffff;
          max-width: 18ch;
          margin: 0 auto;
          padding-bottom: 0.12em;
        }
        .phg-title em {
          font-style: normal;
          color: #ffffff;
          font-weight: 900;
        }
        @media (min-width: 640px)  { .phg-title { font-size: 4rem; } }
        @media (min-width: 768px)  { .phg-title { font-size: 5rem; } }
        @media (min-width: 1024px) { .phg-title { font-size: 6rem; } }
        @media (min-width: 1536px) { .phg-title { font-size: 7rem; } }
        .phg-sub {
          margin: 22px auto 0;
          font-size: clamp(1rem, 1.2vw, 1.125rem);
          line-height: 1.65;
          color: rgba(255,255,255,0.62);
          max-width: 52ch;
        }

        .phg-strip-wrap {
          position: relative;
          width: 100%;
          min-height: clamp(360px, 58vh, 620px);
          display: flex;
          align-items: center;
          overflow: hidden;
          z-index: 2;
          transform: translate3d(0, -8vh, 0);
        }
        .phg-strip {
          display: flex;
          gap: clamp(14px, 1.6vw, 22px);
          padding: clamp(8px, 1.5vh, 20px) 6vw clamp(8px, 1vh, 18px);
          will-change: transform, opacity;
          transform: translate3d(var(--phg-x, 7vw), 0, 0);
        }
        .phg-card {
          flex: 0 0 auto;
          width: clamp(280px, 27vw, 400px);
          aspect-ratio: 4 / 5;
          border-radius: 26px;
          overflow: hidden;
          position: relative;
          background: rgba(0,0,0,0.4);
          box-shadow:
            0 30px 70px -28px rgba(0,0,0,0.7),
            0 0 0 1px rgba(255,255,255,0.07);
          transition: box-shadow 0.6s ease;
          will-change: transform, opacity;
          transform: translateZ(0);
        }
        /* Initial state — exakt match med introTextItems i goToIntro (1→2):
           y: 44, opacity: 0. Inga scales eller andra extra transforms. */
        .phg-card-enter {
          opacity: 0;
          transform: translate3d(0, 44px, 0);
        }
        /* Entrance — kopia av introTextItems-tween i goToIntro:
           duration 0.62s, ease power2.out, stagger 0.08s (80ms via --enter-delay).
           Triggas vid +0.48s i timeline (samma offset som intro-text i 1→2). */
        .phg-strip.phg-entered .phg-card-enter {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
        /* Exit — kopia av introTextItems-tween i goToHero (2→1):
           duration 0.42s, ease power2.in, stagger 0.055s (55ms via --leave-delay). */
        .phg-strip.phg-leaving .phg-card-enter {
          opacity: 0;
          transform: translate3d(0, 44px, 0);
        }
        @media (prefers-reduced-motion: reduce) {
          .phg-strip.phg-entered .phg-card-enter,
          .phg-strip.phg-leaving .phg-card-enter { animation: none; opacity: 1; transform: none; }
        }
        .phg-card::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 38%, hsl(var(--secondary) / 0.25) 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          z-index: 3;
        }
        .phg-strip.phg-entered:not(.phg-leaving) .phg-card:hover {
          box-shadow:
            0 44px 90px -28px rgba(0,0,0,0.85),
            0 0 0 1px rgba(255,255,255,0.14),
            0 0 60px -12px hsl(var(--secondary) / 0.4);
        }
        .phg-card img,
        .phg-card video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          pointer-events: none;
          user-select: none;
        }
        @keyframes phg-kenburns {
          0%   { transform: scale(1.04) translate3d(0,0,0); }
          50%  { transform: scale(1.10) translate3d(-1.2%,-0.8%,0); }
          100% { transform: scale(1.04) translate3d(0,0,0); }
        }
        .phg-card img { animation: phg-kenburns 24s ease-in-out infinite; }
        /* Pausa kenburns under 3→2-exiten så bilden inte oscillerar synligt
           precis innan layern flyger upp. Vi pausar i nuvarande frame så
           ingen "snap" syns; animationen återupptas när galleriet entras igen. */
        .phg-strip.phg-pause-kenburns .phg-card img { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .phg-card img { animation: none; }
        }
        .phg-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.15) 42%, transparent 65%);
          pointer-events: none;
        }
        .phg-cap {
          position: absolute;
          left: 0; right: 0; bottom: 0;
          padding: 22px 22px 24px;
          color: white;
          z-index: 2;
        }
        .phg-cap-eyebrow {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: hsl(var(--secondary) / 0.95);
          margin-bottom: 6px;
        }
        .phg-cap-title {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.012em;
          line-height: 1.18;
          text-shadow: 0 2px 14px rgba(0,0,0,0.6);
        }

        .phg-footer {
          padding: clamp(20px, 3vh, 32px) 24px clamp(28px, 4vh, 48px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          z-index: 4;
        }
        .phg-progress {
          width: min(220px, 40vw);
          height: 2px;
          background: rgba(255,255,255,0.1);
          border-radius: 999px;
          overflow: hidden;
          opacity: var(--phg-bar-opacity, 0);
          transition: opacity 0.32s ease;
        }
        .phg-progress > span {
          display: block;
          height: 100%;
          background: linear-gradient(90deg, hsl(var(--secondary)), #7cc6ff);
          transform-origin: left center;
          transform: scaleX(var(--phg-progress, 0));
          will-change: transform;
        }
        .phg-hint {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
        }

        @media (max-width: 767px) {
          .phg-strip-wrap { transform: translate3d(0, -5vh, 0); }
          .phg-card { width: 64vw; border-radius: 18px; }
          .phg-strip { padding: 0 18vw 0 8vw; }
          .phg-footer { padding: 8px 24px 12px; gap: 8px; }
        }
      `}</style>

      <div ref={sectionRef} className="phg-section" style={{ height: `${SCROLL_VH}vh` }}>
        <div className="phg-sticky">

          <div ref={headerRef} className="phg-header" style={{ opacity: 0, transform: 'translate3d(0, 44px, 0)' }}>
            <p className="phg-title">Vi gör det <em>tillsammans!</em></p>
          </div>

          <div className="phg-strip-wrap">
            <div ref={stripRef} className="phg-strip">
              {items.map((item, i) => (
                <CardItem key={i} item={item} index={i} />
              ))}
            </div>
          </div>

          <div className="phg-footer">
            <div className="phg-progress" aria-hidden>
              <span />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PinnedHorizontalGallery;

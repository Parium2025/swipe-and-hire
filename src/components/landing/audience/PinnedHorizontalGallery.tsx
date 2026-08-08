import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import real1 from '@/assets/landing/jobseeker-real-1.jpg';
import real2 from '@/assets/landing/jobseeker-real-2.jpg';
import real3 from '@/assets/landing/jobseeker-real-3.jpg';
import real4 from '@/assets/landing/jobseeker-real-4.jpg';
import real5 from '@/assets/landing/jobseeker-real-5.jpg';
import real6 from '@/assets/landing/jobseeker-real-6.jpg';
import real7 from '@/assets/landing/jobseeker-real-7.jpg';
import winElectrician from '@/assets/landing/windows/jobseeker-electrician-windows.mp4.asset.json';
import winFarmer from '@/assets/landing/windows/jobseeker-farmer-windows.mp4.asset.json';
import winNurse from '@/assets/landing/windows/jobseeker-nurse-windows.mp4.asset.json';
import winPlumber from '@/assets/landing/windows/jobseeker-plumber-windows.mp4.asset.json';
import winPt from '@/assets/landing/windows/jobseeker-pt-windows.mp4.asset.json';
import winReal3 from '@/assets/landing/windows/jobseeker-real-3-windows.mp4.asset.json';
import winReal4 from '@/assets/landing/windows/jobseeker-real-4-windows.mp4.asset.json';
import winRealCenter from '@/assets/landing/windows/jobseeker-real-center-windows.mp4.asset.json';
import { fetchPriority } from '@/lib/fetchPriority';
import { getGalleryPreload, getMaxConcurrentVideos, isAppleDevice, prefersLightweightVideo, shouldFreeDecodersOnLeave } from '@/lib/videoPlatform';

/**
 * Apple-style "Så funkar det" sektion.
 * - Centrerad rubrik som kommer in med fade+lyft (ingen dubblett av hero)
 * - En lugn pinned horizontell mediestrip med raffinerade kort (~340px)
 * - Generöst whitespace, subtil rörelse — inte scroll-jacking-overkill
 */

type MediaItem = {
  type: 'image' | 'video';
  src: string;
  windowsSrc?: string;
  poster?: string;
  position?: string;
  eyebrow: string;
  title: string;
};

// VIKTIGT: Alla videos har en poster. Om videon failar att ladda (offline,
// 404, codec-issue) renderas posterbilden istället för en svart ruta —
// användaren ser alltid något meningsfullt i kortet.
const items: MediaItem[] = [
  { type: 'video', src: '/landing/jobseeker-pt.mp4', windowsSrc: winPt.url, poster: real1, position: '50% 30%', eyebrow: 'Träning', title: 'Personliga tränare' },
  { type: 'video', src: '/landing/jobseeker-plumber.mp4', windowsSrc: winPlumber.url, poster: real5, position: '50% 30%', eyebrow: 'Hantverk', title: 'Rörmokare & byggare' },
  { type: 'video', src: '/landing/jobseeker-real-center.mp4', windowsSrc: winRealCenter.url, poster: real1, eyebrow: 'Affärer', title: 'Yrkespersoner i sitt element' },
  { type: 'video', src: '/landing/jobseeker-real-4.mp4', windowsSrc: winReal4.url, poster: real2, eyebrow: 'Service', title: 'Mäklare & rådgivare' },
  { type: 'video', src: '/landing/jobseeker-real-3.mp4', windowsSrc: winReal3.url, poster: real3, eyebrow: 'Restaurang', title: 'Kockar & köksmästare' },
  { type: 'video', src: '/landing/jobseeker-electrician.mp4', windowsSrc: winElectrician.url, poster: real4, position: '50% 28%', eyebrow: 'Elektriker', title: 'Elektriker' },
  { type: 'video', src: '/landing/jobseeker-farmer.mp4', windowsSrc: winFarmer.url, poster: real7, eyebrow: 'Lantbruk', title: 'Bönder & djurskötare' },
  { type: 'video', src: '/landing/jobseeker-nurse.mp4', windowsSrc: winNurse.url, poster: real6, position: '50% 25%', eyebrow: 'Vård', title: 'Undersköterskor' },
];

type CardItemProps = {
  item: MediaItem;
  index: number;
};

/**
 * Global uppspelnings-koordinator för galleriets videor.
 *
 * Varför: på Windows-laptops utan dedikerad GPU faller browsern tillbaka på
 * software-decode så fort flera H.264-strömmar spelas samtidigt — då hackar
 * både galleriet och resten av sidan. macOS/iOS har hårdvaruavkodning för
 * många parallella strömmar och märker därför ingenting.
 *
 * Lösning: max MAX_CONCURRENT videor spelar samtidigt (de närmast viewportens
 * mitt), och all mätning sker i EN rAF-tick istället för per scroll-event och
 * per video (annars tvingar varje getBoundingClientRect fram en ny layout).
 */
const getMaxConcurrent = () => getMaxConcurrentVideos();
/** Lätt källa till Windows/Android/sparläge, full källa till Apple & desktop. */
const getPlayableSrc = (item: MediaItem) =>
  prefersLightweightVideo() && item.windowsSrc ? item.windowsSrc : item.src;
const registry = new Set<HTMLVideoElement>();
let rafId = 0;

const evaluateAll = () => {
  rafId = 0;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const centerX = vw / 2;
  const hidden = document.hidden;

  type Entry = { el: HTMLVideoElement; covered: number; left: number; inView: boolean };
  const all: Entry[] = [];
  registry.forEach((el) => {
    const rect = el.getBoundingClientRect();
    const inView =
      !hidden &&
      rect.bottom > 0 &&
      rect.top < vh &&
      rect.right > 0 &&
      rect.left < vw;
    // Hur stor del av kortets BREDD som faktiskt syns.
    const visibleW = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0));
    const covered = rect.width > 0 ? visibleW / rect.width : 0;
    all.push({ el, covered, left: rect.left, inView });
  });

  // Kortens ordning i strippen = deras x-position (1 … 8), oavsett om de syns.
  all.sort((a, b) => a.left - b.left);

  const maxConcurrent = getMaxConcurrent();
  const playVisible = (el: HTMLVideoElement) => {
    el.muted = true;
    el.playsInline = true;
    try {
      el.preload = 'auto';
      // På Windows/Android avbryter load() en redan pågående range-request.
      // Scroll-koordinatorn kör ofta; upprepade load() skapade därför en loop av
      // ERR_ABORTED-hämtningar. Apple behåller exakt sin tidigare väg.
      if (isAppleDevice() && el.readyState < 2) el.load();
      else if (!isAppleDevice() && el.networkState === HTMLMediaElement.NETWORK_EMPTY) el.load();
    } catch {
      // Best-effort only — playback coordinator must never throw during scroll.
    }
    if (el.paused) {
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    }
  };

  /**
   * Urval — ett SAMMANHÄNGANDE fönster som glider vänster→höger:
   * 1,2,3 → 2,3,4 → … → 6,7,8.
   *
   * Vi tar de N vänstraste synliga korten. Undantag i strippens slut: när det
   * sista kortet syns finns inga kort kvar till höger, så fönstret ankras i
   * stället mot höger (de N sista synliga). Utan detta hamnade kort 8 alltid
   * utanför budgeten och stod kvar på posterbilden — samma sak för kort 1 vid
   * strippens början, som ankras mot vänster.
   */
  const visibleIdx: number[] = [];
  all.forEach((e, i) => {
    if (e.inView && e.covered >= 0.5) visibleIdx.push(i);
  });
  // Om inget kort är halvt synligt (extremt smala vyer) → fall tillbaka på allt i vy.
  if (visibleIdx.length === 0) all.forEach((e, i) => { if (e.inView) visibleIdx.push(i); });

  const picks = new Set<HTMLVideoElement>();
  if (visibleIdx.length > 0) {
    const lastCardIndex = all.length - 1;
    const reachedEnd = visibleIdx[visibleIdx.length - 1] === lastCardIndex;
    const slots = reachedEnd
      ? visibleIdx.slice(Math.max(0, visibleIdx.length - maxConcurrent))
      : visibleIdx.slice(0, maxConcurrent);
    slots.forEach((i) => picks.add(all[i].el));

  }

  const candidates = all.filter((e) => e.inView);
  all.forEach(({ el, inView }) => {
    if (!inView && !el.paused) el.pause();
  });


  candidates.forEach(({ el }) => {
    if (picks.has(el)) {
      playVisible(el);
    } else if (!el.paused) {
      el.pause();
    }
  });



};

const scheduleEvaluate = () => {
  if (rafId) return;
  rafId = requestAnimationFrame(evaluateAll);
};

const CardItem = ({ item, index }: CardItemProps) => {
  // failed=true → byt ut <video> mot poster-bild som fallback. Triggas vid
  // network error, 404, codec-fel eller om användaren är offline när videon
  // ska laddas. Användaren ser alltid en relevant bild istället för svart ruta.
  const [failed, setFailed] = useState(false);
  const [src, setSrc] = useState(() => getPlayableSrc(item));
  const [frameReady, setFrameReady] = useState(false);
  const markReady = useCallback(() => {
    setFrameReady(true);
  }, []);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || item.type !== 'video' || failed) return;
    const root = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    registry.add(v);
    window.addEventListener('parium:gallery-progress', scheduleEvaluate);
    window.addEventListener('resize', scheduleEvaluate);
    window.addEventListener('scroll', scheduleEvaluate, { passive: true });
    root?.addEventListener('scroll', scheduleEvaluate, { passive: true });
    document.addEventListener('visibilitychange', scheduleEvaluate);
    scheduleEvaluate();
    return () => {
      registry.delete(v);
      window.removeEventListener('parium:gallery-progress', scheduleEvaluate);
      window.removeEventListener('resize', scheduleEvaluate);
      window.removeEventListener('scroll', scheduleEvaluate);
      root?.removeEventListener('scroll', scheduleEvaluate);
      document.removeEventListener('visibilitychange', scheduleEvaluate);
    };
  }, [item.type, failed]);

  // Starta varje kort på en egen tidsposition första gången metadata finns.
  // Då loopar inte alla Windows-videor samtidigt, utan varje kort börjar om i
  // sin egen lugna takt — utan fade/transition-effekt på bilden.
  useEffect(() => {
    const v = videoRef.current;
    if (!v || item.type !== 'video' || failed) return;
    const applyOffset = () => {
      if (v.dataset.loopOffsetApplied === '1') return;
      const d = v.duration;
      if (!Number.isFinite(d) || d <= 1) return;
      const safeDuration = Math.max(0.5, d - 0.35);
      const offset = (index * 0.73) % safeDuration;
      try {
        v.currentTime = offset;
        v.dataset.loopOffsetApplied = '1';
      } catch {
        // Best-effort only — native looping still works.
      }
    };
    if (v.readyState >= 1) applyOffset();
    else v.addEventListener('loadedmetadata', applyOffset);
    return () => {
      v.removeEventListener('loadedmetadata', applyOffset);
    };
  }, [item.type, failed, index]);

  // Chromium kan lämna en video i `paused=false` med frusen currentTime efter
  // GPU-/skärmbyte eller decoder-press. onError triggas då inte. Vakten kör bara
  // för en video som faktiskt spelar och eskalerar från pause/play till load().
  useEffect(() => {
    const v = videoRef.current;
    if (!v || item.type !== 'video' || failed) return;
    let lastTime = v.currentTime;
    let frozenTicks = 0;
    let rebuilding = false;

    const recover = () => {
      if (rebuilding || document.hidden) return;
      rebuilding = true;
      const resumeAt = Number.isFinite(v.currentTime) ? v.currentTime : 0;
      const release = () => {
        v.removeEventListener('loadedmetadata', restore);
        v.removeEventListener('error', release);
        rebuilding = false;
      };
      const restore = () => {
        release();
        try {
          if (Number.isFinite(v.duration) && v.duration > 0) {
            v.currentTime = Math.min(resumeAt, Math.max(0, v.duration - 0.1));
          }
        } catch { /* best effort */ }
        frozenTicks = 0;
        lastTime = v.currentTime;
        scheduleEvaluate();
      };
      v.addEventListener('loadedmetadata', restore, { once: true });
      v.addEventListener('error', release, { once: true });
      try {
        v.pause();
        v.load();
      } catch {
        release();
        scheduleEvaluate();
      }
    };

    const check = () => {
      if (document.hidden || rebuilding || v.paused || v.ended || v.seeking) {
        frozenTicks = 0;
        lastTime = v.currentTime;
        return;
      }
      if (Math.abs(v.currentTime - lastTime) < 0.04) {
        frozenTicks += 1;
        if (frozenTicks === 2) {
          try {
            v.pause();
            scheduleEvaluate();
          } catch { /* best effort */ }
        } else if (frozenTicks >= 5) {
          recover();
        }
      } else {
        frozenTicks = 0;
        lastTime = v.currentTime;
      }
    };

    const timer = window.setInterval(check, 1000);
    return () => {
      window.clearInterval(timer);
    };
  }, [item.type, failed]);


  return (
    <div
      className="phg-card phg-card-enter"
      style={{ ['--enter-delay' as string]: `${index * 80}ms`, ['--leave-delay' as string]: `${index * 55}ms` }}
    >
      {item.type === 'video' && !failed ? (
        <>
          <video
            ref={videoRef}
            src={src}
            muted
            loop
            playsInline
            preload={getGalleryPreload()}
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload noplaybackrate nofullscreen"
            onContextMenu={(e) => e.preventDefault()}
            onCanPlay={scheduleEvaluate}
            onLoadedData={(e) => {
              scheduleEvaluate();
              markReady();
            }}
            onPlaying={markReady}
            onTimeUpdate={markReady}
            onError={() => {
              // Apple behåller sin befintliga fallback. På Windows/Android ska
              // ett codec-/decodefel inte följas av ett försök med en ännu tyngre
              // desktopfil, eftersom det förvärrar decoder- och nätverkstrycket.
              if (isAppleDevice() && src !== item.src) {
                setSrc(item.src);
                return;
              }
              setFailed(true);
            }}
            style={{ objectPosition: item.position ?? '50% 50%' }}
            className={cn(
              'pointer-events-none transition-opacity duration-300 ease-out',
              frameReady ? 'opacity-100' : 'opacity-0'
            )}
          />
          <img
            src={item.poster}
            alt={item.title}
            loading={index < 3 ? 'eager' : 'lazy'}
            decoding="async"
            {...fetchPriority(index < 2 ? 'high' : index >= 4 ? 'low' : 'auto')}
            draggable={false}
            style={{ objectPosition: item.position ?? '50% 50%' }}
            className={cn(
              'transition-opacity duration-300 ease-out',
              frameReady ? 'opacity-0' : 'opacity-100'
            )}
          />
        </>
      ) : (
        <img
          src={item.type === 'video' ? (item.poster ?? item.src) : item.src}
          alt={item.title}
          loading={index < 3 ? 'eager' : 'lazy'}
          decoding="async"
          {...fetchPriority(index < 2 ? 'high' : index >= 4 ? 'low' : 'auto')}
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

  // Apple-desktop (Mac med trackpad/mus) får en egen pin-distans. Windows,
  // touch-enheter och övriga plattformar rörs inte alls av flaggan.
  const isAppleDesktop =
    typeof window !== 'undefined' &&
    isAppleDevice() &&
    window.matchMedia('(pointer: fine)').matches;


  useEffect(() => {
    const el = document.querySelector('[data-landing-scroll-root]') as HTMLElement | null;
    containerRef.current = el;
    setReady(true);
  }, []);

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
    const isTouchScroll = window.matchMedia('(pointer: coarse)').matches;

    /**
     * Enhetspixel-rutnät för icke-touch. Windows kör ofta fraktionell skalning
     * (125 % → dpr 1.25, 150 % → 1.5), där osnappade positioner kan skimra.
     *
     * VIKTIGT: Touch (iPhone/iPad/Android) ska INTE snappas alls. iOS momentum
     * producerar extremt fina subpixel-värden; även 1/dpr-snappning kan då läsas
     * som små steg/hack i kortstrippen. Touch kör därför exakt fri subpixel.
     */
    const snapToDevicePixel = (v: number) => {
      // DPR kan ändras när ett Windows-fönster flyttas mellan laptopskärm och
      // extern skärm. Läs aktuellt värde per frame i stället för vid mount.
      const currentDpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 3);
      return Math.round(v * currentDpr) / currentDpr;
    };

    const applyProgress = (progress: number) => {
      const p = Math.min(1, Math.max(0, progress));
      // Mät faktisk overflow så att alla kort alltid exponeras oavsett viewport.
      // Slutposition = visa sista kortet med samma marginal som första kortet får i start.
      const stripWidth = strip.scrollWidth;
      const viewport = window.innerWidth || document.documentElement.clientWidth;
      const startPx = viewport * 0.07; // 7vw inledande marginal (matchar gammal start)
      // Sluta så att sista kortet är helt synligt med samma 7vw marginal till höger
      const endPx = Math.min(startPx, viewport - stripWidth - startPx);
      const rawXPx = startPx + (endPx - startPx) * p;
      const xPx = isTouchScroll ? rawXPx : snapToDevicePixel(rawXPx);
      // Touch: fri subpixel-rörelse (ingen avrundning/snappning). Icke-touch:
      // device-pixel-snappning för Windows/fraktionell desktop-skalning.
      strip.style.setProperty('--phg-x', `${xPx.toFixed(isTouchScroll ? 2 : 3)}px`);
      section.style.setProperty('--phg-progress', `${p}`);
      section.dataset.phgProgress = p.toFixed(4);
      window.dispatchEvent(new CustomEvent('parium:gallery-progress', { detail: { progress: p } }));
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

    /**
     * Smoothing-faktor per inmatningstyp.
     *
     * Ett mushjul på Windows levererar scroll i diskreta hopp (~100 px per
     * hack) — helt olikt en Mac-trackpad som ger många små deltas. Utan
     * smoothing "teleporterar" därför kortraden ett stycke per hjulhack, vilket
     * är exakt den känsla som gör att sidan upplevs billigare på Windows.
     * 0.5 når målet på ~5 frames (~80 ms): tillräckligt för att hoppet ska
     * läsas som en glidning, för snabbt för att kännas som eftersläpning.
     *
     * TOUCH (iOS/Android): 0.38 — FRUSET VÄRDE. Detta är exakt samma faktor
     * som galleriet körde med före Windows-optimeringen (commit 3927df1f7).
     * iOS momentum kommer i grövre steg än trackpad; 0.38 tar bort den
     * "hackiga" känslan. Ändra ALDRIG detta värde vid desktop-/Windows-arbete.
     */
    const LERP = isTouchScroll ? 0.38 : 0.5;


    const tick = () => {
      rafRef.current = null;
      if (frozen) return;
      const target = targetProgressRef.current;
      // Vid pinnens absoluta start/slut går vi rakt på målet, annars kan
      // strippen se ut att släpa efter när sektionen tas i bruk eller lämnas.
      if (target < 0.002 || target > 0.998) {
        renderedProgressRef.current = target;
        applyProgress(target);
        return;
      }
      const current = renderedProgressRef.current;
      const next = current + (target - current) * LERP;
      renderedProgressRef.current = Math.abs(target - next) < 0.001 ? target : next;
      applyProgress(renderedProgressRef.current);
      if (Math.abs(target - renderedProgressRef.current) > 0.001 && rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(tick);
      }
    };


    // Frys enbart vid 3→2 (gallery-leave). Vid 2→3 återställer vi först till
    // startpositionen, annars kan ett gammalt p=1-läge ligga kvar fryst från
    // förra besöket och korten behöver "korrigera sig" efter landningen.
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
      // Snap rendered progress direkt till faktisk scroll-position så att
      // galleriet inte "lerpar ikapp" från ett gammalt värde (t.ex. 1 från
      // ett tidigare djupt scroll-läge). Utan detta tar det ~0.5s innan
      // strippen står på rätt plats efter 2→3, vilket känns som att kort 3
      // "korrigerar sig" efteråt.
      const rect = section.getBoundingClientRect();
      const distance = Math.max(1, section.offsetHeight - root.clientHeight);
      const p = Math.min(1, Math.max(0, -rect.top / distance));
      targetProgressRef.current = p;
      renderedProgressRef.current = p;
      applyProgress(p);
    };
    const resetToStart = () => {
      frozen = false;
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      targetProgressRef.current = 0;
      renderedProgressRef.current = 0;
      applyProgress(0);
    };


    applyProgress(0);
    measure();
    root.addEventListener('scroll', measure, { passive: true });
    window.addEventListener('resize', measure);
    window.addEventListener('parium:gallery-leave', freeze);
    window.addEventListener('parium:gallery-enter', thaw);
    window.addEventListener('parium:gallery-reset-start', resetToStart);
    return () => {
      root.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
      window.removeEventListener('parium:gallery-leave', freeze);
      window.removeEventListener('parium:gallery-enter', thaw);
      window.removeEventListener('parium:gallery-reset-start', resetToStart);
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

    // Adaptiv warmup: på data-saver eller långsamma nät (2G/3G) warm:ar vi
    // bara de första 4 videorna direkt — resten warm:as först när användaren
    // faktiskt scrollar nära dem. Sparar 50% bandbredd på mobil/sparsam data
    // utan att försämra upplevelsen för dem som har snabbt nät.
    const getNetworkProfile = (): 'slim' | 'full' => {
      try {
        if (window.matchMedia('(pointer: coarse)').matches) return 'slim';
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

    /**
     * Sekventiell warmup — EN video i taget.
     *
     * Tidigare startades alla åtta korten med 140 ms mellanrum, vilket i
     * praktiken betyder åtta parallella nedladdningar samtidigt som
     * hero-videon (~3 MB) fortfarande buffrar. På localhost märks det inte
     * alls; på ett riktigt nät delar strömmarna bandbredd, varje video når
     * `canplay` för tidigt och Windows spelar upp ryckigt vid kallstart.
     *
     * Nu laddas nästa video först när den föregående är spelbar (eller efter
     * en timeout), så bandbredden går till det kort användaren faktiskt ser.
     */
    const warmVideos = () => {
      if (warmed) return;
      warmed = true;
      const videos = Array.from(strip.querySelectorAll('video')) as HTMLVideoElement[];
      const profile = getNetworkProfile();
      const priority = prefersLightweightVideo()
        ? videos.slice(0, getMaxConcurrent())
        : profile === 'slim'
          ? videos.slice(0, 3)
          : videos.slice(0, 4);
      // Windows/Android: värm bara de strömmar som faktiskt får spela samtidigt.
      // evaluateAll() laddar nästa synliga kort vid behov. Att ändå köa alla åtta
      // fyllde nätverk/dekodrar i bakgrunden och motverkade hela concurrency-taket.
      // Apple/övriga plattformar behåller den befintliga fulla kön.
      const queue = prefersLightweightVideo()
        ? priority
        : [...priority, ...videos.filter((v) => !priority.includes(v))];

      let index = 0;
      const step = () => {
        if (disposed) return;
        const v = queue[index++];
        if (!v) return;
        if (v.readyState >= 3) {
          warmTimers.push(window.setTimeout(step, 60));
          return;
        }
        let done = false;
        const next = () => {
          if (done) return;
          done = true;
          v.removeEventListener('canplay', next);
          v.removeEventListener('error', next);
          // Liten paus mellan kort så att decode/nätverk hinner andas.
          warmTimers.push(window.setTimeout(step, 180));
        };
        v.addEventListener('canplay', next, { once: true });
        v.addEventListener('error', next, { once: true });
        // Skyddsnät: fastnar en video i buffring får kön inte stanna.
        warmTimers.push(window.setTimeout(next, 2500));
        try {
          v.preload = 'auto';
          if (isAppleDevice() && v.readyState < 2) v.load();
          else if (!isAppleDevice() && v.networkState === HTMLMediaElement.NETWORK_EMPTY) v.load();
        } catch {
          // Video warmup is best-effort only.
        }
      };
      step();
    };


    const onWarm = () => warmVideos();

    const enter = () => {
      if (entered) return;
      const shouldAnimateIn = !hasEnteredOnce;
      entered = true;
      hasEnteredOnce = true;
      strip.classList.remove('phg-leaving');
      strip.classList.add('phg-entered');
      // Warmup sköts efter kortens intro nedan. Att samtidigt köra både den
      // sekventiella kön och playback-koordinatorn gav dubbla play/load-anrop
      // på Windows och kunde lämna samtliga videos pausade.
      const cards = Array.from(strip.querySelectorAll('.phg-card-enter')) as HTMLElement[];
      const header = headerRef.current;
      if (gsapInstance) {
        gsapInstance.killTweensOf(cards);
        if (shouldAnimateIn) {
            gsapInstance.fromTo(cards, { y: 44, opacity: 0 }, {
              y: 0,
              opacity: 1,
              duration: 0.62,
              stagger: 0.08,
              ease: 'power2.out',
              force3D: isAppleDevice(),
              clearProps: isAppleDevice() ? undefined : 'transform',
            });
        } else {
            gsapInstance.set(cards, { y: 0, opacity: 1, force3D: isAppleDevice(), clearProps: isAppleDevice() ? undefined : 'transform' });
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
        warmVideos();
        scheduleEvaluate();
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
        gsapInstance.set(cards, { y: 0, opacity: 1, force3D: isAppleDevice(), clearProps: isAppleDevice() ? undefined : 'transform' });
        if (header) {
          gsapInstance.killTweensOf(header);
          gsapInstance.set(header, { y: 0, opacity: 1, force3D: true });
        }
      }
      const shouldFreeDecode = shouldFreeDecodersOnLeave();
      if (shouldFreeDecode) {
        const videos = Array.from(strip.querySelectorAll('video')) as HTMLVideoElement[];
        videos.forEach((video) => video.pause());
      }
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
        .phg-section {
          position: relative;
          width: 100%;
          /* Pin-distans = hur mycket vertikal scroll som "kostar" att
             traversera hela kortstrippen.
             BAS (Windows/övriga desktop): 240vh — rörd inte, den är avstämd
             mot mushjulets stegning och Windows scroll-skuld. */
          height: 240vh;

        }
        /* Apple-desktop (Mac/trackpad) ENDAST: trackpaden ger mycket mer
           scrolldelta per rörelse, så 240vh gjorde att korten flög förbi.
           Windows påverkas inte av denna regel. */
        [data-phg-platform="apple"].phg-section {
          height: 340vh;
        }

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
          /* Mer luftigt avstånd ovan/under rubriken på alla skärmar — håller
             professionellt andrum mellan topp-nav (Parium-logo) och titel,
             samt mellan titel och kortrad. */
          padding: clamp(64px, 9vh, 104px) 24px clamp(24px, 3.8vh, 48px);
          text-align: center;
          z-index: 3;
          will-change: transform, opacity;
        }
        .phg-title {
          /* Något lägre tak så rubriken känns balanserad mot korten på laptop.
             Skalar fortfarande fluid utan breakpoint-hopp.
             Höjt min från 1.75rem → 2.75rem så rubriken har samma tyngd som
             hero-rubriken på mobil (annars blir det mycket död yta). */
          font-size: clamp(2.75rem, 5.2vw, 7rem);
          font-weight: 900;
          line-height: 1.04;
          letter-spacing: -0.025em;
          /* Färg styrs av .wave-text-systemet och ska vara kritvit över blå ytor. */
          max-width: min(90vw, 20ch);
          margin: 0 auto;
          padding-bottom: 0.12em;
          overflow-wrap: break-word;
        }
        .phg-title em {
          font-style: normal;
          color: inherit;
          font-weight: 900;
        }
        @media (min-width: 1280px) { .phg-title { font-size: clamp(2.75rem, 5.2vw, 7rem); } }
        @media (min-width: 1536px) { .phg-title { font-size: clamp(2.75rem, 5.2vw, 7rem); } }
        @media (min-width: 768px) and (max-width: 1180px) and (orientation: portrait) {
          .phg-header { padding: clamp(36px, 5vh, 56px) 24px clamp(8px, 1.2vh, 16px); }
          .phg-title { font-size: 5.25rem; line-height: 1.0; max-width: min(92vw, 14ch); }
        }
        @media (min-width: 900px) and (max-width: 1180px) and (orientation: landscape) {
          /* iPad liggandes: matcha övriga sektioners rubrikstorlek så allt skalar likadant. */
          .phg-title { font-size: clamp(4.5rem, 7.6vw, 5rem); line-height: 1.04; max-width: min(92vw, 18ch); }
        }
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
          min-height: clamp(320px, 52vh, 580px);
          display: flex;
          align-items: center;
          overflow: hidden;
          z-index: 2;
          /* Ingen negativ pullup längre — header-paddingen styr avståndet,
             så korten ligger alltid tryggt under rubriken oavsett höjd. */
          transform: translate3d(0, 0, 0);
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
          /* Något mindre kort på laptop-bredder (1000–1400) så helheten
             känns mer luftig och proportionerlig mot rubrik + chrome. */
          width: clamp(220px, 19vw, 330px);
          aspect-ratio: 4 / 5;
          border-radius: 26px;
          overflow: hidden;
          position: relative;
          background:
            linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%),
            rgba(0,0,0,0.4);
          box-shadow: none;
          transition: box-shadow 0.6s ease;
          /* Ingen lagerpromotion per kort: 8 permanenta kompositlager äter
             GPU-minne och kan tvinga Windows-browsers till software-komposit.
             Strippen (som faktiskt animeras) har will-change kvar. */
          /* Premium perf: låt browsern skippa layout/paint för kort som är utanför viewport.
             contain-intrinsic-size håller scroll-höjden stabil så inget hoppar. */
          content-visibility: auto;
          contain-intrinsic-size: 500px 400px;
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
          box-shadow: none;
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
        @media (prefers-reduced-motion: reduce), (pointer: coarse) {
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
          color: hsl(var(--landing-light-foreground) / 0.95);
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
          width: min(240px, 56vw);
          height: 3px;
          background: rgba(255,255,255,0.12);
          border-radius: 999px;
          overflow: hidden;
          opacity: var(--phg-bar-opacity, 0);
          transition: opacity 0.32s ease;
        }
        .phg-progress > span {
          display: block;
          height: 100%;
          background: hsl(var(--secondary));
          box-shadow: 0 0 16px hsl(var(--secondary) / 0.5);
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
          /* Mobil touch: tillräcklig pin för mjuk horisontell rörelse, men utan den långa tomkänslan mellan sektionerna. */
          .phg-section { height: 420vh; }
          /* Sticky-höjden kapas till innehållet med exakt uträknad luft över/under
             så att avdelarens ljus hamnar mitt emellan sektionerna. */
          .phg-sticky { height: auto; justify-content: flex-start; padding: 112px 0 44px; }
          .phg-header { padding: 0 24px clamp(16px, 2.4vh, 26px); }
          .phg-title { font-size: 3.25rem; line-height: 1.04; }
          .phg-strip-wrap { transform: none; }
          .phg-card { width: 74vw; border-radius: 18px; }
          .phg-strip { padding: 0 13vw 0 6vw; }
          .phg-footer { padding: 8px 24px 0; gap: 8px; }
        }


        /* Ultra-små skärmar ENDAST (iPhone SE, små Android ≤ 380px).
           Standardmobiler (iPhone 12/13/14/15, Pro, Pro Max) använder
           default-mobilreglerna ovan (max-width: 767px) helt orörda. */
        @media (max-width: 380px) {
          .phg-sticky { height: auto; justify-content: flex-start; padding: 104px 0 32px; }
          .phg-header { padding: 8px 20px 32px; }
          .phg-title { font-size: 2.25rem; line-height: 1.05; }
          .phg-strip-wrap { min-height: 0; margin-top: 8px; }
          .phg-card { width: 56vw; border-radius: 16px; }
          .phg-strip { padding: 0 24vw 0 10vw; gap: 14px; }
        }

        @media (max-width: 360px) {
          /* Extra trångt på iPhone SE 1:a/2:a och små Android. */
          .phg-sticky { padding: 48px 0 28px; }
          .phg-header { padding: 8px 20px 28px; }
          .phg-title { font-size: 1.95rem; line-height: 1.06; }
          .phg-strip-wrap { margin-top: 6px; }
          .phg-card { width: 52vw; }
          .phg-strip { padding: 0 28vw 0 10vw; gap: 12px; }
        }






        @media (pointer: coarse) and (min-width: 768px) and (max-width: 1366px) {
          /* iPad/tablet touch: lugn pin för fingerscroll. */
          .phg-section { height: 480vh; }
        }
      `}</style>

      <div ref={sectionRef} data-phg-section data-phg-platform={isAppleDesktop ? "apple" : undefined} className="phg-section">
        <div className="phg-sticky">

          <div ref={headerRef} className="phg-header" style={{ opacity: 0, transform: 'translate3d(0, 44px, 0)' }}>
            <p className="phg-title wave-text">Vi gör det <em>tillsammans!</em></p>
          </div>

          <div className="phg-strip-wrap">
            <div ref={stripRef} className="phg-strip">
              {items.map((item, i) => (
                <CardItem key={i} item={item} index={i} />
              ))}
            </div>
          </div>

          <div className="phg-footer" aria-hidden="true">
            <div className="phg-progress">
              <span />
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default PinnedHorizontalGallery;

import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import hevcAsset from '@/assets/showcase-jobseeker.hevc.mp4.asset.json';
import hiCrispAsset from '@/assets/showcase-jobseeker-hi-crisp.mp4.asset.json';
import winCrispAsset from '@/assets/showcase-jobseeker-win-crisp.mp4.asset.json';
import posterAsset from '@/assets/showcase-jobseeker-poster.jpg.asset.json';
import windowsMp4Asset from '@/assets/showcase-jobseeker-windows-premium.mp4.asset.json';
import fit432Asset from '@/assets/showcase-jobseeker-fit432.mp4.asset.json';
import { prefersReducedData } from '@/lib/videoPlatform';

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Skärmens proportion. Videon är 9:19.5 men iPhone-chassit blir visuellt för
 * långsmalt när ramen läggs på — 9:19 ger en kropp på ca 2.04:1, vilket är
 * exakt en riktig iPhone (149.6 × 71.5 mm). Videon täcker via object-cover.
 */
const ASPECT = '9 / 19';

/**
 * HEVC erbjuds ENDAST till Apple-Safari.
 *
 * Varför: Edge/Chrome på Windows rapporterar ofta stöd för `hvc1`
 * (HEVC Video Extension / Win11) men saknar i praktiken hårdvaruavkodning för
 * den profilen → browsern faller tillbaka på software-decode och videon hackar.
 * H.264 High@4.0 är däremot hårdvaruaccelererat på i princip alla Windows-GPU:er.
 */
const prefersHevc = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isAppleSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  if (!isAppleSafari) return false;
  const probe = document.createElement('video');
  return probe.canPlayType('video/mp4; codecs="hvc1"') === 'probably';
};

/**
 * Den lätta H.264-källan (720x1560, Main@4.0) används bara i sparläge.
 */
const prefersPerformanceMp4 = () => prefersReducedData();

/**
 * Upplösningsstege — vald efter FAKTISKA enhetspixlar, inte efter operativsystem.
 *
 * Detta är kärnan i skärpeproblemet på Windows: en video som är bredare än den
 * yta den ritas på måste skalas ned av browsern. Chrome/Edge på Windows gör den
 * nedskalningen i video-overlayen med ett billigt bilinjärt filter — text blir
 * grötig oavsett hur hög bitrate källan har (därför gav bitrate-höjningen noll
 * skillnad). Safari på Apple använder ett betydligt bättre filter, vilket är
 * exakt varför samma fil ser skarp ut där och suddig här.
 *
 * Lösningen är att INTE låta browsern skala: vi levererar en master vars bredd
 * ligger så nära `CSS-bredd × devicePixelRatio` som möjligt. Nedskalningen görs
 * då i förväg med Lanczos + lätt unsharp (offline, högsta kvalitet) istället för
 * av Chrome i realtid.
 */
const LADDER = [
  { w: 432, url: fit432Asset.url },
  { w: 648, url: winCrispAsset.url },
  { w: 810, url: hiCrispAsset.url },
] as const;

/** Uppskattad CSS-bredd på telefonen innan första målningen (matchar max-w-stegen). */
const estimateCssWidth = (widthPx?: number) => {
  if (widthPx) return widthPx;
  if (typeof window === 'undefined') return 285;
  const vw = window.innerWidth;
  if (vw >= 1280) return 285;
  if (vw >= 1024) return 260;
  if (vw >= 768) return 230;
  if (vw >= 640) return 215;
  return Math.min(190, vw - 48);
};

const pickLadder = (widthPx?: number) => {
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 3);
  const target = estimateCssWidth(widthPx) * dpr;
  // Välj minsta rung som täcker målet (uppskalning undviks helt).
  return (LADDER.find((r) => r.w >= target - 24) ?? LADDER[LADDER.length - 1]).url;
};

const getSources = (widthPx?: number) =>
  prefersHevc()
    ? [
        { src: hevcAsset.url, type: 'video/mp4; codecs="hvc1"' },
        { src: hiCrispAsset.url, type: 'video/mp4' },
      ]
    : prefersPerformanceMp4()
      ? [{ src: windowsMp4Asset.url, type: 'video/mp4' }]
      : [{ src: pickLadder(widthPx), type: 'video/mp4' }];



/**
 * Video-showcase för jobbsökare — en riktig telefoninspelning av appen i en
 * fotorealistisk iPhone-ram (titanram, tunna ramar, Dynamic Island och
 * sidoknappar).
 *
 * Uppspelning: ett enda videolager med native `loop` + autoplay. Ingen
 * korsfade, ingen manuell omstart — bara rå, oavbruten loop.
 */
const JobSeekerVideoShowcase = ({
  className = '',
  widthPx,
  instant = false,
  active = true,
}: {
  className?: string;
  /** Explicit bredd i px — används när telefonen ska matcha hero-layoutens mått. */
  widthPx?: number;
  /** Hoppa över intro-animationen (telefonen är redan på plats direkt). */
  instant?: boolean;
  /** Pausa videodecode helt när telefonen är visuellt dold utanför hero-zonen. */
  active?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourcesRef = useRef<ReturnType<typeof getSources> | null>(null);
  if (sourcesRef.current === null) sourcesRef.current = getSources(widthPx);
  const sources = sourcesRef.current;


  const safePlay = useCallback((v: HTMLVideoElement | null) => {
    if (!v || !active || document.visibilityState !== 'visible') return;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, [active]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.loop = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.disablePictureInPicture = true;
    if (active) safePlay(v);
    else v.pause();

    const resume = () => {
      if (!active) {
        if (!v.paused) v.pause();
        return;
      }
      if (document.visibilityState !== 'visible') return;
      if (v.paused) safePlay(v);
    };

    document.addEventListener('visibilitychange', resume);
    window.addEventListener('pageshow', resume);
    v.addEventListener('canplay', resume);
    v.addEventListener('pause', resume);

    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('pageshow', resume);
      v.removeEventListener('canplay', resume);
      v.removeEventListener('pause', resume);
    };
  }, [active, safePlay]);


  return (
    <motion.div
      initial={instant ? false : { opacity: 0, y: 40, scale: 0.94 }}
      whileInView={instant ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={instant ? undefined : { once: true, amount: 0.2 }}
      transition={instant ? undefined : { duration: 1.1, ease }}
      style={widthPx ? { width: `${widthPx}px`, maxWidth: '100%' } : undefined}
      className={`relative mx-auto ${widthPx ? '' : 'w-full max-w-[190px] sm:max-w-[215px] md:max-w-[230px] lg:max-w-[260px] xl:max-w-[285px]'} ${className}`}
    >



      {/* Sidoknappar — ligger under ramen så de "sticker ut" ur chassit */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Action-knapp + volym (vänster sida) */}
        <span className="absolute -left-[2px] top-[16.5%] h-[3.4%] w-[2px] rounded-l-full bg-gradient-to-b from-[#8f8b85] to-[#5c5954]" />
        <span className="absolute -left-[2px] top-[24%] h-[6.4%] w-[2px] rounded-l-full bg-gradient-to-b from-[#8f8b85] to-[#5c5954]" />
        <span className="absolute -left-[2px] top-[32.5%] h-[6.4%] w-[2px] rounded-l-full bg-gradient-to-b from-[#8f8b85] to-[#5c5954]" />
        {/* Power (höger sida) */}
        <span className="absolute -right-[2px] top-[27%] h-[9.5%] w-[2px] rounded-r-full bg-gradient-to-b from-[#8f8b85] to-[#5c5954]" />
      </div>

      {/* Titanchassi — behåll borstad metall, men klipp bort den sista
          subpixeln längst ned som annars kan ritas som en horisontell kant. */}
      <div
        className="relative rounded-[13.5%/6.4%] p-[1.5px]"
        style={{
          background:
            'linear-gradient(158deg, #4a4844 0%, #3a3835 22%, #2b2a27 48%, #34322f 66%, #232220 86%, #1b1a18 100%)',
          boxShadow: '0 22px 52px -34px rgba(0, 0, 0, 0.72)',
          clipPath: 'inset(0 0 1.2px 0 round 13.5% / 6.4%)',
          transform: 'translateZ(0)',
        }}
      >
        {/* Svart ram runt skärmen */}
        <div className="relative rounded-[13.3%/6.3%] bg-[#050505] p-[3.2%]">
          {/* Skärm */}
          <div
            className="relative overflow-hidden rounded-[10.5%/4.6%] bg-black"
            style={{ aspectRatio: ASPECT }}
          >
            <video
              ref={videoRef}
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
              poster={posterAsset.url}
              aria-label="Demo av Parium-appen för jobbsökare"
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                // OBS: ingen CSS-`filter` här. En filter-property på ett
                // <video> tvingar Chrome/Edge på Windows bort från den
                // hårdvaruaccelererade video-overlayen och varje bildruta måste
                // då komposit-renderas → hackig uppspelning på laptops utan
                // dedikerad GPU.
              }}
            >
              {sources.map((s) => (
                <source key={s.src} src={s.src} type={s.type} />
              ))}

            </video>


            {/* Statiskt statusfält — täcker hela inspelningens statusrad (klocka,
                wifi, batteri och iOS inspelningsindikator) med appens exakta
                bakgrundsfärg och ritar en helt stilla egen rad ovanpå. Inget
                kan då "blixtra till" när loopen startar om. */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-[6.4%] bg-[#01182f]"
            >
              <div className="flex h-full items-center justify-between px-[7.5%] text-[6px] font-semibold leading-none text-white sm:text-[7px] md:text-[7.5px] lg:text-[8px] xl:text-[9px]">
                <span className="tabular-nums tracking-[-0.02em]">19:41</span>
                <span className="flex items-center gap-[0.35em]">
                  {/* Signal */}
                  <svg viewBox="0 0 18 12" className="h-[0.95em] w-auto" fill="currentColor">
                    <rect x="0" y="8" width="3" height="4" rx="1" />
                    <rect x="5" y="5.5" width="3" height="6.5" rx="1" />
                    <rect x="10" y="3" width="3" height="9" rx="1" />
                    <rect x="15" y="0" width="3" height="12" rx="1" />
                  </svg>
                  {/* Wifi */}
                  <svg viewBox="0 0 16 12" className="h-[0.95em] w-auto" fill="currentColor">
                    <path d="M8 11.2 5.9 8.9a3 3 0 0 1 4.2 0L8 11.2Z" />
                    <path d="M8 6.1c-1.5 0-2.9.6-3.9 1.6l-1.3-1.4A7.2 7.2 0 0 1 8 4.1c2 0 3.9.8 5.2 2.2l-1.3 1.4A5.4 5.4 0 0 0 8 6.1Z" />
                    <path d="M8 2.1c-2.6 0-5 1-6.7 2.7L0 3.4A11.3 11.3 0 0 1 8 .1c3.1 0 6 1.3 8 3.3l-1.3 1.4A9.3 9.3 0 0 0 8 2.1Z" />
                  </svg>
                  {/* Batteri */}
                  <svg viewBox="0 0 26 12" className="h-[0.95em] w-auto">
                    <rect
                      x="0.6"
                      y="0.6"
                      width="22"
                      height="10.8"
                      rx="3"
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.5"
                      strokeWidth="1.2"
                    />
                    <rect x="2.4" y="2.4" width="18.4" height="7.2" rx="1.8" fill="currentColor" />
                    <path
                      d="M24.2 4.2c1 .4 1.4 1 1.4 1.8s-.4 1.4-1.4 1.8V4.2Z"
                      fill="currentColor"
                      fillOpacity="0.5"
                    />
                  </svg>
                </span>
              </div>
            </div>
            {/* Dynamic Island i normalt läge */}
            <div
              aria-hidden
              className="absolute left-1/2 top-[1.2%] h-[4.3%] w-[30%] -translate-x-1/2 rounded-full bg-black"
            />



            {/* Skärmreflex + inre kant — hålls diskret så kontrasten inte tappas */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{
                background:
                  'linear-gradient(115deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 20%, rgba(255,255,255,0) 42%)',
                boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.08)',
              }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default JobSeekerVideoShowcase;

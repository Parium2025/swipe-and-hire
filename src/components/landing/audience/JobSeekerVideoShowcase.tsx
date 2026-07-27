import { useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

/** Videons nativa proportion (720 x 1560). */
const ASPECT = '720 / 1560';

const SOURCES = [
  { src: '/showcase-jobseeker.hevc.mp4', type: 'video/mp4; codecs="hvc1"' },
  { src: '/showcase-jobseeker.mp4', type: 'video/mp4' },
] as const;

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
}: {
  className?: string;
  /** Explicit bredd i px — används när telefonen ska matcha hero-layoutens mått. */
  widthPx?: number;
  /** Hoppa över intro-animationen (telefonen är redan på plats direkt). */
  instant?: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const safePlay = useCallback((v: HTMLVideoElement | null) => {
    if (!v) return;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, []);

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
    safePlay(v);

    const resume = () => {
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
  }, [safePlay]);


  return (
    <motion.div
      initial={instant ? false : { opacity: 0, y: 40, scale: 0.94 }}
      whileInView={instant ? undefined : { opacity: 1, y: 0, scale: 1 }}
      viewport={instant ? undefined : { once: true, amount: 0.2 }}
      transition={instant ? undefined : { duration: 1.1, ease }}
      style={widthPx ? { width: `${widthPx}px`, maxWidth: '100%' } : undefined}
      className={`relative mx-auto ${widthPx ? '' : 'w-full max-w-[190px] sm:max-w-[215px] md:max-w-[230px] lg:max-w-[260px] xl:max-w-[285px]'} ${className}`}
    >

      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-secondary/20 blur-3xl sm:-inset-8"
      />

      {/* Sidoknappar — ligger under ramen så de "sticker ut" ur chassit */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Action-knapp + volym (vänster sida) */}
        <span className="absolute -left-[2px] top-[16.5%] h-[3.4%] w-[2px] rounded-l-full bg-gradient-to-b from-[#8f8b85] to-[#5c5954]" />
        <span className="absolute -left-[2px] top-[24%] h-[6.4%] w-[2px] rounded-l-full bg-gradient-to-b from-[#8f8b85] to-[#5c5954]" />
        <span className="absolute -left-[2px] top-[32.5%] h-[6.4%] w-[2px] rounded-l-full bg-gradient-to-b from-[#8f8b85] to-[#5c5954]" />
        {/* Power (höger sida) */}
        <span className="absolute -right-[2px] top-[27%] h-[9.5%] w-[2px] rounded-r-full bg-gradient-to-b from-[#8f8b85] to-[#5c5954]" />
      </div>

      {/* Titanchassi */}
      <div
        className="relative rounded-[13.5%/6.4%] p-[1.5px] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.75),0_2px_8px_-2px_rgba(0,0,0,0.5)]"
        style={{
          background:
            'linear-gradient(150deg, #e6e3de 0%, #a7a29b 18%, #6f6b66 42%, #b9b4ad 62%, #77736e 82%, #d5d1cb 100%)',
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
              poster="/showcase-jobseeker-poster.jpg"
              aria-label="Demo av Parium-appen för jobbsökare"
              className="absolute inset-0 h-full w-full object-cover"
              style={{
                // Kompenserar för att en liten skärm + glans-overlay plattar ut
                // kontrasten jämfört med en riktig telefon.
                filter: 'saturate(1.06) contrast(1.04)',
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
              }}
            >
              {SOURCES.map((s) => (
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

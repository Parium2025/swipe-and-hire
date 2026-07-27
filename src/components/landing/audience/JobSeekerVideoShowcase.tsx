import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

/** Sekunder av korsfade i loop-skarven — döljer hoppet mellan sista och första bildrutan. */
const CROSSFADE = 0.6;
/** Videons nativa proportion (540 x 1170). */
const ASPECT = '540 / 1170';

const SOURCES = [
  { src: '/showcase-jobseeker.hevc.mp4', type: 'video/mp4; codecs="hvc1"' },
  { src: '/showcase-jobseeker.mp4', type: 'video/mp4' },
] as const;

/**
 * Video-showcase för jobbsökare — en riktig telefoninspelning av appen i en
 * fotorealistisk iPhone-ram (titanram, tunna ramar, Dynamic Island och
 * sidoknappar).
 *
 * Sömlös loop: två videolager spelar växelvis och korsfadar i skarven, så att
 * omstarten aldrig "blixtrar till". Dynamic Island-överlägget täcker samtidigt
 * iOS-statusfältets inspelningsindikator högst upp i klippet.
 */
const JobSeekerVideoShowcase = ({ className = '' }: { className?: string }) => {
  const videoRefs = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [active, setActive] = useState(0);
  const swapping = useRef(false);

  const prime = useCallback((v: HTMLVideoElement) => {
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
  }, []);

  const safePlay = useCallback((v: HTMLVideoElement | null) => {
    if (!v) return;
    const p = v.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  }, []);

  useEffect(() => {
    const [a, b] = videoRefs.map((r) => r.current);
    if (!a || !b) return;
    [a, b].forEach(prime);

    // Bara det aktiva lagret spelar; det andra står redo på frame 0.
    safePlay(a);
    b.currentTime = 0;

    const onTime = () => {
      const cur = videoRefs[active].current;
      const next = videoRefs[1 - active].current;
      if (!cur || !next || !cur.duration || swapping.current) return;
      if (cur.duration - cur.currentTime <= CROSSFADE) {
        swapping.current = true;
        next.currentTime = 0;
        safePlay(next);
        setActive((i) => 1 - i);
        // Släpp spärren när skarven är passerad och pausa det utfadade lagret.
        window.setTimeout(() => {
          cur.pause();
          cur.currentTime = 0;
          swapping.current = false;
        }, CROSSFADE * 1000);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') safePlay(videoRefs[active].current);
    };
    const onPageShow = () => safePlay(videoRefs[active].current);

    a.addEventListener('timeupdate', onTime);
    b.addEventListener('timeupdate', onTime);
    a.addEventListener('canplay', onPageShow);
    b.addEventListener('canplay', onPageShow);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      a.removeEventListener('timeupdate', onTime);
      b.removeEventListener('timeupdate', onTime);
      a.removeEventListener('canplay', onPageShow);
      b.removeEventListener('canplay', onPageShow);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onPageShow);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, prime, safePlay]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.94 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 1.1, ease }}
      className={`relative mx-auto w-full max-w-[190px] sm:max-w-[215px] md:max-w-[230px] lg:max-w-[260px] xl:max-w-[285px] ${className}`}
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
            {videoRefs.map((ref, i) => (
              <video
                key={i}
                ref={ref}
                autoPlay={i === 0}
                muted
                playsInline
                preload="auto"
                poster={i === 0 ? '/showcase-jobseeker-poster.jpg' : undefined}
                aria-hidden={i !== active}
                aria-label={i === 0 ? 'Demo av Parium-appen för jobbsökare' : undefined}
                className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[600ms] ease-linear"
                style={{ opacity: i === active ? 1 : 0 }}
              >
                {SOURCES.map((s) => (
                  <source key={s.src} src={s.src} type={s.type} />
                ))}
              </video>
            ))}

            {/* Maskar bort iOS utökade inspelnings-island (röd prick) med appens
                exakta statusfältsfärg — klocka och batteri får vara kvar. */}
            <div
              aria-hidden
              className="absolute left-[23%] right-[23%] top-0 h-[6.6%] bg-[#01182f]"
            />
            {/* Dynamic Island i normalt läge */}
            <div
              aria-hidden
              className="absolute left-1/2 top-[1.2%] h-[4.3%] w-[30%] -translate-x-1/2 rounded-full bg-black"
            />


            {/* Skärmreflex + inre kant */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-[inherit]"
              style={{
                background:
                  'linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 22%, rgba(255,255,255,0) 45%)',
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

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
const JobSeekerVideoShowcase = ({ className = '' }: { className?: string }) => {
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


            {/* Maskar bort iOS utökade inspelnings-island (röd prick) med appens
                exakta statusfältsfärg — klocka och batteri får vara kvar. */}
            <div
              aria-hidden
              className="absolute left-[25%] right-[27.5%] top-0 h-[6.4%] bg-[#01182f]"
            />
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

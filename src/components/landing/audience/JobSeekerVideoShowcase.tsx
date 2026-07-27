import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Video-showcase för jobbsökare — visar en riktig telefoninspelning av appen
 * i en snygg mockup-ram. Loopar, muted, autoplay, playsInline. Presenterad
 * som en levande produktdemo direkt under intro-texten.
 *
 * Cross-device:
 *  - Mobil: staplas under intro-texten, full bredd (max 320px), centrerad.
 *  - Tablet/Desktop: sitter till höger om texten via grid i föräldern; här
 *    hanterar vi bara innermockup + video så komponenten funkar i båda layouts.
 */
const JobSeekerVideoShowcase = ({ className = '' }: { className?: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');
    v.setAttribute('autoplay', '');
    const tryPlay = () => {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };
    tryPlay();
    const onCanPlay = () => tryPlay();
    const onVisible = () => {
      if (document.visibilityState === 'visible') tryPlay();
    };
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('loadeddata', onCanPlay);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', tryPlay);
    return () => {
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('loadeddata', onCanPlay);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', tryPlay);
    };
  }, []);

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
      {/* Phone frame */}
      <div className="relative overflow-hidden rounded-[1.9rem] border border-white/15 bg-black/40 p-[5px] shadow-[0_24px_60px_-22px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:rounded-[2.2rem] sm:p-[6px]">
        <div className="relative overflow-hidden rounded-[1.6rem] bg-black sm:rounded-[1.9rem]">
          <video
            ref={videoRef}
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            poster="/showcase-jobseeker-poster.jpg"
            aria-label="Demo av Parium-appen för jobbsökare"
            className="block h-auto w-full"
            style={{ aspectRatio: '1180 / 2556' }}
          >
            <source src="/showcase-jobseeker.hevc.mp4" type='video/mp4; codecs="hvc1"' />
            <source src="/showcase-jobseeker.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </motion.div>

  );
};

export default JobSeekerVideoShowcase;

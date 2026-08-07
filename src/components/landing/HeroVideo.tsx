import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { isWindowsDevice, prefersLightweightVideo, prefersReducedData } from '@/lib/videoPlatform';
import hero720 from '@/assets/landing/hero/hero-video-720.mp4.asset.json';
import heroFull from '@/assets/landing/hero/hero-video.mp4.asset.json';
import heroPoster from '@/assets/landing/hero/hero-video-poster.jpg.asset.json';
import { registerLandingVideo } from '@/lib/landingVideoCoordinator';

// Datasparläge eller 2G → hoppa över videoladdning helt och visa bara poster.
// Sparar 2,4–13 MB för användare i dåligt nät utan att förändra UX synbart.
const shouldSkipVideo = () => {
  if (typeof navigator === 'undefined') return false;
  const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
  if (!conn) return false;
  if (conn.saveData) return true;
  if (typeof conn.effectiveType === 'string' && /(^|-)2g$/.test(conn.effectiveType)) return true;
  return false;
};

// Välj EXAKT en källa. `media` på <source> inuti <video> respekteras inte
// tillförlitligt av Chrome/Edge → desktop hämtade både 6,3 MB och 2,4 MB och
// spelade sedan den lilla. Det åt hela nätverksbudgeten på Windows.
const pickHeroSrc = () => {
  if (typeof window === 'undefined') return hero720.url;
  const desktop = typeof window.matchMedia === 'function' && window.matchMedia('(min-width: 1024px)').matches;
  // Windows/Android (och sparläge/svagt nät) får den lätta 720p-mastern även på
  // desktop: 6,3 MB + mjukvaruavkodning är exakt det som gör hero-videon hackig
  // där. Villkoret delas nu med galleriet via videoPlatform.ts så de inte glider isär.
  return desktop && !prefersLightweightVideo() && !prefersReducedData() ? heroFull.url : hero720.url;
};


const HeroVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [windowsDevice] = useState<boolean>(isWindowsDevice);
  const [skipVideo] = useState<boolean>(shouldSkipVideo);
  const [heroSrc] = useState<string>(pickHeroSrc);
  // Ger upp helt och visar postern om videon inte går att spela. Bättre en
  // skarp stillbild än en sida som slåss med decodern i evighet.
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || skipVideo || gaveUp) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    const onError = () => setGaveUp(true);
    video.addEventListener('error', onError, { once: true });
    const unregister = registerLandingVideo(video, 30);
    return () => {
      unregister();
      video.removeEventListener('error', onError);
    };
  }, [skipVideo, gaveUp]);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <motion.div
        initial={windowsDevice ? { opacity: 0 } : { opacity: 0, scale: 1.06 }}
        animate={windowsDevice ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        className="absolute inset-0 h-full w-full"
      >
        <video
          ref={videoRef}
          muted
          loop
          playsInline
          // preload="metadata" — videon hämtas ändå via <link rel="preload"> i index.html,
          // så vi behöver inte att <video>-elementet startar en parallell auto-fetch.
          preload="metadata"
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate nofullscreen"
          poster={heroPoster.url}

          onContextMenu={(e) => e.preventDefault()}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        >
          {!skipVideo && !gaveUp && (
            /* Endast EN källa — samma URL som <link rel="preload"> i index.html,
               så browsern återanvänder samma fetch istället för att ladda två filer.
               Vid gaveUp tas källan bort helt: då står postern kvar och browsern
               slutar försöka dekoda, i stället för att mala i bakgrunden. */
            <source src={heroSrc} type="video/mp4" />
          )}

        </video>
      </motion.div>
      <div className="absolute inset-0 bg-black/45 md:bg-black/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60 md:from-black/25 md:via-transparent md:to-black/55 pointer-events-none" />
    </div>
  );
};

export default HeroVideo;

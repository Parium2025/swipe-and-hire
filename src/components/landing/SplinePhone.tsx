import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Application as SplineApplication } from '@splinetool/runtime';
import { isAndroidDevice, isWindowsDevice } from '@/lib/videoPlatform';

interface SplinePhoneProps {
  className?: string;
  style?: CSSProperties;
  zoom?: number;
  active?: boolean;
}

const SCENE_URL = '/spline/parium-phone-scene.splinecode';

export const SplinePhone = ({ className, style, zoom = 0.78, active = true }: SplinePhoneProps) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const appRef = useRef<SplineApplication | null>(null);
  const activeRef = useRef(active);
  const galleryActiveRef = useRef(false);
  const onScreenRef = useRef(true);

  const zoomRef = useRef(zoom);

  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /**
   * EN sanning för om renderloopen ska rulla. Tidigare fanns tre separata
   * effekter som var för sig anropade play()/stop() utifrån sin egen delmängd
   * av villkoren — de kunde därför starta om loopen åt varandra (t.ex. kunde
   * visibilitychange starta Spline igen mitt i galleriet). Nu räknas hela
   * villkoret ut på ett ställe.
   */
  const syncPlayback = () => {
    const app = appRef.current;
    if (!app) return;
    const shouldRun =
      activeRef.current &&
      !galleryActiveRef.current &&
      onScreenRef.current &&
      !scrollingRef.current &&
      !document.hidden;

    if (shouldRun) {
      if (app.isStopped) app.play();
    } else if (!app.isStopped) {
      app.stop();
    }
  };

  useEffect(() => {
    activeRef.current = active;
    syncPlayback();
  }, [active, isReady]);

  // På Windows/Android delar WebGL och videodecode samma knappa GPU-budget.
  // Stoppa Spline-renderloopen medan galleriet är aktivt; Apple lämnas exakt
  // oförändrat och fortsätter rendera med sin tidigare livscykel.
  useEffect(() => {
    if (!isWindowsDevice() && !isAndroidDevice()) return;
    const onGalleryEnter = () => {
      galleryActiveRef.current = true;
      syncPlayback();
    };
    const onGalleryLeave = () => {
      galleryActiveRef.current = false;
      syncPlayback();
    };
    window.addEventListener('parium:gallery-enter', onGalleryEnter);
    window.addEventListener('parium:gallery-leave', onGalleryLeave);
    return () => {
      window.removeEventListener('parium:gallery-enter', onGalleryEnter);
      window.removeEventListener('parium:gallery-leave', onGalleryLeave);
    };
  }, []);

  /**
   * Windows/Android: rendera bara när telefonen faktiskt syns.
   *
   * Utan detta fortsatte den kontinuerliga WebGL-loopen (renderMode 'auto')
   * rulla i bakgrunden genom hela sidan — mätning under scroll visade att
   * Spline-runtime stod för merparten av GPU-/huvudtrådsarbetet, även när
   * telefonen låg långt ovanför viewporten. Det är den enskilt största
   * anledningen till att scrollen kändes tung just på Windows.
   *
   * Apple rörs inte: där finns hårdvarubudget för både WebGL och video, och
   * beteendet ska vara exakt som förut.
   */
  useEffect(() => {
    if (!isWindowsDevice() && !isAndroidDevice()) return;
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          onScreenRef.current = entry.isIntersecting;
        }
        syncPlayback();
      },
      { rootMargin: '15% 0px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [isReady]);

  /**
   * NOT: att pausa Spline under pågående scroll testades och gjorde det
   * MÄTBART SÄMRE (median 16,8 ms → 57 ms, 51+ long tasks). Splines play()
   * bygger upp renderloopen på nytt varje gång, så start/stopp fem gånger i
   * sekunden kostar mer än de frames man sparar. Renderloopen får bara
   * stängas av vid tillståndsbyten som varar — utanför vy, dold flik, galleri.
   */


  // Pausa renderloopen när fliken är dold — annars fortsätter WebGL tugga GPU
  // i bakgrunden och konkurrerar med videoavkodningen när man kommer tillbaka.
  useEffect(() => {
    const onVisibility = () => syncPlayback();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);




  useEffect(() => {
    zoomRef.current = zoom;
    const app = appRef.current;
    if (!app || !isReady) return;
    app.setZoom(zoom);
    requestAnimationFrame(() => appRef.current?.setZoom(zoom));
  }, [zoom, isReady]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let app: SplineApplication | null = null;

    const waitForFrames = (count: number) =>
      new Promise<void>((resolve) => {
        const tick = (remaining: number) => {
          if (remaining <= 0) {
            resolve();
            return;
          }
          requestAnimationFrame(() => tick(remaining - 1));
        };
        tick(count);
      });

    const inspectSplineFrame = () => {
      try {
        const width = canvas.width;
        const height = canvas.height;
        if (!width || !height) return { hasScenePixels: false, hasWhiteSlab: true };

        const sampleCanvas = document.createElement('canvas');
        const sampleWidth = 80;
        const sampleHeight = Math.max(120, Math.round((height / width) * sampleWidth));
        sampleCanvas.width = sampleWidth;
        sampleCanvas.height = sampleHeight;

        const ctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return { hasScenePixels: false, hasWhiteSlab: false };
        ctx.drawImage(canvas, 0, 0, sampleWidth, sampleHeight);

        const { data } = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
        let whiteCount = 0;
        let scenePixelCount = 0;
        let minX = sampleWidth;
        let minY = sampleHeight;
        let maxX = 0;
        let maxY = 0;

        for (let y = 0; y < sampleHeight; y += 1) {
          for (let x = 0; x < sampleWidth; x += 1) {
            const i = (y * sampleWidth + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            const isMeaningfulPixel = a > 24 && (r > 8 || g > 8 || b > 8);
            const isWhite = a > 220 && r > 218 && g > 218 && b > 218 && Math.max(r, g, b) - Math.min(r, g, b) < 34;
            if (isMeaningfulPixel) scenePixelCount += 1;
            if (!isWhite) continue;
            whiteCount += 1;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }

        const hasScenePixels = scenePixelCount / (sampleWidth * sampleHeight) > 0.012;
        if (whiteCount < 180) return { hasScenePixels, hasWhiteSlab: false };
        const whiteRatio = whiteCount / (sampleWidth * sampleHeight);
        const boxWidth = maxX - minX;
        const boxHeight = maxY - minY;
        const looksLikePhonePlaceholder = boxWidth >= sampleWidth * 0.16 && boxHeight >= sampleHeight * 0.34;

        return { hasScenePixels, hasWhiteSlab: whiteRatio > 0.025 && looksLikePhonePlaceholder };
      } catch {
        return { hasScenePixels: true, hasWhiteSlab: false };
      }
    };

    const waitForVisualSettle = async () => {
      const isCoarse = window.matchMedia?.('(pointer: coarse)').matches;
      await waitForFrames(isCoarse ? 10 : 4);
      await new Promise<void>((resolve) => window.setTimeout(resolve, isCoarse ? 760 : 140));
      const startedAt = performance.now();
      const maxWait = isCoarse ? 2800 : 1200;
      let stableFrames = 0;

      while (!cancelled && performance.now() - startedAt < maxWait) {
        await waitForFrames(1);
        const frame = inspectSplineFrame();
        if (!frame.hasScenePixels || frame.hasWhiteSlab) {
          stableFrames = 0;
          continue;
        }
        stableFrames += 1;
        if (stableFrames >= (isCoarse ? 10 : 4)) break;
      }

      await waitForFrames(isCoarse ? 4 : 1);
    };

    const boot = async () => {
      try {
        const { Application } = await import('@splinetool/runtime');
        if (cancelled) return;

        // Spline renderar utan MSAA (getContextAttributes().antialias === false,
        // SAMPLES === 0) och till en offscreen render target. Tunna kanter —
        // som sidoknappen — saknar därför helt kantutjämning: när modellen
        // roterar långsamt hoppar kanten mellan två pixelcentrum och ser ut
        // att blinka (temporal aliasing). Enda sättet att bli av med det utan
        // tillgång till Splines pipeline är supersampling: rendera canvasen
        // med fler pixlar än skärmen och låta browsern skala ned = äkta SSAA.
        // Canvasen är bara ~177x383 CSS-px, så 3x är ca 0,6 MP — försumbart.
        const ssaa = () => {
          const isCoarse = window.matchMedia?.('(pointer: coarse)').matches;
          const dpr = window.devicePixelRatio || 1;
          // Windows/Android: 3x SSAA håller en kontinuerlig WebGL-renderloop på
          // ~0,6 MP/frame och konkurrerar direkt med videodecode, särskilt på
          // integrerad GPU och extern skärm. Apple behåller exakt tidigare 3x.
          if (isWindowsDevice() || isAndroidDevice()) {
            return Math.min(1.5, Math.max(1, dpr));
          }
          // Mobil: 2.5 räcker och håller GPU-budgeten nere bredvid videon.
          // Desktop: 3x, oavsett att skärmen bara har 1x/1.25x.
          return isCoarse ? Math.min(3, Math.max(dpr, 2.5)) : Math.min(3, Math.max(dpr, 3));
        };

        if (typeof window !== 'undefined' && 'devicePixelRatio' in window) {
          try {
            Object.defineProperty(canvas, '_dprCap', {
              value: ssaa(),
              configurable: true,
            });
          } catch {
            /* no-op */
          }
        }

        app = new Application(canvas, { renderMode: 'auto' });
        appRef.current = app;
        await app.load(SCENE_URL);
        try {
          // OBS: Splines interna renderer ligger på `_renderer` (den publika
          // `renderer` finns inte) — tidigare försök att höja pixel ratio
          // träffade därför ingenting alls.
          const internal = app as unknown as {
            _renderer?: { setPixelRatio?: (n: number) => void };
            setSize?: (w: number, h: number) => void;
            requestRender?: () => void;
          };
          const ratio = ssaa();
          internal._renderer?.setPixelRatio?.(ratio);
          const rect = canvas.getBoundingClientRect();
          if (rect.width && rect.height) internal.setSize?.(rect.width, rect.height);
          internal.requestRender?.();
        } catch {
          /* no-op */
        }




        app.setZoom(zoomRef.current);
        requestAnimationFrame(() => app?.setZoom(zoomRef.current));
        syncPlayback();
        await waitForVisualSettle();
        if (!cancelled) {
          setIsReady(true);
          window.dispatchEvent(new Event('parium:spline-ready'));
        }
      } catch (error) {
        console.error('Kunde inte ladda Spline-telefonen:', error);
        if (!cancelled) setHasError(true);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      app?.dispose();
      appRef.current = null;
    };
  }, [reducedMotion]);

  if (hasError) {
    return (
      <div
        ref={wrapperRef}
        aria-hidden="true"
        data-spline-phone
        className={`relative select-none overflow-visible ${className ?? ''}`}
        style={style}
      />
    );
  }

  return (
    <div
      ref={wrapperRef}
      data-spline-phone
      className={`relative select-none overflow-visible ${className ?? ''}`}
      style={{ touchAction: 'pan-y', overscrollBehavior: 'contain', ...style }}
    >
      <div
        data-spline-phone-host
        aria-hidden={!isReady}
        className="absolute inset-0"
        style={{
          opacity: isReady ? 1 : 0,
          visibility: 'visible',
          transform: isReady ? 'translate3d(0, 0, 0)' : 'translate3d(-200vw, 0, 0)',
          transition: 'opacity 520ms cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: 'opacity, transform',
          contain: 'layout paint style',
          backgroundColor: 'transparent',
        }}
      >
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Parium 3D-telefon"
          tabIndex={-1}
          data-spline-phone-canvas
          className="relative h-full w-full cursor-grab bg-transparent outline-none active:cursor-grabbing"
          draggable={false}
          style={{
            colorScheme: 'normal',
            backgroundColor: 'transparent',
            display: 'block',
            opacity: 1,
            visibility: 'inherit',
            transition: 'none',
            willChange: 'auto',
            touchAction: 'none',
          }}
        />
      </div>
      {!isReady && (
        <div
          data-spline-phone-mask
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundColor: 'transparent',
            touchAction: 'none',
          }}
        />
      )}
    </div>
  );
};

export default SplinePhone;
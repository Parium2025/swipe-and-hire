import { memo, useEffect, useMemo, useRef } from 'react';
import { motion, useMotionValue, useTransform, useVelocity, useSpring } from 'framer-motion';
import { useInputCapability } from '@/hooks/useInputCapability';
import { useCardImage } from '@/hooks/useCardImage';
import type { SwipeJob } from './types';
import { getJobOverlayTextStyle } from '@/lib/jobOverlayText';
import { getImageVersion } from '@/lib/imageTransforms';

import {
  SWIPE_IMG_TRANSFORM,
  SWIPE_LOGO_TRANSFORM,
  UNDERLAY_INITIAL_SCALE,
  UNDERLAY_INITIAL_Y,
} from './jobSlide/constants';
import { getImageObjectPosition } from './jobSlide/utils';
import { JobSlideContent, OccupationBadge } from './jobSlide/JobSlideContent';
import { NextCardUnderlay } from './jobSlide/NextCardUnderlay';
import { useUndoEntryAnimation } from './jobSlide/useUndoEntryAnimation';
import { useTapHint } from './jobSlide/useTapHint';
import { useSwipeCardGesture, type SwipeDirection } from './jobSlide/useSwipeCardGesture';

export interface JobSlideSwipeApi {
  swipe: (direction: SwipeDirection) => void;
}

interface JobSlideProps {
  job: SwipeJob;
  nextJob?: SwipeJob;
  applied: boolean;
  saved: boolean;
  skipped?: boolean;
  isVisible: boolean;
  isActive: boolean;
  isLast: boolean;
  sectionHeight?: string;
  overlayOpen?: boolean;
  skipEntryAnimation?: boolean;
  isUndoEntry?: boolean;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onSave: () => void;
  onTap: () => void;
  /**
   * Registrerar/avregistrerar aktivt korts swipe-API mot föräldern så att
   * den persistenta action-baren kan trigga vänster/höger-swipe.
   */
  onRegisterSwipeApi?: (api: JobSlideSwipeApi | null) => void;
}

export const JobSlide = memo(function JobSlide({
  job,
  nextJob,
  applied,
  saved,
  skipped,
  isVisible,
  isActive,
  isLast,
  sectionHeight,
  overlayOpen,
  skipEntryAnimation,
  isUndoEntry,
  onSwipeRight,
  onSwipeLeft,
  onSave,
  onTap,
  onRegisterSwipeApi,
}: JobSlideProps) {
  const inputCapability = useInputCapability();
  const useTouchTunnel = inputCapability !== 'mouse';

  const x = useMotionValue(0);
  const exitOpacity = useMotionValue(1);
  const entryScale = useMotionValue(1);
  const likeOpacity = useTransform(x, [0, 60, 140], [0, 0.4, 1]);
  const nopeOpacity = useTransform(x, [-140, -60, 0], [1, 0.4, 0]);
  // Mjukare rotate/scale-utslag = mindre visuell wobble under drag.
  // Rotate 10° → 6°, scale 0.95 → 0.98.
  const cardRotate = useTransform(x, [-200, 0, 200], [-6, 0, 6]);
  const cardScale = useTransform(x, [-200, 0, 200], [0.98, 1, 0.98]);
  const combinedScale = useTransform(
    [cardScale, entryScale],
    ([cs, es]) => (cs as number) * (es as number),
  );
  // 🚫 Ingen animerad boxShadow: att interpolera skuggsträngar per frame
  // tvingar browsern att repainta hela kortet varje frame → lagg-känsla.
  // Statisk skugga = ren kompositor-transform (GPU) på x/rotate/scale.
  const STATIC_CARD_SHADOW =
    '0 18px 45px -10px rgba(0,0,0,0.4), 0 6px 16px -4px rgba(0,0,0,0.25)';

  // Underlay: driven av explicit timed animation, INTE drag-progress
  const underlayY = useMotionValue(UNDERLAY_INITIAL_Y);
  const underlayScale = useMotionValue(UNDERLAY_INITIAL_SCALE);
  const underlayOpacity = useMotionValue(0);

  const titleRef = useRef<HTMLHeadingElement>(null);

  const displayCompanyName = job.workplace_name || job.company_name || 'Okänt företag';

  // KRITISKT: getImageVersion (image_updated_at ?? updated_at) MÅSTE matcha
  // useSwipeImagePreloader exakt, annars warmar preloadern en URL och kortet
  // renderar en annan → cache-miss + synlig nätverksladdning på första frame.
  const { displayUrl: imageUrl, handleError: handleImageError } = useCardImage(
    job.job_image_url ?? null,
    'job-images',
    getImageVersion(job),
    SWIPE_IMG_TRANSFORM,
  );
  const { displayUrl: nextImageUrl } = useCardImage(
    nextJob?.job_image_url ?? null,
    'job-images',
    getImageVersion(nextJob),
    SWIPE_IMG_TRANSFORM,
  );


  // 🚀 Logo i swipe-card är liten (~64px) → be om optimerad version
  const { displayUrl: logoUrl, handleError: handleLogoError } = useCardImage(
    job.company_logo_url ?? null,
    'company-logos',
    getImageVersion(job),
    SWIPE_LOGO_TRANSFORM,
  );
  const { displayUrl: nextLogoUrl } = useCardImage(
    nextJob?.company_logo_url ?? null,
    'company-logos',
    getImageVersion(nextJob),
    SWIPE_LOGO_TRANSFORM,
  );
  const overlayTextStyle = useMemo(
    () => getJobOverlayTextStyle(job.overlay_text_color),
    [job.overlay_text_color],
  );

  // Tap-hint (title/company popover) — inklusive auto-hide-timer och
  // stängning när overlayet öppnas.
  const { showTapHint, tapHintSource, isTitleTruncated, armTapHint, clearTapHint } =
    useTapHint({ overlayOpen, titleRef });

  // All gestlogik (touch-tunnel + mouse-drag + trigger) i en hook.
  const {
    triggerSwipe,
    handleDragEnd,
    handleTouchStartCapture,
    handleTouchMoveCapture,
    handleTouchEndCapture,
    handleTouchCancelCapture,
  } = useSwipeCardGesture({
    useTouchTunnel,
    overlayOpen,
    showTapHint,
    x,
    exitOpacity,
    underlayY,
    underlayScale,
    underlayOpacity,
    onSwipeLeft,
    onSwipeRight,
    onTap,
    onTapTitle: () => armTapHint('title'),
    onTapCompany: () => armTapHint('company'),
    clearTapHint,
  });

  // ✨ Ångra: mjuk premium "catch"-animation.
  useUndoEntryAnimation({ isUndoEntry, x, exitOpacity, entryScale });

  // 🎛️ Registrera swipe-API för föräldern när kortet är aktivt.
  // Bar-knapparna (persistent längst ner i SwipeFullscreen) triggar
  // den aktiva `triggerSwipe`. Vi avregistrerar vid unmount + när isActive
  // blir false så att den gamla instansen inte lämnar en stale referens.
  useEffect(() => {
    if (!onRegisterSwipeApi) return;
    if (isActive) {
      onRegisterSwipeApi({ swipe: triggerSwipe });
      return () => {
        onRegisterSwipeApi(null);
      };
    }
  }, [isActive, onRegisterSwipeApi, triggerSwipe]);



  return (
    <div
      className="h-full w-full flex flex-col px-3 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] pt-[calc(env(safe-area-inset-top,0px)+4.75rem)]"
      style={sectionHeight ? { height: sectionHeight } : undefined}
    >
      {/* Card area with swipe */}
      <div className="relative min-h-0 flex-1">
        {nextJob && isActive && !overlayOpen && (
          <NextCardUnderlay
            job={nextJob}
            imageUrl={nextImageUrl}
            logoUrl={nextLogoUrl}
            y={underlayY}
            scale={underlayScale}
            opacity={underlayOpacity}
          />
        )}

        <motion.div
          // bg-[hsl(215,85%,15%)] = solid mörk bas så app-bakgrunden aldrig
          // lyser igenom den avrundade kanten under första framen eller under
          // scale-in (nytt kort/ångra). Utan denna färg såg iOS Safari ett
          // synligt vitt "rim" tills bilden dekodades.
          className={`relative h-full rounded-2xl overflow-hidden bg-[hsl(215,85%,15%)] select-none [-webkit-tap-highlight-color:transparent] ${isActive ? 'will-change-transform' : ''}`}
          style={{
            x,
            opacity: exitOpacity,
            rotate: cardRotate,
            scale: combinedScale,
            boxShadow: STATIC_CARD_SHADOW,
            touchAction: useTouchTunnel ? 'pan-y' : 'auto',
          }}
          drag={useTouchTunnel ? false : 'x'}
          dragDirectionLock={!useTouchTunnel}
          dragConstraints={useTouchTunnel ? undefined : { left: 0, right: 0 }}
          dragElastic={useTouchTunnel ? undefined : 0.18}

          onDragEnd={useTouchTunnel ? undefined : handleDragEnd}
          onTouchStartCapture={handleTouchStartCapture}
          onTouchMoveCapture={handleTouchMoveCapture}
          onTouchEndCapture={handleTouchEndCapture}
          onTouchCancelCapture={handleTouchCancelCapture}
          onDoubleClick={useTouchTunnel ? undefined : onTap}
        >
          {/* Bakgrundsbild — decoding="sync" på AKTIVT kort: bilden är redan
              förvärmd i blob-cachen (useSwipeImagePreloader), och vi behöver
              garantera att den är fullt dekodad till första paint när ett nytt
              kort mountas efter swipe. Async här orsakade en synlig "blixt"
              (basfärgen syns 1 frame innan bilden hinner målas). */}
          <div className="absolute inset-0">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={job.title}
                className="w-full h-full object-cover"
                style={{ objectPosition: getImageObjectPosition(job.image_focus_position) }}
                loading={isVisible ? 'eager' : 'lazy'}
                decoding="sync"
                fetchPriority={isActive ? 'high' : 'auto'}
                draggable={false}
                onError={handleImageError}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[hsl(215,85%,25%)] to-[hsl(215,85%,15%)]" />
            )}
          </div>

          {/* Gradient overlay – stronger for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />

          {/* Kategori-badge */}
          {job.occupation && <OccupationBadge occupation={job.occupation} />}

          {/* SÖK-stamp */}
          <motion.div
            className="absolute top-8 left-6 z-20 border-4 border-green-400 rounded-lg px-4 py-1 -rotate-12 pointer-events-none"
            style={{ opacity: likeOpacity }}
          >
            <span className="text-green-400 text-2xl font-black tracking-wider">SÖK</span>
          </motion.div>

          {/* TYCKER INTE OM-stamp */}
          <motion.div
            className="absolute top-8 right-6 z-20 border-4 border-red-400 rounded-lg px-3 py-1 rotate-12 pointer-events-none"
            style={{ opacity: nopeOpacity }}
          >
            <span className="text-red-400 text-lg font-black tracking-wider">TYCKER INTE OM</span>
          </motion.div>

          {/* Applied stamp — ingen backdrop-blur: filter re-samplas per frame
              på iOS Safari → orsakar synligt flimmer vid fade-in. bg-black/55
              ger samma läsbarhet utan GPU-blur-kostnad. */}
          {applied && (
            <div className="absolute top-4 left-4 z-30 pointer-events-none">
              <div className="-rotate-[12deg] border-[3px] border-green-500 rounded-lg px-4 py-1.5 bg-black/55">
                <span className="text-green-500 text-lg font-black tracking-widest uppercase">SÖKT ✓</span>
              </div>
            </div>
          )}

          {/* Skipped stamp — samma anledning: ingen backdrop-blur. */}
          {skipped && !applied && (
            <div className="absolute top-4 left-4 z-30 pointer-events-none">
              <div className="-rotate-[12deg] border-[3px] border-white/40 rounded-lg px-4 py-1.5 bg-black/55">
                <span className="text-white/60 text-lg font-black tracking-widest uppercase">SKIPPAD</span>
              </div>
            </div>
          )}

          <JobSlideContent
            job={job}
            logoUrl={logoUrl}
            hasImage={Boolean(imageUrl)}
            displayCompanyName={displayCompanyName}
            overlayTextStyle={overlayTextStyle}
            interactive
            titleRef={titleRef}
            onLogoError={handleLogoError}
          />


          {showTapHint && tapHintSource === 'title' && isTitleTruncated() && (
            <div className="absolute inset-x-4 bottom-24 z-30 pointer-events-none">
              <div
                data-tap-hint-scroll
                className="pointer-events-auto rounded-xl border border-white/20 bg-slate-900/95 px-4 py-3 backdrop-blur-md shadow-2xl max-h-[300px] overflow-y-auto overscroll-contain touch-pan-y"
              >
                <p className="text-sm font-semibold text-white leading-relaxed break-words whitespace-pre-wrap">{job.title}</p>
              </div>
            </div>
          )}

        </motion.div>
      </div>
    </div>
  );
});

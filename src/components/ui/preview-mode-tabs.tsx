import { motion } from 'framer-motion';
import { memo, useRef, useState, useLayoutEffect, useCallback, useEffect } from 'react';
import { Smartphone, Monitor } from 'lucide-react';

type PreviewMode = 'mobile' | 'desktop';

interface PreviewModeTabsProps {
  activeMode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  /** Optional ref to a swipeable container area below the tabs */
  swipeContainerRef?: React.RefObject<HTMLElement>;
}

export const PreviewModeTabs = memo(function PreviewModeTabs({ activeMode, onModeChange, swipeContainerRef }: PreviewModeTabsProps) {
  const mobileRef = useRef<HTMLButtonElement>(null);
  const desktopRef = useRef<HTMLButtonElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ x: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const ref = activeMode === 'mobile' ? mobileRef.current : desktopRef.current;
    if (ref) {
      setIndicatorStyle({
        x: ref.offsetLeft,
        width: ref.offsetWidth,
      });
    }
  }, [activeMode]);

  useLayoutEffect(() => {
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  // Swipe gesture support
  useEffect(() => {
    const container = swipeContainerRef?.current;
    if (!container) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      // Only register horizontal swipes (more horizontal than vertical, min 50px)
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0 && activeMode === 'mobile') {
          onModeChange('desktop');
        } else if (dx > 0 && activeMode === 'desktop') {
          onModeChange('mobile');
        }
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [swipeContainerRef, activeMode, onModeChange]);

  return (
    <div className="dashboard-tabs-viewport mx-auto">
      <div className="dashboard-tabs-rail relative bg-white/5 border border-white/10 mx-auto">
        {/* Sliding background */}
        <motion.div
          className="absolute top-1 bottom-1 bg-white/20 rounded-[7px] will-change-transform"
          style={{ width: indicatorStyle.width, left: 0 }}
          initial={false}
          animate={{ x: indicatorStyle.x }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 34,
            mass: 0.6,
          }}
        />
        
        <button
          ref={mobileRef}
          type="button"
          onClick={() => onModeChange('mobile')}
          className="dashboard-tab-button relative z-10 rounded-[7px] font-medium text-white transition-colors whitespace-nowrap flex items-center gap-1.5"
        >
          <Smartphone className="h-3.5 w-3.5" />
          Mobilvy
        </button>
        <button
          ref={desktopRef}
          type="button"
          onClick={() => onModeChange('desktop')}
          className="dashboard-tab-button relative z-10 rounded-[7px] font-medium text-white transition-colors whitespace-nowrap flex items-center gap-1.5"
        >
          <Monitor className="h-3.5 w-3.5" />
          Datorvy
        </button>
      </div>
    </div>
  );
});

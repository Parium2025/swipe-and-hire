import { useEffect, useRef } from 'react';
import { useSidebar } from '@/components/ui/sidebar';

interface UseSwipeToOpenOptions {
  swipeThreshold?: number; // Minimum distance in pixels for swipe
  edgeThreshold?: number;  // Maximum distance from edge to start swipe
  enabled?: boolean;       // Enable/disable the hook
}

export const useSwipeToOpen = (options: UseSwipeToOpenOptions = {}) => {
  const {
    swipeThreshold = 80,
    edgeThreshold = 50,
    enabled = true
  } = options;
  
  const { setOpenMobile, isMobile, state } = useSidebar();
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const startX = touch.clientX;
      const startY = touch.clientY;
      
      // Only start tracking if touch starts near the left edge and sidebar is closed
      if (startX <= edgeThreshold && state !== 'expanded') {
        touchStart.current = {
          x: startX,
          y: startY,
          time: Date.now()
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStart.current) return;
      
      const touch = e.touches[0];
      const currentX = touch.clientX;
      const currentY = touch.clientY;
      
      const deltaX = currentX - touchStart.current.x;
      const deltaY = currentY - touchStart.current.y;
      
      // If vertical movement is greater than horizontal, cancel swipe
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        touchStart.current = null;
        return;
      }
      
      // Prevent default scrolling during horizontal swipe
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return;
      
      const touch = e.changedTouches[0];
      const endX = touch.clientX;
      const endY = touch.clientY;
      const endTime = Date.now();
      
      const deltaX = endX - touchStart.current.x;
      const deltaY = endY - touchStart.current.y;
      const deltaTime = endTime - touchStart.current.time;
      
      // Check if this is a valid right swipe
      const isRightSwipe = deltaX > swipeThreshold && 
                          Math.abs(deltaY) < swipeThreshold && 
                          deltaTime < 300; // Max 300ms for swipe
      
      if (isRightSwipe && state !== 'expanded') {
        setOpenMobile(true);
      }
      
      touchStart.current = null;
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchstart', handleTouchStart, { passive: false });
      container.addEventListener('touchmove', handleTouchMove, { passive: false });
      container.addEventListener('touchend', handleTouchEnd, { passive: false });
      
      return () => {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [enabled, isMobile, swipeThreshold, edgeThreshold, setOpenMobile, state]);

  return { containerRef };
};
import { useEffect, useRef, useState } from 'react';

/**
 * Triggers once when an element enters the viewport.
 * Used by the Viktor-Oddy-style landing sections to add `animate-landing-fade-in-up`.
 */
export const useInViewAnimation = <T extends HTMLElement = HTMLDivElement>(
  threshold = 0.1,
) => {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold, rootMargin: '0px 0px -10% 0px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, inView };
};

export default useInViewAnimation;

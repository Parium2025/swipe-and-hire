import { useEffect, useRef } from "react";

export type AutoFitOptions = {
  min?: number; // px
  max?: number; // px
  step?: number; // px
};

export default function useAutoFitText<T extends HTMLElement>(
  text: string,
  options: AutoFitOptions = {}
) {
  const { min = 6, max = 14, step = 0.2 } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !text) return;
    
    // Hitta containern (förälderns förälder som har fast bredd)
    const container = el.closest('.bg-white\\/10') as HTMLElement;
    if (!container) return;

    const fit = () => {
      // Återställ
      el.style.fontSize = `${max}px`;
      el.style.transform = 'none';
      el.style.whiteSpace = 'nowrap';
      
      // Mät tillgänglig bredd (minus padding/margin)
      const containerStyles = getComputedStyle(container);
      const containerWidth = container.offsetWidth 
        - parseFloat(containerStyles.paddingLeft) 
        - parseFloat(containerStyles.paddingRight);
      
      // Minska font-size tills texten får plats
      let currentSize = max;
      while (currentSize > min && el.scrollWidth > containerWidth * 0.95) {
        currentSize = Math.max(min, currentSize - step);
        el.style.fontSize = `${currentSize}px`;
      }
      
      // Om fortfarande för bred, använd horizontal scaling
      if (el.scrollWidth > containerWidth * 0.95) {
        const scale = (containerWidth * 0.95) / el.scrollWidth;
        el.style.transform = `scaleX(${Math.max(0.6, scale)})`;
        el.style.transformOrigin = 'left center';
      }
    };

    // Kör direkt och vid ändringar
    fit();
    
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(container);
    
    // Kör igen efter kort delay för att säkerställa rendering
    const timeout = setTimeout(fit, 10);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeout);
    };
  }, [text, min, max, step]);

  return ref;
}
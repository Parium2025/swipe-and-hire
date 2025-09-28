import { useEffect, useRef } from "react";

export default function useSmartTextFit<T extends HTMLElement>(
  text: string,
  options: { minScale?: number; maxLines?: number } = {}
) {
  const { minScale = 0.7, maxLines = 1 } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !text) return;

    const fit = () => {
      // Återställ all styling
      el.style.transform = 'none';
      el.style.transformOrigin = '';
      el.style.whiteSpace = '';
      
      // Låt texten flöda naturligt först
      requestAnimationFrame(() => {
        const container = el.closest('.bg-white\\/10') as HTMLElement;
        if (!container) return;
        
        // Mät containerbredd (tillgängligt utrymme)
        const containerStyles = getComputedStyle(container);
        const safety = 8; // extra buffert så sista bokstaven inte klipps
        const availableWidth = container.offsetWidth 
          - parseFloat(containerStyles.paddingLeft) 
          - parseFloat(containerStyles.paddingRight) - safety;
        
        // Testa faktisk enkelrad-bredd
        el.style.whiteSpace = 'nowrap';
        const singleLineWidth = el.scrollWidth;
        el.style.whiteSpace = '';
        
        // Om texten är bredare än tillgängligt utrymme, krymp den lite extra för säkerhet
        if (singleLineWidth > availableWidth) {
          const scale = Math.max(minScale, (availableWidth - 3) / singleLineWidth) * 0.97; // extra säkerhetsmarginal
          el.style.whiteSpace = 'nowrap';
          el.style.transform = `scaleX(${scale})`;
          el.style.transformOrigin = 'left center';
          el.style.paddingRight = '3px';
          el.style.willChange = 'transform';
        }
      });
    };

    // Kör efter kort delay för att säkerställa rendering
    const timeout = setTimeout(fit, 50);
    
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(fit, 10);
    });
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeout);
    };
  }, [text, minScale, maxLines]);

  return ref;
}
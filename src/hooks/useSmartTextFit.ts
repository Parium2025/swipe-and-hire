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
        const availableWidth = container.offsetWidth 
          - parseFloat(containerStyles.paddingLeft) 
          - parseFloat(containerStyles.paddingRight) - 8; // Margin för säkerhet
        
        // Testa om texten bryts genom att sätta nowrap och jämföra
        el.style.whiteSpace = 'nowrap';
        const singleLineWidth = el.scrollWidth;
        el.style.whiteSpace = '';
        
        // Om texten är bredare än tillgängligt utrymme, krympa den
        if (singleLineWidth > availableWidth) {
          const scale = Math.max(minScale, availableWidth / singleLineWidth);
          el.style.whiteSpace = 'nowrap';
          el.style.transform = `scaleX(${scale})`;
          el.style.transformOrigin = 'left center';
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
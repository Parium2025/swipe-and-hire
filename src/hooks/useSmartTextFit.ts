import { useEffect, useRef } from "react";

export default function useSmartTextFit<T extends HTMLElement>(
  text: string,
  options: { minScale?: number; maxLines?: number } = {}
) {
  const { minScale = 0.75, maxLines = 1 } = options;
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !text) return;

    const fit = () => {
      // Återställ styling
      el.style.transform = 'none';
      el.style.fontSize = '';
      
      // Mät höjden med break-words
      const originalHeight = el.scrollHeight;
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      const actualLineHeight = lineHeight || 16; // fallback om lineHeight är "normal"
      
      // Beräkna antal rader (med marginal för avrundning)
      const lines = Math.round(originalHeight / actualLineHeight);
      
      // Om texten bryts över flera rader, krympa den
      if (lines > maxLines) {
        // Testa olika skalningar tills det får plats på en rad
        let scale = 1;
        let attempts = 0;
        const maxAttempts = 20;
        
        while (scale >= minScale && attempts < maxAttempts) {
          el.style.transform = `scaleX(${scale})`;
          el.style.transformOrigin = 'left center';
          
          // Mät igen
          const newHeight = el.scrollHeight;
          const newLines = Math.round(newHeight / actualLineHeight);
          
          if (newLines <= maxLines) {
            break;
          }
          
          scale -= 0.05;
          attempts++;
        }
      }
    };

    // Kör direkt och vid ändringar
    const timeout = setTimeout(fit, 10);
    
    const resizeObserver = new ResizeObserver(fit);
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeout);
    };
  }, [text, minScale, maxLines]);

  return ref;
}
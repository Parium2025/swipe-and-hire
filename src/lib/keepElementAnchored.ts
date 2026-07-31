/**
 * Håller ett elements position i viewporten konstant medan innehåll under/över
 * det animerar in eller ut (t.ex. en accordion som fäller ut).
 *
 * Utan detta "hoppar" sidan när ett kort ovanför expanderar, eftersom allt
 * nedanför trycks ner. Vi mäter elementets top varje frame och kompenserar
 * med scrollBy tills animationen är klar.
 */
export function keepElementAnchored(el: HTMLElement | null, durationMs = 700): () => void {
  if (!el || typeof window === 'undefined') return () => {};

  const startTop = el.getBoundingClientRect().top;
  const t0 = performance.now();
  let raf = 0;

  const step = () => {
    const delta = el.getBoundingClientRect().top - startTop;
    if (Math.abs(delta) > 0.5) window.scrollBy(0, delta);
    if (performance.now() - t0 < durationMs) {
      raf = requestAnimationFrame(step);
    }
  };

  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

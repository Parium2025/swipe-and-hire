// En enda observer för hela inkorgen: en observer per rad skulle bli dyrt när
// hundratals konversationer är hämtade även om bara några syns på skärmen.
const listeners = new Map<Element, (visible: boolean) => void>();
let observer: IntersectionObserver | null = null;

export function observeChatRow(element: Element, onVisibility: (visible: boolean) => void): () => void {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) listeners.get(entry.target)?.(entry.isIntersecting);
    });
  }
  listeners.set(element, onVisibility);
  observer.observe(element);
  return () => {
    observer?.unobserve(element);
    listeners.delete(element);
    if (listeners.size === 0) {
      observer?.disconnect();
      observer = null;
    }
  };
}
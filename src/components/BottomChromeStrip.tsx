import { useBrowserChromeStrip } from '@/hooks/useBrowserChromeStrip';

/**
 * Tunn färgremsa längst ner — endast på mobil/touch.
 * Säkerställer att området bakom iOS Safaris bottenverktygsfält alltid har
 * rätt färg vid SPA-navigering (Safari samplar annars body en gång per
 * sidladdning och uppdaterar inte vid route-byte).
 *
 * Synlig endast på touch-enheter (telefon/surfplatta). Desktop slipper.
 */
const BottomChromeStrip = () => {
  const { color, isTouch } = useBrowserChromeStrip();

  if (!isTouch) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
        backgroundColor: color,
        zIndex: 2147483647,
        pointerEvents: 'none',
      }}
    />
  );
};

export default BottomChromeStrip;

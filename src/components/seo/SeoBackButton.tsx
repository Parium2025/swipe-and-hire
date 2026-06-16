import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SeoBackButtonProps {
  /** Fallback route if there is no history to go back to. */
  fallback?: string;
  label?: string;
}

/**
 * Floating back button for SEO pages — sits clearly below the fixed
 * navbar and aligns horizontally with the page's content max-width
 * (max-w-6xl = 72rem). On viewports wider than the content container,
 * `left` follows the content's left padding rather than the viewport
 * edge, so the pill never crowds the navbar logo or floats in dead
 * space at the screen edge.
 *
 * Goes back in history when possible, otherwise navigates to fallback.
 */
const SeoBackButton = ({ fallback = '/jobb', label = 'Tillbaka' }: SeoBackButtonProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button
      type="button"
      onPointerDown={handleBack}
      aria-label={label}
      // top-20/24 = clears the 64px fixed nav with breathing room.
      // left uses max() so it hugs viewport padding on small screens and
      // jumps inwards to align with content (max-w-6xl) on large screens.
      className="fixed z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/[0.14] hover:border-white/25 top-20 sm:top-24 left-[max(1rem,calc((100vw-72rem)/2+1rem))] sm:left-[max(1.5rem,calc((100vw-72rem)/2+1.5rem))] lg:left-[max(2rem,calc((100vw-72rem)/2+2rem))]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

export default SeoBackButton;

import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SeoBackButtonProps {
  /** Fallback route if there is no history to go back to. */
  fallback?: string;
  label?: string;
}

/**
 * Inline back link for SEO pages — sits inside the content flow,
 * just under the fixed navbar and above the hero. Left-aligned within
 * the same max-w-6xl container as the page content. Discreet, Apple-/
 * Spotify-like text link (no floating pill, no overlap with navbar).
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
    <div className="relative z-20 mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-28 md:px-12">
      <button
        type="button"
        onPointerDown={handleBack}
        aria-label={label}
        className="group inline-flex min-h-11 items-center gap-1.5 -ml-1 px-1 text-sm font-medium text-white/80 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
        <span>{label}</span>
      </button>
    </div>
  );
};

export default SeoBackButton;

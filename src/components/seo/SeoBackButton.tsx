import { X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFooterRestoreOrigin, requestFooterRestore } from '@/lib/scrollRestoration';

interface SeoBackButtonProps {
  /** Fallback route if there is no history to go back to. */
  fallback?: string;
  label?: string;
}

/**
 * Discreet "close" button for SEO pages — sits as a fixed circular
 * X-icon in the top-right corner, comfortably below the navbar so it
 * never overlaps the Parium logo or the "Logga in" pill.
 *
 * Goes back in history when possible, otherwise navigates to fallback.
 * If we know the user arrived from the landing footer, we restore
 * the exact scroll position via requestFooterRestore.
 */
const SeoBackButton = ({ fallback = '/jobb', label = 'Stäng' }: SeoBackButtonProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    const state = location.state as { footerOriginPath?: unknown } | null;
    const footerOrigin = typeof state?.footerOriginPath === 'string'
      ? state.footerOriginPath
      : getFooterRestoreOrigin(window.location.pathname);
    if (footerOrigin) {
      requestFooterRestore(footerOrigin);
      navigate(footerOrigin);
      return;
    }

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
      className="fixed right-3 top-[max(env(safe-area-inset-top),0.75rem)] z-40 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/8 text-white backdrop-blur-md ring-1 ring-white/15 transition-all duration-200 hover:bg-white/14 hover:ring-white/25 active:scale-95 sm:right-5 sm:top-[max(env(safe-area-inset-top),1rem)] md:right-6 md:top-[max(env(safe-area-inset-top),1.25rem)] lg:right-10"
    >
      <X className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
};

export default SeoBackButton;

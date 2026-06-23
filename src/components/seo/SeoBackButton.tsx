import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFooterRestoreOrigin, requestFooterRestore } from '@/lib/scrollRestoration';

interface SeoBackButtonProps {
  /** Fallback route if there is no history to go back to. */
  fallback?: string;
  label?: string;
  /** Optional breadcrumb shown on the same row, left-aligned. */
  breadcrumb?: ReactNode;
}

/**
 * Inline back link for SEO pages — placed on the same horizontal row as
 * an optional breadcrumb. Breadcrumb left, "Tillbaka" right, hairline
 * underneath. Pure white, Apple/Spotify-like.
 *
 * Goes back in history when possible, otherwise navigates to fallback.
 */
const SeoBackButton = ({ fallback = '/jobb', label = 'Tillbaka', breadcrumb }: SeoBackButtonProps) => {
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
    <div className="relative z-30 w-full px-5 pt-24 sm:px-8 sm:pt-28 md:px-12">
      <div className="flex min-h-11 items-center justify-between gap-4">
        <div className="min-w-0 flex-1 text-[15px] font-medium text-white sm:text-base">
          {breadcrumb}
        </div>
        <button
          type="button"
          onPointerDown={handleBack}
          aria-label={label}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-[15px] font-medium text-white transition-opacity hover:opacity-80 sm:text-base"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{label}</span>
        </button>
      </div>
      <div className="mt-3 h-px w-full bg-white/25" aria-hidden="true" />
    </div>
  );
};

export default SeoBackButton;


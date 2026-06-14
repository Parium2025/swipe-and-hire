import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SeoBackButtonProps {
  /** Fallback route if there is no history to go back to. */
  fallback?: string;
  label?: string;
}

/**
 * Premium back button for SEO pages. Goes back in history when possible,
 * otherwise navigates to the provided fallback. Sits in the same glassmorphism
 * language as the rest of the app, full 44 px touch target.
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
    <div className="relative z-30 mx-auto max-w-5xl px-5 pt-24 sm:px-8 sm:pt-28 md:px-12">
      <button
        type="button"
        onPointerDown={handleBack}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/[0.12] hover:border-white/25"
        aria-label={label}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    </div>
  );
};

export default SeoBackButton;

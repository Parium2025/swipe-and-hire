import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface SeoBackButtonProps {
  /** Fallback route if there is no history to go back to. */
  fallback?: string;
  label?: string;
}

/**
 * Floating back button for SEO pages – sits just below the fixed nav,
 * top-left, in the same glass language as the rest of the app.
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
      className="fixed left-4 top-[4.5rem] z-40 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-4 py-2 text-sm font-medium text-white backdrop-blur-md transition hover:bg-white/[0.14] hover:border-white/25 sm:left-6 sm:top-[5rem]"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};

export default SeoBackButton;

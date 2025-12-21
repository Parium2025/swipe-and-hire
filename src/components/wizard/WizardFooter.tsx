import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Loader2, CheckCircle } from 'lucide-react';
import { MouseEvent, TouchEvent } from 'react';

export interface WizardFooterProps {
  /** Current step index (0-based) */
  currentStep: number;
  /** Whether this is the last step */
  isLastStep: boolean;
  /** Called when "Tillbaka" is clicked */
  onBack: () => void;
  /** Called when "Nästa" or submit button is clicked */
  onNext: () => void;
  /** Called when the submit button is clicked (last step) */
  onSubmit: () => void;
  /** Whether submit/next is disabled */
  disabled?: boolean;
  /** Whether a save/submit operation is in progress */
  loading?: boolean;
  /** Label for the submit button (default: "Spara ändringar") */
  submitLabel?: string;
  /** Label shown while loading (default: "Sparar...") */
  loadingLabel?: string;
  /** Whether to show submit icon (CheckCircle) */
  showSubmitIcon?: boolean;
  /** Custom justify class when back button is hidden */
  hideBackOnFirstStep?: boolean;
  /** Additional class name for the container */
  className?: string;
}

/**
 * Shared wizard footer navigation component.
 * Handles blur-on-click to prevent focus ring flashing.
 */
export const WizardFooter = ({
  currentStep,
  isLastStep,
  onBack,
  onNext,
  onSubmit,
  disabled = false,
  loading = false,
  submitLabel = 'Spara ändringar',
  loadingLabel = 'Sparar...',
  showSubmitIcon = false,
  hideBackOnFirstStep = false,
  className = '',
}: WizardFooterProps) => {
  const showBackButton = hideBackOnFirstStep ? currentStep > 0 : true;
  const backDisabled = currentStep === 0;
  
  // Blur active element when clicking empty space between buttons
  const handleContainerMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  const handleContainerTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Wrapper to blur + call handler
  const handleBackClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    onBack();
  };

  const handleNextClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    onNext();
  };

  const handleSubmitClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.blur();
    onSubmit();
  };

  // Button classes shared across all wizards
  const backButtonClasses = 
    'bg-white/5 backdrop-blur-sm border-white/20 text-white px-4 py-2 transition-colors duration-150 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white disabled:opacity-30 touch-border-white [&_svg]:text-white hover:[&_svg]:text-white md:hover:[&_svg]:text-white focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0';

  const nextButtonClasses = 
    'bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-8 py-2 touch-border-white transition-colors duration-150 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0';

  const submitButtonClasses = 
    'bg-green-600/80 hover:bg-green-600 md:hover:bg-green-600 text-white px-8 py-2 transition-colors duration-150 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0';

  // Justify: if back button hidden on first step, center the next/submit button
  const justifyClass = (hideBackOnFirstStep && currentStep === 0) 
    ? 'justify-center' 
    : 'justify-between';

  return (
    <div
      className={`flex items-center p-4 border-t border-white/20 flex-shrink-0 ${justifyClass} ${className}`}
      onMouseDown={handleContainerMouseDown}
      onTouchStart={handleContainerTouchStart}
    >
      {/* Back button */}
      {showBackButton && (
        <Button
          variant="outline"
          onClick={handleBackClick}
          disabled={backDisabled}
          className={backButtonClasses}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Tillbaka
        </Button>
      )}

      {/* Submit button (shown on last step) */}
      {isLastStep ? (
        <Button
          onClick={handleSubmitClick}
          disabled={loading || disabled}
          className={submitButtonClasses}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {loadingLabel}
            </>
          ) : (
            <>
              {showSubmitIcon && <CheckCircle className="h-4 w-4 mr-2" />}
              {submitLabel}
            </>
          )}
        </Button>
      ) : (
        <Button
          onClick={handleNextClick}
          disabled={disabled}
          className={nextButtonClasses}
        >
          Nästa
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  );
};

export default WizardFooter;

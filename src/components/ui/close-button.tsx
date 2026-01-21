import { X } from 'lucide-react';
import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CloseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Size variant: 'sm' (16px icon), 'md' (20px icon, default), 'lg' (24px icon) */
  size?: 'sm' | 'md' | 'lg';
  /** Optional custom className for additional styling */
  className?: string;
}

/**
 * Standardized close button (X) component for consistent UX across the app.
 * 
 * Features:
 * - White X icon with round hover background
 * - Smooth transition effects
 * - No focus ring (blur-on-click pattern)
 * - Three size variants
 * 
 * Usage:
 * ```tsx
 * <CloseButton onClick={handleClose} />
 * <CloseButton size="sm" onClick={handleClose} />
 * <CloseButton size="lg" className="absolute top-4 right-4" onClick={handleClose} />
 * ```
 */
const CloseButton = forwardRef<HTMLButtonElement, CloseButtonProps>(
  ({ size = 'md', className, ...props }, ref) => {
    const sizeClasses = {
      sm: 'p-1',
      md: 'p-1.5',
      lg: 'p-2',
    };

    const iconSizes = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-label="Stäng"
        className={cn(
          // Base styles
          'rounded-full transition-colors duration-150',
          // Hover effect - subtle white background
          'hover:bg-white/10',
          // Focus styles - no ring, just subtle background
          'focus:outline-none focus:ring-0 focus:bg-white/10',
          // Active state
          'active:bg-white/20 active:scale-95',
          // Size
          sizeClasses[size],
          // Custom classes
          className
        )}
        onMouseDown={(e) => {
          e.currentTarget.blur();
          props.onMouseDown?.(e);
        }}
        onMouseUp={(e) => {
          e.currentTarget.blur();
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
          props.onMouseUp?.(e);
        }}
        {...props}
      >
        <X className={cn('text-white', iconSizes[size])} />
      </button>
    );
  }
);

CloseButton.displayName = 'CloseButton';

export { CloseButton };

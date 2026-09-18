import * as React from 'react';
import { cn } from '@/lib/utils';

type PillButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  /** "text" = rounded pill with padding, "icon" = square 36px circle */
  shape?: 'text' | 'icon';
  /** Set when the button opens a menu/popover (keeps Radix data-state styling) */
  menu?: boolean;
};

/**
 * Shared pill button used across candidate views.
 * Kills the iOS/desktop "blink" (focus ring + tap highlight) without breaking
 * Radix triggers: we blur on focus instead of preventing pointer-down.
 */
export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ className, shape = 'text', menu = false, onFocus, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      {...props}
      onFocus={(event) => {
        // Only drop focus for pointer users; keyboard users keep navigation.
        if (!event.currentTarget.matches(':focus-visible')) {
          event.currentTarget.blur();
        }
        onFocus?.(event);
      }}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 text-white',
        'transition-all duration-200 hover:bg-white/10 hover:border-white/50',
        'outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0',
        'touch-manipulation [-webkit-tap-highlight-color:transparent]',
        shape === 'text'
          ? 'px-4 h-9 text-xs font-medium whitespace-nowrap flex-shrink-0'
          : 'h-9 w-9',
        menu && 'data-[state=open]:bg-white/20 data-[state=open]:border-white/30',
        className,
      )}
    />
  ),
);

PillButton.displayName = 'PillButton';

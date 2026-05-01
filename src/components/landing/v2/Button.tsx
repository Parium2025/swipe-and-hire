import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'tertiary';

const SHADOW_PRIMARY =
  '0 1px 2px 0 rgba(255,255,255,0.10), 0 4px 4px 0 rgba(255,255,255,0.09), 0 9px 6px 0 rgba(255,255,255,0.05), 0 17px 7px 0 rgba(255,255,255,0.01), 0 26px 7px 0 rgba(255,255,255,0), inset 0 2px 8px 0 rgba(255,255,255,0.5)';
const SHADOW_SECONDARY =
  '0 0 0 0.5px rgba(255,255,255,0.18), 0 4px 30px rgba(0,0,0,0.20)';
const SHADOW_TERTIARY =
  '0 0 0 0.5px rgba(255,255,255,0.22), 0 4px 30px rgba(0,0,0,0.18), inset 0 2px 8px 0 rgba(255,255,255,0.5)';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
};

export const LandingV2Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', className, children, style, ...rest }, ref) => {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-medium transition-transform duration-200 hover:-translate-y-[1px] active:translate-y-0 whitespace-nowrap';

    const variants: Record<Variant, string> = {
      primary: 'bg-[#F6FCFF] text-[#051A24]',
      secondary: 'bg-white/10 text-white border border-white/20 backdrop-blur-md',
      tertiary: 'bg-white/95 text-[#051A24]',
    };

    const shadow =
      variant === 'primary'
        ? SHADOW_PRIMARY
        : variant === 'secondary'
        ? SHADOW_SECONDARY
        : SHADOW_TERTIARY;

    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], className)}
        style={{ boxShadow: shadow, ...style }}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
LandingV2Button.displayName = 'LandingV2Button';

export default LandingV2Button;

import { forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SeoCTAButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Knapptext. Default: "Skapa min profil idag" */
  label?: string;
  /** Vart användaren ska. Default: /auth */
  to?: string;
  /** Visa pil. Default: true */
  showArrow?: boolean;
  /** Storlek. Default: lg */
  size?: 'md' | 'lg';
  /** Variant. primary = ljusblå pill (Pariums standard), ghost = outline */
  variant?: 'primary' | 'ghost';
}

/**
 * Pariums STANDARD CTA-knapp för alla SEO-landningssidor.
 * Exakt samma stil som hero-knappen på /jobbsokare ("Skapa min profil idag").
 * Använd för alla primära konverteringspunkter på publika sidor.
 */
const SeoCTAButton = forwardRef<HTMLButtonElement, SeoCTAButtonProps>(
  (
    {
      label = 'Skapa min profil idag',
      to = '/auth',
      showArrow = true,
      size = 'lg',
      variant = 'primary',
      className,
      onClick,
      ...rest
    },
    ref
  ) => {
    const navigate = useNavigate();
    const sizing =
      size === 'lg'
        ? 'min-h-[52px] px-8 text-base sm:text-lg'
        : 'min-h-[44px] px-6 text-sm sm:text-base';

    const variantClasses =
      variant === 'primary'
        ? 'bg-secondary text-white hover:bg-secondary/90 focus-visible:ring-secondary'
        : 'border border-white/25 bg-white/5 text-white hover:bg-white/10 focus-visible:ring-white/40';

    return (
      <button
        ref={ref}
        type="button"
        onPointerDown={(e) => {
          // Snabbare svar än onClick (mobile premium-ergonomi)
          if (rest.disabled) return;
          e.preventDefault();
          if (onClick) onClick(e as unknown as React.MouseEvent<HTMLButtonElement>);
          else navigate(to);
        }}
        onClick={(e) => e.preventDefault()}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight',
          'transition-all duration-200 active:scale-[0.98] hover:scale-[1.02]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(215_100%_12%)]',
          'disabled:opacity-50 disabled:pointer-events-none',
          sizing,
          variantClasses,
          className
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        {...rest}
      >
        {label}
        {showArrow && <ArrowRight className="h-4 w-4" />}
      </button>
    );
  }
);
SeoCTAButton.displayName = 'SeoCTAButton';

export default SeoCTAButton;

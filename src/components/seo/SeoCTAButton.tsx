import { forwardRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

interface SeoCTAButtonProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'> {
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
  /** React Router state att skicka med (t.ex. { mode: 'signup' }) */
  navState?: Record<string, unknown>;
  /** Inaktiverad. Behålls för bakåtkompatibilitet. */
  disabled?: boolean;
}

/**
 * Pariums STANDARD CTA-knapp för alla SEO-landningssidor.
 * Exakt samma stil som hero-knappen på /jobbsokare ("Skapa min profil idag").
 * Renderas som en riktig länk (<a>) så att sökmotorer kan följa den och
 * användaren kan öppna i ny flik — utseendet är identiskt med tidigare knapp.
 */
const SeoCTAButton = forwardRef<HTMLAnchorElement, SeoCTAButtonProps>(
  (
    {
      label = 'Skapa min profil idag',
      to = '/auth',
      showArrow = true,
      size = 'lg',
      variant = 'primary',
      navState,
      className,
      onClick,
      disabled,
      ...rest
    },
    ref
  ) => {
    const navigate = useNavigate();
    // Redan inloggad? Då är "Skapa konto" fel budskap — skicka in i appen istället
    // för att bounca användaren via inloggningssidan.
    const { user } = useAuth();
    const isAuthed = !!user;
    const resolvedLabel = isAuthed ? 'Öppna Parium' : label;
    const target = isAuthed ? '/dashboard' : to;
    const sizing =
      size === 'lg'
        ? 'min-h-[52px] px-8 text-base sm:text-lg'
        : 'min-h-[44px] px-6 text-sm sm:text-base';

    const variantClasses =
      variant === 'primary'
        ? 'bg-secondary text-white focus-visible:ring-secondary'
        : 'border border-white/25 bg-white/5 text-white focus-visible:ring-white/40';

    // Öppna i ny flik/fönster ska fungera som på vilken länk som helst.
    const isModified = (e: React.MouseEvent | React.PointerEvent) =>
      e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || ('button' in e && e.button !== 0);

    return (
      <Link
        ref={ref}
        to={target}
        state={!isAuthed && navState ? navState : undefined}
        aria-disabled={disabled || undefined}
        onPointerDown={(e) => {
          // Snabbare svar än onClick (mobile premium-ergonomi)
          if (disabled || isModified(e)) return;
          e.preventDefault();
          if (isAuthed) navigate('/dashboard');
          else if (onClick) onClick(e as unknown as React.MouseEvent<HTMLAnchorElement>);
          else navigate(to, navState ? { state: navState } : undefined);
        }}
        onClick={(e) => {
          if (isModified(e)) return;
          e.preventDefault();
        }}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight',
          'transition-all duration-200 active:scale-[0.98] hover:scale-[1.02]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(215_100%_12%)]',
          disabled && 'opacity-50 pointer-events-none',
          sizing,
          variantClasses,
          className
        )}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        {...rest}
      >
        {resolvedLabel}
        {showArrow && <ArrowRight className="h-4 w-4" />}
      </Link>
    );
  }
);
SeoCTAButton.displayName = 'SeoCTAButton';

export default SeoCTAButton;


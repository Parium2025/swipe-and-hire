import pariumLogoRings from "@/assets/parium-logo-rings.png";

type PariumLogoButtonProps = {
  onClick: () => void;
  ariaLabel: string;
};

/**
 * Home button (logo) with inline margin compensation to avoid any late-applied
 * CSS causing the logo to shift/pop when navigating between routes.
 */
export function PariumLogoButton({ onClick, ariaLabel }: PariumLogoButtonProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center hover:opacity-80 transition-opacity shrink-0"
      aria-label={ariaLabel}
      style={{ marginLeft: -4, marginRight: -80 }}
    >
      <div
        role="img"
        aria-label="Parium"
        className="h-8 w-32 bg-contain bg-left bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${pariumLogoRings})` }}
      />
    </button>
  );
}

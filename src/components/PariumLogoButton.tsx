import pariumLogoRings from "@/assets/parium-logo-rings.png";

type PariumLogoButtonProps = {
  onClick: () => void;
  ariaLabel: string;
};

/**
 * Home button (logo) using a real <img> with sync decoding to guarantee
 * the logo is painted immediately without any pop-in on route changes.
 */
export function PariumLogoButton({ onClick, ariaLabel }: PariumLogoButtonProps) {
  return (
    <button
      onClick={onClick}
      // NOTE: We intentionally overlap the following nav items via negative marginRight.
      // Ensure the logo is always on top so it can't be visually covered ("pop in"/disappear)
      // when counts/labels change width during navigation.
      className="relative z-20 flex items-center hover:opacity-80 transition-opacity shrink-0"
      aria-label={ariaLabel}
      // -ml-1 (4px) + old -mr-[104px] to visually align and keep menus tight
      style={{ marginLeft: -4, marginRight: -104 }}
    >
      <img
        src={pariumLogoRings}
        alt="Parium"
        width={160}
        height={40}
        loading="eager"
        decoding="sync"
        fetchPriority="high"
        className="h-10 w-40 object-contain object-left pointer-events-none"
      />
    </button>
  );
}

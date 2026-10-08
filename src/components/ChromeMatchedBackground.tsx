/** Edge-only paint: no layout changes or coverage of the video centre. */
export function ChromeEdgeBlend({ video = false }: { video?: boolean }) {
  return <div aria-hidden="true" data-chrome-edge-blend={video ? 'video' : 'audience'} className={`chrome-edge-blend pointer-events-none inset-0 ${video ? 'absolute z-[1]' : 'fixed z-0'}`} />;
}

/** Paint only: preserves shell sizing and excludes the video route. */
export default function ChromeMatchedBackground({ variant = 'app' }: { variant?: 'app' | 'auth' | 'standard'}) {
  return <div aria-hidden="true" data-chrome-matched-background={variant} className={`chrome-matched-background chrome-matched-background--${variant} fixed inset-0 pointer-events-none z-0`} />;
}

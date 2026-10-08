/** Paint only: preserves shell sizing and excludes the video route. */
export default function ChromeMatchedBackground({ variant = 'app' }: { variant?: 'app' | 'auth' | 'standard'}) {
  return <div aria-hidden="true" data-chrome-matched-background={variant} className={`chrome-matched-background chrome-matched-background--${variant} fixed inset-0 pointer-events-none z-0`} />;
}

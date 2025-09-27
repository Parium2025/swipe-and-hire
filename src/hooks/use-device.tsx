// Lightweight device detector without React hooks to avoid duplicate-React hook issues
// Returns a snapshot of the current device type; components can call it on render.
const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

export function useDevice(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop'
  const width = window.innerWidth
  if (width < MOBILE_BREAKPOINT) return 'mobile'
  if (width < TABLET_BREAKPOINT) return 'tablet'
  return 'desktop'
}

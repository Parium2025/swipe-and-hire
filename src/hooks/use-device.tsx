import * as React from "react"

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

export function useDevice() {
  const [device, setDevice] = React.useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  React.useEffect(() => {
    const updateDevice = () => {
      const width = window.innerWidth
      if (width < MOBILE_BREAKPOINT) {
        setDevice('mobile')
      } else if (width < TABLET_BREAKPOINT) {
        setDevice('tablet')
      } else {
        setDevice('desktop')
      }
    }

    const mql = window.matchMedia(`(max-width: ${TABLET_BREAKPOINT - 1}px)`)
    mql.addEventListener("change", updateDevice)
    updateDevice()

    return () => mql.removeEventListener("change", updateDevice)
  }, [])

  return device
}
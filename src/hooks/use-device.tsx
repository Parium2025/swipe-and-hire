import { useState, useEffect } from "react"

const MOBILE_BREAKPOINT = 768
const TABLET_BREAKPOINT = 1024

export function useDevice() {
  // Detect initial device type immediately to prevent flash
  const getInitialDevice = () => {
    if (typeof window === 'undefined') return 'desktop'
    const width = window.innerWidth
    if (width < MOBILE_BREAKPOINT) return 'mobile'
    if (width < TABLET_BREAKPOINT) return 'tablet'
    return 'desktop'
  }

  const [device, setDevice] = useState<'mobile' | 'tablet' | 'desktop'>(getInitialDevice)

  useEffect(() => {
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
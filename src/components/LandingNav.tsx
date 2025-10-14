import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

interface LandingNavProps {
  onLoginClick: () => void;
}

const LandingNav = ({ onLoginClick }: LandingNavProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  

  useEffect(() => {
    const scroller = document.scrollingElement || document.documentElement || document.body;
    let last = scroller.scrollTop;
    let ticking = false;

    const update = (y: number) => {
      const delta = y - last;
      if (y <= 10) setIsVisible(true);
      else if (delta > 2) setIsVisible(false);
      else if (delta < -2) setIsVisible(true);
      last = y;
      ticking = false;
    };

    const onScroll = () => {
      const y = scroller.scrollTop;
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => update(y));
      }
    };

    // Wheel (desktop) for more responsive direction
    const onWheel = (e: WheelEvent) => {
      const y = scroller.scrollTop;
      if (e.deltaY > 3 && y > 20) setIsVisible(false);
      else if (e.deltaY < -3) setIsVisible(true);
    };

    // Touch feedback (iOS/Android)
    let lastTouchY = 0;
    const onTouchStart = (e: TouchEvent) => { lastTouchY = e.touches[0].clientY; };
    const onTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const delta = currentY - lastTouchY;
      if (Math.abs(delta) > 3) setIsVisible(delta > 0);
      lastTouchY = currentY;
    };

    // Keyboard navigation
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') setIsVisible(false);
      if (e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home') setIsVisible(true);
    };

    // Restore correct state when tab becomes visible again
    const onVisibility = () => {
      if (document.visibilityState === 'visible') update(scroller.scrollTop);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);


  const navItems = [
    { label: 'Produkt', href: '#produkt' },
    { label: 'Om oss', href: '#om-oss' },
    { label: 'Kontakt', href: '#kontakt' }
  ];

  return (
    <>
      <nav 
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/10"
        style={{
          transform: isVisible ? 'translate3d(0,0,0)' : 'translate3d(0,-120%,0)',
          opacity: isVisible ? 1 : 0,
          pointerEvents: isVisible ? 'auto' : 'none',
          transition: 'transform 250ms ease, opacity 200ms ease',
          willChange: 'transform, opacity'
        }}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <div className="flex items-center">
              <img
                src={pariumLogo}
                alt="Parium"
                className="h-auto w-32 md:w-48 lg:w-56"
              />
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-white/80 hover:text-white transition-colors text-sm font-medium"
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:block">
              <Button
                onClick={onLoginClick}
                variant="ghost"
                className="text-white hover:bg-white/10 border border-white/20"
              >
                Logga in
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-white"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-primary/95 backdrop-blur-lg pt-24 px-6">
            <div className="flex flex-col gap-6">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-white text-xl font-medium py-3 border-b border-white/10"
                >
                  {item.label}
                </a>
              ))}
              
              <div className="pt-6">
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="w-full bg-white text-primary hover:bg-white/90"
                  size="lg"
                >
                  Logga in
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LandingNav;

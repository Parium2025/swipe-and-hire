import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

interface LandingNavProps {
  onLoginClick: () => void;
}

const LandingNav = ({ onLoginClick }: LandingNavProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { label: 'Funktioner', href: '#funktioner' },
    { label: 'Hur det funkar', href: '#hur-det-funkar' },
    { label: 'Kontakt', href: '#kontakt' },
  ];

  return (
    <>
      <nav
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-500 ${
          scrolled ? 'border-b border-white/[0.06] bg-primary/78 backdrop-blur-xl' : 'bg-transparent'
        }`}
        role="navigation"
        aria-label="Huvudnavigation"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 md:px-12 lg:px-24">
          <div className="flex h-16 items-center justify-between sm:h-20">
            <img
              src={pariumLogo}
              alt="Parium – Rekryteringsplattform"
              width={224}
              height={224}
              className="h-auto w-28 md:w-36 lg:w-40"
            />

            <div className="hidden items-center gap-8 md:flex">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-sm font-medium text-white/72 transition-colors hover:text-white"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="hidden md:block">
              <Button variant="glass" onClick={onLoginClick} className="px-6 py-2.5 text-sm font-medium text-white">
                Logga in
              </Button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2.5 text-white/82 transition-colors hover:bg-white/10 md:hidden"
              aria-label="Öppna meny"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-primary/96 px-6 pt-24 backdrop-blur-xl">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-[54px] items-center border-b border-white/[0.06] py-4 text-lg font-medium text-white/82 transition-colors hover:text-white"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-8">
                <Button
                  variant="glass"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    sessionStorage.setItem('parium-skip-splash', '1');
                    onLoginClick();
                  }}
                  className="min-h-[54px] w-full rounded-full border-white/[0.18] bg-white/[0.12] text-base font-semibold text-white"
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

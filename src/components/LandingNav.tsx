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
    { label: 'Bevis', href: '#bevis' },
    { label: 'Funktioner', href: '#funktioner' },
    { label: 'Process', href: '#hur-det-funkar' },
    { label: 'Kontakt', href: '#kontakt' },
  ];

  return (
    <>
      <nav
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-[hsl(var(--landing-border)/0.16)] bg-[hsl(var(--primary)/0.92)] shadow-[0_18px_50px_-30px_hsl(var(--landing-shadow)/0.9)]'
            : 'bg-transparent'
        }`}
        role="navigation"
        aria-label="Huvudnavigation"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 md:px-12 lg:px-24">
          <div className="flex h-[4.5rem] items-center justify-between sm:h-[5.25rem]">
            <a href="#top" className="flex items-center" aria-label="Gå till toppen av sidan">
              <img
                src={pariumLogo}
                alt="Parium – Rekryteringsplattform"
                width={224}
                height={224}
                className="h-auto w-28 sm:w-32 lg:w-36"
              />
            </a>

            <div className="hidden items-center gap-8 lg:flex">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-sm font-medium tracking-[0.01em] text-pure-white transition-opacity duration-200 hover:opacity-100"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="hidden lg:block">
              <Button variant="glass" onClick={onLoginClick} className="landing-secondary-button px-6 text-sm font-semibold">
                Logga in
              </Button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-[hsl(var(--landing-border)/0.18)] bg-[hsl(var(--landing-panel)/0.72)] p-2.5 text-pure-white transition-transform duration-200 active:scale-[0.97] lg:hidden"
              aria-label="Öppna meny"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-[hsl(var(--primary)/0.98)] px-6 pt-24">
            <div className="landing-panel mx-auto flex max-w-md flex-col gap-1 rounded-[2rem] p-4">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-[54px] items-center rounded-[1.25rem] px-4 py-4 text-lg font-semibold text-pure-white transition-transform duration-200 active:scale-[0.99]"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-6">
                <Button
                  variant="glass"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    sessionStorage.setItem('parium-skip-splash', '1');
                    onLoginClick();
                  }}
                  className="landing-primary-button min-h-[54px] w-full text-base font-semibold"
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

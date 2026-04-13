import { useState, useEffect } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

interface LandingNavProps {
  onLoginClick: () => void;
}

const navItems = [
  { label: 'Plattform', href: '#plattform' },
  { label: 'Varför Parium', href: '#bevis' },
  { label: 'Flöden', href: '#floden' },
  { label: 'Frågor', href: '#faq' },
  { label: 'Starta', href: '#kontakt' },
];

const LandingNav = ({ onLoginClick }: LandingNavProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav
        className="fixed left-0 right-0 top-0 z-50 px-4 pt-4 sm:px-6 md:px-8 lg:px-10"
        role="navigation"
        aria-label="Huvudnavigation"
      >
        <div className={`landing-nav-frame mx-auto max-w-7xl transition-all duration-300 ${scrolled ? 'translate-y-0 opacity-100' : 'opacity-95'}`}>
          <div className="flex h-[4.5rem] items-center justify-between px-4 sm:h-[5rem] sm:px-5 lg:px-6">
            <a href="#top" className="flex items-center" aria-label="Gå till toppen av sidan">
              <img
                src={pariumLogo}
                alt="Parium – Rekryteringsplattform"
                width={224}
                height={224}
                className="h-auto w-28 sm:w-32"
              />
            </a>

            <div className="hidden items-center gap-7 lg:flex">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="landing-nav-link"
                >
                  {item.label}
                </a>
              ))}
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <Button variant="glass" onClick={onLoginClick} className="landing-secondary-button px-5 text-sm font-semibold">
                Logga in
              </Button>
              <Button asChild variant="glassBlue" className="landing-primary-button px-5 text-sm font-semibold">
                <a href="#kontakt">
                  Kom igång
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>

            <button
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="landing-mobile-toggle flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full p-2.5 text-pure-white transition-transform duration-200 active:scale-[0.97] lg:hidden"
              aria-label="Öppna meny"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="landing-mobile-sheet fixed inset-0 px-6 pt-24">
            <div className="landing-panel-strong mx-auto flex max-w-md flex-col gap-2 rounded-[2rem] p-4">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="landing-mobile-link flex min-h-[54px] items-center rounded-[1.25rem] px-4 py-4 text-lg font-semibold text-pure-white transition-transform duration-200 active:scale-[0.99]"
                >
                  {item.label}
                </a>
              ))}
              <div className="grid gap-3 pt-6">
                <Button asChild variant="glassBlue" className="landing-primary-button min-h-[54px] w-full text-base font-semibold">
                  <a href="#kontakt" onClick={() => setMobileMenuOpen(false)}>
                    Kom igång
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button
                  variant="glass"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    sessionStorage.setItem('parium-skip-splash', '1');
                    onLoginClick();
                  }}
                  className="landing-secondary-button min-h-[54px] w-full text-base font-semibold"
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

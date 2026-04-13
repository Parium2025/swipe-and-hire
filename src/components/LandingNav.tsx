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
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = [
    { label: 'Funktioner', href: '#funktioner' },
    { label: 'Om oss', href: '#om-oss' },
    { label: 'Kontakt', href: '#kontakt' },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-primary/80 backdrop-blur-xl border-b border-white/[0.06]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <img
              src={pariumLogo}
              alt="Parium"
              width={224}
              height={224}
              className="h-auto w-28 md:w-36 lg:w-40"
            />

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-white/50 hover:text-white transition-colors text-sm font-medium"
                >
                  {item.label}
                </a>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:block">
              <Button
                onClick={onLoginClick}
                size="sm"
                className="rounded-full px-5 bg-white/5 border border-white/15 text-white text-sm font-medium hover:bg-white/10 transition-all"
              >
                Logga in
              </Button>
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-full text-white/70 hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-primary/98 backdrop-blur-xl pt-24 px-6">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-white/70 hover:text-white text-lg font-medium py-4 border-b border-white/[0.06] transition-colors"
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-8">
                <Button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    sessionStorage.setItem('parium-skip-splash', '1');
                    onLoginClick();
                  }}
                  className="w-full rounded-full bg-white text-primary hover:bg-white/90 font-semibold"
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

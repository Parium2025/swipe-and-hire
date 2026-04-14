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
    { label: 'Hur det fungerar', href: '#hur-det-fungerar' },
  ];

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[hsl(220_20%_4%/0.9)] backdrop-blur-2xl border-b border-white/[0.04]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6 md:px-12 lg:px-24">
          <div className="flex items-center justify-between h-16 sm:h-[72px]">
            <img
              src={pariumLogo}
              alt="Parium"
              width={224}
              height={224}
              className="h-auto w-24 md:w-28"
            />
            <div className="hidden md:flex items-center gap-8">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-white/30 hover:text-white/60 transition-colors text-[13px] font-medium tracking-wide uppercase"
                >
                  {item.label}
                </a>
              ))}
            </div>
            <div className="hidden md:block">
              <Button
                onClick={onLoginClick}
                size="sm"
                className="rounded-full px-6 bg-white/[0.04] border border-white/[0.08] text-white text-[13px] font-medium hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300"
              >
                Logga in
              </Button>
            </div>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-full text-white/50 hover:bg-white/[0.04] transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-[hsl(220_20%_4%/0.98)] backdrop-blur-2xl pt-24 px-6">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-white/50 hover:text-white text-lg font-semibold py-4 border-b border-white/[0.03] transition-colors uppercase tracking-wide"
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
                  className="w-full rounded-full bg-white text-[hsl(220_40%_10%)] hover:bg-white/90 font-bold"
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

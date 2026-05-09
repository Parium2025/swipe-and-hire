import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import pariumLogo from '/lovable-uploads/79c2f9ec-4fa4-43c9-9177-5f0ce8b19f57.png';

export interface LandingNavLink {
  label: string;
  href: string; // e.g. "#hur-det-fungerar"
}

interface LandingNavProps {
  onLoginClick: () => void;
  links?: LandingNavLink[];
}

const LandingNav = ({ onLoginClick, links = [] }: LandingNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const goHome = (e?: React.SyntheticEvent) => {
    e?.preventDefault();
    if (location.pathname === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      sessionStorage.setItem('parium-skip-splash', '1');
      navigate('/');
    }
  };

  const handleAnchor = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith('#')) return;
    e.preventDefault();
    const id = href.slice(1);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setMobileMenuOpen(false);
    }
  };

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-[backdrop-filter,background-color,border-color] duration-500 ${
          scrolled
            ? 'bg-parium-navy/70 backdrop-blur-2xl border-b border-white/[0.04]'
            : 'bg-transparent border-b border-transparent'
        }`}
        aria-label="Huvudnavigation"
      >
        <div className="max-w-[1400px] mx-auto px-5 sm:px-6 md:px-12 lg:px-24">
          <div className="flex items-center justify-between h-16 sm:h-[72px] gap-6">
            <a
              href="/"
              onPointerDown={goHome}
              onClick={(e) => e.preventDefault()}
              aria-label="Tillbaka till start"
              className="cursor-pointer touch-manipulation select-none transition-opacity active:opacity-70 hover:opacity-80 shrink-0"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <img
                src={pariumLogo}
                alt="Parium"
                width={224}
                height={224}
                draggable={false}
                className="h-auto w-24 md:w-28 pointer-events-none"
              />
            </a>

            {links.length > 0 && (
              <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 rounded-full border border-white/[0.06] bg-white/[0.03] backdrop-blur-xl px-1.5 py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                {links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={(e) => handleAnchor(e, l.href)}
                    className="rounded-full px-4 py-2 text-[13px] font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    {l.label}
                  </a>
                ))}
              </div>
            )}

            <div className="hidden md:block ml-auto shrink-0">
              <Button
                onClick={onLoginClick}
                size="sm"
                className="rounded-full px-6 bg-white/[0.04] border border-white/[0.08] text-white text-[13px] font-medium hover:bg-secondary/20 hover:border-secondary/45 hover:shadow-[0_0_30px_hsl(var(--secondary)/0.28)] transition-all duration-300"
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
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={(e) => handleAnchor(e, l.href)}
                  className="px-4 py-4 rounded-2xl text-white/85 hover:bg-white/[0.06] text-lg font-medium transition-colors"
                >
                  {l.label}
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

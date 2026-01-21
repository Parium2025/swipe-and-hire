import { memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Chrome, Smartphone, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CloseButton } from '@/components/ui/close-button';

interface GpsHelpModalProps {
  open: boolean;
  onClose: () => void;
}

// Detect browser
const getBrowser = (): 'chrome' | 'safari' | 'firefox' | 'edge' | 'other' => {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('chrome') && !ua.includes('edg/')) return 'chrome';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  if (ua.includes('firefox')) return 'firefox';
  return 'other';
};

// Detect if mobile
const isMobile = (): boolean => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

interface BrowserInstructions {
  name: string;
  icon: typeof Chrome;
  steps: string[];
  tip?: string;
}

const GpsHelpModal = memo(({ open, onClose }: GpsHelpModalProps) => {
  const browser = getBrowser();
  const mobile = isMobile();

  const instructions = useMemo((): BrowserInstructions => {
    if (mobile) {
      // iOS Safari
      if (browser === 'safari') {
        return {
          name: 'Safari (iOS)',
          icon: Smartphone,
          steps: [
            'Öppna Inställningar på din iPhone/iPad',
            'Scrolla ner och tryck på Safari',
            'Tryck på Plats under "Inställningar för webbplatser"',
            'Välj "Tillåt" eller "Fråga"',
            'Gå tillbaka till appen och ladda om sidan',
          ],
          tip: 'Du kan också trycka på "Aa" i adressfältet → Webbplatsinställningar → Plats',
        };
      }
      // Android Chrome
      return {
        name: 'Chrome (Android)',
        icon: Smartphone,
        steps: [
          'Tryck på de tre prickarna (⋮) uppe till höger',
          'Välj Inställningar → Webbplatsinställningar',
          'Tryck på Plats',
          'Hitta denna webbplats och tryck på den',
          'Ändra till "Tillåt"',
        ],
        tip: 'Du kan också trycka på hänglåset i adressfältet för snabb åtkomst',
      };
    }

    // Desktop browsers
    switch (browser) {
      case 'chrome':
      case 'edge':
        return {
          name: browser === 'edge' ? 'Microsoft Edge' : 'Google Chrome',
          icon: Chrome,
          steps: [
            'Klicka på hänglåset 🔒 till vänster i adressfältet',
            'Hitta "Plats" i listan',
            'Ändra från "Blockera" till "Tillåt"',
            'Klicka utanför menyn för att stänga',
            'Ladda om sidan (Ctrl+R eller Cmd+R)',
          ],
          tip: 'Alternativt: Klicka på de tre prickarna → Inställningar → Sekretess → Webbplatsinställningar → Plats',
        };
      case 'safari':
        return {
          name: 'Safari (Mac)',
          icon: Globe,
          steps: [
            'Klicka på Safari i menyraden → Inställningar',
            'Gå till fliken "Webbplatser"',
            'Välj "Plats" i vänstra sidofältet',
            'Hitta denna webbplats i listan',
            'Ändra till "Tillåt"',
          ],
          tip: 'Du kan också högerklicka i adressfältet → Inställningar för denna webbplats',
        };
      case 'firefox':
        return {
          name: 'Mozilla Firefox',
          icon: Globe,
          steps: [
            'Klicka på hänglåset 🔒 till vänster i adressfältet',
            'Klicka på pilen bredvid "Anslutningen är säker"',
            'Klicka på "Mer information"',
            'Gå till fliken "Behörigheter"',
            'Hitta "Åtkomst till din plats" och klicka på "Tillåt"',
          ],
        };
      default:
        return {
          name: 'Din webbläsare',
          icon: Globe,
          steps: [
            'Öppna webbläsarens inställningar',
            'Sök efter "Plats" eller "Platsbehörigheter"',
            'Hitta denna webbplats och ändra till "Tillåt"',
            'Ladda om sidan',
          ],
        };
    }
  }, [browser, mobile]);

  const Icon = instructions.icon;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
          />

          {/* Modal (portaled to body, truly centered in viewport) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-hidden rounded-2xl shadow-lg border border-white/20 bg-white/10 backdrop-blur-sm flex flex-col relative">
              {/* Header - centered like UnsavedChangesDialog */}
              <div className="p-6 pb-2 shrink-0 text-center">
                <div className="flex justify-center mb-3">
                  <div className="p-2.5 rounded-xl bg-white/10">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                </div>
                <h2 className="font-semibold text-white text-lg">Aktivera plats</h2>
                <p className="text-sm text-white mt-1">{instructions.name}</p>
                
                {/* Close button top right */}
                <CloseButton
                  onClick={onClose}
                  className="absolute top-4 right-4"
                />
              </div>

              {/* Content (scrollable so entire message is always readable) */}
              <div className="px-6 pb-4 flex-1 min-h-0 overflow-y-auto">
                <div className="flex items-center gap-2 mb-4 justify-center">
                  <Icon className="h-4 w-4 text-white/60" />
                  <span className="text-sm font-medium text-white">Så här gör du:</span>
                </div>

                <ol className="space-y-3">
                  {instructions.steps.map((step, index) => (
                    <li key={index} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white/10 text-white text-xs font-semibold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span className="text-sm text-white leading-relaxed pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>

                {instructions.tip && (
                  <div className="mt-4 p-3 bg-white/5 rounded-lg border border-white/20">
                    <p className="text-xs text-white">
                      <span className="font-semibold">Tips:</span> {instructions.tip}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer - buttons styled like UnsavedChangesDialog */}
              <div className="p-6 pt-2 flex gap-2 justify-center shrink-0">
                <button
                  onClick={onClose}
                  className="rounded-full px-4 py-2 text-sm bg-white/5 backdrop-blur-[2px] border border-white/20 text-white transition-all duration-300 md:hover:bg-white/15 md:hover:text-white md:hover:border-white/50"
                >
                  Stäng
                </button>
                <button
                  onClick={() => {
                    onClose();
                    navigator.geolocation.getCurrentPosition(
                      () => window.location.reload(),
                      () => {},
                      { timeout: 5000 }
                    );
                  }}
                  className="rounded-full px-4 py-2 text-sm bg-emerald-500/20 backdrop-blur-sm text-white border border-emerald-500/40 md:hover:bg-emerald-500/30 md:hover:border-emerald-500/50 transition-all duration-300 whitespace-nowrap"
                >
                  Jag har aktiverat – testa igen
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
});

GpsHelpModal.displayName = 'GpsHelpModal';

export default GpsHelpModal;

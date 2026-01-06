import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X } from 'lucide-react';

const GPS_PROMPT_DISMISSED_KEY = 'parium_gps_prompt_dismissed';
const GPS_PROMPT_DELAY_MS = 3000; // Show after 3 seconds

interface GpsPromptProps {
  onEnableGps?: () => void;
}

const GpsPrompt = memo(({ onEnableGps }: GpsPromptProps) => {
  const [visible, setVisible] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');

  useEffect(() => {
    // Check if already dismissed
    const dismissed = localStorage.getItem(GPS_PROMPT_DISMISSED_KEY);
    if (dismissed === 'true') {
      return;
    }

    // Check GPS permission status
    const checkPermission = async () => {
      try {
        if ('permissions' in navigator) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          setGpsStatus(result.state as 'granted' | 'denied' | 'prompt');
          
          // Only show prompt if GPS is not already granted
          if (result.state !== 'granted') {
            // Show after a delay
            const timer = setTimeout(() => {
              setVisible(true);
            }, GPS_PROMPT_DELAY_MS);
            return () => clearTimeout(timer);
          }
        } else {
          // Fallback: assume prompt is needed if we can't check
          const timer = setTimeout(() => {
            setVisible(true);
          }, GPS_PROMPT_DELAY_MS);
          return () => clearTimeout(timer);
        }
      } catch {
        // Permission API not supported, show prompt
        const timer = setTimeout(() => {
          setVisible(true);
        }, GPS_PROMPT_DELAY_MS);
        return () => clearTimeout(timer);
      }
    };

    checkPermission();
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem(GPS_PROMPT_DISMISSED_KEY, 'true');
  };

  const handleEnableGps = () => {
    handleDismiss();
    
    // Trigger GPS permission request
    navigator.geolocation.getCurrentPosition(
      () => {
        // Success - GPS is now enabled
        console.log('GPS enabled successfully');
        onEnableGps?.();
      },
      (error) => {
        console.log('GPS permission denied:', error.message);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  // Don't show if GPS is already granted
  if (gpsStatus === 'granted') {
    return null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[calc(100%-2rem)]"
        >
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 shrink-0">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-sm mb-1">
                  Aktivera plats för exakt väder
                </h4>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Tillåt GPS för att alltid se rätt väder oavsett var du befinner dig.
                </p>
                
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleEnableGps}
                    className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Aktivera
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-3 py-1.5 text-muted-foreground text-xs font-medium hover:text-foreground transition-colors"
                  >
                    Inte nu
                  </button>
                </div>
              </div>
              
              <button
                onClick={handleDismiss}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                aria-label="Stäng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

GpsPrompt.displayName = 'GpsPrompt';

export default GpsPrompt;

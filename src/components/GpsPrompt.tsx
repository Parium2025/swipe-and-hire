import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, AlertCircle } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import GpsHelpModal from '@/components/GpsHelpModal';

const GPS_PROMPT_DISMISSED_KEY = 'parium_gps_prompt_dismissed';
const GPS_PROMPT_DELAY_MS = 3000; // Show after 3 seconds

// Check if running as native app
const isNativeApp = (): boolean => Capacitor.isNativePlatform();

// Unified GPS permission check for both native and web
const checkGpsPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  try {
    if (isNativeApp()) {
      const status = await Geolocation.checkPermissions();
      if (status.location === 'granted' || status.coarseLocation === 'granted') {
        return 'granted';
      }
      if (status.location === 'denied') {
        return 'denied';
      }
      return 'prompt';
    }
    
    // Browser API
    if ('permissions' in navigator) {
      const result = await navigator.permissions.query({ name: 'geolocation' });
      return result.state as 'granted' | 'denied' | 'prompt';
    }
    
    return 'prompt';
  } catch {
    return 'prompt';
  }
};

// Request GPS permission - native shows OS dialog, web triggers on getCurrentPosition
const requestGpsPermission = async (): Promise<boolean> => {
  try {
    if (isNativeApp()) {
      const status = await Geolocation.requestPermissions();
      return status.location === 'granted' || status.coarseLocation === 'granted';
    }
    // On web, permission is requested when getCurrentPosition is called
    return true;
  } catch {
    return false;
  }
};

interface GpsPromptProps {
  onEnableGps?: () => void;
}

const GpsPrompt = memo(({ onEnableGps }: GpsPromptProps) => {
  // TEMP: Always show for testing - set to 'denied' to see blocked state, 'prompt' for normal
  const [visible, setVisible] = useState(true);
  const [gpsStatus, setGpsStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('prompt');
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleDismiss = () => {
    setVisible(false);
    // Only save dismissal if not denied (denied users should always see the help option)
    if (gpsStatus !== 'denied') {
      localStorage.setItem(GPS_PROMPT_DISMISSED_KEY, 'true');
    }
  };

  const handleEnableGps = async () => {
    // If GPS is denied, show help modal instead of trying again
    if (gpsStatus === 'denied') {
      setShowHelpModal(true);
      return;
    }
    
    handleDismiss();
    
    // On native, use Capacitor to request permission first
    if (isNativeApp()) {
      const granted = await requestGpsPermission();
      if (granted) {
        console.log('Native GPS enabled successfully');
        onEnableGps?.();
        window.location.reload();
      } else {
        console.log('Native GPS permission denied');
        setGpsStatus('denied');
        setVisible(true);
      }
      return;
    }
    
    // On web, trigger GPS permission request via getCurrentPosition
    navigator.geolocation.getCurrentPosition(
      () => {
        console.log('GPS enabled successfully');
        onEnableGps?.();
        window.location.reload();
      },
      (error) => {
        console.log('GPS permission denied:', error.message);
        // User denied - update status and show help
        setGpsStatus('denied');
        setVisible(true);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  // TEMP: Skip grant check for testing
  // if (gpsStatus === 'granted') {
  //   return null;
  // }

  const isDenied = gpsStatus === 'denied';

  return (
    <>
      <GpsHelpModal open={showHelpModal} onClose={() => setShowHelpModal(false)} />
      
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed top-20 right-4 z-50 max-w-xs w-[calc(100%-2rem)] sm:w-80"
          >
            <div className={`backdrop-blur-xl rounded-2xl shadow-2xl border p-4 ${
              isDenied 
                ? 'bg-amber-950/90 border-amber-700/50' 
                : 'bg-slate-800/95 border-slate-600/50'
            }`}>
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-xl shrink-0 ${
                  isDenied 
                    ? 'bg-amber-500/20' 
                    : 'bg-teal-500/20'
                }`}>
                  {isDenied ? (
                    <AlertCircle className="h-5 w-5 text-amber-400" />
                  ) : (
                    <MapPin className="h-5 w-5 text-teal-400" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className={`font-semibold text-sm mb-1 ${
                    isDenied ? 'text-amber-100' : 'text-white'
                  }`}>
                    {isDenied ? 'Plats är blockerad' : 'Aktivera plats för exakt väder'}
                  </h4>
                  <p className={`text-xs leading-relaxed ${
                    isDenied ? 'text-amber-200/80' : 'text-slate-300'
                  }`}>
                    {isDenied 
                      ? 'Du har blockerat platsåtkomst. Klicka nedan för att se hur du aktiverar det.'
                      : 'Tillåt GPS för att alltid se rätt väder och plats oavsett var du befinner dig.'
                    }
                  </p>
                  
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleEnableGps}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        isDenied
                          ? 'bg-amber-500 text-amber-950 hover:bg-amber-400'
                          : 'bg-teal-500 text-white hover:bg-teal-400'
                      }`}
                    >
                      {isDenied ? 'Visa instruktioner' : 'Aktivera'}
                    </button>
                    {!isDenied && (
                      <button
                        onClick={handleDismiss}
                        className="px-3 py-1.5 text-slate-400 text-xs font-medium hover:text-white transition-colors"
                      >
                        Inte nu
                      </button>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={handleDismiss}
                  className={`p-1 transition-colors shrink-0 ${
                    isDenied 
                      ? 'text-amber-400 hover:text-amber-100' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                  aria-label="Stäng"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

GpsPrompt.displayName = 'GpsPrompt';

export default GpsPrompt;

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
  const [visible, setVisible] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Check GPS permission on mount and listen for changes
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let permissionStatus: PermissionStatus | null = null;
    
    const checkPermission = async () => {
      const status = await checkGpsPermission();
      setGpsStatus(status);
      
      // If already granted - NEVER show our prompt
      if (status === 'granted') {
        setVisible(false);
        return;
      }
      
      // If denied - show help immediately
      if (status === 'denied') {
        setVisible(true);
        return;
      }
      
      // If prompt (browser hasn't asked yet):
      // Wait 3 seconds, then show our custom prompt (use sessionStorage instead of localStorage)
      const dismissed = sessionStorage.getItem(GPS_PROMPT_DISMISSED_KEY);
      if (status === 'prompt' && !dismissed) {
        timeoutId = setTimeout(() => {
          // Double-check permission hasn't changed during the wait
          checkGpsPermission().then(currentStatus => {
            if (currentStatus === 'prompt') {
              setVisible(true);
            } else if (currentStatus === 'granted') {
              setGpsStatus('granted');
              setVisible(false);
            }
          });
        }, GPS_PROMPT_DELAY_MS);
      }
    };
    
    // Setup permission change listener (browser API)
    const setupPermissionListener = async () => {
      if ('permissions' in navigator && !isNativeApp()) {
        try {
          permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          
          const handleChange = () => {
            const newState = permissionStatus?.state;
            if (newState === 'granted') {
              setGpsStatus('granted');
              setVisible(false);
              // Cancel any pending timeout
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
            } else if (newState === 'denied') {
              setGpsStatus('denied');
              setVisible(true);
            }
          };
          
          permissionStatus.addEventListener('change', handleChange);
        } catch {
          // Permission API not supported
        }
      }
    };
    
    checkPermission();
    setupPermissionListener();
    
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    // Never save dismissal for denied status - always show on page reload
    // Only save dismissal for 'prompt' status (when user hasn't decided yet)
    if (gpsStatus === 'prompt') {
      sessionStorage.setItem(GPS_PROMPT_DISMISSED_KEY, 'true');
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
        setGpsStatus('granted');
        onEnableGps?.();
        // Don't reload - let the app handle the state update naturally
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
        setGpsStatus('granted');
        onEnableGps?.();
        // Don't reload - let the app handle the state update naturally
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

  // Don't render if GPS is already granted
  if (gpsStatus === 'granted') {
    return null;
  }

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
                  <h4 className="font-semibold text-sm mb-1 text-white">
                    {isDenied ? 'Plats är blockerad' : 'Aktivera plats för exakt väder'}
                  </h4>
                  <p className="text-xs leading-relaxed text-white">
                    {isDenied 
                      ? 'Du har blockerat platsåtkomst. Klicka nedan för att se hur du aktiverar det.'
                      : 'Tillåt GPS för att alltid se rätt väder och plats oavsett var du befinner dig.'
                    }
                  </p>
                  
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleEnableGps}
                      className={`px-4 py-2 text-xs font-medium rounded-full backdrop-blur-sm border transition-all duration-300 active:scale-95 ${
                        isDenied
                          ? 'bg-amber-500/20 border-amber-500/40 text-white hover:bg-amber-500/30 hover:border-amber-500/50'
                          : 'bg-teal-500/20 border-teal-500/40 text-white hover:bg-teal-500/30 hover:border-teal-500/50'
                      }`}
                    >
                      {isDenied ? 'Visa instruktioner' : 'Aktivera'}
                    </button>
                    {!isDenied && (
                      <button
                        onClick={handleDismiss}
                        className="px-4 py-2 text-xs font-medium rounded-full bg-white/5 backdrop-blur-[2px] border border-white/20 text-white hover:bg-white/15 hover:backdrop-blur-sm hover:border-white/50 active:scale-95 transition-all duration-300"
                      >
                        Inte nu
                      </button>
                    )}
                  </div>
                </div>
                
                <button
                  onClick={handleDismiss}
                  className="p-1 transition-colors shrink-0 text-white hover:text-white/80"
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

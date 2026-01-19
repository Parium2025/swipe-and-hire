import { memo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, AlertCircle } from 'lucide-react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import GpsHelpModal from '@/components/GpsHelpModal';

const GPS_PROMPT_DELAY_MS = 3000; // Show after 3 seconds

// Dismissed state that survives SPA navigation (module stays loaded) but resets on full page reload
let gpsPromptDismissedUntilReload = false;
// Track if user has seen and expanded the prompt this session (to know whether to minimize on navigation)
let gpsPromptHasBeenShown = false;

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
  const [expanded, setExpanded] = useState(false); // Always start as icon, user expands manually
  const [gpsStatus, setGpsStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [showHelpModal, setShowHelpModal] = useState(false);

  // On mount, if prompt was previously shown but not dismissed, start minimized
  useEffect(() => {
    if (gpsPromptHasBeenShown && !gpsPromptDismissedUntilReload) {
      setExpanded(false);
    }
  }, []);

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
      
      // If denied
      if (status === 'denied') {
        if (!gpsPromptDismissedUntilReload) {
          setVisible(true);
          gpsPromptHasBeenShown = true;
          // Always start minimized (icon only)
        }
        return;
      }
      
      // If prompt (browser hasn't asked yet):
      // Wait 3 seconds, then show our custom prompt
      if (status === 'prompt' && !gpsPromptDismissedUntilReload) {
        timeoutId = setTimeout(() => {
          // Double-check permission hasn't changed during the wait
          checkGpsPermission().then(currentStatus => {
            if (currentStatus === 'prompt') {
              setVisible(true);
              gpsPromptHasBeenShown = true;
              // Always start minimized (icon only)
            } else if (currentStatus === 'granted') {
              setGpsStatus('granted');
              setVisible(false);
              gpsPromptDismissedUntilReload = false;
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
              gpsPromptDismissedUntilReload = false;
              setGpsStatus('granted');
              setVisible(false);
              // Cancel any pending timeout
              if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
              }
            } else if (newState === 'denied') {
              setGpsStatus('denied');
              setVisible(!gpsPromptDismissedUntilReload);
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
    gpsPromptDismissedUntilReload = true;
    setVisible(false);
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
        gpsPromptDismissedUntilReload = false;
        setGpsStatus('granted');
        onEnableGps?.();
        // Don't reload - let the app handle the state update naturally
      } else {
        console.log('Native GPS permission denied');
        gpsPromptDismissedUntilReload = false;
        setGpsStatus('denied');
        setVisible(true);
      }
      return;
    }
    
    // On web, trigger GPS permission request via getCurrentPosition
    navigator.geolocation.getCurrentPosition(
      () => {
        console.log('GPS enabled successfully');
        gpsPromptDismissedUntilReload = false;
        setGpsStatus('granted');
        onEnableGps?.();
        // Don't reload - let the app handle the state update naturally
      },
      (error) => {
        console.log('GPS permission denied:', error.message);
        // User denied - update status and show help
        gpsPromptDismissedUntilReload = false;
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
      
      <AnimatePresence mode="wait">
        {visible && !expanded && (
          // Minimized state - just the icon
          <motion.button
            key="minimized"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            onClick={() => setExpanded(true)}
            className="fixed top-20 right-4 z-50 p-3 rounded-full backdrop-blur-xl shadow-2xl border bg-amber-950/90 border-amber-700/50 hover:bg-amber-900/90 transition-colors"
            aria-label="Visa platsinformation"
          >
            <AlertCircle className="h-5 w-5 text-amber-400" />
          </motion.button>
        )}
        
        {visible && expanded && (
          // Expanded state - full notification
          <motion.div
            key="expanded"
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

import { memo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, X, AlertCircle } from 'lucide-react';
import { checkGpsPermission, requestGpsPermission, isNativeApp } from '@/lib/gpsUtils';
import GpsHelpModal from '@/components/GpsHelpModal';
import {
  canUsePreciseLocation,
  notePermissionGranted,
  notePermissionRevoked,
} from '@/lib/gpsCoordinator';

// Vänta 10s innan GPS-ikonen visas — så att grovt IP-/profilväder hinner
// landa och Home får boota ostört. Ikonen måste därefter finnas kvar som den
// uttryckliga opt-in-vägen till exakt plats; ett lyckat IP-väder får inte göra
// GPS-medgivandet oåtkomligt.
const GPS_PROMPT_DELAY_MS = 10000;

// Dismissed state that survives SPA navigation but resets on full page reload
let gpsPromptDismissedUntilReload = false;
let gpsPromptHasBeenShown = false;

interface GpsPromptProps {
  onEnableGps?: () => void;
  weatherAvailable?: boolean;
  /** Jobseeker keeps the explicit precise-location opt-in reachable after IP weather loads. */
  keepOptInReachableWhenWeatherAvailable?: boolean;
  /** Home synlig? Dold Home (KeepAlive) stänger av all GPS-logik och UI. */
  active?: boolean;
}

const GpsPrompt = memo(({
  onEnableGps,
  weatherAvailable = false,
  keepOptInReachableWhenWeatherAvailable = false,
  active = true,
}: GpsPromptProps) => {

  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
  const [preciseEnabled, setPreciseEnabled] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const weatherAvailableRef = useRef(weatherAvailable);
  weatherAvailableRef.current = weatherAvailable;
  const keepOptInReachableRef = useRef(keepOptInReachableWhenWeatherAvailable);
  keepOptInReachableRef.current = keepOptInReachableWhenWeatherAvailable;

  useEffect(() => {
    if (gpsPromptHasBeenShown && !gpsPromptDismissedUntilReload) {
      setExpanded(false);
    }
  }, []);


  useEffect(() => {
    if (!active) {
      setVisible(false);
      setExpanded(false);
      setShowHelpModal(false);
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let permissionStatus: PermissionStatus | null = null;
    let handleChange: (() => void) | null = null;
    
    const checkPermission = async () => {
      const preciseAllowed = await canUsePreciseLocation();
      const status = await checkGpsPermission();
      if (cancelled) return;
      setPreciseEnabled(preciseAllowed);
      setGpsStatus(status);
      
      if (preciseAllowed) {
        setVisible(false);
        return;
      }
      
      if (gpsPromptDismissedUntilReload) return;

      timeoutId = setTimeout(() => {
        Promise.all([canUsePreciseLocation(), checkGpsPermission()]).then(([allowed, currentStatus]) => {
          if (cancelled) return;
          setPreciseEnabled(allowed);
          setGpsStatus(currentStatus);
          if (allowed) {
            setVisible(false);
            return;
          }
          if (weatherAvailableRef.current && !keepOptInReachableRef.current) return;
          setVisible(true);
          gpsPromptHasBeenShown = true;
        });
      }, GPS_PROMPT_DELAY_MS);

    };
    
    const setupPermissionListener = async () => {
      if ('permissions' in navigator && !isNativeApp()) {
        try {
          const queried = await navigator.permissions.query({ name: 'geolocation' });
          if (cancelled) return;
          permissionStatus = queried;
          
          handleChange = () => {
            if (cancelled) return;
            const newState = permissionStatus?.state;
            if (newState === 'granted') {
              setGpsStatus('granted');
            } else if (newState === 'denied') {
              notePermissionRevoked();
              setPreciseEnabled(false);
              setGpsStatus('denied');
              setVisible(
                !gpsPromptDismissedUntilReload &&
                (!weatherAvailableRef.current || keepOptInReachableRef.current),
              );
            } else if (newState === 'prompt') {
              notePermissionRevoked();
              setPreciseEnabled(false);
              setGpsStatus('prompt');
              setVisible(
                !gpsPromptDismissedUntilReload &&
                (!weatherAvailableRef.current || keepOptInReachableRef.current),
              );
            }
          };
          
          permissionStatus.addEventListener('change', handleChange);
        } catch { /* Permission API not supported */ }
      }
    };
    
    checkPermission();
    setupPermissionListener();
    
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (permissionStatus && handleChange) {
        permissionStatus.removeEventListener('change', handleChange);
      }
    };
  }, [active]);

  // Generation-guard: asynkrona fortsättningar (native-dialog, geolocation-
  // callbacks) får inte mutera state efter att Home dolts (KeepAlive).
  const activeRef = useRef(active);
  activeRef.current = active;
  const generationRef = useRef(0);
  useEffect(() => {
    if (!active) generationRef.current += 1;
  }, [active]);
  useEffect(() => {
    // A component can disappear without first rendering `active=false`
    // (account switch, route teardown). Invalidate every outstanding native/
    // browser permission callback before React discards this instance.
    activeRef.current = active;
    return () => {
      activeRef.current = false;
      generationRef.current += 1;
    };
    // This guard owns the component lifetime; active changes are handled by
    // the dedicated effect above and the render-time ref assignment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDismiss = () => {
    gpsPromptDismissedUntilReload = true;
    setVisible(false);
  };

  const handleEnableGps = async () => {
    if (gpsStatus === 'denied') {
      setShowHelpModal(true);
      return;
    }

    handleDismiss();
    const generation = generationRef.current;
    const isStale = () => generationRef.current !== generation || !activeRef.current;

    if (isNativeApp()) {
      const granted = await requestGpsPermission();
      if (isStale()) return;
      if (granted) {
        console.log('Native GPS enabled successfully');
        notePermissionGranted();
        setPreciseEnabled(true);
        gpsPromptDismissedUntilReload = false;
        setGpsStatus('granted');
        onEnableGps?.();
      } else {
        console.log('Native GPS permission denied');
        const currentStatus = await checkGpsPermission();
        if (isStale()) return;
        if (currentStatus === 'denied') notePermissionRevoked();
        gpsPromptDismissedUntilReload = false;
        setGpsStatus(currentStatus);
        setVisible(true);
      }
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      () => {
        if (isStale()) return;
        console.log('GPS enabled successfully');
        notePermissionGranted();
        setPreciseEnabled(true);
        gpsPromptDismissedUntilReload = false;
        setGpsStatus('granted');
        onEnableGps?.();
      },
      (error) => {
        if (isStale()) return;
        console.log('GPS activation failed:', error.message);
        gpsPromptDismissedUntilReload = false;
        if (error.code === 1) {
          notePermissionRevoked();
          setGpsStatus('denied');
        }
        setVisible(true);
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  if (!active) return null;
  if (preciseEnabled) return null;
  if (weatherAvailable && !keepOptInReachableWhenWeatherAvailable) return null;


  const isDenied = gpsStatus === 'denied';

  return (
    <>
      <GpsHelpModal open={showHelpModal} onClose={() => setShowHelpModal(false)} />
      
      <AnimatePresence mode="wait">
        {visible && !expanded && (
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
                  isDenied ? 'bg-amber-500/20' : 'bg-teal-500/20'
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
                  className="flex h-7 w-7 !min-h-0 !min-w-0 items-center justify-center overflow-hidden rounded-full text-white bg-white/10 transition-colors shrink-0 md:hover:bg-white/20"
                  aria-label="Stäng"
                >
                  <X className="h-3.5 w-3.5 text-white" />
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

// Delade konstanter för JobSlide-familjen. Ändra ALDRIG dessa utan att
// samtidigt uppdatera useSwipeImagePreloader — transforms måste matcha
// exakt, annars hamnar preloader-cachen på fel key och första framen
// blir en nätverksladdning.

export const SWIPE_IMG_TRANSFORM = {
  width: 800,
  height: 1000,
  quality: 78,
  resize: 'cover' as const,
};

export const SWIPE_LOGO_TRANSFORM = {
  width: 64,
  height: 64,
  quality: 80,
  resize: 'contain' as const,
};

// Gest-trösklar
export const SWIPE_THRESHOLD = 100;
export const VELOCITY_THRESHOLD = 400;
export const EXIT_X =
  typeof window !== 'undefined' ? window.innerWidth * 1.4 : 600;

export const SNAP_SPRING = {
  type: 'spring' as const,
  stiffness: 340,
  damping: 28,
  mass: 0.9,
};

// Tap-detektion
export const DOUBLE_TAP_DELAY = 280;
export const TAP_MAX_DURATION = 250;
export const TAP_MOVE_THRESHOLD = 18;
export const TAP_RESET_VELOCITY_THRESHOLD = 120;
export const TOUCH_DRAG_INTENT_THRESHOLD = 12;

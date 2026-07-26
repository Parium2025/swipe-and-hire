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

// Exit-animation för aktivt kort när vänster-swipe committas.
export const EXIT_SPRING = {
  type: 'spring' as const,
  stiffness: 220,
  damping: 26,
  mass: 0.85,
};
export const EXIT_OPACITY_DURATION = 0.38;

// Underlay ("nästa kort") som stiger fram bakom det utåkande kortet.
export const UNDERLAY_RISE_SPRING = {
  type: 'spring' as const,
  stiffness: 190,
  damping: 25,
  mass: 0.9,
};
export const UNDERLAY_OPACITY_DURATION = 0.42;
// Underlay är osynligt/off-screen i vila. Det animeras in ENDAST under
// swipe-exit (triggerSwipe → animate underlayY/scale/opacity till 0/1/1).
// Så länge inget swipas syns bara det aktiva kortet — inga dubbletter.
export const UNDERLAY_INITIAL_Y = 40;
export const UNDERLAY_INITIAL_SCALE = 0.96;
export const UNDERLAY_INITIAL_OPACITY = 0;

export const PREMIUM_EASE = [0.22, 1, 0.36, 1] as const;

// Tap-detektion
export const DOUBLE_TAP_DELAY = 280;
export const TAP_MAX_DURATION = 250;
export const TAP_MOVE_THRESHOLD = 18;
export const TAP_RESET_VELOCITY_THRESHOLD = 120;
export const TOUCH_DRAG_INTENT_THRESHOLD = 12;

// Låser input kort efter att overlay stängts så att stängnings-tap inte
// råkar registreras som en swipe/tap på kortet under.
export const OVERLAY_CLOSE_INPUT_LOCK_MS = 150;

// Handoff när ghost-underlaget redan hunnit lägga sig nästan exakt i aktiv
// position. För tidig array-mutation gör att det riktiga nästa kortet poppar
// in och kan ge en ljus/tom mellanframe på iOS.
export const EXIT_HANDOFF_MS = 240;



// ♿️ Reduced motion: korta linjära toningar istället för spring/parallax.
// Samma flöde och samma timing-kontrakt, men utan rörelse i sidled.
export const REDUCED_FADE = 0.12;
export const REDUCED_SNAP = { duration: 0.1, ease: 'linear' as const };
export const REDUCED_EXIT_HANDOFF_MS = 120;

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
  stiffness: 140,
  damping: 22,
  mass: 1.1,
};
export const UNDERLAY_OPACITY_DURATION = 0.42;
export const UNDERLAY_INITIAL_Y = 800;
export const UNDERLAY_INITIAL_SCALE = 0.68;

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

// Tinder/TikTok-känsla: släpp föräldern (mounta nästa kort och gör det
// interaktivt) redan när exit-animationen passerat ~45 % av sin väg.
// Underlaget har då rest sig så pass mycket att övergången ser smidig ut,
// men användaren behöver INTE vänta på att gamla kortets spring landar.
// Sänkt från 200 → 160 ms för snabbare respons; exit-fade fortsätter
// visuellt i bakgrunden eftersom vi inte längre resettar motion-values
// vid handoff (se useSwipeCardGesture — undviker "tomt kort"-flash).
export const EXIT_HANDOFF_MS = 160;



import type { Variants } from 'framer-motion';

export const premiumEase = [0.16, 1, 0.3, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: premiumEase } },
};

export const fadeUpSmall: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: premiumEase } },
};

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: -80 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.95, ease: premiumEase } },
};

export const slideRight: Variants = {
  hidden: { opacity: 0, x: 80 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.95, ease: premiumEase } },
};

export const stagger = (children = 0.12, delay = 0.05): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: children, delayChildren: delay } },
});

// Trigga mycket tidigare så innehållet hinner animera klart innan användaren
// når sektionen på mobil. Animationerna finns kvar, men sker off-screen.
export const inView = { once: true, amount: 0.01, margin: '0px 0px 100% 0px' } as const;

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

// Trigga tidigare så innehållet redan är animerat när det syns på mobil
// (annars upplevs det som att sektionen "måste laddas om" vid scroll).
export const inView = { once: true, amount: 0.05, margin: '0px 0px 25% 0px' } as const;

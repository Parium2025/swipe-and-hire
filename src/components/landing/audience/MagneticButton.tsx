import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'> & {
  children: ReactNode;
  /** Hur långt knappen rör sig mot pekaren i px. Default 10. */
  strength?: number;
  /** Hur långt utanför knappen den fortfarande "drar". Default 0.4 = 40%. */
  radius?: number;
};

/**
 * MagneticButton — knappen rör sig svagt mot muspekaren (Awwwards/Stripe-trick).
 * Aktiveras endast på enheter med fin pekare (mus/trackpad). På touch =
 * normal knapp utan magnetism, men behåller alla aria/click-egenskaper.
 * Respekterar prefers-reduced-motion.
 */
const MagneticButton = ({ children, strength = 10, radius = 0.4, className, ...props }: Props) => {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springConfig = { stiffness: 220, damping: 18, mass: 0.4 };
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (reduce) return;
    if (e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const maxX = rect.width * (0.5 + radius);
    const maxY = rect.height * (0.5 + radius);
    x.set(Math.max(-strength, Math.min(strength, (dx / maxX) * strength)));
    y.set(Math.max(-strength, Math.min(strength, (dy / maxY) * strength)));
  };

  const handlePointerLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      {...(props as any)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{ x: springX, y: springY }}
      className={className}
    >
      <span className="pointer-events-none inline-flex items-center justify-center gap-3">{children}</span>
    </motion.button>
  );
};

export default MagneticButton;

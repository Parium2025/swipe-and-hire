import { AnimatedBackground } from '@/components/AnimatedBackground';

/**
 * SEO page background — identical bubbles + glow as the main landing page,
 * `fixed` so the effect follows the viewport while the user scrolls.
 */
const SeoBubbles = () => <AnimatedBackground showBubbles showGlow variant="viewport" />;

export default SeoBubbles;

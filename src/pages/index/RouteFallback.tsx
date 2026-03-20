const touchScrollStyle = { WebkitOverflowScrolling: 'touch' } as const;

const RouteFallback = () => (
  <div className="min-h-screen bg-gradient-parium smooth-scroll touch-pan" style={touchScrollStyle} />
);

export default RouteFallback;
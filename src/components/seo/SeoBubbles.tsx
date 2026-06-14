const SeoBubbles = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
    <div className="absolute top-20 left-10 h-4 w-4 rounded-full bg-secondary/30" />
    <div className="absolute top-32 left-16 h-2 w-2 rounded-full bg-accent/40 animate-soft-bounce" style={{ animationDuration: '2.5s', animationDelay: '-1.2s', animationFillMode: 'backwards' }} />
    <div className="absolute top-24 left-20 h-3 w-3 rounded-full bg-secondary/20 animate-soft-bounce" style={{ animationDuration: '3s', animationDelay: '-0.7s', animationFillMode: 'backwards' }} />
    <div className="absolute bottom-40 right-20 h-5 w-5 rounded-full bg-accent/30 animate-soft-bounce" style={{ animationDuration: '2.2s', animationDelay: '-0.8s', animationFillMode: 'backwards' }} />
    <div className="absolute bottom-32 right-16 h-3 w-3 rounded-full bg-secondary/25 animate-soft-bounce" style={{ animationDuration: '2.8s', animationDelay: '-1.5s', animationFillMode: 'backwards' }} />
    <div className="absolute bottom-36 right-24 h-2 w-2 rounded-full bg-accent/35 animate-soft-bounce" style={{ animationDuration: '2.3s', animationDelay: '-0.5s', animationFillMode: 'backwards' }} />
    <div className="absolute top-10 right-10 h-3 w-3 rounded-full bg-secondary/40 animate-pulse" style={{ animationDuration: '1.5s', animationDelay: '-0.4s', animationFillMode: 'backwards' }} />
    <div className="absolute top-16 right-20 h-2 w-2 rounded-full bg-accent/30 animate-pulse" style={{ animationDuration: '2s', animationDelay: '-1.0s', animationFillMode: 'backwards' }} />
    <div className="absolute top-12 left-8 h-3 w-3 rounded-full bg-accent/40 animate-pulse" style={{ animationDuration: '1.8s', animationDelay: '-0.6s', animationFillMode: 'backwards' }} />
    <div className="absolute top-1/3 right-1/3 h-1 w-1 rounded-full bg-secondary/60 animate-pulse" style={{ animationDuration: '2.5s', animationDelay: '-1.3s', animationFillMode: 'backwards', willChange: 'opacity' }} />
    <div className="absolute top-1/4 left-1/3 h-1 w-1 rounded-full bg-accent/60 animate-pulse" style={{ animationDuration: '3s', animationDelay: '-0.9s', animationFillMode: 'backwards', willChange: 'opacity' }} />
    <div className="absolute -right-32 bottom-0 h-64 w-64 opacity-10 pointer-events-none pwa-bottom-glow sm:h-80 sm:w-80 sm:opacity-15 md:h-96 md:w-96 md:opacity-40 lg:opacity-60">
      <div className="absolute inset-0 hidden rounded-full bg-primary-glow/40 blur-[120px] md:block" />
      <div className="absolute inset-4 hidden rounded-full bg-primary-glow/30 blur-[100px] md:block" />
      <div className="absolute inset-8 rounded-full bg-primary-glow/25 blur-[40px] md:blur-[80px]" />
    </div>
  </div>
);

export default SeoBubbles;

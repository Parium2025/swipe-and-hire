const items = ['MATCHNING', 'JOBB', 'KANDIDATER', 'INTERVJUER', 'TEAM', 'MOBILT', 'SVERIGE'];

const LandingMarquee = () => (
  <section className="relative overflow-hidden border-y border-white/[0.04] py-5 sm:py-7" aria-hidden="true">
    <div className="flex whitespace-nowrap animate-landing-marquee">
      {[0, 1].map((loop) => (
        <div key={loop} className="flex shrink-0 items-center gap-8 pr-8 sm:gap-12 sm:pr-12">
          {items.map((item) => (
            <span key={`${loop}-${item}`} className="flex items-center gap-8 sm:gap-12">
              <span className="select-none text-2xl font-black uppercase tracking-[0.08em] text-white/[0.08] sm:text-4xl">
                {item}
              </span>
              <span className="h-2 w-2 shrink-0 rounded-full bg-secondary/35" />
            </span>
          ))}
        </div>
      ))}
    </div>
  </section>
);

export default LandingMarquee;

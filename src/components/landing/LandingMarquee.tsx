const items = ['SWIPE', 'MATCHA', 'ANSTÄLL', 'AI-DRIVEN', 'MOBILE-FIRST', 'GDPR-SÄKER', '60 SEK'];

const LandingMarquee = () => (
  <section className="relative py-6 sm:py-10 overflow-hidden border-y border-white/[0.04]" aria-hidden="true">
    <div className="flex whitespace-nowrap animate-landing-marquee">
      {[0, 1].map((loop) => (
        <div
          key={loop}
          className="flex items-center gap-8 sm:gap-14 shrink-0 pr-8 sm:pr-14"
        >
          {items.map((item, i) => (
            <span key={`${loop}-${i}`} className="flex items-center gap-8 sm:gap-14">
              <span className="text-[2rem] sm:text-[3rem] md:text-[4rem] font-black tracking-[-0.04em] text-white/[0.06] uppercase select-none">
                {item}
              </span>
              <span className="w-2.5 h-2.5 rounded-full bg-secondary/25 flex-shrink-0" />
            </span>
          ))}
        </div>
      ))}
    </div>
  </section>
);

export default LandingMarquee;

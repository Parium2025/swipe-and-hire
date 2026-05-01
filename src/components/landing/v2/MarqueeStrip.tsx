const IMAGES = [
  'https://motionsites.ai/assets/hero-space-voyage-preview-eECLH3Yc.gif',
  'https://motionsites.ai/assets/hero-portfolio-cosmic-preview-BpvWJ3Nc.gif',
  'https://motionsites.ai/assets/hero-velorah-preview-CJNTtbpd.gif',
  'https://motionsites.ai/assets/hero-asme-preview-B_nGDnTP.gif',
  'https://motionsites.ai/assets/hero-transform-data-preview-Cx5OU29N.gif',
  'https://motionsites.ai/assets/hero-aethera-preview-DknSlcTa.gif',
  'https://motionsites.ai/assets/hero-orbit-web3-preview-BXt4OttD.gif',
  'https://motionsites.ai/assets/hero-nexora-preview-cx5HmUgo.gif',
];

const MarqueeStrip = () => {
  const all = [...IMAGES, ...IMAGES];
  return (
    <section className="relative z-10 mt-16 md:mt-20 mb-16 w-full overflow-hidden">
      <div className="flex w-max animate-landing-marquee">
        {all.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            loading="lazy"
            className="h-[280px] md:h-[500px] w-auto object-cover mx-3 rounded-2xl shadow-lg ring-1 ring-white/10"
          />
        ))}
      </div>
    </section>
  );
};

export default MarqueeStrip;
export { IMAGES as MARQUEE_IMAGES };

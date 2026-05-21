export const IntroText = ({ paragraphs }: { paragraphs: string[] }) => (
  <div className="max-w-3xl text-center text-base leading-[1.75] text-white sm:text-lg md:text-xl">
    {paragraphs.map((paragraph, pIdx) => (
      <p key={pIdx} className={pIdx > 0 ? 'mt-6' : undefined}>
        {paragraph}
      </p>
    ))}
  </div>
);

export default IntroText;

/**
 * Invisible image preloader som alltid håller bilder laddade
 * Förhindrar "blixtrande" genom att ha bilderna redo i browserns cache
 */
interface InvisibleImagePreloaderProps {
  urls: (string | null | undefined)[];
}

export function InvisibleImagePreloader({ urls }: InvisibleImagePreloaderProps) {
  const validUrls = urls.filter((url): url is string => !!url && url.trim() !== '');

  if (validUrls.length === 0) return null;

  return (
    <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none" aria-hidden="true">
      {validUrls.map((url, index) => (
        <img
          key={`${url}-${index}`}
          src={url}
          alt=""
          loading="eager"
          fetchPriority="high"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            opacity: 0
          }}
        />
      ))}
    </div>
  );
}

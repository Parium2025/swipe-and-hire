import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, MapPin, Search } from 'lucide-react';
import { useJobCounts, getJobCount } from '@/hooks/useJobCounts';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SeoTruncatedText } from '@/components/seo/SeoTruncateLink';
import { cn } from '@/lib/utils';

/**
 * Returnerar antal kolumner i griden enligt Tailwind-breakpoints
 * (sm = 640px → 2 kol, lg = 1024px → 3 kol, annars 1).
 * Används för att trimma item-listan så sista raden alltid är full
 * och vi aldrig får en ensam "hängande" länk på höger sida.
 */
const useGridColumns = (): number => {
  const [cols, setCols] = useState(1);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const compute = () => {
      const w = window.innerWidth;
      if (w >= 1024) setCols(3);
      else if (w >= 640) setCols(2);
      else setCols(1);
    };
    compute();
    window.addEventListener('resize', compute);
    return () => window.removeEventListener('resize', compute);
  }, []);
  return cols;
};

type Item = {
  slug: string;
  label: string;
  to: string;
  count?: number;
};

interface SeoFooterLinksProps {
  title: string;
  items: Item[];
  icon?: 'occupation' | 'city';
  fallbackTo?: string;
}

/**
 * Diskret länk-footer på SEO-sidor.
 *
 * - Aktiv länk visar antal jobb och leder till matchande SEO-sida.
 * - 0 jobb → inaktiverad chip + "Sök"-CTA till /auth.
 * - Kritvit text överallt. Tooltip på trunkerad label.
 * - Knappen ligger alltid på samma rad oavsett labellängd.
 */
const SeoFooterLinks = ({
  title,
  items,
  icon = 'occupation',
  fallbackTo = '/auth',
}: SeoFooterLinksProps) => {
  const Icon = icon === 'city' ? MapPin : Briefcase;

  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={100}>
    <section className="px-5 py-12 sm:px-8 md:px-12">
      <div className="mx-auto max-w-5xl">
        <h2 className="text-center text-xl font-semibold tracking-tight sm:text-2xl text-white">
          {title}
        </h2>
        <ul className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const count = item.count ?? 0;
            const hasJobs = count > 0;
            const countLabel = count === 1 ? '1 jobb' : `${count} jobb`;

            if (!hasJobs) {
              return (
                <li key={item.slug}>
                  <div
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] backdrop-blur-md px-4 py-3 text-sm'
                    )}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-white">
                      <Icon className="h-4 w-4 shrink-0 text-white" />
                      <SeoTruncatedText fullText={item.label} className="text-white">
                        {item.label}
                      </SeoTruncatedText>
                    </span>
                    <Link
                      to={fallbackTo}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/20 transition"
                      aria-label={`Sök ${item.label}`}
                    >
                      <Search className="h-3 w-3" /> Sök
                    </Link>
                  </div>
                </li>
              );
            }

            return (
              <li key={item.slug}>
                <Link
                  to={item.to}
                  aria-label={item.label}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.06] backdrop-blur-md px-4 py-3 text-sm text-white hover:bg-white/10 hover:border-white/20 transition"
                >
                  <span className="flex min-w-0 flex-1 items-center gap-2">
                    <Icon className="h-4 w-4 text-white shrink-0" />
                    <SeoTruncatedText fullText={item.label} className="text-white">
                      {item.label}
                    </SeoTruncatedText>
                  </span>
                  <span className="shrink-0 rounded-full bg-secondary/20 text-white px-2 py-0.5 text-[11px] font-semibold">
                    {countLabel}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
    </TooltipProvider>
  );
};

/** Wrapper: bygger items för "andra yrken i en stad". */
export const SeoOtherOccupationsInCity = ({
  citySlug,
  cityName,
  cityInForm,
  currentOccupationSlug,
  occupations,
  limit = 9,
}: {
  citySlug: string;
  cityName: string;
  cityInForm: string;
  currentOccupationSlug?: string;
  occupations: { slug: string; name: string }[];
  limit?: number;
}) => {
  const { data } = useJobCounts();
  const items: Item[] = occupations
    .filter((o) => o.slug !== currentOccupationSlug)
    .map((o) => ({
      slug: o.slug,
      label: `${o.name} ${cityInForm}`,
      to: `/jobb/${citySlug}/${o.slug}`,
      count: getJobCount(data, { citySlug, occupationSlug: o.slug }),
    }))
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, limit);

  return (
    <SeoFooterLinks
      title={`Andra lediga jobb ${cityInForm}`}
      items={items}
      icon="occupation"
    />
  );
};

/** Wrapper: bygger items för "samma yrke i andra städer". */
export const SeoOccupationInOtherCities = ({
  occupationSlug,
  occupationName,
  currentCitySlug,
  cities,
  limit = 9,
}: {
  occupationSlug: string;
  occupationName: string;
  currentCitySlug?: string;
  cities: { slug: string; name: string }[];
  limit?: number;
}) => {
  const { data } = useJobCounts();
  const items: Item[] = cities
    .filter((c) => c.slug !== currentCitySlug)
    .map((c) => ({
      slug: c.slug,
      label: `${occupationName} i ${c.name}`,
      to: `/jobb/${c.slug}/${occupationSlug}`,
      count: getJobCount(data, { citySlug: c.slug, occupationSlug }),
    }))
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, limit);

  return (
    <SeoFooterLinks
      title={`${occupationName}jobb i andra städer`}
      items={items}
      icon="city"
    />
  );
};

export default SeoFooterLinks;

import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight } from 'lucide-react';

interface SeoEmptyResultCTAProps {
  query: string;
  /** "yrke" | "stad" | "kommun" — vad användaren sökte efter. */
  kind?: 'yrke' | 'stad' | 'kommun';
  className?: string;
}

/**
 * Tomt sökresultat → konverterings-CTA istället för en grå tom-state.
 *
 * Vi tappar aldrig leadet: även när användaren söker på något vi inte
 * har en sida för, fångar vi dem med "Skapa profil → vi matchar dig
 * när jobbet dyker upp". Routar till /auth.
 */
const SeoEmptyResultCTA = ({
  query,
  kind = 'yrke',
  className = '',
}: SeoEmptyResultCTAProps) => {
  const noun = kind === 'yrke' ? 'yrke' : kind === 'stad' ? 'stad' : 'kommun';

  return (
    <div
      className={`rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-md p-6 sm:p-8 text-center ${className}`}
      role="status"
    >
      <div className="mx-auto mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
        <Sparkles className="h-5 w-5 text-white" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-white sm:text-lg">
        Hittade du inte ditt {noun}?
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-white">
        {query
          ? `Inga sidor matchar "${query}" — men vi har förmodligen jobbet ändå.`
          : 'Vi har förmodligen jobbet ändå.'}{' '}
        Skapa din profil så matchar vi dig direkt när rätt arbetsgivare lägger ut sitt nästa jobb.
      </p>
      <Link
        to="/auth"
        className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[hsl(215_100%_12%)] hover:bg-white/90 transition-colors"
      >
        Skapa profil gratis
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
};

export default SeoEmptyResultCTA;

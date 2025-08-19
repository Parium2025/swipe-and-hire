import React from 'react';
import { Heart, X } from 'lucide-react';

interface JobAdCardProps {
  imageUrl?: string;
  imageAlt?: string;
  title: string;
  company: string;
  location: string;
  matchScore?: number;
  tags?: string[];
  salary?: string;
  onLike?: () => void;
  onNope?: () => void;
  onSuperLike?: () => void; // kept for API compatibility
  onRewind?: () => void; // kept for API compatibility
}

const JobAdCard: React.FC<JobAdCardProps> = ({
  imageUrl,
  imageAlt,
  title,
  company,
  location,
  matchScore,
  // tags = [], // not shown in this style
  // salary, // not shown in this style
  onLike,
  onNope,
}) => {
  return (
    <section aria-label="Jobbannonskort" className="relative w-72 sm:w-80 h-[440px] mx-auto">
      <div className="relative w-full h-full rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-slate-900">
        {/* Bakgrundsbild */}
        {imageUrl ? (
          <img
            loading="lazy"
            src={imageUrl}
            alt={imageAlt || `${title} hos ${company}`}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        )}

        {/* Överlägg för läsbarhet */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Match-badge */}
        {typeof matchScore === 'number' && (
          <div className="absolute top-4 right-4 bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full shadow-lg">
            {matchScore}% match
          </div>
        )}

        {/* Innehåll i nederkant */}
        <div className="absolute inset-x-0 bottom-0 p-6 text-white">
          <h3 className="text-2xl font-bold leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
            {title}
          </h3>
          <div className="mt-1 text-white/90 text-base drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]">{company}</div>
          <div className="text-white/75 text-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.4)]">{location}</div>

          {/* Knappar */}
          <div className="mt-5 flex items-center justify-between">
            <button
              aria-label="Nej tack"
              onClick={onNope}
              className="w-12 h-12 rounded-full bg-red-500 shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="h-6 w-6 text-white" />
            </button>
            <button
              aria-label="Gilla jobbet"
              onClick={onLike}
              className="w-12 h-12 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-colors"
            >
              <Heart className="h-6 w-6 text-white fill-white" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JobAdCard;

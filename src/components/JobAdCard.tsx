import React from 'react';
import { Heart, Star, X, RotateCcw } from 'lucide-react';

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
  onSuperLike?: () => void;
  onRewind?: () => void;
}

const JobAdCard: React.FC<JobAdCardProps> = ({
  imageUrl,
  imageAlt,
  title,
  company,
  location,
  matchScore,
  tags = [],
  salary,
  onLike,
  onNope,
  onSuperLike,
  onRewind,
}) => {
  return (
    <section aria-label="Jobbannonskort" className="relative w-[340px] sm:w-[360px] mx-auto">
      {/* Kort */}
      <article className="rounded-[1.75rem] overflow-hidden bg-primary-foreground text-primary shadow-2xl border border-primary/15">
        {/* Bild / header */}
        <div className="h-72 w-full overflow-hidden">
          {imageUrl ? (
            <img
              loading="lazy"
              src={imageUrl}
              alt={imageAlt || `${title} hos ${company}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full relative">
              <div className="absolute inset-0 bg-gradient-to-b from-primary/25 via-primary/15 to-primary/35" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary))/0.18,transparent_60%)]" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold leading-tight">{title}</h3>
              <div className="mt-1 text-sm text-primary/70 flex items-center gap-2">
                <span>{company}</span>
                <span className="w-1 h-1 rounded-full bg-primary/40" />
                <span>{location}</span>
              </div>
            </div>
            {typeof matchScore === 'number' && (
              <span className="text-[11px] font-semibold px-2 py-1 rounded-full border bg-accent/15 text-accent border-accent/30">
                {matchScore}% match
              </span>
            )}
          </div>

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {salary && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-primary/60">Månadslön</span>
              <span className="text-primary font-semibold">{salary}</span>
            </div>
          )}
        </div>
      </article>

      {/* Åtgärdsknappar */}
      <div className="mt-5 flex items-center justify-center gap-4">
        <button
          aria-label="Ångra"
          onClick={onRewind}
          className="w-14 h-14 rounded-full bg-primary-foreground text-primary border border-primary/25 shadow-lg hover-scale focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <RotateCcw className="h-6 w-6" />
        </button>
        <button
          aria-label="Nej"
          onClick={onNope}
          className="w-16 h-16 rounded-full bg-primary-foreground text-destructive border border-destructive/30 shadow-xl hover-scale focus:outline-none focus:ring-2 focus:ring-destructive/30"
        >
          <X className="h-7 w-7" />
        </button>
        <button
          aria-label="Gilla"
          onClick={onLike}
          className="w-20 h-20 rounded-full bg-accent text-accent-foreground shadow-[0_15px_30px_-10px_hsl(var(--accent)/0.35)] hover-scale focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <Heart className="h-8 w-8 fill-current" />
        </button>
        <button
          aria-label="Superlike"
          onClick={onSuperLike}
          className="w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-xl hover-scale focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <Star className="h-7 w-7" />
        </button>
      </div>
    </section>
  );
};

export default JobAdCard;

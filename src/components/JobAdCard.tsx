import React from 'react';
import { Heart, X } from 'lucide-react';

interface JobAdCardProps {
  imageUrl?: string;
  imageAlt?: string;
  title: string;
  company: string;
  location: string;
  matchScore?: number; // kept for API compatibility, not shown in this style
  tags?: string[]; // kept for API compatibility
  salary?: string; // kept for API compatibility
  onLike?: () => void;
  onNope?: () => void;
  onSuperLike?: () => void; // kept for API compatibility
  onRewind?: () => void; // kept for API compatibility
}

const JobAdCard: React.FC<JobAdCardProps> = ({
  imageUrl = "/src/assets/office-building.jpg",
  imageAlt,
  title = "Frontend Developer",
  company = "Clarity",
  location = "Stockholm • Heltid",
  onLike,
  onNope,
}) => {
  return (
    <section aria-label="Jobbannonskort" className="relative w-[140px] h-[280px] mx-auto">
      {/* Telefonram */}
      <div className="relative w-full h-full rounded-[1.2rem] bg-slate-950 p-0.5 shadow-2xl ring-1 ring-black/30">
        {/* Skärm */}
        <div className="relative w-full h-full rounded-[0.9rem] overflow-hidden bg-black">
          {/* Notch/status */}
          <div className="absolute top-0.5 left-1/2 -translate-x-1/2 z-20 h-0.5 w-6 rounded-full bg-black/60 border border-white/10"></div>

          {/* Bakgrundsbild */}
          {imageUrl ? (
            <img
              loading="lazy"
              src={imageUrl}
              alt={imageAlt || `${title} hos ${company}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800" />
          )}

          {/* Nedre gradient för läsbarhet */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/85 via-black/45 to-transparent" />

          {/* Textinnehåll - centrerat */}
          <div className="absolute inset-0 flex flex-col justify-center items-center p-2 text-white text-center">
            <h3 className="text-base font-extrabold leading-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
              {title}
            </h3>
            <div className="mt-1 text-white/95 text-sm drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">{company}</div>
            <div className="text-white/80 text-xs drop-shadow-[0_1px_3px_rgba(0,0,0,0.45)]">{location.replace(/\s*OK\s*$/, '')}</div>
          </div>

          {/* Handlingsknappar */}
          <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-3">
            <button
              aria-label="Nej tack"
              onClick={onNope}
              className="w-8 h-8 rounded-full bg-red-500 shadow-lg flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="h-4 w-4 text-white" />
            </button>
            <button
              aria-label="Gilla jobbet"
              onClick={onLike}
              className="w-8 h-8 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center hover:bg-emerald-600 transition-colors"
            >
              <Heart className="h-4 w-4 text-white fill-white" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JobAdCard;

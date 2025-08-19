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
    <section aria-label="Jobbannonskort" className="relative w-[300px] sm:w-[320px] mx-auto">
      {/* Huvudkort */}
      <article className="rounded-[2rem] overflow-hidden bg-white shadow-[0_20px_40px_-10px_rgba(0,0,0,0.15)] border border-gray-100">
        {/* Bildsektion */}
        <div className="h-[400px] w-full relative overflow-hidden bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
          {imageUrl ? (
            <img
              loading="lazy"
              src={imageUrl}
              alt={imageAlt || `${title} hos ${company}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              {/* Modern gradient bakgrund */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
              
              {/* Dekorativa element */}
              <div className="absolute top-8 right-8 w-3 h-3 bg-white/30 rounded-full animate-pulse" />
              <div className="absolute top-16 right-12 w-2 h-2 bg-white/20 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
              <div className="absolute top-12 right-20 w-1.5 h-1.5 bg-white/25 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
            </>
          )}
          
          {/* Match-badge */}
          {typeof matchScore === 'number' && (
            <div className="absolute top-6 right-6 bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
              {matchScore}% match
            </div>
          )}
          
          {/* Bottom overlay för bättre läsbarhet */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/40 via-black/20 to-transparent" />
        </div>

        {/* Info-sektion */}
        <div className="relative p-6 bg-white">
          {/* Huvud-info */}
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900 leading-tight">{title}</h3>
            <div className="flex items-center text-gray-600 text-sm space-x-2">
              <span className="font-medium">{company}</span>
              <span className="w-1 h-1 rounded-full bg-gray-400" />
              <span>{location}</span>
            </div>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Lön */}
          {salary && (
            <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <span className="text-sm text-gray-600 font-medium">Månadslön</span>
              <span className="text-lg font-bold text-gray-900">{salary}</span>
            </div>
          )}
        </div>
      </article>

      {/* Åtgärdsknappar - Tinder-stil */}
      <div className="mt-6 flex items-center justify-center gap-4">
        <button
          aria-label="Ångra"
          onClick={onRewind}
          className="w-14 h-14 rounded-full bg-white text-gray-600 border-2 border-gray-200 shadow-lg hover:scale-110 hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-gray-300"
        >
          <RotateCcw className="h-5 w-5 mx-auto" />
        </button>
        
        <button
          aria-label="Nej tack"
          onClick={onNope}
          className="w-16 h-16 rounded-full bg-white text-red-500 border-2 border-red-200 shadow-lg hover:scale-110 hover:shadow-xl hover:bg-red-50 transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-red-300"
        >
          <X className="h-6 w-6 mx-auto stroke-[2.5]" />
        </button>
        
        <button
          aria-label="Gilla jobbet"
          onClick={onLike}
          className="w-20 h-20 rounded-full bg-emerald-500 text-white shadow-[0_8px_25px_-5px_rgba(16,185,129,0.4)] hover:scale-110 hover:shadow-[0_12px_35px_-5px_rgba(16,185,129,0.5)] hover:bg-emerald-600 transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-emerald-300"
        >
          <Heart className="h-7 w-7 mx-auto fill-current" />
        </button>
        
        <button
          aria-label="Superlike"
          onClick={onSuperLike}
          className="w-16 h-16 rounded-full bg-white text-blue-500 border-2 border-blue-200 shadow-lg hover:scale-110 hover:shadow-xl hover:bg-blue-50 transition-all duration-200 focus:outline-none focus:ring-3 focus:ring-blue-300"
        >
          <Star className="h-6 w-6 mx-auto fill-current" />
        </button>
      </div>
    </section>
  );
};

export default JobAdCard;

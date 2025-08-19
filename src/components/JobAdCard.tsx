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
    <section aria-label="Jobbannonskort" className="relative w-full max-w-xs mx-auto">
      {/* Telefon mockup */}
      <div className="relative">
        <div className="w-48 h-80 bg-slate-900 rounded-[2rem] p-1.5 shadow-2xl mx-auto">
          {/* Telefon skärm */}
          <div className="w-full h-full rounded-[1.5rem] overflow-hidden relative bg-white">
            
            {/* Status bar */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
              <div className="flex items-center space-x-1 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-full">
                <span className="w-1 h-1 rounded-full bg-white" />
                <span className="w-1 h-1 rounded-full bg-white/40" />
                <span className="w-1 h-1 rounded-full bg-white/40" />
              </div>
            </div>

            {/* Jobbannons innehåll */}
            <div className="absolute inset-0">
              {/* Bakgrundsbild/gradient */}
              <div className="h-3/5 w-full relative overflow-hidden">
                {imageUrl ? (
                  <img
                    loading="lazy"
                    src={imageUrl}
                    alt={imageAlt || `${title} hos ${company}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                  </>
                )}
                
                {/* Match badge */}
                {typeof matchScore === 'number' && (
                  <div className="absolute top-3 right-2 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                    {matchScore}% match
                  </div>
                )}
              </div>

              {/* Info kort */}
              <div className="absolute bottom-12 left-2 right-2">
                <div className="bg-white/95 backdrop-blur-md rounded-xl p-2.5 shadow-xl border border-white/20">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-gray-900 leading-tight">{title}</h3>
                    <div className="flex items-center text-gray-600 text-[10px] space-x-1">
                      <span className="font-medium">{company}</span>
                      <span className="w-0.5 h-0.5 rounded-full bg-gray-400" />
                      <span>{location}</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[8px] font-medium rounded border border-blue-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Lön */}
                  {salary && (
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[9px] text-gray-600">Månadslön</span>
                      <span className="text-sm font-bold text-gray-900">{salary}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Swipe knappar */}
              <div className="absolute bottom-3 left-0 right-0">
                <div className="flex items-center justify-center space-x-2">
                  <button
                    aria-label="Nej tack"
                    onClick={onNope}
                    className="w-8 h-8 rounded-full bg-white shadow-lg border border-red-200 flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <X className="h-3.5 w-3.5 text-red-500 stroke-[2.5]" />
                  </button>
                  <button
                    aria-label="Gilla jobbet"
                    onClick={onLike}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <Heart className="h-4 w-4 text-white fill-white" />
                  </button>
                  <button
                    aria-label="Superlike"
                    onClick={onSuperLike}
                    className="w-8 h-8 rounded-full bg-white shadow-lg border border-blue-200 flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <Star className="h-3.5 w-3.5 text-blue-500 fill-current" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JobAdCard;
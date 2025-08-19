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
        <div className="w-64 h-[500px] bg-slate-900 rounded-[2.5rem] p-2 shadow-2xl mx-auto">
          {/* Telefon skärm */}
          <div className="w-full h-full rounded-[2rem] overflow-hidden relative bg-white">
            
            {/* Status bar */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
              <div className="flex items-center space-x-1.5 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
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
                  <div className="absolute top-6 right-4 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg">
                    {matchScore}% match
                  </div>
                )}
              </div>

              {/* Info kort */}
              <div className="absolute bottom-20 left-4 right-4">
                <div className="bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/20">
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-gray-900 leading-tight">{title}</h3>
                    <div className="flex items-center text-gray-600 text-sm space-x-2">
                      <span className="font-medium">{company}</span>
                      <span className="w-1 h-1 rounded-full bg-gray-400" />
                      <span>{location}</span>
                    </div>
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg border border-blue-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Lön */}
                  {salary && (
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-600">Månadslön</span>
                      <span className="text-lg font-bold text-gray-900">{salary}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Swipe knappar */}
              <div className="absolute bottom-5 left-0 right-0">
                <div className="flex items-center justify-center space-x-4">
                  <button
                    aria-label="Nej tack"
                    onClick={onNope}
                    className="w-14 h-14 rounded-full bg-white shadow-lg border-2 border-red-200 flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <X className="h-6 w-6 text-red-500 stroke-[2.5]" />
                  </button>
                  <button
                    aria-label="Gilla jobbet"
                    onClick={onLike}
                    className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 shadow-xl flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <Heart className="h-7 w-7 text-white fill-white" />
                  </button>
                  <button
                    aria-label="Superlike"
                    onClick={onSuperLike}
                    className="w-14 h-14 rounded-full bg-white shadow-lg border-2 border-blue-200 flex items-center justify-center hover:scale-105 transition-transform"
                  >
                    <Star className="h-6 w-6 text-blue-500 fill-current" />
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
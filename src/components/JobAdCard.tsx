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
    <section aria-label="Jobbannonskort" className="relative w-80 h-96 mx-auto">
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-2xl">
        {/* Bakgrundsbild/gradient */}
        <div className="absolute inset-0">
          {imageUrl ? (
            <img
              loading="lazy"
              src={imageUrl}
              alt={imageAlt || `${title} hos ${company}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          )}
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        </div>

        {/* Match badge */}
        {typeof matchScore === 'number' && (
          <div className="absolute top-4 right-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
            {matchScore}% match
          </div>
        )}

        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
          {/* Tags */}
          {tags.length > 0 && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-sm font-medium rounded-full border border-white/30"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Job title */}
          <h3 className="text-2xl font-bold mb-2 leading-tight">{title}</h3>

          {/* Company and location */}
          <div className="flex items-center text-white/90 text-sm mb-1">
            <span className="font-medium">{company}</span>
          </div>
          <div className="text-white/80 text-sm mb-4">{location}</div>

          {/* Salary */}
          {salary && (
            <div className="mb-6">
              <div className="text-xl font-bold">{salary}</div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-center space-x-4">
            <button
              aria-label="Nej tack"
              onClick={onNope}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:scale-105 transition-transform hover:bg-red-500/20"
            >
              <X className="h-5 w-5 text-white stroke-[2]" />
            </button>
            <button
              aria-label="Gilla jobbet"
              onClick={onLike}
              className="w-14 h-14 rounded-full bg-emerald-500 shadow-xl flex items-center justify-center hover:scale-105 transition-transform hover:bg-emerald-600"
            >
              <Heart className="h-6 w-6 text-white fill-white" />
            </button>
            <button
              aria-label="Superlike"
              onClick={onSuperLike}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:scale-105 transition-transform hover:bg-blue-500/20"
            >
              <Star className="h-5 w-5 text-white fill-current" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default JobAdCard;
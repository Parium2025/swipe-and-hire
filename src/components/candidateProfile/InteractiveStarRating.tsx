import { useState } from 'react';
import { Star } from 'lucide-react';

interface InteractiveStarRatingProps {
  rating?: number;
  maxStars?: number;
  onChange?: (rating: number) => void;
}

export const InteractiveStarRating = ({
  rating = 0,
  maxStars = 5,
  onChange,
}: InteractiveStarRatingProps) => {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const handleClick = (e: React.MouseEvent, starIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (onChange) {
      const newRating = starIndex + 1 === rating ? 0 : starIndex + 1;
      onChange(newRating);
    }
  };

  const displayRating = hoverRating !== null ? hoverRating : rating;

  return (
    <div
      className="flex gap-1 justify-center"
      onMouseLeave={() => setHoverRating(null)}
    >
      {Array.from({ length: maxStars }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={(e) => handleClick(e, i)}
          onMouseEnter={(e) => {
            e.stopPropagation();
            if (onChange) setHoverRating(i + 1);
          }}
          className="p-0.5 focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`h-5 w-5 transition-colors ${
              i < displayRating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-white/30 hover:text-yellow-400/50'
            }`}
          />
        </button>
      ))}
    </div>
  );
};

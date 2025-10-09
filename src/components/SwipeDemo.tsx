import { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion';
import { Heart, X, Briefcase, MapPin, Clock } from 'lucide-react';

interface JobCard {
  id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  image: string;
}

const mockJobs: JobCard[] = [
  {
    id: 1,
    title: 'Frontend Developer',
    company: 'TechCorp AB',
    location: 'Stockholm',
    type: 'Heltid',
    image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=500&fit=crop'
  },
  {
    id: 2,
    title: 'UX Designer',
    company: 'Design Studio',
    location: 'Göteborg',
    type: 'Heltid',
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=500&fit=crop'
  },
  {
    id: 3,
    title: 'Backend Developer',
    company: 'CodeBase Inc',
    location: 'Malmö',
    type: 'Heltid',
    image: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=400&h=500&fit=crop'
  },
  {
    id: 4,
    title: 'Product Manager',
    company: 'StartUp Co',
    location: 'Uppsala',
    type: 'Heltid',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=500&fit=crop'
  }
];

export const SwipeDemo = () => {
  const [cards, setCards] = useState(mockJobs);
  const [showConfetti, setShowConfetti] = useState(false);
  const [matchCount, setMatchCount] = useState(0);

  const removeCard = (id: number, direction: 'left' | 'right') => {
    setCards(prev => prev.filter(card => card.id !== id));
    
    if (direction === 'right') {
      setShowConfetti(true);
      setMatchCount(prev => prev + 1);
      setTimeout(() => setShowConfetti(false), 1000);
    }

    // Reset cards when empty
    if (cards.length === 1) {
      setTimeout(() => setCards(mockJobs), 500);
    }
  };

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="relative h-[500px]">
        <AnimatePresence>
          {cards.map((card, index) => (
            <SwipeCard
              key={card.id}
              card={card}
              index={index}
              onSwipe={removeCard}
              isTop={index === cards.length - 1}
              totalCards={cards.length}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Match Counter */}
      <motion.div
        className="mt-6 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
          <Heart className="w-5 h-5 text-secondary fill-secondary" />
          <span className="text-white font-semibold">
            {matchCount} Matchningar
          </span>
        </div>
      </motion.div>

      {/* Confetti Effect */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-secondary rounded-full"
              initial={{
                x: '50%',
                y: '50%',
                scale: 0
              }}
              animate={{
                x: `${50 + (Math.random() - 0.5) * 100}%`,
                y: `${50 + (Math.random() - 0.5) * 100}%`,
                scale: [0, 1, 0],
                opacity: [0, 1, 0]
              }}
              transition={{
                duration: 0.8,
                delay: i * 0.02
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SwipeCard = ({ 
  card, 
  index, 
  onSwipe, 
  isTop,
  totalCards
}: { 
  card: JobCard; 
  index: number; 
  onSwipe: (id: number, direction: 'left' | 'right') => void;
  isTop: boolean;
  totalCards: number;
}) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  const handleDragEnd = (event: any, info: any) => {
    if (Math.abs(info.offset.x) > 100) {
      const direction = info.offset.x > 0 ? 'right' : 'left';
      onSwipe(card.id, direction);
    }
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab active:cursor-grabbing"
      style={{
        x,
        rotate,
        opacity,
        zIndex: index,
      }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95 - index * 0.05, y: index * 10 }}
      animate={{ 
        scale: isTop ? 1 : 0.95 - (totalCards - index - 1) * 0.05, 
        y: isTop ? 0 : (totalCards - index - 1) * 10 
      }}
      exit={{ x: x.get() > 0 ? 300 : -300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <div className="relative w-full h-full bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 overflow-hidden shadow-2xl">
        {/* Image */}
        <div className="h-64 overflow-hidden">
          <img 
            src={card.image} 
            alt={card.title}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-2xl font-bold text-white mb-1">
              {card.title}
            </h3>
            <p className="text-white/70 text-lg">
              {card.company}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 text-white/80">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">{card.location}</span>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{card.type}</span>
            </div>
          </div>
        </div>

        {/* Swipe Indicators */}
        <motion.div
          className="absolute top-8 right-8 text-secondary font-bold text-4xl border-4 border-secondary rounded-xl px-6 py-2 rotate-12"
          style={{ opacity: useTransform(x, [0, 100], [0, 1]) }}
        >
          MATCH!
        </motion.div>
        <motion.div
          className="absolute top-8 left-8 text-destructive font-bold text-4xl border-4 border-destructive rounded-xl px-6 py-2 -rotate-12"
          style={{ opacity: useTransform(x, [-100, 0], [1, 0]) }}
        >
          NOPE
        </motion.div>
      </div>
    </motion.div>
  );
};

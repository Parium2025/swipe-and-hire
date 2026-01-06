import { memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Cpu, 
  TrendingUp, 
  Users, 
  Globe,
  Newspaper,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useHrNews, HrNewsItem } from '@/hooks/useHrNews';

// Map icon names to components
const iconMap: Record<string, React.ElementType> = {
  Cpu,
  TrendingUp,
  Users,
  Globe,
  Newspaper,
  Sparkles,
};

// Default gradients if not specified - order: green, blue, purple, orange (top-to-bottom, left-to-right)
const defaultGradients = [
  'from-emerald-500/90 via-emerald-600/80 to-teal-700/90',
  'from-amber-500/90 via-orange-500/80 to-orange-600/90',
  'from-blue-500/90 via-blue-600/80 to-indigo-700/90',
  'from-violet-500/90 via-purple-600/80 to-purple-700/90',
];

interface NewsCardProps {
  news: HrNewsItem;
  index: number;
}

const NewsCard = memo(({ news, index }: NewsCardProps) => {
  const Icon = iconMap[news.icon_name || ''] || Newspaper;
  const gradient = news.gradient || defaultGradients[index % 4];

  const handleClick = () => {
    if (news.source_url) {
      window.open(news.source_url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.1 + index * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group"
    >
      <Card 
        className={`relative overflow-hidden bg-gradient-to-br ${gradient} border-0 shadow-lg transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-xl ${news.source_url ? 'cursor-pointer' : ''} h-full`}
        onClick={handleClick}
      >
        {/* Glass overlay */}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
        
        {/* Decorative elements */}
        <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
        
        <CardContent className="relative p-5 flex flex-col h-full min-h-[160px]">
          {/* Icon and source */}
          <div className="flex items-center justify-between mb-3">
            <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm transition-all duration-300 group-hover:bg-white/20 group-hover:scale-110">
              <Icon className="h-5 w-5 text-white" strokeWidth={1.5} />
            </div>
            <div className="flex items-center gap-1.5">
              {news.source_url ? (
                <span className="text-[10px] text-emerald-300/80 font-medium uppercase tracking-wider">Källa</span>
              ) : (
                <span className="text-[10px] text-amber-300/80 font-medium uppercase tracking-wider">AI</span>
              )}
              <span className="text-xs text-white/70 font-medium">{news.source}</span>
            </div>
          </div>
          
          {/* Title */}
          <h3 className="text-base font-semibold text-white mb-2 leading-tight line-clamp-2">
            {news.title}
          </h3>
          
          {/* Summary */}
          <p className="text-sm text-white/70 flex-1 line-clamp-2">
            {news.summary}
          </p>
          
          {/* Link indicator if clickable */}
          {news.source_url && (
            <div className="flex items-center gap-1 mt-3 text-white/40 group-hover:text-white/80 transition-colors">
              <span className="text-xs font-medium">Läs mer</span>
              <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
});

NewsCard.displayName = 'NewsCard';

const LoadingSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
    {[0, 1, 2, 3].map((i) => (
      <Card key={i} className="bg-white/5 border-white/10">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-10 rounded-xl bg-white/10" />
            <Skeleton className="h-3 w-16 bg-white/10" />
          </div>
          <Skeleton className="h-5 w-full bg-white/10" />
          <Skeleton className="h-4 w-3/4 bg-white/10" />
          <Skeleton className="h-4 w-1/2 bg-white/10" />
        </CardContent>
      </Card>
    ))}
  </div>
);

export const HrNewsCards = memo(() => {
  const { data: news, isLoading, error } = useHrNews();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2"
        >
          <Sparkles className="h-5 w-5 text-white/60" />
          <h2 className="text-lg font-semibold text-white/80">Nytt inom rekrytering idag</h2>
        </motion.div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !news || news.length === 0) {
    return null; // Silently fail - don't show anything if news fails
  }

  return (
    <div className="space-y-4">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex items-center gap-2"
      >
        <Sparkles className="h-5 w-5 text-secondary" />
        <h2 className="text-lg font-semibold text-white">Nytt inom rekrytering idag</h2>
      </motion.div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
        {news.slice(0, 4).map((item, index) => (
          <NewsCard key={item.id} news={item} index={index} />
        ))}
      </div>
    </div>
  );
});

HrNewsCards.displayName = 'HrNewsCards';

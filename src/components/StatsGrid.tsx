import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { memo } from 'react';

interface SubItem {
  label: string;
  value: number;
  /** Unique key for persisting the last known value across page loads */
  cacheKey?: string;
}

interface StatCard {
  icon: LucideIcon;
  title: string;
  value: number | string;
  loading?: boolean;
  subItems?: SubItem[];
  /** Unique key for persisting the last known value across page loads */
  cacheKey?: string;
}

interface StatsGridProps {
  stats: StatCard[];
}

export const StatsGrid = memo(({ stats }: StatsGridProps) => {
  const hasMultiColumnCard = stats.some(s => s.subItems && s.subItems.length > 0);
  
  // Split cards into multi-column (subItems) and regular for mobile layout
  const multiColCards = stats.filter(s => s.subItems && s.subItems.length > 0);
  const regularCards = stats.filter(s => !s.subItems || s.subItems.length === 0);
  
  const renderCard = (stat: StatCard, index: number, spanClass = '') => (
    <Card key={index} className={`bg-white/5 backdrop-blur-sm border-white/20 ${spanClass}`}>
      {stat.subItems && stat.subItems.length > 0 ? (
        <div className="flex h-full">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center justify-center p-1 sm:p-1.5 md:p-3 min-h-[28px] sm:min-h-[32px] md:min-h-[40px]">
              <span className="text-[10px] sm:text-xs md:text-sm font-medium text-green-400 whitespace-nowrap truncate">
                {stat.title}
              </span>
            </div>
            <div className="px-1 pb-1 sm:px-1.5 sm:pb-1.5 md:px-3 md:pb-3">
              <div 
                className="text-sm sm:text-base md:text-xl font-bold text-center transition-opacity duration-500 flex justify-center text-green-400"
                style={{ opacity: stat.loading ? 0.5 : 1 }}
              >
                {typeof stat.value === 'number' ? (
                  <AnimatedCounter value={stat.value} className="text-sm sm:text-base md:text-xl font-bold" cacheKey={stat.cacheKey} />
                ) : stat.value}
              </div>
            </div>
          </div>
          {stat.subItems.map((item, idx) => {
            const colorClass = idx === 0 ? 'text-red-400' : 'text-amber-400';
            return (
              <div key={idx} className="flex-1 flex flex-col border-l border-white/30 min-w-0">
                <div className="flex items-center justify-center p-1 sm:p-1.5 md:p-3 min-h-[28px] sm:min-h-[32px] md:min-h-[40px]">
                  <span className={`text-[10px] sm:text-xs md:text-sm font-medium whitespace-nowrap truncate ${colorClass}`}>
                    {item.label}
                  </span>
                </div>
                <div className="px-1 pb-1 sm:px-1.5 sm:pb-1.5 md:px-3 md:pb-3">
                  <div className={`text-sm sm:text-base md:text-xl font-bold text-center flex justify-center ${colorClass}`}>
                    <AnimatedCounter value={item.value} className="text-sm sm:text-base md:text-xl font-bold" cacheKey={item.cacheKey} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <CardHeader className="flex flex-row items-center justify-center gap-1 md:gap-2 space-y-0 p-1.5 sm:p-2 md:p-3 min-w-0 min-h-[28px] sm:min-h-[32px] md:min-h-[40px]">
            <stat.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4 text-white flex-shrink-0" />
            <span className="text-[10px] sm:text-xs md:text-sm font-medium text-white whitespace-nowrap truncate">
              {stat.title}
            </span>
          </CardHeader>
          <CardContent className="px-1.5 pb-1.5 sm:px-2 sm:pb-2 md:px-3 md:pb-3">
            <div 
              className="text-sm sm:text-base md:text-xl font-bold text-white text-center transition-opacity duration-500 flex justify-center"
              style={{ opacity: stat.loading ? 0.5 : 1 }}
            >
              {typeof stat.value === 'number' ? (
                <AnimatedCounter value={stat.value} className="text-sm sm:text-base md:text-xl font-bold" cacheKey={stat.cacheKey} />
              ) : stat.value}
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );

  if (hasMultiColumnCard) {
    return (
      <>
        {/* Desktop: single row with 5 columns */}
        <div className="hidden md:grid md:grid-cols-5 gap-2">
          {stats.map((stat, i) => renderCard(stat, i, stat.subItems && stat.subItems.length > 0 ? 'col-span-2' : ''))}
        </div>
        {/* Mobile: Aktiva/Utgångna full width, then 3 cards in one row below */}
        <div className="md:hidden space-y-2">
          {multiColCards.map((stat, i) => renderCard(stat, i))}
          <div className="grid grid-cols-3 gap-2">
            {regularCards.map((stat, i) => renderCard(stat, i + multiColCards.length))}
          </div>
        </div>
      </>
    );
  }

  const colsClass = stats.length === 4 ? 'grid-cols-4' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-5';
  return (
    <div className={`grid ${colsClass} gap-2`}>
      {stats.map((stat, i) => renderCard(stat, i))}
    </div>
  );
}, (prevProps, nextProps) => {
  if (prevProps.stats.length !== nextProps.stats.length) return false;
  return prevProps.stats.every((stat, index) => {
    const nextStat = nextProps.stats[index];
    const subItemsEqual = JSON.stringify(stat.subItems) === JSON.stringify(nextStat.subItems);
    return stat.value === nextStat.value && stat.title === nextStat.title && stat.loading === nextStat.loading && subItemsEqual;
  });
});

StatsGrid.displayName = 'StatsGrid';
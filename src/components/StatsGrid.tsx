import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';
import { AnimatedCounter } from '@/components/AnimatedCounter';
import { memo } from 'react';

interface SubItem {
  label: string;
  value: number;
}

interface StatCard {
  icon: LucideIcon;
  title: string;
  value: number | string;
  loading?: boolean;
  subItems?: SubItem[];
}

interface StatsGridProps {
  stats: StatCard[];
}

export const StatsGrid = memo(({ stats }: StatsGridProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-1.5 md:gap-2">
      {stats.map((stat, index) => {
        // Cards with subItems need more space
        const hasSubItems = stat.subItems && stat.subItems.length > 0;
        const spanClass = hasSubItems ? 'col-span-2' : '';
        
        return (
        <Card key={index} className={`bg-white/5 backdrop-blur-sm border-white/20 ${spanClass}`}>
          {stat.subItems && stat.subItems.length > 0 ? (
            // Special layout for cards with subItems - full height dividers, matching standard card height
            <div className="flex h-full">
              {/* First column - main stat */}
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-center gap-1 md:gap-2 p-2 md:p-4 min-h-[36px] md:min-h-[40px]">
                  <stat.icon className="h-3 w-3 md:h-4 md:w-4 text-white flex-shrink-0" />
                  <span className="text-xs md:text-sm font-medium text-white whitespace-nowrap">
                    {stat.title}
                  </span>
                </div>
                <div className="px-2 pb-2 md:px-4 md:pb-4">
                  <div 
                    className="text-lg md:text-xl font-bold text-white text-center transition-opacity duration-500 flex justify-center"
                    style={{ opacity: stat.loading ? 0.5 : 1 }}
                  >
                    {typeof stat.value === 'number' ? (
                      <AnimatedCounter value={stat.value} className="text-lg md:text-xl font-bold" />
                    ) : (
                      stat.value
                    )}
                  </div>
                </div>
              </div>
              
              {/* Sub-item columns with full-height dividers */}
              {stat.subItems.map((item, idx) => (
                <div key={idx} className="flex-1 flex flex-col border-l border-white/30">
                  <div className="flex items-center justify-center p-2 md:p-4 min-h-[36px] md:min-h-[40px]">
                    <span className="text-xs md:text-sm font-medium text-white whitespace-nowrap">
                      {item.label}
                    </span>
                  </div>
                  <div className="px-2 pb-2 md:px-4 md:pb-4">
                    <div className="text-lg md:text-xl font-bold text-white text-center flex justify-center">
                      <AnimatedCounter value={item.value} className="text-lg md:text-xl font-bold" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Standard layout for cards without subItems
            <>
              <CardHeader className="flex flex-row items-center justify-center gap-1 md:gap-2 space-y-0 p-2 md:p-4 min-w-0 min-h-[36px] md:min-h-[40px]">
                <stat.icon className="h-3 w-3 md:h-4 md:w-4 text-white flex-shrink-0" />
                <span className="text-xs md:text-sm font-medium text-white whitespace-nowrap">
                  {stat.title}
                </span>
              </CardHeader>
              <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
                <div 
                  className="text-lg md:text-xl font-bold text-white text-center transition-opacity duration-500 flex justify-center"
                  style={{ opacity: stat.loading ? 0.5 : 1 }}
                >
                  {typeof stat.value === 'number' ? (
                    <AnimatedCounter value={stat.value} className="text-lg md:text-xl font-bold" />
                  ) : (
                    stat.value
                  )}
                </div>
              </CardContent>
            </>
          )}
        </Card>
        );
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if stat values actually changed
  if (prevProps.stats.length !== nextProps.stats.length) return false;
  
  return prevProps.stats.every((stat, index) => {
    const nextStat = nextProps.stats[index];
    const subItemsEqual = JSON.stringify(stat.subItems) === JSON.stringify(nextStat.subItems);
    return stat.value === nextStat.value && 
           stat.title === nextStat.title && 
           stat.loading === nextStat.loading &&
           subItemsEqual;
  });
});

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { TruncatedText } from '@/components/TruncatedText';

interface StatCard {
  icon: LucideIcon;
  title: string;
  value: number | string;
  loading?: boolean;
}

interface StatsGridProps {
  stats: StatCard[];
}

export const StatsGrid = ({ stats }: StatsGridProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-1.5 md:gap-2">
      {stats.map((stat, index) => (
        <Card key={index} className="bg-white/5 backdrop-blur-sm border-white/20">
          <CardHeader className="flex flex-row items-center gap-1 md:gap-2 space-y-0 p-2 md:p-4 min-w-0 min-h-[36px] md:min-h-[40px]">
            <stat.icon className="h-3 w-3 md:h-4 md:w-4 text-white" />
            <CardTitle className="text-xs md:text-sm font-medium text-white min-w-0 flex-1 overflow-hidden">
              <TruncatedText 
                text={stat.title} 
                className="w-full block whitespace-nowrap truncate"
              />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-2 md:px-4 md:pb-4">
            <div className="text-lg md:text-xl font-bold text-white transition-all duration-300">
              {stat.loading ? '...' : stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

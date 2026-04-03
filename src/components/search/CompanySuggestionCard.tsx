import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building2, ChevronDown, Star, X } from 'lucide-react';

interface CompanySuggestionCardProps {
  company: {
    id: string;
    name: string;
    logo?: string;
    jobCount: number;
    avgRating?: number;
    reviewCount: number;
  };
  onOpenProfile: (companyId: string) => void;
  onRemove?: () => void;
}

export const CompanySuggestionCard = memo(function CompanySuggestionCard({
  company,
  onOpenProfile,
  onRemove,
}: CompanySuggestionCardProps) {
  return (
    <div className="relative">
      <button
        onClick={() => onOpenProfile(company.id)}
        className="w-full text-left"
      >
        <Card className="bg-white/5 border-white/20 transition-all duration-300 hover:bg-white/10 hover:border-white/30 cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12 flex-shrink-0">
                <AvatarImage src={company.logo || ''} alt={company.name} />
                <AvatarFallback className="bg-white/20 text-white text-lg font-bold" delayMs={150}>
                  {company.name.split(' ').map(word => word[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-white flex-shrink-0" />
                  <span className="text-xs text-white uppercase tracking-wide">Företag</span>
                </div>
                <h3 className="text-base font-semibold text-white truncate mt-1">
                  {company.name} - {company.jobCount} aktiv{company.jobCount !== 1 ? 'a' : 't'} jobb
                </h3>
                <div className="flex items-center gap-1 text-sm text-white flex-wrap">
                  <span>Se företagsprofil och recensioner</span>
                  {company.avgRating && company.reviewCount > 0 && (
                    <>
                      <span className="text-white/40">·</span>
                      <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                        {company.avgRating.toFixed(1)}
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        ({company.reviewCount})
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ChevronDown className="h-5 w-5 text-white -rotate-90 flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </button>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 active:scale-[0.95] touch-manipulation z-10 [@media(hover:hover)]:hover:bg-white/20 border border-white/15"
        >
          <X className="h-4 w-4 text-white" />
        </button>
      )}
    </div>
  );
});

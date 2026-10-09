import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Building2, ChevronDown, Star, X } from 'lucide-react';
import { getCompanyInitials } from '@/lib/companyInitials';
import { usePreparedCompanyLogo } from '@/hooks/usePreparedCompanyLogo';

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
  /** Uppgifterna är inte hämtade än — visa platshållare i stället för 0/initialer. */
  pending?: boolean;
}

export const CompanySuggestionCard = memo(function CompanySuggestionCard({
  company,
  onOpenProfile,
  onRemove,
  pending = false,
}: CompanySuggestionCardProps) {
  const logoUrl = usePreparedCompanyLogo(company.logo);
  return (
    <div className="relative">
      <button
        onClick={() => { if (!pending && company.id) onOpenProfile(company.id); }}
        aria-busy={pending || undefined}
        className="w-full text-left"
      >
        <Card className="bg-white/5 border-white/20 transition-all duration-300 hover:bg-white/10 hover:border-white/30 cursor-pointer">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {pending ? <div className="h-12 w-12 flex-shrink-0 rounded-full bg-white/15 animate-pulse" /> : <Avatar className="h-12 w-12 flex-shrink-0">
                <AvatarImage src={logoUrl || ''} alt={company.name} />
                <AvatarFallback fallbackType="company" className="bg-white/20 text-white text-lg font-bold" delayMs={150}>
                  {getCompanyInitials(company.name)}
                </AvatarFallback>
              </Avatar>}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-white flex-shrink-0" />
                  <span className="text-xs text-white uppercase tracking-wide">Företag</span>
                </div>
                <h3 className="text-base font-semibold text-white mt-1 min-w-0 break-words [overflow-wrap:anywhere] line-clamp-2">
                  {pending ? company.name : <>{company.name} - {company.jobCount} aktiv{company.jobCount !== 1 ? 'a' : 't'} jobb</>}
                </h3>
                <p className="text-sm text-white">Se företagsprofil och recensioner</p>
                {pending && <div className="mt-1 h-3.5 w-16 rounded bg-white/15 animate-pulse" />}
                {!pending && !!company.avgRating && company.reviewCount > 0 && (
                  <div className="mt-0.5 inline-flex items-center gap-0.5 whitespace-nowrap text-sm text-white">
                    {company.avgRating.toFixed(1)}
                    <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    ({company.reviewCount})
                  </div>
                )}
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

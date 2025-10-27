import { Badge } from '@/components/ui/badge';
import { Users, Clock, CheckCircle, XCircle, Briefcase } from 'lucide-react';

interface CandidatesFiltersProps {
  stats: {
    total: number;
    new: number;
    reviewing: number;
    accepted: number;
    rejected: number;
  };
  selectedFilter: string;
  onFilterChange: (filter: string) => void;
}

export const CandidatesFilters = ({ stats, selectedFilter, onFilterChange }: CandidatesFiltersProps) => {
  const filters = [
    { id: 'all', label: 'Alla kandidater', count: stats.total, icon: Users },
    { id: 'pending', label: 'Nya ansökningar', count: stats.new, icon: Briefcase },
    { id: 'reviewing', label: 'Under granskning', count: stats.reviewing, icon: Clock },
    { id: 'accepted', label: 'Accepterade', count: stats.accepted, icon: CheckCircle },
    { id: 'rejected', label: 'Avvisade', count: stats.rejected, icon: XCircle },
  ];

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">Segment</h3>
      {filters.map((filter) => {
        const Icon = filter.icon;
        const isSelected = selectedFilter === filter.id;
        
        return (
          <button
            key={filter.id}
            onClick={() => onFilterChange(filter.id)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
              isSelected
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4" />
              <span className="text-sm font-medium">{filter.label}</span>
            </div>
            <Badge 
              variant="outline" 
              className={isSelected ? 'bg-primary/30 text-primary border-primary/50' : 'bg-white/5 text-muted-foreground border-white/10'}
            >
              {filter.count}
            </Badge>
          </button>
        );
      })}
    </div>
  );
};

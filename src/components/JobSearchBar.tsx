import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

interface JobSearchBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  placeholder?: string;
}

export const JobSearchBar = ({
  searchInput,
  onSearchChange,
  sortBy,
  onSortChange,
  placeholder = "Sök efter titel, plats, anställningstyp...",
}: JobSearchBarProps) => {
  const sortLabels: Record<SortOption, string> = {
    newest: 'Nyast först',
    oldest: 'Äldst först',
    'title-asc': 'Titel A-Ö',
    'title-desc': 'Titel Ö-A',
  };

  return (
    <div className="flex flex-col md:flex-row gap-2">
      {/* Search field */}
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
        <Input
          placeholder={placeholder}
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10 min-h-[44px] bg-white/5 border-white/20 text-white placeholder:text-white/60"
        />
      </div>
      
      {/* Sort menu */}
      <DropdownMenu 
        onOpenChange={(open) => {
          if (!open) {
            // När dropdown stängs, ta bort fokus
            setTimeout(() => {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
            }, 0);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full md:w-auto md:min-w-[180px] bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10"
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {sortLabels[sortBy]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          {Object.entries(sortLabels).map(([key, label]) => (
            <DropdownMenuItem 
              key={key} 
              onClick={() => onSortChange(key as SortOption)}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

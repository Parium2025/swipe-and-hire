import { memo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown, UserCheck, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';


import type { SortOption } from '@/hooks/useJobFiltering';

export interface Recruiter {
  id: string;
  first_name: string;
  last_name: string;
}

interface JobSearchBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  placeholder?: string;
  companyName?: string;
  recruiters?: Recruiter[];
  selectedRecruiterId?: string | null;
  onRecruiterChange?: (recruiterId: string | null) => void;
  hasDrafts?: boolean;
}

export const JobSearchBar = memo(({
  searchInput,
  onSearchChange,
  sortBy,
  onSortChange,
  placeholder = "Sök efter titel, plats, anställningstyp...",
  companyName,
  recruiters = [],
  selectedRecruiterId,
  onRecruiterChange,
  hasDrafts = false,
}: JobSearchBarProps) => {
  const showRecruiterFilter = recruiters.length > 1;

  const sortLabels: Record<SortOption, string> = {
    newest: 'Nyast först',
    oldest: 'Äldst först',
    'title-asc': 'Titel A-Ö',
    'title-desc': 'Titel Ö-A',
    'active-first': 'Aktiv',
    'expired-first': 'Utgången',
    'draft-first': 'Utkast',
  };

  return (
    <>
      {/* Desktop: Full layout */}
      <div className="hidden md:flex md:flex-row gap-2">
        {/* Search field */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
          <Input
            placeholder={placeholder}
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 min-h-[44px] bg-white/5 border-white/20 hover:border-white/50 text-white placeholder:text-white"
          />
        </div>
        
        {/* Recruiter filter - only show if multiple recruiters */}
        {showRecruiterFilter && onRecruiterChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-auto min-w-[180px] bg-white/5 backdrop-blur-sm border-white/20 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white"
              >
                <UserCheck className="mr-2 h-4 w-4" />
                {selectedRecruiterId 
                  ? recruiters.find(r => r.id === selectedRecruiterId)
                    ? `${recruiters.find(r => r.id === selectedRecruiterId)!.first_name} ${recruiters.find(r => r.id === selectedRecruiterId)!.last_name}`
                    : 'Rekryterare'
                  : 'Alla rekryterare'
                }
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] z-[10000] glass-panel rounded-md">
              <DropdownMenuItem 
                onClick={() => onRecruiterChange(null)}
                className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer"
              >
                Alla rekryterare
              </DropdownMenuItem>
              {recruiters.map((recruiter) => (
                <DropdownMenuItem 
                  key={recruiter.id} 
                  onClick={() => onRecruiterChange(recruiter.id)}
                  className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer"
                >
                  {recruiter.first_name} {recruiter.last_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Sort menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="w-auto min-w-[180px] bg-white/5 border-white/20 text-white backdrop-blur-[2px] transition-colors duration-150 will-change-transform md:hover:bg-white/10 md:hover:text-white md:hover:border-white/50 [&_svg]:text-white md:hover:[&_svg]:text-white focus:outline-none focus-visible:outline-none focus:ring-0 ring-0 outline-none active:bg-white/5 active:border-white/20 active:shadow-none data-[state=open]:bg-white/5 data-[state=open]:border-white/20"
            >
              <ArrowUpDown className="mr-2 h-4 w-4" />
              {sortLabels[sortBy]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px] z-[10000] glass-panel rounded-md">
            <DropdownMenuItem 
              onClick={() => onSortChange('newest')}
              className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer"
            >
              {sortLabels.newest}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onSortChange('oldest')}
              className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer"
            >
              {sortLabels.oldest}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onSortChange('title-asc')}
              className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer"
            >
              {sortLabels['title-asc']}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onSortChange('title-desc')}
              className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer"
            >
              {sortLabels['title-desc']}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile: Always-visible search with inline icons */}
      <div className="md:hidden flex items-center gap-1.5">
        {/* Search field with sort button inside */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-white" />
          <Input
            placeholder="Titel, Plats, Anställningstyp..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 pr-10 h-9 text-sm text-center bg-white/5 border-white/20 hover:border-white/50 text-white placeholder:text-white placeholder:text-center focus:outline-none focus-visible:outline-none focus:ring-0"
          />
          {searchInput ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-1.5 top-1/2 transform -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-white bg-white/10 transition-colors focus:outline-none"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="absolute right-1.5 top-1/2 transform -translate-y-1/2 flex h-6 w-6 items-center justify-center text-white focus:outline-none"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-[200px] z-[10000] glass-panel rounded-md"
              >
                <DropdownMenuItem onClick={() => onSortChange('newest')} className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer">{sortLabels.newest}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSortChange('oldest')} className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer">{sortLabels.oldest}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSortChange('title-asc')} className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer">{sortLabels['title-asc']}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSortChange('title-desc')} className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer">{sortLabels['title-desc']}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Recruiter filter - only show if multiple recruiters */}
        {showRecruiterFilter && onRecruiterChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-9 w-9 flex-shrink-0 text-white active:bg-white/12 focus:outline-none focus-visible:outline-none focus:ring-0"
              >
                <UserCheck className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              className="w-[200px] z-[10000] glass-panel rounded-md"
            >
              <DropdownMenuItem 
                onClick={() => onRecruiterChange(null)}
                className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer"
              >
                Alla rekryterare
              </DropdownMenuItem>
              {recruiters.map((recruiter) => (
                <DropdownMenuItem 
                  key={recruiter.id} 
                  onClick={() => onRecruiterChange(recruiter.id)}
                  className="text-white hover:bg-white/20 focus:bg-white/20 cursor-pointer"
                >
                  {recruiter.first_name} {recruiter.last_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
});

JobSearchBar.displayName = 'JobSearchBar';

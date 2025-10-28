import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useState, useRef, useEffect } from 'react';

type SortOption = 'newest' | 'oldest' | 'title-asc' | 'title-desc';

interface JobSearchBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  sortBy: SortOption;
  onSortChange: (value: SortOption) => void;
  placeholder?: string;
  companyName?: string;
}

export const JobSearchBar = ({
  searchInput,
  onSearchChange,
  sortBy,
  onSortChange,
  placeholder = "Sök efter titel, plats, anställningstyp...",
  companyName,
}: JobSearchBarProps) => {
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchExpanded]);

  const sortLabels: Record<SortOption, string> = {
    newest: 'Nyast först',
    oldest: 'Äldst först',
    'title-asc': 'Titel A-Ö',
    'title-desc': 'Titel Ö-A',
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
            className="pl-10 min-h-[44px] bg-white/5 border-white/20 text-white placeholder:text-white/60"
          />
        </div>
        
        {/* Sort menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="w-auto min-w-[180px] bg-white/5 backdrop-blur-sm border-white/20 text-white transition-all duration-300 md:hover:bg-white/10 md:hover:text-white [&_svg]:text-white md:hover:[&_svg]:text-white"
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

      {/* Mobile: Expandable search */}
      <div className="md:hidden bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg overflow-hidden transition-all duration-300">
        {!searchExpanded ? (
          // Collapsed state: Header with company name and icons
          <div className="flex items-center justify-between px-4 py-3">
            <h3 className="text-white font-medium text-sm truncate">
              Utlagda jobb av {companyName || 'företaget'}
            </h3>
            
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {/* Search icon button */}
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setSearchExpanded(true)}
                className="h-8 w-8 text-white active:bg-white/12 focus:outline-none focus-visible:outline-none focus:ring-0"
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* Sort icon button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 text-white active:bg-white/12 focus:outline-none focus-visible:outline-none focus:ring-0"
                  >
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-[200px] z-[10000] bg-neutral-900/95 supports-[backdrop-filter]:bg-neutral-900/85 text-white border-white/20 shadow-lg"
                >
                  {Object.entries(sortLabels).map(([key, label]) => (
                    <DropdownMenuItem 
                      key={key} 
                      onClick={() => onSortChange(key as SortOption)}
                      className="text-white md:hover:bg-white/10 md:focus:bg-white/10"
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : (
          // Expanded state: Search field with icons
          <div className="flex items-center gap-2 px-4 py-3 animate-fade-in">
            {/* Search field */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60" />
              <Input
                ref={searchInputRef}
                placeholder={placeholder}
                value={searchInput}
                onChange={(e) => onSearchChange(e.target.value)}
                onBlur={() => {
                  if (!searchInput) {
                    setSearchExpanded(false);
                  }
                }}
                className="pl-10 pr-8 bg-white/10 border-white/20 text-white placeholder:text-white/60 focus:outline-none focus-visible:outline-none focus:ring-0"
              />
              {searchInput && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    onSearchChange('');
                    setSearchExpanded(false);
                  }}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 text-white/60 hover:text-white focus:outline-none focus-visible:outline-none focus:ring-0"
                >
                  <Search className="h-3 w-3 rotate-45" />
                </Button>
              )}
            </div>

            {/* Sort icon button */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  className="h-8 w-8 flex-shrink-0 text-white active:bg-white/12 focus:outline-none focus-visible:outline-none focus:ring-0"
                >
                  <ArrowUpDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                align="end" 
                className="w-[200px] z-[10000] bg-neutral-900/95 supports-[backdrop-filter]:bg-neutral-900/85 text-white border-white/20 shadow-lg"
              >
                {Object.entries(sortLabels).map(([key, label]) => (
                  <DropdownMenuItem 
                    key={key} 
                    onClick={() => onSortChange(key as SortOption)}
                    className="text-white md:hover:bg-white/10 md:focus:bg-white/10"
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </>
  );
};

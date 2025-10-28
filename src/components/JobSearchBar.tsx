import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useState } from 'react';

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
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);

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
              className="w-auto min-w-[180px] bg-white/5 backdrop-blur-sm border-white/20 text-white transition-all duration-300 md:hover:bg-white/10"
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

      {/* Mobile: Compact header with icons */}
      <div className="md:hidden flex items-center justify-between bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg px-4 py-3">
        <h3 className="text-white font-medium text-sm truncate">
          Utlagda jobb av {companyName || 'företaget'}
        </h3>
        
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {/* Search icon button */}
          <Sheet open={searchSheetOpen} onOpenChange={setSearchSheetOpen}>
            <SheetTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8 text-white md:hover:bg-white/10 active:bg-white/12 focus:outline-none focus-visible:outline-none focus:ring-0"
              >
                <Search className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="bottom" 
              className="bg-neutral-900/95 border-white/20"
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                const activeEl = document.activeElement as HTMLElement;
                activeEl?.blur();
              }}
            >
              <SheetHeader>
                <SheetTitle className="text-white">Sök annonser</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <Input
                  autoFocus
                  placeholder={placeholder}
                  value={searchInput}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                />
              </div>
            </SheetContent>
          </Sheet>

          {/* Sort icon button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-8 w-8 text-white md:hover:bg-white/10 active:bg-white/12 focus:outline-none focus-visible:outline-none focus:ring-0"
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
    </>
  );
};

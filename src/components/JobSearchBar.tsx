import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ArrowUpDown, X } from 'lucide-react';
import { useState } from 'react';
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
} from '@/components/ui/sheet';

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
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);
  
  const sortLabels: Record<SortOption, string> = {
    newest: 'Nyast först',
    oldest: 'Äldst först',
    'title-asc': 'Titel A-Ö',
    'title-desc': 'Titel Ö-A',
  };

  return (
    <>
      {/* Desktop: Full search bar and sort dropdown */}
      <div className="hidden md:flex flex-row gap-2">
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
        <DropdownMenu onOpenChange={(open) => {
          if (!open) {
            (document.activeElement as HTMLElement)?.blur();
          }
        }}>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="outline" 
              className="w-auto min-w-[180px] bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 data-[state=open]:bg-white/10"
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

      {/* Mobile: Icon buttons for search and sort */}
      <div className="flex md:hidden items-center justify-end gap-2">
        {/* Search icon button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSearchSheetOpen(true)}
          className="h-10 w-10 text-white hover:bg-white/10 focus:outline-none focus-visible:outline-none"
        >
          <Search className="h-5 w-5" />
        </Button>

        {/* Sort icon button with dropdown */}
        <DropdownMenu onOpenChange={(open) => {
          if (!open) {
            (document.activeElement as HTMLElement)?.blur();
          }
        }}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-white hover:bg-white/10 data-[state=open]:bg-white/10 focus:outline-none focus-visible:outline-none"
            >
              <ArrowUpDown className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-[220px] z-[10000] bg-neutral-900/95 supports-[backdrop-filter]:bg-neutral-900/85 text-white border-white/20 shadow-lg"
          >
            {Object.entries(sortLabels).map(([key, label]) => (
              <DropdownMenuItem 
                key={key} 
                onClick={() => onSortChange(key as SortOption)}
                className="text-white hover:bg-white/10"
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile search sheet */}
      <Sheet open={searchSheetOpen} onOpenChange={setSearchSheetOpen}>
        <SheetContent 
          side="bottom" 
          className="bg-neutral-900/95 border-white/20"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            (document.activeElement as HTMLElement)?.blur();
          }}
        >
          <SheetHeader>
            <SheetTitle className="text-white">Sök</SheetTitle>
          </SheetHeader>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
            <Input
              autoFocus
              placeholder={placeholder}
              value={searchInput}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10 min-h-[44px] bg-white/5 border-white/20 text-white placeholder:text-white/60"
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

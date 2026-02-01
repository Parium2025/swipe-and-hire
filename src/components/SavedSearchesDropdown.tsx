import { useState } from 'react';
import { Bell, X, Trash2, Search, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { SavedSearch, SearchCriteria } from '@/hooks/useSavedSearches';
import { cn } from '@/lib/utils';

interface SavedSearchesDropdownProps {
  savedSearches: SavedSearch[];
  totalNewMatches: number;
  onApplySearch: (criteria: SearchCriteria) => void;
  onDeleteSearch: (searchId: string) => Promise<boolean>;
  onClearNewMatches: (searchId?: string) => Promise<boolean>;
}

export function SavedSearchesDropdown({
  savedSearches,
  totalNewMatches,
  onApplySearch,
  onDeleteSearch,
  onClearNewMatches,
}: SavedSearchesDropdownProps) {
  const [open, setOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteSearch, setConfirmDeleteSearch] = useState<SavedSearch | null>(null);

  if (savedSearches.length === 0) return null;

  const handleApplySearch = async (search: SavedSearch) => {
    // Build criteria from saved search
    const criteria: SearchCriteria = {
      search_query: search.search_query || undefined,
      city: search.city || undefined,
      county: search.county || undefined,
      employment_types: search.employment_types || undefined,
      category: search.category || undefined,
      salary_min: search.salary_min || undefined,
      salary_max: search.salary_max || undefined,
    };
    
    // Clear new matches for this search
    if (search.new_matches_count > 0) {
      await onClearNewMatches(search.id);
    }
    
    onApplySearch(criteria);
    setOpen(false);
  };

  const handleDeleteClick = (e: React.MouseEvent, search: SavedSearch) => {
    e.stopPropagation();
    setConfirmDeleteSearch(search);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteSearch) return;
    setDeletingId(confirmDeleteSearch.id);
    await onDeleteSearch(confirmDeleteSearch.id);
    setDeletingId(null);
    setConfirmDeleteSearch(null);
  };

  // Build a summary of the search criteria for display
  const getCriteriaSummary = (search: SavedSearch): string => {
    const parts: string[] = [];
    if (search.search_query) parts.push(`"${search.search_query}"`);
    if (search.city) parts.push(search.city);
    if (search.category) parts.push(search.category);
    if (search.employment_types?.length) {
      parts.push(search.employment_types.slice(0, 2).join(', '));
    }
    return parts.length > 0 ? parts.join(' • ') : 'Alla jobb';
  };

  return (
    <>
      <Popover open={open} onOpenChange={(isOpen) => {
        // Don't close popover if confirmation dialog is open
        if (!isOpen && confirmDeleteSearch) return;
        setOpen(isOpen);
      }}>
        <PopoverTrigger asChild>
          <button
            className="relative flex items-center gap-2 text-xs text-white rounded-lg px-3 min-h-[44px] transition-all duration-200 md:hover:bg-white/10 active:scale-95 active:bg-white/10"
          >
            <Bell className="h-4 w-4 text-white" />
            <span>{savedSearches.length} sparad{savedSearches.length !== 1 ? 'e' : ''} sökning{savedSearches.length !== 1 ? 'ar' : ''}</span>
            {totalNewMatches > 0 && (
              <Badge 
                variant="glass" 
                className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px] h-5 px-1.5"
              >
                {totalNewMatches} nya
              </Badge>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-80 p-0 bg-slate-900/95 backdrop-blur-xl border-white/20"
          align="start"
        >
          <div className="p-3 border-b border-white/10">
            <h4 className="text-sm font-medium text-white">Sparade sökningar</h4>
            <p className="text-xs text-white mt-0.5">Klicka för att aktivera sökningen</p>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {savedSearches.map((search) => (
              <div
                key={search.id}
                onClick={() => handleApplySearch(search)}
                className={cn(
                  "flex items-start gap-3 p-3 cursor-pointer transition-colors",
                  "hover:bg-white/5 border-b border-white/5 last:border-b-0",
                  deletingId === search.id && "opacity-50 pointer-events-none"
                )}
              >
                <Search className="h-4 w-4 text-white mt-0.5 shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {search.name}
                    </span>
                    {search.new_matches_count > 0 && (
                      <Badge 
                        variant="glass" 
                        className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px] h-4 px-1 shrink-0"
                      >
                        +{search.new_matches_count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-white truncate mt-0.5">
                    {getCriteriaSummary(search)}
                  </p>
                </div>
                
                <button
                  onClick={(e) => handleDeleteClick(e, search)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-white md:hover:text-red-400 md:hover:bg-red-500/10 transition-colors shrink-0 active:scale-95 active:bg-red-500/20"
                  aria-label="Ta bort sparad sökning"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          
          {totalNewMatches > 0 && (
            <div className="p-2 border-t border-white/10">
              <button
                onClick={async () => {
                  await onClearNewMatches();
                  setOpen(false);
                }}
                className="w-full text-xs text-white/60 md:hover:text-white min-h-[44px] rounded-lg md:hover:bg-white/5 transition-colors active:scale-[0.98] active:bg-white/10"
              >
                Rensa alla notifikationer
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!confirmDeleteSearch} onOpenChange={(open) => !open && setConfirmDeleteSearch(null)}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort sparad sökning
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {confirmDeleteSearch && (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">"{confirmDeleteSearch.name}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              onClick={() => setConfirmDeleteSearch(null)}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              variant="destructiveSoft"
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 text-sm flex items-center justify-center rounded-full"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
}
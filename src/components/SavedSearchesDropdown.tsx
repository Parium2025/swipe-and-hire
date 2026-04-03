import { useState, useRef } from 'react';
import { Bell, X, Trash2, Search, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { useTapToPreview } from '@/hooks/useTapToPreview';
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
  const [hoverTruncatedId, setHoverTruncatedId] = useState<string | null>(null);
  const { handleTap, isPreview, resetPreview, isTouch } = useTapToPreview();
  const nameRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const criteriaRefs = useRef<Record<string, HTMLParagraphElement | null>>({});

  // Reset preview state when popover closes
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && confirmDeleteSearch) return;
    if (!isOpen) resetPreview();
    setOpen(isOpen);
  };

  if (savedSearches.length === 0) return null;

  const handleApplySearch = (search: SavedSearch) => {
    // Close popover FIRST for instant UI response
    setOpen(false);
    
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
    
    onApplySearch(criteria);
    
    // Clear new matches in background (non-blocking)
    if (search.new_matches_count > 0) {
      onClearNewMatches(search.id).catch(() => {});
    }
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
    if (!search) return 'Alla jobb';
    const parts: string[] = [];
    if (search.search_query) parts.push(`"${search.search_query}"`);
    if (search.city) parts.push(search.city);
    if (search.category) parts.push(search.category);
    if (Array.isArray(search.employment_types) && search.employment_types.length) {
      parts.push(search.employment_types.slice(0, 2).join(', '));
    }
    return parts.length > 0 ? parts.join(' • ') : 'Alla jobb';
  };

  return (
    <>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            className="relative h-11 px-6 inline-flex items-center justify-center gap-2 text-sm text-white rounded-full bg-white/10 border border-white/20 hover:bg-white/15 active:scale-[0.97] transition-all duration-200 touch-manipulation"
          >
            <Bell className="h-4 w-4 text-white brightness-125" />
            <span>{savedSearches.length} sparad{savedSearches.length !== 1 ? 'e' : ''} sökning{savedSearches.length !== 1 ? 'ar' : ''}</span>
            {totalNewMatches > 0 && (
              <Badge 
                variant="glass" 
                className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] h-5 px-1.5"
              >
                {totalNewMatches} nya
              </Badge>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[min(calc(100vw-2rem),360px)] p-0 bg-slate-900/95 backdrop-blur-xl border-white/20"
          align="center"
        >
          <div className="p-4 border-b border-white/10">
            <h4 className="text-base font-medium text-white">Sparade sökningar</h4>
            <p className="text-sm text-white mt-1">
              {isTouch ? 'Tryck för att förhandsgranska, tryck igen för att välja' : 'Klicka för att aktivera sökningen'}
            </p>
          </div>
          
          <TooltipProvider delayDuration={0} skipDelayDuration={0}>
          <div className="max-h-[50vh] overflow-y-auto overscroll-contain">
            {savedSearches.map((search) => {
              const showingPreview = isPreview(search.id);
              const tooltipOpen = isTouch 
                ? showingPreview 
                : hoverTruncatedId === search.id;
              return (
                <Tooltip key={search.id} open={tooltipOpen}>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => {
                        const nameEl = nameRefs.current[search.id] ?? null;
                        const criteriaEl = criteriaRefs.current[search.id] ?? null;
                        // Check either element for truncation on touch
                        const truncatedEl = (nameEl && nameEl.scrollWidth > nameEl.clientWidth + 1) 
                          ? nameEl 
                          : (criteriaEl && criteriaEl.scrollWidth > criteriaEl.clientWidth + 1)
                            ? criteriaEl
                            : null;
                        handleTap(
                          search.id,
                          truncatedEl,
                          () => handleApplySearch(search)
                        );
                      }}
                      onMouseEnter={() => {
                        if (isTouch) return;
                        const nameEl = nameRefs.current[search.id];
                        const criteriaEl = criteriaRefs.current[search.id];
                        const nameTruncated = nameEl && nameEl.scrollWidth > nameEl.clientWidth + 1;
                        const criteriaTruncated = criteriaEl && criteriaEl.scrollWidth > criteriaEl.clientWidth + 1;
                        if (nameTruncated || criteriaTruncated) {
                          setHoverTruncatedId(search.id);
                        }
                      }}
                      onMouseLeave={() => {
                        if (!isTouch) setHoverTruncatedId(null);
                      }}
                      className={cn(
                        "flex items-start gap-3 p-3 cursor-pointer transition-colors",
                        "hover:bg-white/5 border-b border-white/5 last:border-b-0",
                        deletingId === search.id && "opacity-50 pointer-events-none",
                        showingPreview && "bg-white/5"
                      )}
                    >
                      <Search className="h-4 w-4 text-white mt-0.5 shrink-0" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span 
                            ref={(el) => { nameRefs.current[search.id] = el; }}
                            className="text-sm font-medium text-white truncate"
                          >
                            {search.name}
                          </span>
                          {search.new_matches_count > 0 && (
                            <Badge 
                              variant="glass" 
                              className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] h-4 px-1 shrink-0"
                            >
                              +{search.new_matches_count}
                            </Badge>
                          )}
                        </div>
                        <p 
                          ref={(el) => { criteriaRefs.current[search.id] = el; }}
                          className="text-xs text-white truncate mt-0.5"
                        >
                          {getCriteriaSummary(search)}
                        </p>
                      </div>
                      
                      <button
                        onClick={(e) => handleDeleteClick(e, search)}
                        className="shrink-0 rounded-full border border-destructive/40 bg-destructive/20 p-1.5 text-white transition-colors md:hover:!border-destructive/50 md:hover:!bg-destructive/30 md:hover:!text-white"
                        aria-label="Ta bort sparad sökning"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    sideOffset={6}
                    className="z-[999999] max-w-[280px] bg-slate-900/95 border border-white/20 shadow-2xl p-2.5 pointer-events-none rounded-lg"
                  >
                    <p className="text-sm text-white font-medium break-words">{search.name}</p>
                    <p className="text-xs text-white/70 break-words mt-0.5">{getCriteriaSummary(search)}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          </TooltipProvider>
          
          {totalNewMatches > 0 && (
            <div className="p-2 border-t border-white/10">
              <button
                onClick={async () => {
                  await onClearNewMatches();
                  setOpen(false);
                }}
                className="w-full text-xs text-white py-2 rounded-full border border-white/20 hover:bg-white/10 transition-colors"
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
                <AlertTriangle className="h-4 w-4 text-white" />
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
              className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              variant="destructiveSoft"
              className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
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
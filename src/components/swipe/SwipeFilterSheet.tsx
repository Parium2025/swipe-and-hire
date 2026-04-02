import { useState, useEffect, useRef, useCallback, type MouseEvent, type PointerEvent, type TouchEvent } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { X, Search, MapPin, Briefcase, Clock, ArrowUpDown, Check, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LocationSearchInput from '@/components/LocationSearchInput';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { OCCUPATION_CATEGORIES } from '@/lib/occupations';
import { SEARCH_EMPLOYMENT_TYPES } from '@/lib/employmentTypes';

interface SwipeFilterSheetProps {
  open: boolean;
  onClose: () => void;
  // Filter state
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  selectedCity: string;
  onLocationChange: (location: string) => void;
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedEmploymentTypes: string[];
  onEmploymentTypesChange: (value: string[]) => void;
  sortBy: 'newest' | 'oldest' | 'most-views';
  onSortChange: (value: 'newest' | 'oldest' | 'most-views') => void;
  onClearAll: () => void;
  jobCount: number;
  activeFilterCount: number;
}

const DISMISS_THRESHOLD = 120;

const sortLabels: Record<string, string> = {
  newest: 'Nyast först',
  oldest: 'Äldst först',
  'most-views': 'Mest visade',
};

export function SwipeFilterSheet({
  open,
  onClose,
  searchInput,
  onSearchInputChange,
  selectedCity,
  onLocationChange,
  selectedCategory,
  onCategoryChange,
  selectedEmploymentTypes,
  onEmploymentTypesChange,
  sortBy,
  onSortChange,
  onClearAll,
  jobCount,
  activeFilterCount,
}: SwipeFilterSheetProps) {
  const dragY = useMotionValue(0);
  const sheetControls = useAnimation();
  const dragStartY = useRef(0);
  const isDragging = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const backdropOpacity = useTransform(dragY, [0, 400], [1, 0]);
  const [dismissing, setDismissing] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(true);
  const openedAtRef = useRef(0);

  // Reset animation state on every open
  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
      setIsAnimatingIn(true);
      setDismissing(false);
      dragY.jump(0);
    }
  }, [open, dragY]);

  const animatedClose = useCallback(() => {
    if (dismissing) return;
    setDismissing(true);
    animate(dragY, window.innerHeight, {
      type: 'spring',
      damping: 34,
      stiffness: 400,
      mass: 0.8,
      onComplete: () => {
        onClose();
        setDismissing(false);
      },
    });
  }, [onClose, dragY, dismissing]);

  const handleBackdropDismiss = useCallback((event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>) => {
    if (Date.now() - openedAtRef.current < 420) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    animatedClose();
  }, [animatedClose]);

  const stopSheetPropagation = useCallback((event: MouseEvent<HTMLDivElement> | PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
  }, []);

  // Drag to dismiss
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const scrollTop = scrollRef.current?.scrollTop ?? 0;
    if (scrollTop <= 0) {
      isDragging.current = true;
      dragStartY.current = e.touches[0].clientY;
      dragY.set(0);
    }
  }, [dragY]);

  const handleTouchMove = useCallback((e: TouchEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) {
      dragY.set(dy * 0.8);
      e.preventDefault();
    } else {
      isDragging.current = false;
      dragY.set(0);
    }
  }, [dragY]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const currentY = dragY.get();
    if (currentY > DISMISS_THRESHOLD) {
      setDismissing(true);
      // Animate dragY (which drives the style) to avoid conflict with sheetControls
      animate(dragY, window.innerHeight, {
        type: 'spring',
        damping: 34,
        stiffness: 400,
        mass: 0.8,
        onComplete: () => {
          onClose();
          setDismissing(false);
        },
      });
    } else {
      animate(dragY, 0, { type: 'spring', damping: 24, stiffness: 400 });
    }
  }, [dragY, onClose]);

  const handleHandleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    isDragging.current = true;
    dragStartY.current = e.touches[0].clientY;
    dragY.set(0);
    e.stopPropagation();
  }, [dragY]);

  return (
    <AnimatePresence mode="wait">
      {open && (
        <div key="swipe-filter" className="fixed inset-0 z-[10002]">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={isAnimatingIn ? undefined : { opacity: backdropOpacity }}
            onPointerDown={handleBackdropDismiss}
            onClick={handleBackdropDismiss}
          />

          {/* Sheet */}
          <motion.div
            className="absolute inset-x-0 bottom-0 max-h-[92vh] bg-parium-gradient rounded-t-3xl overflow-hidden flex flex-col will-change-transform"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.8 }}
            onAnimationComplete={() => setIsAnimatingIn(false)}
            style={isAnimatingIn ? undefined : { y: dragY }}
            onPointerDown={stopSheetPropagation}
            onClick={stopSheetPropagation}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {/* Drag handle */}
            <div
              className="flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing"
              onTouchStart={handleHandleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="w-10 h-1.5 rounded-full bg-white/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-white" />
                <h2 className="text-lg font-bold text-white">Filter</h2>
                {activeFilterCount > 0 && (
                  <span className="flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-secondary text-white text-xs font-bold">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <button
                onClick={animatedClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-all active:scale-90"
                aria-label="Stäng"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>

            {/* Content */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-5 pb-4 space-y-4"
              style={{ WebkitOverflowScrolling: 'touch' }}
              onTouchStart={handleTouchStart}
            >
              {/* Search */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-white inline-flex items-center gap-2 pl-1">
                  <Search className="h-3.5 w-3.5" />
                  Sök
                </Label>
                <div className="relative">
                  <Input
                    placeholder="Jobbtitel, Företag, Plats..."
                    value={searchInput}
                    onChange={(e) => onSearchInputChange(e.target.value)}
                    className="pl-9 pr-10 !h-12 !min-h-0 text-base bg-white/5 border-white/10 text-white placeholder:text-white/60"
                  />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
                  {searchInput && (
                    <button
                      onClick={() => onSearchInputChange('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white rounded-full p-1"
                      aria-label="Rensa"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-white inline-flex items-center gap-2 pl-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Plats
                </Label>
                <LocationSearchInput
                  values={selectedCity ? selectedCity.split(' | ').filter(Boolean) : []}
                  onLocationsChange={(locations) => onLocationChange(locations.join(' | '))}
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-white inline-flex items-center gap-2 pl-1">
                  <Briefcase className="h-3.5 w-3.5" />
                  Yrkesområde
                </Label>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full h-12 flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 text-left touch-manipulation">
                      <Briefcase className="h-4 w-4 text-white flex-shrink-0" />
                      <span className="text-[15px] text-white flex-1 truncate">
                        {selectedCategory === 'all-categories'
                          ? 'Alla yrkesområden'
                          : OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.label || 'Välj'
                        }
                      </span>
                      {selectedCategory !== 'all-categories' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCategoryChange('all-categories'); }}
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10"
                        >
                          <X className="h-4 w-4 text-white" />
                        </button>
                      ) : (
                        <ChevronDown className="h-4 w-4 text-white" />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-[var(--radix-dropdown-menu-trigger-width)] bg-slate-900 border border-white/20 rounded-md shadow-lg text-white max-h-60 overflow-y-auto [-webkit-overflow-scrolling:touch] overscroll-contain">
                    <DropdownMenuItem onClick={() => onCategoryChange('all-categories')} className="cursor-pointer active:bg-white/10 text-white font-medium touch-manipulation py-3 text-[15px] leading-tight">
                      Alla yrkesområden
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/20" />
                    {OCCUPATION_CATEGORIES.map((cat, i) => (
                      <div key={cat.value}>
                        <DropdownMenuItem
                          onClick={() => onCategoryChange(cat.value)}
                          className="cursor-pointer active:bg-white/10 text-white flex items-center justify-between touch-manipulation py-3 text-[15px] leading-tight"
                        >
                          <span>{cat.label}</span>
                          {selectedCategory === cat.value && <Check className="h-4 w-4" />}
                        </DropdownMenuItem>
                        {i < OCCUPATION_CATEGORIES.length - 1 && <DropdownMenuSeparator className="bg-white/20" />}
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Employment type */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-white inline-flex items-center gap-2 pl-1">
                  <Clock className="h-3.5 w-3.5" />
                  Anställning
                </Label>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full h-12 flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 text-left touch-manipulation">
                      <Clock className="h-4 w-4 text-white flex-shrink-0" />
                      <span className="text-[15px] text-white flex-1 truncate">
                        {selectedEmploymentTypes.length === 0
                          ? 'Alla anställningar'
                          : `${selectedEmploymentTypes.length} valda`
                        }
                      </span>
                      <ChevronDown className="h-4 w-4 text-white" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-[var(--radix-dropdown-menu-trigger-width)] bg-slate-900 border border-white/20 rounded-md shadow-lg text-white max-h-60 overflow-y-auto [-webkit-overflow-scrolling:touch] overscroll-contain">
                    <DropdownMenuItem onClick={() => onEmploymentTypesChange([])} className="cursor-pointer active:bg-white/10 text-white font-medium touch-manipulation py-3 text-[15px] leading-tight">
                      Alla anställningar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-white/20" />
                    {SEARCH_EMPLOYMENT_TYPES.map((type, i) => (
                      <div key={type.value}>
                        <DropdownMenuItem
                          onClick={() => {
                            onEmploymentTypesChange(
                              selectedEmploymentTypes.includes(type.value)
                                ? selectedEmploymentTypes.filter(t => t !== type.value)
                                : [...selectedEmploymentTypes, type.value]
                            );
                          }}
                          className="cursor-pointer active:bg-white/10 text-white flex items-center justify-between touch-manipulation py-3 text-[15px] leading-tight"
                        >
                          <span>{type.label}</span>
                          {selectedEmploymentTypes.includes(type.value) && <Check className="h-4 w-4" />}
                        </DropdownMenuItem>
                        {i < SEARCH_EMPLOYMENT_TYPES.length - 1 && <DropdownMenuSeparator className="bg-white/20" />}
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Sort */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-white inline-flex items-center gap-2 pl-1">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  Sortering
                </Label>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full h-12 flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 text-left touch-manipulation">
                      <ArrowUpDown className="h-4 w-4 text-white flex-shrink-0" />
                      <span className="text-[15px] text-white flex-1">{sortLabels[sortBy]}</span>
                      <ChevronDown className="h-4 w-4 text-white" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-[var(--radix-dropdown-menu-trigger-width)] bg-slate-900 border border-white/20 rounded-md shadow-lg text-white">
                    {(['newest', 'oldest', 'most-views'] as const).map((val, i) => (
                      <div key={val}>
                        <DropdownMenuItem
                          onClick={() => onSortChange(val)}
                          className="cursor-pointer active:bg-white/10 text-white flex items-center justify-between touch-manipulation py-3 text-[15px] leading-tight"
                        >
                          <span>{sortLabels[val]}</span>
                          {sortBy === val && <Check className="h-4 w-4" />}
                        </DropdownMenuItem>
                        {i < 2 && <DropdownMenuSeparator className="bg-white/20" />}
                      </div>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Clear all */}
              {activeFilterCount > 0 && (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={onClearAll}
                    className="h-11 px-6 text-sm text-white rounded-full bg-white/10 border border-white/20 active:scale-[0.97] transition-transform touch-manipulation"
                  >
                    Rensa alla filter
                  </button>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="shrink-0 px-5 pb-5 pt-3 border-t border-white/10" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 1.25rem)' }}>
              <button
                onClick={animatedClose}
                className="w-full h-14 rounded-2xl font-semibold text-base bg-secondary text-white shadow-lg shadow-secondary/30 active:scale-[0.97] transition-all min-h-[44px]"
              >
                Visa {jobCount} jobb
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

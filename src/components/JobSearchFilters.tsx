import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, X, SlidersHorizontal, MapPin, Briefcase, Clock, ArrowUpDown, Check, ChevronDown } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from '@/components/ui/drawer';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { SEARCH_EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import { OCCUPATION_CATEGORIES } from '@/lib/occupations';
import LocationSearchInput from '@/components/LocationSearchInput';
import { cn } from '@/lib/utils';

// Common work location types
const WORK_LOCATION_CHIPS = [
  { value: 'remote', label: 'Distans' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'on_site', label: 'På plats' },
];

// Quick employment type chips (most common ones)
const QUICK_EMPLOYMENT_CHIPS = [
  { value: 'Heltid', label: 'Heltid' },
  { value: 'Deltid', label: 'Deltid' },
  { value: 'Sommarjobb', label: 'Sommarjobb' },
];

interface JobSearchFiltersProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  selectedPostalCode: string;
  onPostalCodeChange: (code: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  selectedSubcategories: string[];
  onSubcategoriesChange: (subcategories: string[]) => void;
  selectedEmploymentTypes: string[];
  onEmploymentTypesChange: (types: string[]) => void;
  sortBy: 'newest' | 'oldest' | 'most-views';
  onSortChange: (sort: 'newest' | 'oldest' | 'most-views') => void;
}

export const JobSearchFilters = ({
  searchInput,
  onSearchChange,
  selectedCity,
  onCityChange,
  selectedPostalCode,
  onPostalCodeChange,
  selectedCategory,
  onCategoryChange,
  selectedSubcategories,
  onSubcategoriesChange,
  selectedEmploymentTypes,
  onEmploymentTypesChange,
  sortBy,
  onSortChange,
}: JobSearchFiltersProps) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedWorkLocation, setSelectedWorkLocation] = useState<string[]>([]);

  // Count active filters for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCity) count++;
    if (selectedCategory && selectedCategory !== 'all-categories') count++;
    if (selectedSubcategories.length > 0) count++;
    if (selectedEmploymentTypes.length > 0) count++;
    if (selectedWorkLocation.length > 0) count++;
    return count;
  }, [selectedCity, selectedCategory, selectedSubcategories, selectedEmploymentTypes, selectedWorkLocation]);

  const toggleChip = (chipValue: string, currentValues: string[], setter: (values: string[]) => void) => {
    if (currentValues.includes(chipValue)) {
      setter(currentValues.filter(v => v !== chipValue));
    } else {
      setter([...currentValues, chipValue]);
    }
  };

  const clearAllFilters = () => {
    onCityChange('');
    onPostalCodeChange('');
    onCategoryChange('all-categories');
    onSubcategoriesChange([]);
    onEmploymentTypesChange([]);
    setSelectedWorkLocation([]);
  };

  const sortLabels = {
    newest: 'Nyast först',
    oldest: 'Äldst först',
    'most-views': 'Mest visade',
  };

  // Advanced filters content (shared between drawer and sheet)
  const AdvancedFiltersContent = () => (
    <div className="space-y-6 p-4">
      {/* Location */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-white flex items-center gap-2">
          <MapPin className="h-3 w-3" />
          Plats
        </Label>
        <LocationSearchInput
          value={selectedPostalCode || selectedCity}
          onLocationChange={(location) => onCityChange(location)}
          onPostalCodeChange={onPostalCodeChange}
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-white flex items-center gap-2">
          <Briefcase className="h-3 w-3" />
          Yrkesområde
        </Label>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="w-full bg-white/5 border-white/20 text-white md:hover:bg-white/10 md:hover:border-white/50 justify-between"
            >
              <span className="truncate">
                {selectedCategory === 'all-categories'
                  ? 'Alla yrkesområden'
                  : OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.label || 'Välj område'
                }
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72 max-h-80 overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-white/20 text-white">
            <DropdownMenuItem
              onClick={() => {
                onCategoryChange('all-categories');
                onSubcategoriesChange([]);
              }}
              className="cursor-pointer hover:bg-white/10 text-white"
            >
              Alla yrkesområden
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/20" />
            {OCCUPATION_CATEGORIES.map((category) => (
              <DropdownMenuItem
                key={category.value}
                onClick={() => {
                  onCategoryChange(category.value);
                  onSubcategoriesChange([]);
                }}
                className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
              >
                <span>{category.label}</span>
                {selectedCategory === category.value && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Subcategories - only if category is selected */}
      {selectedCategory && selectedCategory !== 'all-categories' && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-white">
            Specifik roll
          </Label>
          <div className="flex flex-wrap gap-2">
            {OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.subcategories.map((subcat) => (
              <Badge
                key={subcat}
                variant="outline"
                onClick={() => {
                  if (selectedSubcategories.includes(subcat)) {
                    onSubcategoriesChange(selectedSubcategories.filter(s => s !== subcat));
                  } else {
                    onSubcategoriesChange([...selectedSubcategories, subcat]);
                  }
                }}
                className={cn(
                  "cursor-pointer transition-all",
                  selectedSubcategories.includes(subcat)
                    ? "bg-primary/20 border-primary/50 text-white"
                    : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10"
                )}
              >
                {subcat}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Employment Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-white flex items-center gap-2">
          <Clock className="h-3 w-3" />
          Anställningstyp
        </Label>
        <div className="flex flex-wrap gap-2">
          {SEARCH_EMPLOYMENT_TYPES.map((type) => (
            <Badge
              key={type.value}
              variant="outline"
              onClick={() => toggleChip(type.value, selectedEmploymentTypes, onEmploymentTypesChange)}
              className={cn(
                "cursor-pointer transition-all",
                selectedEmploymentTypes.includes(type.value)
                  ? "bg-primary/20 border-primary/50 text-white"
                  : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10"
              )}
            >
              {type.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Work Location Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-white">
          Arbetsplats
        </Label>
        <div className="flex flex-wrap gap-2">
          {WORK_LOCATION_CHIPS.map((chip) => (
            <Badge
              key={chip.value}
              variant="outline"
              onClick={() => toggleChip(chip.value, selectedWorkLocation, setSelectedWorkLocation)}
              className={cn(
                "cursor-pointer transition-all",
                selectedWorkLocation.includes(chip.value)
                  ? "bg-primary/20 border-primary/50 text-white"
                  : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10"
              )}
            >
              {chip.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Clear all button */}
      {activeFilterCount > 0 && (
        <Button
          variant="outline"
          onClick={clearAllFilters}
          className="w-full bg-white/5 border-white/20 text-white md:hover:bg-white/10"
        >
          <X className="h-4 w-4 mr-2" />
          Rensa alla filter
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Main Search Row */}
      <div className="flex gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white" />
          <Input
            placeholder="Sök jobbtitel, företag, plats..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10 min-h-[44px] bg-white/5 border-white/20 hover:border-white/50 text-white placeholder:text-white"
          />
          {searchInput && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 rounded text-white hover:bg-white/10 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              className="min-h-[44px] bg-white/5 border-white/20 text-white md:hover:bg-white/10 md:hover:border-white/50 [&_svg]:text-white gap-2"
            >
              <ArrowUpDown className="h-4 w-4" />
              <span className="hidden sm:inline">{sortLabels[sortBy]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-slate-900/95 backdrop-blur-xl border border-white/20 text-white">
            {Object.entries(sortLabels).map(([key, label]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => onSortChange(key as 'newest' | 'oldest' | 'most-views')}
                className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
              >
                {label}
                {sortBy === key && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Advanced Filters - Mobile: Drawer, Desktop: Sheet */}
        <div className="md:hidden">
          <Drawer open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="outline"
                className="min-h-[44px] bg-white/5 border-white/20 text-white md:hover:bg-white/10 md:hover:border-white/50 [&_svg]:text-white relative"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-xs flex items-center justify-center text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </DrawerTrigger>
            <DrawerContent className="bg-slate-900 border-white/20">
              <DrawerHeader className="border-b border-white/10">
                <DrawerTitle className="text-white">Filter</DrawerTitle>
              </DrawerHeader>
              <AdvancedFiltersContent />
            </DrawerContent>
          </Drawer>
        </div>

        <div className="hidden md:block">
          <Sheet open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="min-h-[44px] bg-white/5 border-white/20 text-white md:hover:bg-white/10 md:hover:border-white/50 [&_svg]:text-white relative gap-2"
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filter</span>
                {activeFilterCount > 0 && (
                  <span className="h-5 w-5 rounded-full bg-primary text-xs flex items-center justify-center text-white">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-slate-900 border-white/20 w-[400px]">
              <SheetHeader>
                <SheetTitle className="text-white">Filter</SheetTitle>
              </SheetHeader>
              <AdvancedFiltersContent />
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {/* Quick employment type chips */}
        {QUICK_EMPLOYMENT_CHIPS.map((chip) => (
          <Badge
            key={chip.value}
            variant="outline"
            onClick={() => toggleChip(chip.value, selectedEmploymentTypes, onEmploymentTypesChange)}
            className={cn(
              "cursor-pointer transition-all py-1.5 px-3",
              selectedEmploymentTypes.includes(chip.value)
                ? "bg-primary/20 border-primary/50 text-white"
                : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10 hover:border-white/40"
            )}
          >
            {chip.label}
          </Badge>
        ))}

        {/* Work location chips */}
        {WORK_LOCATION_CHIPS.map((chip) => (
          <Badge
            key={chip.value}
            variant="outline"
            onClick={() => toggleChip(chip.value, selectedWorkLocation, setSelectedWorkLocation)}
            className={cn(
              "cursor-pointer transition-all py-1.5 px-3",
              selectedWorkLocation.includes(chip.value)
                ? "bg-primary/20 border-primary/50 text-white"
                : "bg-white/5 border-white/20 text-white/80 hover:bg-white/10 hover:border-white/40"
            )}
          >
            {chip.label}
          </Badge>
        ))}

        {/* Show city if selected */}
        {selectedCity && (
          <Badge
            variant="outline"
            className="bg-primary/20 border-primary/50 text-white py-1.5 px-3 flex items-center gap-1"
          >
            <MapPin className="h-3 w-3" />
            {selectedCity}
            <X
              className="h-3 w-3 cursor-pointer hover:text-white/80"
              onClick={(e) => {
                e.stopPropagation();
                onCityChange('');
                onPostalCodeChange('');
              }}
            />
          </Badge>
        )}

        {/* Show category if selected */}
        {selectedCategory && selectedCategory !== 'all-categories' && (
          <Badge
            variant="outline"
            className="bg-primary/20 border-primary/50 text-white py-1.5 px-3 flex items-center gap-1"
          >
            <Briefcase className="h-3 w-3" />
            {OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.label}
            <X
              className="h-3 w-3 cursor-pointer hover:text-white/80"
              onClick={(e) => {
                e.stopPropagation();
                onCategoryChange('all-categories');
                onSubcategoriesChange([]);
              }}
            />
          </Badge>
        )}
      </div>
    </div>
  );
};

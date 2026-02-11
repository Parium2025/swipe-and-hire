import React, { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MapPin, Briefcase, Users, Clock, X, ChevronDown, Check, Search, ArrowUpDown, Bookmark } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import LocationSearchInput from '@/components/LocationSearchInput';
import { SavedSearchesDropdown } from '@/components/SavedSearchesDropdown';
import { OCCUPATION_CATEGORIES } from '@/lib/occupations';
import { SEARCH_EMPLOYMENT_TYPES } from '@/lib/employmentTypes';
import type { SearchCriteria } from '@/hooks/useSavedSearches';

interface SearchFiltersPanelProps {
  // Search
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  // Location
  selectedCity: string;
  selectedPostalCode: string;
  onLocationChange: (location: string, postalCode?: string) => void;
  onPostalCodeChange: (value: string) => void;
  // Category
  selectedCategory: string;
  onCategoryChange: (value: string) => void;
  selectedSubcategories: string[];
  onSubcategoriesChange: (value: string[]) => void;
  // Employment
  selectedEmploymentTypes: string[];
  onEmploymentTypesChange: (value: string[]) => void;
  // Sort
  sortBy: 'newest' | 'oldest' | 'most-views';
  onSortChange: (value: 'newest' | 'oldest' | 'most-views') => void;
  // Filter expansion
  filtersExpanded: boolean;
  onFiltersExpandedChange: (value: boolean) => void;
  // Saved searches
  savedSearches: any[];
  totalNewMatches: number;
  onApplySavedSearch: (criteria: SearchCriteria) => void;
  onDeleteSearch: (id: string) => Promise<boolean>;
  onClearNewMatches: (searchId?: string) => Promise<boolean>;
  hasActiveFilters: (criteria: Partial<SearchCriteria>) => boolean;
  onOpenSaveDialog: () => void;
  // Clear all
  onClearAll: () => void;
}

const sortLabels = {
  newest: 'Nyast först',
  oldest: 'Äldst först',
  'most-views': 'Mest visade',
};

export const SearchFiltersPanel = memo(function SearchFiltersPanel({
  searchInput,
  onSearchInputChange,
  selectedCity,
  selectedPostalCode,
  onLocationChange,
  onPostalCodeChange,
  selectedCategory,
  onCategoryChange,
  selectedSubcategories,
  onSubcategoriesChange,
  selectedEmploymentTypes,
  onEmploymentTypesChange,
  sortBy,
  onSortChange,
  filtersExpanded,
  onFiltersExpandedChange,
  savedSearches,
  totalNewMatches,
  onApplySavedSearch,
  onDeleteSearch,
  onClearNewMatches,
  hasActiveFilters,
  onOpenSaveDialog,
  onClearAll,
}: SearchFiltersPanelProps) {
  const employmentTypes = SEARCH_EMPLOYMENT_TYPES;

  return (
    <Card className="bg-white/5 backdrop-blur-sm border-white/20">
      <CardContent className="p-3 md:p-4 space-y-3 md:space-y-4">
        {/* Search Field with Save Search Button */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            {hasActiveFilters({
              search_query: searchInput,
              city: selectedCity,
              county: selectedPostalCode,
              employment_types: selectedEmploymentTypes,
              category: selectedCategory !== 'all-categories' ? selectedCategory : undefined,
            }) ? (
              <button
                onClick={onOpenSaveDialog}
                className="inline-flex items-center gap-1.5 h-7 px-2 text-xs text-white rounded-md transition-all duration-200 md:hover:bg-white/10 active:scale-95 ml-auto"
              >
                <Bookmark className="h-3.5 w-3.5 text-white" />
                <span className="hidden sm:inline">Spara sökning</span>
              </button>
            ) : <span />}
          </div>
          <div className="relative">
            <Input
              placeholder="Jobbtitel, Företag, Plats..."
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              className="pl-9 pr-10 !h-10 !min-h-[40px] md:!h-11 md:!min-h-[44px] text-sm bg-white/5 border-white/10 hover:border-white/50 text-white placeholder:text-white/60"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white pointer-events-none" />
            {searchInput && (
              <button
                onClick={() => onSearchInputChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white hover:bg-white/10 rounded p-1 transition-colors"
                aria-label="Rensa sökning"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Saved Searches Dropdown */}
          <SavedSearchesDropdown
            savedSearches={savedSearches}
            totalNewMatches={totalNewMatches}
            onApplySearch={onApplySavedSearch}
            onDeleteSearch={onDeleteSearch}
            onClearNewMatches={onClearNewMatches}
          />
        </div>

        {/* Expand/Collapse Filters Button */}
        <button
          onClick={() => onFiltersExpandedChange(!filtersExpanded)}
          className="w-full flex items-center justify-center gap-2 py-2 text-sm text-white"
        >
          <span>{filtersExpanded ? 'Dölj filter' : 'Visa filter'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${filtersExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Collapsible Filter Section */}
        <div className={`space-y-3 md:space-y-4 overflow-hidden transition-all duration-300 ${filtersExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {/* Location Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white inline-flex items-center gap-2 leading-none">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span className="leading-none">Plats</span>
              </Label>
              <LocationSearchInput
                value={selectedPostalCode || selectedCity}
                onLocationChange={onLocationChange}
                onPostalCodeChange={onPostalCodeChange}
              />
            </div>

            {/* Yrkesområde Filter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white inline-flex items-center gap-2 leading-none">
                <Briefcase className="h-3 w-3 flex-shrink-0" />
                <span className="leading-none">Yrkesområde</span>
              </Label>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="w-full h-10 md:h-[44px] flex items-center gap-2 md:gap-3 bg-white/5 border border-white/10 hover:border-white/50 rounded-lg px-3 text-left transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label="Välj yrkesområde"
                  >
                    <Briefcase className="h-4 w-4 text-white flex-shrink-0" />
                    <span className="text-sm text-white flex-1 truncate leading-none">
                      {selectedCategory === 'all-categories'
                        ? 'Alla yrkesområden'
                        : OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.label || 'Välj område'
                      }
                    </span>
                    {selectedCategory !== 'all-categories' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCategoryChange('all-categories');
                          onSubcategoriesChange([]);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-full text-white bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors"
                        aria-label="Rensa yrkesområde"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-80 bg-slate-900 border border-white/20 rounded-md shadow-lg text-white max-h-80 overflow-y-auto [-webkit-overflow-scrolling:touch] overscroll-contain [will-change:scroll-position]">
                  <DropdownMenuItem
                    onClick={() => {
                      onCategoryChange('all-categories');
                      onSubcategoriesChange([]);
                    }}
                    className="cursor-pointer hover:bg-white/10 text-white font-medium"
                  >
                    Alla yrkesområden
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/20" />
                  {OCCUPATION_CATEGORIES.map((category, index) => (
                    <React.Fragment key={category.value}>
                      <DropdownMenuItem
                        onClick={() => {
                          onCategoryChange(category.value);
                          onSubcategoriesChange([]);
                        }}
                        className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                      >
                        <span>{category.label}</span>
                        {selectedCategory === category.value && (
                          <Check className="h-4 w-4 text-white" />
                        )}
                      </DropdownMenuItem>
                      {index < OCCUPATION_CATEGORIES.length - 1 && (
                        <DropdownMenuSeparator className="bg-white/20" />
                      )}
                    </React.Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Subcategories Dropdown */}
          {selectedCategory && selectedCategory !== 'all-categories' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium text-white flex items-center gap-2">
                <Users className="h-3 w-3" />
                Specifik roll inom {OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.label}
              </Label>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button
                    className="w-full h-10 md:h-[44px] flex items-center gap-2 md:gap-3 bg-white/5 border border-white/10 hover:border-white/50 rounded-lg px-3 text-left transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                    aria-label="Välj specifik roll"
                  >
                    <Users className="h-4 w-4 text-white flex-shrink-0" />
                    <span className="text-sm text-white flex-1 truncate leading-none">
                      {selectedSubcategories.length === 0
                        ? 'Alla roller'
                        : selectedSubcategories.length === 1
                        ? selectedSubcategories[0]
                        : `${selectedSubcategories.length} roller valda`
                      }
                    </span>
                    <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-80 bg-slate-900 border border-white/20 rounded-md shadow-lg text-white max-h-80 overflow-y-auto [-webkit-overflow-scrolling:touch] overscroll-contain [will-change:scroll-position]">
                  <DropdownMenuItem
                    onClick={() => onSubcategoriesChange([])}
                    className="cursor-pointer hover:bg-white/10 text-white font-medium"
                  >
                    Alla roller
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/20" />
                  {OCCUPATION_CATEGORIES.find(c => c.value === selectedCategory)?.subcategories.map((subcat, index, array) => (
                    <React.Fragment key={subcat}>
                      <DropdownMenuItem
                        onClick={() => {
                          onSubcategoriesChange(
                            selectedSubcategories.includes(subcat) 
                              ? selectedSubcategories.filter(s => s !== subcat)
                              : [...selectedSubcategories, subcat]
                          );
                        }}
                        className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                      >
                        <span>{subcat}</span>
                        {selectedSubcategories.includes(subcat) && (
                          <Check className="h-4 w-4 text-white" />
                        )}
                      </DropdownMenuItem>
                      {index < array.length - 1 && (
                        <DropdownMenuSeparator className="bg-white/20" />
                      )}
                    </React.Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Show selected roles as badges */}
              {selectedSubcategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSubcategories.map((subcat) => (
                    <Badge 
                      key={subcat}
                      variant="secondary"
                      className="bg-white/10 text-white flex items-center gap-1 cursor-pointer transition-all duration-300 md:hover:bg-white/20 md:hover:text-white"
                    >
                      {subcat}
                      <X 
                        className="h-3 w-3" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onSubcategoriesChange(selectedSubcategories.filter(s => s !== subcat));
                        }}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Employment Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white inline-flex items-center gap-2 leading-none">
                    <Clock className="h-3 w-3 flex-shrink-0" />
                    <span className="leading-none">Anställning</span>
                  </Label>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-full h-10 md:h-[44px] flex items-center gap-2 md:gap-3 bg-white/5 border border-white/10 hover:border-white/50 rounded-lg px-3 text-left transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                        aria-label="Välj anställningstyp"
                      >
                        <Clock className="h-4 w-4 text-white flex-shrink-0" />
                        <span className="text-sm text-white flex-1 truncate leading-none">
                          {selectedEmploymentTypes.length === 0 
                            ? 'Alla anställningar' 
                            : selectedEmploymentTypes.length === 1
                            ? '1 vald'
                            : `${selectedEmploymentTypes.length} valda`
                          }
                        </span>
                        <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" avoidCollisions={false} className="w-72 bg-slate-900 border border-white/20 rounded-md shadow-lg text-white max-h-80 overflow-y-auto [-webkit-overflow-scrolling:touch] overscroll-contain [will-change:scroll-position]">
                      <DropdownMenuItem
                        onClick={() => onEmploymentTypesChange([])}
                        className="cursor-pointer hover:bg-white/10 text-white font-medium"
                      >
                        Alla anställningar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/20" />
                      {employmentTypes.map((type, index) => (
                        <React.Fragment key={type.value}>
                          <DropdownMenuItem
                            onClick={() => {
                              const isSelected = selectedEmploymentTypes.includes(type.value);
                              if (isSelected) {
                                onEmploymentTypesChange(selectedEmploymentTypes.filter(t => t !== type.value));
                              } else {
                                onEmploymentTypesChange([...selectedEmploymentTypes, type.value]);
                              }
                            }}
                            className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                          >
                            <span>{type.label}</span>
                            {selectedEmploymentTypes.includes(type.value) && (
                              <Check className="h-4 w-4 text-white" />
                            )}
                          </DropdownMenuItem>
                          {index < employmentTypes.length - 1 && (
                            <DropdownMenuSeparator className="bg-white/20" />
                          )}
                        </React.Fragment>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Sort Dropdown */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-white inline-flex items-center gap-2 leading-none">
                    <ArrowUpDown className="h-3 w-3 flex-shrink-0" />
                    <span className="leading-none">Sortering</span>
                  </Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-full h-10 md:h-[44px] flex items-center gap-2 md:gap-3 bg-white/5 border border-white/10 hover:border-white/50 rounded-lg px-3 text-left transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20"
                        aria-label="Välj sortering"
                      >
                        <ArrowUpDown className="h-4 w-4 text-white flex-shrink-0" />
                        <span className="text-sm text-white flex-1 truncate leading-none">{sortLabels[sortBy]}</span>
                        <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="bottom" avoidCollisions={false} className="w-[200px] z-[10000] bg-slate-900 border border-white/20 rounded-md shadow-lg text-white">
                      <DropdownMenuItem 
                        onClick={() => onSortChange('newest')}
                        className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                      >
                        <span>{sortLabels.newest}</span>
                        {sortBy === 'newest' && <Check className="h-4 w-4 text-white" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/20" />
                      <DropdownMenuItem 
                        onClick={() => onSortChange('oldest')}
                        className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                      >
                        <span>{sortLabels.oldest}</span>
                        {sortBy === 'oldest' && <Check className="h-4 w-4 text-white" />}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/20" />
                      <DropdownMenuItem 
                        onClick={() => onSortChange('most-views')}
                        className="cursor-pointer hover:bg-white/10 text-white flex items-center justify-between"
                      >
                        <span>{sortLabels['most-views']}</span>
                        {sortBy === 'most-views' && <Check className="h-4 w-4 text-white" />}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Show selected employment types as badges */}
              {selectedEmploymentTypes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedEmploymentTypes.map((type) => (
                    <Badge 
                      key={type}
                      variant="secondary"
                      className="bg-white/10 text-white flex items-center gap-1 cursor-pointer transition-all duration-300 md:hover:bg-white/20 md:hover:text-white"
                    >
                      {employmentTypes.find(t => t.value === type)?.label}
                      <X 
                        className="h-3 w-3" 
                        onClick={(e) => {
                          e.stopPropagation();
                          onEmploymentTypesChange(selectedEmploymentTypes.filter(t => t !== type));
                        }}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Clear all filters button */}
          <div className="pt-2 flex justify-center">
            <button 
              className="h-9 flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 rounded-full px-5 text-xs text-white hover:text-white transition-all duration-300 focus:outline-none"
              onClick={onClearAll}
            >
              Rensa alla filter
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

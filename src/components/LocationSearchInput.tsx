import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCachedPostalCodeInfo, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
import { MapPin, Loader2, Check, X, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { swedishCountiesWithMunicipalities, CountyName } from '@/lib/swedishCountiesWithMunicipalities';

const swedishCounties = Object.keys(swedishCountiesWithMunicipalities) as CountyName[];

interface LocationSearchInputProps {
  values: string[];
  onLocationsChange: (locations: string[]) => void;
  className?: string;
}

const resolveCountyForLocation = (location: string): CountyName | null => {
  if (swedishCounties.includes(location as CountyName)) {
    return location as CountyName;
  }

  for (const county of swedishCounties) {
    if (swedishCountiesWithMunicipalities[county].includes(location)) {
      return county;
    }
  }

  return null;
};

const LocationSearchInput = ({ values, onLocationsChange, className = '' }: LocationSearchInputProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [expandedCounty, setExpandedCounty] = useState<CountyName | null>(null);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [postalCodeCity, setPostalCodeCity] = useState<{
    city: string;
    postalCode: string;
    municipality?: string;
    county?: string;
  } | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const selectedRowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const triggerLabel = useMemo(() => {
    if (values.length === 0) return 'Län, stad eller postnummer';
    if (values.length === 1) return values[0];
    return `${values.length} platser valda`;
  }, [values]);

  const primarySelection = values.length === 1 ? values[0] : null;

  const matchingMunicipalities = useMemo(() => {
    if (!dropdownSearch || /^\d+$/.test(dropdownSearch.trim())) return [];

    return Object.entries(swedishCountiesWithMunicipalities)
      .flatMap(([county, municipalities]) =>
        municipalities
          .filter((municipality) => municipality.toLowerCase().includes(dropdownSearch.toLowerCase()))
          .map((municipality) => ({ municipality, county }))
      )
      .slice(0, 50);
  }, [dropdownSearch]);

  const filteredCounties = useMemo(() => {
    if (/^\d+$/.test(dropdownSearch.trim())) return [];

    return swedishCounties.filter(
      (county) =>
        county.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        swedishCountiesWithMunicipalities[county].some((municipality) =>
          municipality.toLowerCase().includes(dropdownSearch.toLowerCase())
        )
    );
  }, [dropdownSearch]);

  const hasMatchingResults = filteredCounties.length > 0 || matchingMunicipalities.length > 0;

  useEffect(() => {
    const trimmed = dropdownSearch.trim();
    const isNumeric = /^\d+\s?\d*$/.test(trimmed);
    const cleanedCode = trimmed.replace(/\s+/g, '');

    if (!isNumeric || cleanedCode.length !== 5) {
      setPostalCodeCity(null);
      return;
    }

    const checkPostalCode = async () => {
      if (!isValidSwedishPostalCode(cleanedCode)) {
        setPostalCodeCity(null);
        return;
      }

      try {
        const location = await getCachedPostalCodeInfo(cleanedCode);
        if (!location) {
          setPostalCodeCity(null);
          return;
        }

        setPostalCodeCity({
          city: location.city,
          postalCode: cleanedCode,
          municipality: location.municipality,
          county: location.county,
        });
      } catch (error) {
        console.error('Error fetching postal code:', error);
        setPostalCodeCity(null);
      }
    };

    const timeoutId = setTimeout(checkPostalCode, 150);
    return () => clearTimeout(timeoutId);
  }, [dropdownSearch]);

  useEffect(() => {
    if (!open) return;

    if (values.length === 1) {
      const selectedLocation = values[0];
      const county = resolveCountyForLocation(selectedLocation);
      setExpandedCounty(county);

      requestAnimationFrame(() => {
        selectedRowRefs.current[selectedLocation]?.scrollIntoView({
          block: 'center',
          behavior: 'smooth',
        });
      });
    } else if (values.length === 0) {
      setExpandedCounty(null);
      requestAnimationFrame(() => {
        if (listRef.current) {
          listRef.current.scrollTop = 0;
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggleLocation = useCallback(
    async (location: string, postalCode?: string, county?: string) => {
      setIsLoading(true);

      const alreadySelected = values.includes(location);
      const nextLocations = alreadySelected
        ? values.filter((value) => value !== location)
        : [...values, location];

      onLocationsChange(nextLocations);

      if (!alreadySelected) {
        setExpandedCounty((county as CountyName | undefined) ?? resolveCountyForLocation(location));
      }

      if (postalCode) {
        setDropdownSearch(postalCode);
      }

      setPostalCodeCity(null);
      setIsLoading(false);
    },
    [onLocationsChange, values]
  );

  const handleClear = useCallback(() => {
    onLocationsChange([]);
    setDropdownSearch('');
    setPostalCodeCity(null);
    setExpandedCounty(null);
  }, [onLocationsChange]);

  const renderSelectionIndicator = (selected: boolean) => {
    if (selected) {
      return <Check className="h-4 w-4 text-green-400 flex-shrink-0" />;
    }

    return <div className="h-4 w-4 flex-shrink-0" />;
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Popover
        open={open}
        onOpenChange={(isOpen) => {
          setOpen(isOpen);
          if (isOpen) {
            setDropdownSearch('');
            setPostalCodeCity(null);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            className={cn(
              'w-full h-12 flex items-center gap-3 bg-white/5 border border-white/10 hover:border-white/50 rounded-lg px-3 text-left transition-all duration-300 md:hover:bg-white/10 md:hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/20 touch-manipulation',
              values.length > 0 && 'border-white/20'
            )}
            aria-label="Välj plats"
            type="button"
          >
            <MapPin className="h-4 w-4 text-white flex-shrink-0" />
            <span className="text-[15px] md:text-sm text-white flex-1 truncate leading-tight py-0.5 min-w-0">
              {triggerLabel}
            </span>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white flex-shrink-0" />
            ) : values.length > 0 ? (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  handleClear();
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full text-white bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors"
                aria-label="Rensa plats"
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <ChevronDown className="h-4 w-4 text-white flex-shrink-0" />
            )}
          </button>
        </PopoverTrigger>

        <PopoverContent
          className="z-50 w-[var(--radix-popover-trigger-width)] p-0 bg-slate-900 border border-white/20 pointer-events-auto"
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions={false}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command className="bg-transparent border-none" shouldFilter={false} loop={false} value="">
            <div className="flex items-center px-3 border-b border-white/10">
              <Search className="mr-2 h-4 w-4 shrink-0 text-white" />
               <input
                value={dropdownSearch}
                onChange={(event) => setDropdownSearch(event.target.value)}
                placeholder="Sök län eller stad/postnummer"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-[16px] leading-tight outline-none text-white placeholder:text-white/70"
              />
            </div>

            <CommandList
              ref={listRef}
              className="max-h-[50vh] md:max-h-[320px] overflow-y-auto [-webkit-overflow-scrolling:touch] overscroll-contain [will-change:scroll-position]"
            >
              {!/^\d+$/.test(dropdownSearch.trim()) && dropdownSearch && !hasMatchingResults && (
                <CommandEmpty className="text-white py-4 text-center text-sm">Ingen plats hittades.</CommandEmpty>
              )}

              {dropdownSearch && /^\d+$/.test(dropdownSearch.trim()) && dropdownSearch.trim().length < 5 && (
                <div className="py-2 px-3 text-white text-xs text-center">
                  {dropdownSearch.trim().length} av 5 siffror - Postnummer måste innehålla 5 siffror
                </div>
              )}

              {postalCodeCity && (
                <CommandGroup heading="Postnummer" className="text-white">
                  <button
                    type="button"
                    onClick={() => toggleLocation(postalCodeCity.city, postalCodeCity.postalCode, postalCodeCity.county)}
                    className="w-full flex items-center justify-between gap-3 rounded-sm px-2 py-3 md:py-2 text-left text-white active:bg-white/10 [@media(hover:hover)]:hover:bg-white/10 touch-manipulation"
                    ref={(element) => {
                      selectedRowRefs.current[postalCodeCity.city] = element;
                    }}
                  >
                    <div className="flex min-w-0 items-start gap-3 flex-1">
                      <div className="min-w-0">
                        <span className="block font-medium text-white leading-tight">{postalCodeCity.city}</span>
                        <span className="block text-xs text-white/80 leading-tight mt-0.5">
                          {postalCodeCity.postalCode}
                          {postalCodeCity.municipality && ` · ${postalCodeCity.municipality}`}
                          {postalCodeCity.county && ` · ${postalCodeCity.county}`}
                        </span>
                      </div>
                    </div>
                    {renderSelectionIndicator(values.includes(postalCodeCity.city))}
                  </button>
                </CommandGroup>
              )}

              {matchingMunicipalities.length > 0 && !postalCodeCity && (
                <>
                  <div className="h-px bg-white/20 my-1" />
                  <CommandGroup heading="Kommuner" className="[&_[cmdk-group-heading]]:text-white [&_[cmdk-group-heading]]:font-medium">
                    {matchingMunicipalities.map((item, index, array) => {
                      const isSelected = values.includes(item.municipality);

                      return (
                        <React.Fragment key={`${item.county}-${item.municipality}`}>
                          <button
                            type="button"
                            onClick={() => toggleLocation(item.municipality, undefined, item.county)}
                            className={cn(
                              'w-full flex items-center gap-3 px-2 py-3 md:py-2 text-left text-white active:bg-white/10 [@media(hover:hover)]:hover:bg-white/10 touch-manipulation',
                              isSelected && 'bg-white/5'
                            )}
                            ref={(element) => {
                              selectedRowRefs.current[item.municipality] = element;
                            }}
                          >
                            <span className="min-w-0 flex-1 truncate text-[15px] md:text-sm leading-tight py-0.5">
                              {item.municipality}
                            </span>
                            <span className="text-xs text-white/80 leading-tight">{item.county}</span>
                            {renderSelectionIndicator(isSelected)}
                          </button>
                          {index < array.length - 1 && <div className="h-px bg-white/20 mx-2" />}
                        </React.Fragment>
                      );
                    })}
                  </CommandGroup>
                </>
              )}

              {!/^\d+$/.test(dropdownSearch.trim()) && filteredCounties.length > 0 && (
                <>
                  <div className="h-px bg-white/20 my-1" />
                  <CommandGroup heading="Län" className="[&_[cmdk-group-heading]]:text-white [&_[cmdk-group-heading]]:font-medium">
                    {filteredCounties.map((county, index, array) => (
                      <React.Fragment key={county}>
                        <button
                          type="button"
                          onClick={() => setExpandedCounty(expandedCounty === county ? null : county)}
                          className="w-full flex items-center gap-3 px-2 py-3 md:py-2 text-left text-white active:bg-white/10 [@media(hover:hover)]:hover:bg-white/10 touch-manipulation"
                        >
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-[15px] md:text-sm leading-tight py-0.5">{county}</span>
                          {expandedCounty === county ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0" />
                          )}
                        </button>

                        {expandedCounty === county &&
                          swedishCountiesWithMunicipalities[county].map((municipality, municipalityIndex, municipalityArray) => {
                            const isSelected = values.includes(municipality);

                            return (
                              <React.Fragment key={municipality}>
                                <button
                                  type="button"
                                  onClick={() => toggleLocation(municipality, undefined, county)}
                                  className={cn(
                                    'w-full flex items-center gap-3 pl-3 pr-3 py-3 md:py-2 text-left text-white active:bg-white/10 [@media(hover:hover)]:hover:bg-white/10 touch-manipulation',
                                    isSelected && 'bg-white/5'
                                  )}
                                  ref={(element) => {
                                    selectedRowRefs.current[municipality] = element;
                                  }}
                                >
                                  <span className="min-w-0 flex-1 truncate text-[15px] md:text-sm leading-tight py-0.5">
                                    {municipality}
                                  </span>
                                  {renderSelectionIndicator(isSelected)}
                                </button>
                                {municipalityIndex < municipalityArray.length - 1 && (
                                  <div className="h-px bg-white/20 mx-2" />
                                )}
                              </React.Fragment>
                            );
                          })}

                        {index < array.length - 1 && <div className="h-px bg-white/20 mx-2" />}
                      </React.Fragment>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {values.length > 0 && (
        <div className="space-y-1 pl-3">
          {values.map((location) => (
            <div
              key={location}
              className={cn(
                'flex items-center gap-2 text-sm text-white',
                primarySelection ? 'justify-start' : 'justify-start'
              )}
            >
              <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
              <span className="font-medium leading-tight">{location}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationSearchInput;
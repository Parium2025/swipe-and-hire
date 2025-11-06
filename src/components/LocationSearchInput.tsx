import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { getCachedPostalCodeInfo, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
import { MapPin, Loader2, Check, X, ChevronDown, ChevronRight, Search } from 'lucide-react';
import { getAllCities } from '@/lib/swedishCities';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { swedishCountiesWithMunicipalities, CountyName } from '@/lib/swedishCountiesWithMunicipalities';

const swedishCounties = Object.keys(swedishCountiesWithMunicipalities) as CountyName[];

interface LocationSearchInputProps {
  value: string;
  onLocationChange: (location: string, postalCode?: string, municipality?: string, county?: string) => void;
  onPostalCodeChange?: (postalCode: string) => void;
  className?: string;
}

const LocationSearchInput = ({ 
  value,
  onLocationChange,
  onPostalCodeChange,
  className = ""
}: LocationSearchInputProps) => {
  const [searchInput, setSearchInput] = useState(value);
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
  const [foundLocation, setFoundLocation] = useState<{
    type: 'postal' | 'city';
    city: string;
    postalCode?: string;
    municipality?: string;
    county?: string;
  } | null>(null);

  // Sync with external value changes
  useEffect(() => {
    if (value !== searchInput) {
      setSearchInput(value);
    }
  }, [value]);

  // Check if dropdown search is a postal code and fetch city
  useEffect(() => {
    const checkPostalCode = async () => {
      const trimmed = dropdownSearch.trim();
      const isNumeric = /^\d+\s?\d*$/.test(trimmed);
      
      if (isNumeric) {
        const cleanedCode = trimmed.replace(/\s+/g, '');
        
        if (cleanedCode.length === 5 && isValidSwedishPostalCode(cleanedCode)) {
          try {
            const location = await getCachedPostalCodeInfo(cleanedCode);
            if (location) {
              setPostalCodeCity({
                city: location.city,
                postalCode: cleanedCode,
                municipality: location.municipality,
                county: location.county
              });
            } else {
              setPostalCodeCity(null);
            }
          } catch (error) {
            console.error('Error fetching postal code:', error);
            setPostalCodeCity(null);
          }
        } else {
          setPostalCodeCity(null);
        }
      } else {
        setPostalCodeCity(null);
      }
    };

    const timeoutId = setTimeout(checkPostalCode, 300);
    return () => clearTimeout(timeoutId);
  }, [dropdownSearch]);

  useEffect(() => {
    const searchLocation = async () => {
      const trimmed = searchInput.trim();
      
      if (!trimmed) {
        setFoundLocation(null);
        setIsLoading(false);
        onLocationChange('');
        return;
      }

      setIsLoading(true);
      
      // Check if input is numbers (postal code)
      const isNumeric = /^\d+\s?\d*$/.test(trimmed);
      
      if (isNumeric) {
        const cleanedCode = trimmed.replace(/\s+/g, '');
        
        if (cleanedCode.length === 5 && isValidSwedishPostalCode(cleanedCode)) {
          try {
            const location = await getCachedPostalCodeInfo(cleanedCode);
            if (location) {
              setFoundLocation({
                type: 'postal',
                city: location.city,
                postalCode: cleanedCode,
                municipality: location.municipality,
                county: location.county
              });
              onLocationChange(location.city, cleanedCode, location.municipality, location.county || '');
              onPostalCodeChange?.(cleanedCode);
            } else {
              setFoundLocation(null);
            }
          } catch (error) {
            console.error('Error fetching postal code:', error);
            setFoundLocation(null);
          }
        }
      } else {
        // Search by city name
        const cities = getAllCities();
        const normalizedInput = trimmed.toLowerCase();
        const matchedCity = cities.find(city => 
          city.toLowerCase() === normalizedInput ||
          city.toLowerCase().startsWith(normalizedInput)
        );
        
        if (matchedCity) {
          setFoundLocation({
            type: 'city',
            city: matchedCity
          });
          onLocationChange(matchedCity);
        } else {
          // Still allow the search even if city not found
          onLocationChange(trimmed);
          setFoundLocation(null);
        }
      }
      
      setIsLoading(false);
    };

    const timeoutId = setTimeout(searchLocation, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput, onLocationChange, onPostalCodeChange]);

  const handleClear = useCallback(() => {
    setSearchInput('');
    setFoundLocation(null);
    onLocationChange('');
    onPostalCodeChange?.('');
  }, [onLocationChange, onPostalCodeChange]);

  const handleCountyClick = useCallback((county: CountyName) => {
    // Toggle expansion instead of selecting
    setExpandedCounty(expandedCounty === county ? null : county);
  }, [expandedCounty]);

  const handleMunicipalitySelect = useCallback((municipality: string, postalCode?: string, county?: string) => {
    setSearchInput(municipality);
    setDropdownSearch('');
    setPostalCodeCity(null);
    setFoundLocation({
      type: 'city',
      city: municipality
    });
    onLocationChange(municipality, postalCode, municipality, county);
    if (postalCode) {
      onPostalCodeChange?.(postalCode);
    }
    setOpen(false);
  }, [onLocationChange, onPostalCodeChange]);

  return (
    <div className={`space-y-2 ${className}`}>
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          // If there's a selected location, find its county and expand it
          if (searchInput && foundLocation) {
            if (foundLocation.county) {
              setExpandedCounty(foundLocation.county as CountyName);
            } else if (foundLocation.municipality || foundLocation.city) {
              // Find county by searching through all counties
              const cityToFind = foundLocation.municipality || foundLocation.city;
              const foundCounty = Object.entries(swedishCountiesWithMunicipalities).find(([_, municipalities]) =>
                municipalities.includes(cityToFind)
              );
              if (foundCounty) {
                setExpandedCounty(foundCounty[0] as CountyName);
              }
            }
          } else {
            setExpandedCounty(null);
          }
          setDropdownSearch('');
          setPostalCodeCity(null);
        }
      }}>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "w-full flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-left transition-all duration-300 md:hover:bg-white/10",
              "focus:outline-none focus:ring-2 focus:ring-white/20"
            )}
            aria-label="Välj plats"
          >
            <MapPin className="h-4 w-4 text-white flex-shrink-0" />
            <span className="text-sm text-white/90 flex-1 truncate">
              {searchInput || "Sök på län eller stad/postnummer"}
            </span>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/60 flex-shrink-0" />
            ) : searchInput ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="text-white transition-colors"
                aria-label="Rensa"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            ) : (
              <ChevronDown className="h-4 w-4 text-white/60 flex-shrink-0" />
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent 
          className="z-50 w-[var(--radix-popover-trigger-width)] p-0 bg-slate-700/95 backdrop-blur-md border-slate-500/30 pointer-events-auto" 
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions={false}
        >
          <Command 
            className="bg-transparent border-none" 
            shouldFilter={false}
            loop={false}
            value=""
          >
            <div className="flex items-center border-b border-white/10 px-3" cmdk-input-wrapper="">
              <Search className="mr-2 h-4 w-4 shrink-0 text-white" />
              <input
                value={dropdownSearch}
                onChange={(e) => setDropdownSearch(e.target.value)}
                placeholder="Sök län eller stad/postnummer"
                className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none text-white placeholder:text-white/60"
              />
            </div>
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty className="text-white py-6 text-center">Ingen plats hittades.</CommandEmpty>
              
              {/* Show postal code validation hint */}
              {dropdownSearch && /^\d+$/.test(dropdownSearch.trim()) && dropdownSearch.trim().length < 5 && (
                <div className="py-2 px-3 text-white text-sm text-center border-t border-white/10">
                  {dropdownSearch.trim().length} av 5 siffror
                </div>
              )}
              
              {/* Show postal code result if found */}
              {postalCodeCity && (
                <CommandGroup heading="Postnummer" className="text-white [&_[cmdk-group-heading]]:text-white">
                  <CommandItem
                    value={postalCodeCity.city}
                    onSelect={() => handleMunicipalitySelect(
                      postalCodeCity.city, 
                      postalCodeCity.postalCode,
                      postalCodeCity.county
                    )}
                    className="cursor-pointer text-white hover:bg-slate-700/70 flex items-center justify-between"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium text-white">{postalCodeCity.city}</span>
                      <span className="text-white text-xs">
                        {postalCodeCity.postalCode}
                        {postalCodeCity.municipality && ` · ${postalCodeCity.municipality}`}
                        {postalCodeCity.county && ` · ${postalCodeCity.county}`}
                      </span>
                    </div>
                    {searchInput === postalCodeCity.city && (
                      <Check className="h-4 w-4 text-white flex-shrink-0" />
                    )}
                  </CommandItem>
                </CommandGroup>
              )}
              
              {/* Show matching municipalities directly if there's a search - hide when searching with numbers */}
              {dropdownSearch && !postalCodeCity && !(/^\d+$/.test(dropdownSearch.trim())) && (
                <CommandGroup heading="Kommuner" className="[&_[cmdk-group-heading]]:text-white [&_[cmdk-group-heading]]:font-medium">
                  {Object.entries(swedishCountiesWithMunicipalities)
                    .flatMap(([county, municipalities]) => 
                      municipalities
                        .filter(m => m.toLowerCase().includes(dropdownSearch.toLowerCase()))
                        .map(m => ({ municipality: m, county }))
                    )
                    .slice(0, 10) // Limit to 10 direct results
                    .map(({ municipality, county }) => (
                      <CommandItem
                        key={municipality}
                        value={municipality}
                        onSelect={() => handleMunicipalitySelect(municipality)}
                        className="cursor-pointer text-white hover:bg-slate-700/70 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span>{municipality}</span>
                          <span className="text-white/50 text-xs">({county})</span>
                        </div>
                        {searchInput === municipality && (
                          <Check className="h-4 w-4 text-white flex-shrink-0" />
                        )}
                      </CommandItem>
                    ))
                  }
                </CommandGroup>
              )}
              
              {/* Show counties - hide when searching with numbers */}
              {!(/^\d+$/.test(dropdownSearch.trim())) && (
                <CommandGroup heading="Län" className="[&_[cmdk-group-heading]]:text-white [&_[cmdk-group-heading]]:font-medium">
                  {swedishCounties
                    .filter(county => 
                      !dropdownSearch || 
                      county.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
                      swedishCountiesWithMunicipalities[county].some(m => 
                        m.toLowerCase().includes(dropdownSearch.toLowerCase())
                      )
                    )
                    .map((county) => (
                  <div key={county}>
                    <CommandItem
                      value={county}
                      onSelect={() => handleCountyClick(county)}
                      className="cursor-pointer text-white hover:bg-slate-700/70 flex items-center justify-between"
                    >
                      <span>{county}</span>
                      {expandedCounty === county ? (
                        <ChevronDown className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 flex-shrink-0" />
                      )}
                    </CommandItem>
                    {expandedCounty === county && (
                      <div className="bg-slate-800/30">
                        {swedishCountiesWithMunicipalities[county]
                          .filter(municipality => 
                            !dropdownSearch || 
                            municipality.toLowerCase().includes(dropdownSearch.toLowerCase())
                          )
                          .map((municipality) => (
                            <CommandItem
                              key={municipality}
                              value={municipality}
                              onSelect={() => handleMunicipalitySelect(municipality, undefined, county)}
                              className="cursor-pointer text-white hover:bg-slate-700/50 text-sm pl-6 flex items-center justify-between"
                            >
                              <span>{municipality}</span>
                              {searchInput === municipality && (
                                <Check className="h-4 w-4 text-white flex-shrink-0" />
                              )}
                            </CommandItem>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Success indicator */}
      {foundLocation && !isLoading && (
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0">
            <Check className="w-2.5 h-2.5 text-green-400" />
          </div>
          <p className="text-white/90">
            {foundLocation.type === 'postal' ? (
              <>
                <span className="font-medium">{foundLocation.city}</span>
                {foundLocation.county && <span className="text-white/70"> ({foundLocation.county})</span>}
              </>
            ) : (
              <span className="font-medium">{foundLocation.city}</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationSearchInput;

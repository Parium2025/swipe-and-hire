import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { getCachedPostalCodeInfo, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
import { MapPin, Loader2, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
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

  const handleCountySelect = useCallback((county: CountyName) => {
    setSearchInput(county);
    setFoundLocation({
      type: 'city',
      city: county
    });
    onLocationChange(county);
    setOpen(false);
  }, [onLocationChange]);

  const handleMunicipalitySelect = useCallback((municipality: string) => {
    setSearchInput(municipality);
    setFoundLocation({
      type: 'city',
      city: municipality
    });
    onLocationChange(municipality);
    setOpen(false);
  }, [onLocationChange]);

  const toggleCounty = useCallback((county: CountyName, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCounty(expandedCounty === county ? null : county);
  }, [expandedCounty]);

  return (
    <div className={`space-y-2 ${className}`}>
      <Popover open={open} onOpenChange={setOpen}>
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
              {searchInput || "Postnummer eller ort..."}
            </span>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/60 flex-shrink-0" />
            ) : searchInput ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="text-white/60 hover:text-white transition-colors"
                aria-label="Rensa"
              >
                <X className="h-4 w-4" />
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
          <Command className="bg-transparent border-none">
            <CommandInput 
              placeholder="Sök län eller stad..." 
              value={searchInput}
              onValueChange={setSearchInput}
              className="border-none focus:ring-0 bg-transparent text-white placeholder:text-white/60"
            />
            <CommandList className="max-h-[300px] overflow-y-auto">
              <CommandEmpty className="text-white/60 py-6 text-center">Ingen plats hittades.</CommandEmpty>
              <CommandGroup heading="Län" className="text-white/70">
                {swedishCounties.map((county) => (
                  <div key={county}>
                    <CommandItem
                      value={county}
                      onSelect={() => handleCountySelect(county)}
                      className="cursor-pointer text-white hover:bg-slate-700/70 flex items-center justify-between"
                    >
                      <span>{county}</span>
                      <button
                        onClick={(e) => toggleCounty(county, e)}
                        className="ml-auto hover:bg-white/10 p-1 rounded"
                        aria-label={expandedCounty === county ? "Dölj kommuner" : "Visa kommuner"}
                      >
                        {expandedCounty === county ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </CommandItem>
                    {expandedCounty === county && (
                      <div className="pl-6 border-l border-white/10 ml-2">
                        {swedishCountiesWithMunicipalities[county].map((municipality) => (
                          <CommandItem
                            key={municipality}
                            value={municipality}
                            onSelect={() => handleMunicipalitySelect(municipality)}
                            className="cursor-pointer text-white/80 hover:bg-slate-700/50 text-sm py-1.5"
                          >
                            {municipality}
                          </CommandItem>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CommandGroup>
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

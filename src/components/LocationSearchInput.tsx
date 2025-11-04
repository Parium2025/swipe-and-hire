import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { getCachedPostalCodeInfo, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
import { MapPin, Loader2, Check, X, ChevronDown } from 'lucide-react';
import { getAllCities } from '@/lib/swedishCities';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';

const swedishCounties = [
  "Blekinge län",
  "Dalarnas län",
  "Gotlands län",
  "Gävleborgs län",
  "Hallands län",
  "Jämtlands län",
  "Jönköpings län",
  "Kalmar län",
  "Kronobergs län",
  "Norrbottens län",
  "Skåne län",
  "Stockholms län",
  "Södermanlands län",
  "Uppsala län",
  "Värmlands län",
  "Västerbottens län",
  "Västernorrlands län",
  "Västmanlands län",
  "Västra Götalands län",
  "Örebro län",
  "Östergötlands län"
];

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

  const handleCountySelect = useCallback((county: string) => {
    setSearchInput(county);
    setFoundLocation({
      type: 'city',
      city: county
    });
    onLocationChange(county);
    setOpen(false);
  }, [onLocationChange]);

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
          className="z-50 w-[var(--radix-popover-trigger-width)] p-0 bg-[#0A1628] border-white/10 pointer-events-auto" 
          align="start"
          side="bottom"
          sideOffset={4}
          avoidCollisions={false}
        >
          <Command className="bg-[#0A1628] border-none">
            <CommandInput 
              placeholder="Sök län eller stad..." 
              value={searchInput}
              onValueChange={setSearchInput}
              className="border-none focus:ring-0 bg-[#0A1628] text-white placeholder:text-white/60"
            />
            <CommandList className="max-h-[300px] overflow-y-auto bg-[#0A1628]">
              <CommandEmpty className="text-white/60 py-6 text-center">Ingen plats hittades.</CommandEmpty>
              <CommandGroup heading="Län" className="text-white/70">
                {swedishCounties.map((county) => (
                  <CommandItem
                    key={county}
                    value={county}
                    onSelect={() => handleCountySelect(county)}
                    className="cursor-pointer text-white/90 hover:bg-white/10 aria-selected:bg-white/10"
                  >
                    {county}
                  </CommandItem>
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

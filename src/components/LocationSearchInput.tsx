import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { getCachedPostalCodeInfo, isValidSwedishPostalCode } from '@/lib/postalCodeAPI';
import { MapPin, Loader2, Check, X } from 'lucide-react';
import { getAllCities } from '@/lib/swedishCities';

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
          // Try to get county info by looking up any postal code for this city
          try {
            const cityData = (await import('@/lib/swedishCities')).swedishCities.find(
              c => c.name.toLowerCase() === matchedCity.toLowerCase()
            );
            
            if (cityData && cityData.postalCodes.length > 0) {
              // Use first postal code to get county info
              const firstPostalCode = cityData.postalCodes[0].replace(/\s+/g, '');
              const locationInfo = await getCachedPostalCodeInfo(firstPostalCode);
              
              setFoundLocation({
                type: 'city',
                city: matchedCity,
                county: locationInfo?.county,
                municipality: locationInfo?.municipality
              });
              onLocationChange(matchedCity, undefined, locationInfo?.municipality, locationInfo?.county || '');
            } else {
              setFoundLocation({
                type: 'city',
                city: matchedCity
              });
              onLocationChange(matchedCity);
            }
          } catch (error) {
            console.error('Error fetching city county info:', error);
            setFoundLocation({
              type: 'city',
              city: matchedCity
            });
            onLocationChange(matchedCity);
          }
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

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white z-10" />
        <Input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Postnummer eller ort..."
          className="bg-white/5 border-white/10 text-white placeholder:text-white/60 text-sm pl-10 pr-10 transition-all duration-300 md:hover:bg-white/10"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        {isLoading ? (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-white/60" />
          </div>
        ) : searchInput && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors"
            aria-label="Rensa"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

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
              <>
                <span className="font-medium">{foundLocation.city}</span>
                {foundLocation.county && <span className="text-white/70"> ({foundLocation.county})</span>}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default LocationSearchInput;

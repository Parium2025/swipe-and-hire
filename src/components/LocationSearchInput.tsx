import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { getCachedPostalCodeInfo, isValidSwedishPostalCode, getLocationByCityName } from '@/lib/postalCodeAPI';
import { MapPin, Loader2, Check, X } from 'lucide-react';
import { getAllCities } from '@/lib/swedishCities';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Job {
  workplace_city?: string;
  location?: string;
  workplace_postal_code?: string;
}

interface LocationSearchInputProps {
  value?: string;
  onLocationChange: (location: string, postalCode?: string, municipality?: string, county?: string) => void;
  onPostalCodeChange?: (postalCode: string) => void;
  className?: string;
  jobs?: Job[];
}

const LocationSearchInput = ({ 
  value,
  onLocationChange,
  onPostalCodeChange,
  className = "",
  jobs = []
}: LocationSearchInputProps) => {
  const [searchInput, setSearchInput] = useState(value ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [foundLocation, setFoundLocation] = useState<{
    type: 'postal' | 'city';
    city: string;
    postalCode?: string;
    municipality?: string;
    county?: string;
  } | null>(null);

  interface Suggestion {
    city: string;
    postalCode?: string;
    county?: string;
    municipality?: string;
    jobCount: number;
  }

  // Calculate job count per location
  const getJobCountForLocation = useCallback((city: string, postalCode?: string) => {
    return jobs.filter(job => {
      const normalizeCity = (c?: string) => c?.toLowerCase().trim() || '';
      const jobCity = normalizeCity(job.workplace_city || job.location);
      const targetCity = normalizeCity(city);
      
      if (postalCode && job.workplace_postal_code) {
        return job.workplace_postal_code === postalCode;
      }
      
      return jobCity === targetCity || jobCity.includes(targetCity);
    }).length;
  }, [jobs]);

  // Generate suggestions based on search input
  const suggestions = useMemo(() => {
    const trimmed = searchInput.trim();
    if (!trimmed || trimmed.length < 2) return [];

    const isNumeric = /^\d+\s?\d*$/.test(trimmed);
    const results: Suggestion[] = [];
    const seen = new Set<string>();

    if (isNumeric) {
      // Search postal codes
      const cleanedCode = trimmed.replace(/\s+/g, '');
      jobs.forEach(job => {
        if (job.workplace_postal_code?.startsWith(cleanedCode)) {
          const key = job.workplace_postal_code;
          if (!seen.has(key)) {
            seen.add(key);
            const city = job.workplace_city || job.location || 'Okänd ort';
            results.push({
              city,
              postalCode: job.workplace_postal_code,
              jobCount: getJobCountForLocation(city, job.workplace_postal_code)
            });
          }
        }
      });
    } else {
      // Search city names
      const normalizedInput = trimmed.toLowerCase();
      const cities = getAllCities();
      
      cities.forEach(city => {
        if (city.toLowerCase().includes(normalizedInput)) {
          const key = city.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            const jobCount = getJobCountForLocation(city);
            results.push({ city, jobCount }); // Visa alla städer, även med 0 jobb
          }
        }
      });

      // Also check actual job locations
      jobs.forEach(job => {
        const jobCity = job.workplace_city || job.location;
        if (jobCity && jobCity.toLowerCase().includes(normalizedInput)) {
          const key = jobCity.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              city: jobCity,
              jobCount: getJobCountForLocation(jobCity)
            });
          }
        }
      });
    }

    // Sort by job count (most jobs first)
    return results.sort((a, b) => b.jobCount - a.jobCount).slice(0, 10);
  }, [searchInput, jobs, getJobCountForLocation]);

  // Sync with external value changes (only when provided)
  useEffect(() => {
    if (value !== undefined && value !== searchInput) {
      setSearchInput(value);
    }
  }, [value]);

  // Update dropdown position when input moves or suggestions change
  useEffect(() => {
    if (showSuggestions && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [showSuggestions, suggestions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    const handleScroll = () => {
      if (showSuggestions && inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        });
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [showSuggestions]);

  const handleClear = useCallback(() => {
    setSearchInput('');
    setFoundLocation(null);
    setShowSuggestions(false);
    onLocationChange('');
    onPostalCodeChange?.('');
  }, [onLocationChange, onPostalCodeChange]);

  const handleSelectSuggestion = async (suggestion: Suggestion) => {
    setSearchInput(suggestion.city);
    setShowSuggestions(false);
    setIsLoading(true);

    if (suggestion.postalCode) {
      try {
        const location = await getCachedPostalCodeInfo(suggestion.postalCode);
        if (location) {
          setFoundLocation({
            type: 'postal',
            city: location.city,
            postalCode: suggestion.postalCode,
            municipality: location.municipality,
            county: location.county
          });
          onLocationChange(location.city, suggestion.postalCode, location.municipality, location.county || '');
          onPostalCodeChange?.(suggestion.postalCode);
        }
      } catch (error) {
        console.error('Error fetching postal code:', error);
      }
    } else {
      try {
        const info = await getLocationByCityName(suggestion.city);
        if (info) {
          setFoundLocation({
            type: 'city',
            city: info.city,
            county: info.county,
            municipality: info.municipality
          });
          onLocationChange(info.city, undefined, info.municipality, info.county || '');
        } else {
          onLocationChange(suggestion.city);
        }
      } catch (e) {
        onLocationChange(suggestion.city);
      }
    }
    
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          handleSelectSuggestion(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div className={`relative space-y-2 ${className}`}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white z-10" />
        <Input
          ref={inputRef}
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
            setShowSuggestions(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => searchInput.length >= 2 && suggestions.length > 0 && setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Postnummer eller ort..."
          className="bg-white/5 border-white/10 text-white placeholder:text-white/60 text-sm pl-10 pr-10 transition-all duration-300 md:hover:bg-white/10"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
        {isLoading ? (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 z-10">
            <Loader2 className="h-4 w-4 animate-spin text-white/60" />
          </div>
        ) : searchInput && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white transition-colors z-10"
            aria-label="Rensa"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown with suggestions - Using Portal */}
      {showSuggestions && suggestions.length > 0 && createPortal(
        <div 
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          }}
          className="bg-slate-800/95 backdrop-blur-md border border-white/20 rounded-lg shadow-xl z-[10000] max-h-80 overflow-hidden mt-1"
        >
          <ScrollArea className="max-h-80">
            <div className="py-2">
              {suggestions.map((suggestion, index) => (
                <button
                  key={`${suggestion.city}-${suggestion.postalCode || index}`}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className={`w-full px-4 py-3 text-left transition-colors ${
                    index === selectedIndex 
                      ? 'bg-white/20' 
                      : 'hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-white/60 flex-shrink-0" />
                        <span className="text-white font-medium truncate">
                          {suggestion.city}
                        </span>
                      </div>
                      {suggestion.postalCode && (
                        <div className="text-xs text-white/60 mt-0.5 ml-6">
                          {suggestion.postalCode}
                        </div>
                      )}
                    </div>
                    <div className={`flex-shrink-0 px-2 py-1 rounded text-xs font-medium ${
                      suggestion.jobCount === 0 
                        ? 'bg-white/5 text-white/50' 
                        : 'bg-white/10 text-white/90'
                    }`}>
                      {suggestion.jobCount} {suggestion.jobCount === 1 ? 'jobb' : 'jobb'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>,
        document.body
      )}

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

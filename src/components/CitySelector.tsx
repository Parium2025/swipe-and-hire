import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { filterCities, findCityByPostalCode, formatPostalCode, isValidPostalCodeFormat, swedishCities } from '@/lib/swedishCities';
import { MapPin } from 'lucide-react';

interface CitySelectorProps {
  cityValue: string;
  postalCodeValue: string;
  onCityChange: (city: string) => void;
  onPostalCodeChange: (postalCode: string) => void;
  className?: string;
}

const CitySelector = ({ 
  cityValue, 
  postalCodeValue, 
  onCityChange, 
  onPostalCodeChange,
  className = ""
}: CitySelectorProps) => {
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showPostalSuggestions, setShowPostalSuggestions] = useState(false);
  const [filteredCities, setFilteredCities] = useState<Array<{name: string; postalCodes: string[]}>>([]);
  const [filteredPostalCodes, setFilteredPostalCodes] = useState<string[]>([]);
  const [suggestedCity, setSuggestedCity] = useState<string>('');
  const [activeCityIndex, setActiveCityIndex] = useState(-1);
  const [activePostalIndex, setActivePostalIndex] = useState(-1);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const postalInputRef = useRef<HTMLInputElement>(null);
  const citySuggestionsRef = useRef<HTMLDivElement>(null);
  const postalSuggestionsRef = useRef<HTMLDivElement>(null);

  // Hantera stad-input och visa postnummer för den staden
  useEffect(() => {
    if (cityValue.trim()) {
      const cities = filterCities(cityValue);
      setFilteredCities(cities);
      
      // Om en specifik stad är matchad exakt, visa dess postnummer
      const exactMatch = cities.find(city => 
        city.name.toLowerCase() === cityValue.toLowerCase()
      );
      
      if (exactMatch) {
        setFilteredPostalCodes(exactMatch.postalCodes);
        setShowPostalSuggestions(true);
        setShowCitySuggestions(false);
      } else {
        setShowCitySuggestions(cities.length > 0);
        setShowPostalSuggestions(false);
      }
    } else {
      setFilteredCities([]);
      setShowCitySuggestions(false);
      setShowPostalSuggestions(false);
    }
    setActiveCityIndex(-1);
  }, [cityValue]);

  // Hantera postnummer-input och hitta matchande stad
  useEffect(() => {
    if (postalCodeValue.trim().length >= 3) {
      const foundCity = findCityByPostalCode(postalCodeValue);
      if (foundCity && foundCity !== cityValue) {
        setSuggestedCity(foundCity);
      } else {
        setSuggestedCity('');
      }
    } else {
      setSuggestedCity('');
    }
  }, [postalCodeValue, cityValue]);

  const handleCitySelect = (cityName: string) => {
    onCityChange(cityName);
    setShowCitySuggestions(false);
    setActiveCityIndex(-1);
    
    // Hitta den valda stadens postnummer och visa dem
    const selectedCity = swedishCities.find(city => city.name === cityName);
    if (selectedCity) {
      setFilteredPostalCodes(selectedCity.postalCodes);
      setShowPostalSuggestions(true);
    }
  };

  const handlePostalCodeSelect = (postalCode: string) => {
    onPostalCodeChange(postalCode);
    setShowPostalSuggestions(false);
    setActivePostalIndex(-1);
  };

  const handleCitySuggestionAccept = () => {
    if (suggestedCity) {
      onCityChange(suggestedCity);
      setSuggestedCity('');
    }
  };

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPostalCode(value);
    onPostalCodeChange(formatted);
  };

  const handleCityKeyDown = (e: React.KeyboardEvent) => {
    if (!showCitySuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveCityIndex(prev => 
          prev < filteredCities.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveCityIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeCityIndex >= 0 && activeCityIndex < filteredCities.length) {
          handleCitySelect(filteredCities[activeCityIndex].name);
        }
        break;
      case 'Escape':
        setShowCitySuggestions(false);
        setActiveCityIndex(-1);
        break;
    }
  };

  const handlePostalKeyDown = (e: React.KeyboardEvent) => {
    if (!showPostalSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActivePostalIndex(prev => 
          prev < filteredPostalCodes.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActivePostalIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (activePostalIndex >= 0 && activePostalIndex < filteredPostalCodes.length) {
          handlePostalCodeSelect(filteredPostalCodes[activePostalIndex]);
        }
        break;
      case 'Escape':
        setShowPostalSuggestions(false);
        setActivePostalIndex(-1);
        break;
    }
  };

  // Stäng dropdowns när man klickar utanför
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cityInputRef.current && 
        !cityInputRef.current.contains(event.target as Node) &&
        citySuggestionsRef.current && 
        !citySuggestionsRef.current.contains(event.target as Node)
      ) {
        setShowCitySuggestions(false);
      }
      
      if (
        postalInputRef.current && 
        !postalInputRef.current.contains(event.target as Node) &&
        postalSuggestionsRef.current && 
        !postalSuggestionsRef.current.contains(event.target as Node)
      ) {
        setShowPostalSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Stad/Ort fält */}
      <div className="relative">
        <Label htmlFor="city" className="text-white">Var bor du</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            ref={cityInputRef}
            id="city"
            value={cityValue}
            onChange={(e) => onCityChange(e.target.value)}
            onKeyDown={handleCityKeyDown}
            placeholder="Börja skriv din stad..."
            className="pl-10 text-base"
            autoComplete="off"
          />
        </div>
        
        {/* Stadsförslag dropdown */}
        {showCitySuggestions && filteredCities.length > 0 && (
          <div 
            ref={citySuggestionsRef}
            className="absolute z-50 w-full mt-1 bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          >
            {filteredCities.map((city, index) => (
              <div
                key={city.name}
                className={`px-4 py-2 cursor-pointer transition-colors ${
                  index === activeCityIndex 
                    ? 'bg-primary/20 text-white' 
                    : 'hover:bg-white/20 text-white'
                }`}
                onClick={() => handleCitySelect(city.name)}
              >
                <div className="font-medium text-white">{city.name}</div>
                <div className="text-sm text-white/60">
                  Klicka för att se postnummer
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Postnummer fält */}
      <div className="relative">
        <Label htmlFor="postalCode" className="text-white">
          Postnummer <span className="text-sm text-white/70">(valfritt)</span>
        </Label>
        <Input
          ref={postalInputRef}
          id="postalCode"
          value={postalCodeValue}
          onChange={handlePostalCodeChange}
          onKeyDown={handlePostalKeyDown}
          placeholder="XXX XX"
          className="text-base"
          maxLength={6}
          autoComplete="off"
        />
        
        {/* Postnummer-förslag för vald stad */}
        {showPostalSuggestions && filteredPostalCodes.length > 0 && (
          <div 
            ref={postalSuggestionsRef}
            className="absolute z-50 w-full mt-1 bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          >
            <div className="px-4 py-2 text-sm text-white/60 border-b border-white/20">
              Postnummer för {cityValue}:
            </div>
            {filteredPostalCodes.map((postalCode, index) => (
              <div
                key={postalCode}
                className={`px-4 py-2 cursor-pointer transition-colors ${
                  index === activePostalIndex 
                    ? 'bg-primary/20 text-white' 
                    : 'hover:bg-white/20 text-white'
                }`}
                onClick={() => handlePostalCodeSelect(postalCode)}
              >
                <div className="font-medium text-white">{postalCode}</div>
              </div>
            ))}
          </div>
        )}
        
        {/* Stad-förslag baserat på postnummer */}
        {suggestedCity && (
          <div className="absolute z-50 w-full mt-1 bg-slate-800/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-lg">
            <div
              className="px-4 py-2 cursor-pointer transition-colors hover:bg-white/20 text-white"
              onClick={handleCitySuggestionAccept}
            >
              <div className="text-sm text-white/60">Förslag baserat på postnummer:</div>
              <div className="font-medium text-white">{suggestedCity}</div>
              <div className="text-sm text-white/40">Klicka för att välja</div>
            </div>
          </div>
        )}
        
        {postalCodeValue && !isValidPostalCodeFormat(postalCodeValue) && postalCodeValue.replace(/\D/g, '').length >= 5 && (
          <p className="text-sm text-red-300 mt-1">
            Postnummer ska vara i formatet XXX XX (t.ex. 123 45)
          </p>
        )}
      </div>
    </div>
  );
};

export default CitySelector;
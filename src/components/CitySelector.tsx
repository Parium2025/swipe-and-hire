import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { filterCities, findCityByPostalCode, formatPostalCode, isValidPostalCodeFormat } from '@/lib/swedishCities';
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
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCities, setFilteredCities] = useState<Array<{name: string; postalCodes: string[]}>>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cityValue.trim()) {
      const cities = filterCities(cityValue);
      setFilteredCities(cities);
      setShowSuggestions(cities.length > 0);
    } else {
      setFilteredCities([]);
      setShowSuggestions(false);
    }
    setActiveIndex(-1);
  }, [cityValue]);

  const handleCitySelect = (cityName: string) => {
    onCityChange(cityName);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPostalCode(value);
    onPostalCodeChange(formatted);

    // Om postnummer är komplett, försök hitta staden
    if (isValidPostalCodeFormat(formatted)) {
      const foundCity = findCityByPostalCode(formatted);
      if (foundCity) {
        onCityChange(foundCity);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(prev => 
          prev < filteredCities.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < filteredCities.length) {
          handleCitySelect(filteredCities[activeIndex].name);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setActiveIndex(-1);
        break;
    }
  };

  // Stäng dropdown när man klickar utanför
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        cityInputRef.current && 
        !cityInputRef.current.contains(event.target as Node) &&
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
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
            onKeyDown={handleKeyDown}
            placeholder="Börja skriv din stad..."
            className="pl-10 text-base"
            autoComplete="off"
          />
        </div>
        
        {/* Stadsförslag dropdown */}
        {showSuggestions && filteredCities.length > 0 && (
          <div 
            ref={suggestionsRef}
            className="absolute z-50 w-full mt-1 bg-white/95 backdrop-blur-sm border border-white/20 rounded-lg shadow-lg max-h-48 overflow-y-auto"
          >
            {filteredCities.map((city, index) => (
              <div
                key={city.name}
                className={`px-4 py-2 cursor-pointer transition-colors ${
                  index === activeIndex 
                    ? 'bg-primary/20 text-primary-foreground' 
                    : 'hover:bg-white/20 text-gray-800'
                }`}
                onClick={() => handleCitySelect(city.name)}
              >
                <div className="font-medium">{city.name}</div>
                <div className="text-xs text-gray-600">
                  Postnummer: {city.postalCodes.slice(0, 3).join(', ')}
                  {city.postalCodes.length > 3 && '...'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Postnummer fält */}
      <div>
        <Label htmlFor="postalCode" className="text-white">
          Postnummer <span className="text-sm text-white/70">(valfritt)</span>
        </Label>
        <Input
          id="postalCode"
          value={postalCodeValue}
          onChange={handlePostalCodeChange}
          placeholder="XXX XX"
          className="text-base"
          maxLength={6}
        />
        {postalCodeValue && !isValidPostalCodeFormat(postalCodeValue) && postalCodeValue.replace(/\D/g, '').length >= 5 && (
          <p className="text-xs text-red-300 mt-1">
            Postnummer ska vara i formatet XXX XX (t.ex. 123 45)
          </p>
        )}
      </div>
    </div>
  );
};

export default CitySelector;
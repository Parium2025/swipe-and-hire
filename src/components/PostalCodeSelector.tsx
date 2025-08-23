import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { findLocationByPostalCode, formatPostalCode, isValidPostalCodeFormat, PostalCodeData } from '@/lib/postalCodes';
import { MapPin, Check } from 'lucide-react';

interface PostalCodeSelectorProps {
  postalCodeValue: string;
  onPostalCodeChange: (postalCode: string) => void;
  onLocationChange: (location: string) => void;
  className?: string;
}

const PostalCodeSelector = ({ 
  postalCodeValue, 
  onPostalCodeChange,
  onLocationChange,
  className = ""
}: PostalCodeSelectorProps) => {
  const [foundLocation, setFoundLocation] = useState<PostalCodeData | null>(null);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (postalCodeValue.trim()) {
      const isValidFormat = isValidPostalCodeFormat(postalCodeValue);
      setIsValid(isValidFormat);
      
      if (isValidFormat) {
        const location = findLocationByPostalCode(postalCodeValue);
        setFoundLocation(location);
        
        if (location) {
          // Skicka tillbaka den fullständiga platsinformationen
          onLocationChange(`${location.city}, ${location.area}`);
        } else {
          onLocationChange('');
        }
      } else {
        setFoundLocation(null);
        onLocationChange('');
      }
    } else {
      setFoundLocation(null);
      setIsValid(false);
      onLocationChange('');
    }
  }, [postalCodeValue, onLocationChange]);

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPostalCode(value);
    onPostalCodeChange(formatted);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Postnummer input */}
      <div>
        <Label htmlFor="postalCode" className="text-white">
          Var bor du?
        </Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="postalCode"
            value={postalCodeValue}
            onChange={handlePostalCodeChange}
            placeholder="Skriv in ditt postnummer (t.ex. 136 55)"
            className="pl-10 text-base"
            maxLength={6}
            autoComplete="off"
          />
        </div>
        
        {/* Validering meddelande */}
        {postalCodeValue && !isValid && postalCodeValue.replace(/\D/g, '').length >= 5 && (
          <p className="text-xs text-red-300 mt-1">
            Postnummer ska vara i formatet XXX XX (t.ex. 136 55)
          </p>
        )}
      </div>

      {/* Resultat-ruta */}
      {foundLocation && isValid && (
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-green-400" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-white/70">Din plats:</p>
              <p className="text-lg font-semibold text-white">
                {foundLocation.city}, {foundLocation.area}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Om postnummer är giltigt men inte hittat */}
      {isValid && !foundLocation && postalCodeValue && (
        <Card className="bg-yellow-500/10 backdrop-blur-sm border-yellow-500/20 p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-yellow-400" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-yellow-200">
                Postnummer {postalCodeValue} hittades inte i vår databas
              </p>
              <p className="text-xs text-yellow-300/70">
                Kontrollera att postnumret är korrekt
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PostalCodeSelector;
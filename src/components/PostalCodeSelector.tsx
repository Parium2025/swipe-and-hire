import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { getCachedPostalCodeInfo, formatPostalCodeInput, isValidSwedishPostalCode, PostalCodeResponse } from '@/lib/postalCodeAPI';
import { MapPin, Check, Loader2 } from 'lucide-react';

interface PostalCodeSelectorProps {
  postalCodeValue: string;
  onPostalCodeChange: (postalCode: string) => void;
  onLocationChange: (location: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  className?: string;
}

const PostalCodeSelector = ({ 
  postalCodeValue, 
  onPostalCodeChange,
  onLocationChange,
  onValidationChange,
  className = ""
}: PostalCodeSelectorProps) => {
  const [foundLocation, setFoundLocation] = useState<PostalCodeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);

  // Report validation status to parent
  useEffect(() => {
    const hasValidLocation = foundLocation !== null && isValid;
    onValidationChange?.(hasValidLocation);
  }, [foundLocation, isValid, onValidationChange]);

  useEffect(() => {
    const fetchLocation = async () => {
      if (postalCodeValue.trim()) {
        const cleanedCode = postalCodeValue.replace(/\s+/g, '');
        const isValidFormat = isValidSwedishPostalCode(cleanedCode);
        setIsValid(isValidFormat);
        
        if (isValidFormat && cleanedCode.length === 5) {
          setIsLoading(true);
          try {
            const location = await getCachedPostalCodeInfo(postalCodeValue);
            setFoundLocation(location);
            
            if (location) {
              // Skicka tillbaka bara orten (city), inte area eller kommun
              onLocationChange(location.city);
            }
            // Ingen uppdatering av plats om inget resultat hittas
          } catch (error) {
            console.error('Error fetching postal code:', error);
            setFoundLocation(null);
            // Rör inte användarens plats vid fel
          } finally {
            setIsLoading(false);
          }
        } else {
          setFoundLocation(null);
          onLocationChange(''); // Clear location when postal code is invalid
          setIsLoading(false);
        }
      } else {
        setFoundLocation(null);
        setIsValid(false);
        onLocationChange(''); // Clear location when postal code is empty
        setIsLoading(false);
      }
    };

    // Debounce API-anrop
    const timeoutId = setTimeout(fetchLocation, 500);
    return () => clearTimeout(timeoutId);
  }, [postalCodeValue, onLocationChange]);

  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPostalCodeInput(value);
    onPostalCodeChange(formatted);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Postnummer input */}
      <div>
        <Label htmlFor="postalCode" className="text-white">
          Var bor du? <span className="text-white">*</span>
        </Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white z-10" />
          <Input
            id="postalCode"
            value={postalCodeValue}
            onChange={handlePostalCodeChange}
            placeholder="Skriv in ditt postnummer"
            className="pl-10 text-base bg-white/5 backdrop-blur-sm border-white/20 text-white hover:bg-white/10 placeholder:text-white/60"
            maxLength={6}
            autoComplete="off"
          />
          {isLoading && (
            <div className="absolute right-3 top-3">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
          )}
        </div>
        
        {/* Validering meddelande */}
        {postalCodeValue && !isValid && postalCodeValue.replace(/\D/g, '').length >= 5 && (
          <p className="text-sm text-red-300 mt-1">
            Postnummer ska vara 5 siffror (t.ex. 136 55)
          </p>
        )}
      </div>

      {/* Resultat-ruta */}
      {foundLocation && isValid && !isLoading && (
        <Card className="bg-white/5 backdrop-blur-sm border-white/20 p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-secondary/20 rounded-full flex items-center justify-center">
                <Check className="w-4 h-4 text-secondary" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-white">Din plats:</p>
              <p className="text-lg font-semibold text-white">
                {foundLocation.city}
                {foundLocation.area && foundLocation.area !== foundLocation.city && (
                  <span className="text-white">, {foundLocation.area}</span>
                )}
              </p>
              {foundLocation.county && (
                <p className="text-sm text-white">{foundLocation.county}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Om postnummer är giltigt men inte hittat */}
      {isValid && !foundLocation && !isLoading && postalCodeValue && postalCodeValue.replace(/\D/g, '').length === 5 && (
        <Card className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-sm border-yellow-500/20 p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                <MapPin className="w-4 h-4 text-yellow-400" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-yellow-200">
                Postnummer {postalCodeValue} hittades inte
              </p>
              <p className="text-sm text-yellow-300/70">
                Kontrollera att postnumret är korrekt
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading state med proffsig indikator */}
      {isLoading && (
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-4">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <Loader2 className="h-5 w-5 animate-spin text-white/60" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">
                Söker i svensk postnummerdatabas...
              </p>
              <p className="text-sm text-white/70">
                16,000+ postnummer tillgängliga
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PostalCodeSelector;
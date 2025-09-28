import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { getCachedPostalCodeInfo, formatPostalCodeInput, isValidSwedishPostalCode, PostalCodeResponse } from '@/lib/postalCodeAPI';
import { MapPin, Check, Loader2 } from 'lucide-react';

interface WorkplacePostalCodeSelectorProps {
  postalCodeValue: string;
  cityValue: string;
  onPostalCodeChange: (postalCode: string) => void;
  onLocationChange: (location: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  className?: string;
}

const WorkplacePostalCodeSelector = ({ 
  postalCodeValue, 
  cityValue,
  onPostalCodeChange,
  onLocationChange,
  onValidationChange,
  className = ""
}: WorkplacePostalCodeSelectorProps) => {
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
              // Skicka tillbaka bara orten (city)
              onLocationChange(location.city);
            }
          } catch (error) {
            console.error('Error fetching postal code:', error);
            setFoundLocation(null);
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
      <div className="grid grid-cols-2 gap-3">
        {/* Postnummer input */}
        <div className="space-y-2">
          <Label className="text-white font-medium">Postnummer *</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white z-10" />
            <Input
              value={postalCodeValue}
              onChange={handlePostalCodeChange}
              placeholder="XXX XX"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base pl-10"
              maxLength={6}
              autoComplete="off"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-white/60" />
              </div>
            )}
          </div>
          
          {/* Validering meddelande */}
          {postalCodeValue && !isValid && postalCodeValue.replace(/\D/g, '').length >= 5 && (
            <p className="text-xs text-red-300 mt-1">
              Postnummer ska vara 5 siffror (t.ex. 136 55)
            </p>
          )}
        </div>

        {/* Ort input */}
        <div className="space-y-2">
          <Label className="text-white font-medium">Ort *</Label>
          <Input
            value={cityValue}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="Fylls i automatiskt"
            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-12 text-base"
            readOnly={foundLocation !== null}
          />
        </div>
      </div>

      {/* Resultat-kort när location hittas */}
      {foundLocation && isValid && !isLoading && (
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-3">
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-green-400" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">
                <span className="font-semibold">{foundLocation.city}</span>
                {foundLocation.county && (
                  <span className="text-white/90">, {foundLocation.county}</span>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Om postnummer är giltigt men inte hittat */}
      {isValid && !foundLocation && !isLoading && postalCodeValue && postalCodeValue.replace(/\D/g, '').length === 5 && (
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-3">
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
                <MapPin className="w-3 h-3 text-white/60" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">
                Postnummer {postalCodeValue} hittades inte
              </p>
              <p className="text-xs text-white/70 mt-0.5">
                Du kan ange orten manuellt ovan
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading state med proffsig indikator */}
      {isLoading && (
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-3">
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0">
              <Loader2 className="h-4 w-4 animate-spin text-white/60" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">
                Söker i svensk postnummerdatabas...
              </p>
              <p className="text-xs text-white/70 mt-0.5">
                16,000+ postnummer tillgängliga
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default WorkplacePostalCodeSelector;
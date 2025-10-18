import { useState, useEffect, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { getCachedPostalCodeInfo, formatPostalCodeInput, isValidSwedishPostalCode, PostalCodeResponse } from '@/lib/postalCodeAPI';
import { MapPin, Check, Loader2 } from 'lucide-react';

interface WorkplacePostalCodeSelectorProps {
  postalCodeValue: string;
  cityValue: string;
  onPostalCodeChange: (postalCode: string) => void;
  onLocationChange: (location: string, postalCode?: string, municipality?: string, county?: string) => void;
  onValidationChange?: (isValid: boolean) => void;
  cachedInfo?: {postalCode: string, city: string, municipality: string, county: string} | null;
  className?: string;
}

const WorkplacePostalCodeSelector = ({ 
  postalCodeValue, 
  cityValue,
  onPostalCodeChange,
  onLocationChange,
  onValidationChange,
  cachedInfo,
  className = ""
}: WorkplacePostalCodeSelectorProps) => {
  const [foundLocation, setFoundLocation] = useState<PostalCodeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [lastSuccessfulPostalCode, setLastSuccessfulPostalCode] = useState<string>('');

  // Memoized validation status
  const hasValidLocation = useMemo(
    () => foundLocation !== null && isValid,
    [foundLocation, isValid]
  );

  // Report validation status to parent
  useEffect(() => {
    onValidationChange?.(hasValidLocation);
  }, [hasValidLocation, onValidationChange]);

  // Initialize from cached info immediately on mount
  useEffect(() => {
    if (cachedInfo && postalCodeValue.trim()) {
      const cleanedCode = postalCodeValue.replace(/\s+/g, '');
      const cachedCleanedCode = cachedInfo.postalCode.replace(/\s+/g, '');
      
      if (cleanedCode === cachedCleanedCode) {
        setFoundLocation({
          postalCode: cachedInfo.postalCode,
          city: cachedInfo.city,
          municipality: cachedInfo.municipality,
          county: cachedInfo.county
        });
        setLastSuccessfulPostalCode(cleanedCode);
        setIsValid(true);
      }
    }
  }, [cachedInfo, postalCodeValue]);

  useEffect(() => {
    const fetchLocation = async () => {
      if (postalCodeValue.trim()) {
        const cleanedCode = postalCodeValue.replace(/\s+/g, '');
        const isValidFormat = isValidSwedishPostalCode(cleanedCode);
        setIsValid(isValidFormat);
        
        // Check if we have cached info for this postal code - skip API call
        if (cachedInfo && cleanedCode === cachedInfo.postalCode.replace(/\s+/g, '')) {
          return; // Already set in initialization useEffect
        }
        
        // Om samma postnummer som förra gången, behåll det befintliga
        if (cleanedCode === lastSuccessfulPostalCode && foundLocation) {
          return;
        }
        
        if (isValidFormat && cleanedCode.length === 5) {
          setIsLoading(true);
          try {
            const location = await getCachedPostalCodeInfo(postalCodeValue);
            setFoundLocation(location);
            
            if (location) {
              setLastSuccessfulPostalCode(cleanedCode);
              // Skicka tillbaka full info för caching
              onLocationChange(location.city, cleanedCode, location.municipality, location.county || '');
            } else {
              setLastSuccessfulPostalCode('');
            }
          } catch (error) {
            console.error('Error fetching postal code:', error);
            setFoundLocation(null);
            setLastSuccessfulPostalCode('');
          } finally {
            setIsLoading(false);
          }
        } else {
          setFoundLocation(null);
          setLastSuccessfulPostalCode('');
          if (!postalCodeValue.trim()) {
            onLocationChange('');
          }
          setIsLoading(false);
        }
      } else {
        setFoundLocation(null);
        setIsValid(false);
        setLastSuccessfulPostalCode('');
        onLocationChange('');
        setIsLoading(false);
      }
    };

    // Snabbare debounce för bättre användarupplevelse (200ms istället för 500ms)
    const timeoutId = setTimeout(fetchLocation, 200);
    return () => clearTimeout(timeoutId);
  }, [postalCodeValue, onLocationChange, lastSuccessfulPostalCode, foundLocation, cachedInfo]);

  const handlePostalCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPostalCodeInput(value);
    onPostalCodeChange(formatted);

    const digits = formatted.replace(/\D/g, '');
    // När användaren skriver 1–4 siffror: rensa omedelbart tidigare träff så att varningen visas
    if (digits.length >= 0 && digits.length < 5) {
      setFoundLocation(null);
      setIsValid(false);
      setIsLoading(false);
      if (!lastSuccessfulPostalCode.startsWith(digits)) {
        setLastSuccessfulPostalCode('');
      }
    }
  }, [onPostalCodeChange, lastSuccessfulPostalCode]);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-2 gap-3">
        {/* Postnummer input */}
        <div className="space-y-2">
          <Label className="text-white font-medium text-sm">Postnummer *</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white z-10" />
            <Input
              value={postalCodeValue}
              onChange={handlePostalCodeChange}
              placeholder="XXX XX"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm pl-10 transition-all duration-150"
              maxLength={6}
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-white/60" />
              </div>
            )}
          </div>
          
          {/* Validering meddelande - visa när 1-4 siffror eller när 5+ siffror men ogiltigt */}
          {postalCodeValue && 
           !isLoading && 
           !(cachedInfo && postalCodeValue.replace(/\s+/g, '') === cachedInfo.postalCode.replace(/\s+/g, '')) &&
           !foundLocation &&
           (
             (postalCodeValue.replace(/\D/g, '').length > 0 && postalCodeValue.replace(/\D/g, '').length < 5) ||
             (postalCodeValue.replace(/\D/g, '').length >= 5 && !isValid)
           ) && (
            <p className="text-xs text-red-300 mt-1">
              Postnummer ska vara 5 siffror (t.ex. 136 55)
            </p>
          )}
        </div>

        {/* Ort input */}
        <div className="space-y-2">
          <Label className="text-white font-medium text-sm">Ort *</Label>
          <Input
            value={cityValue}
            onChange={(e) => onLocationChange(e.target.value)}
            placeholder="Fylls i automatiskt"
            className="bg-white/10 border-white/20 text-white placeholder:text-white/60 h-9 text-sm transition-all duration-150"
            readOnly={foundLocation !== null}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </div>
      </div>

      {/* Resultat-kort när location hittas */}
      {foundLocation && isValid && !isLoading && (
        <Card className="bg-white/10 backdrop-blur-sm border-white/20 p-3 animate-fade-in">
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
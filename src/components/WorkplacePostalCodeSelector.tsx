import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { getCachedPostalCodeInfo, formatPostalCodeInput, isValidSwedishPostalCode, PostalCodeResponse } from '@/lib/postalCodeAPI';
import { MapPin, Check, Loader2 } from 'lucide-react';
import { RequiredMark } from '@/components/wizard/RequiredMark';

interface WorkplacePostalCodeSelectorProps {
  postalCodeValue: string;
  cityValue: string;
  onPostalCodeChange: (postalCode: string) => void;
  onLocationChange: (location: string, postalCode?: string, municipality?: string, county?: string, source?: 'auto' | 'user') => void;
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
  const lastUserEditedPostalCodeRef = useRef('');

  // Helper to validate city name (only letters, spaces, and hyphens)
  const isValidCityName = useCallback((city: string) => {
    if (!city || city.trim().length === 0) return false;
    // Allow only letters (including Swedish åäöÅÄÖ), spaces, and hyphens
    return /^[a-zA-ZåäöÅÄÖ\s-]+$/.test(city.trim());
  }, []);

  // Memoized validation status
  // Valid if: (1) postal code found automatically, OR (2) postal code valid format + city manually entered with only letters
  const hasValidLocation = useMemo(() => {
    // Scenario 1: Postal code found automatically
    if (foundLocation !== null && isValid) return true;
    
    // Scenario 2: Valid postal code format + manually entered city (with only letters)
    if (isValid && postalCodeValue.replace(/\D/g, '').length === 5 && isValidCityName(cityValue)) {
      return true;
    }
    
    return false;
  }, [foundLocation, isValid, postalCodeValue, cityValue, isValidCityName]);

  // Report validation status to parent
  useEffect(() => {
    onValidationChange?.(hasValidLocation);
  }, [hasValidLocation, onValidationChange]);

  useEffect(() => {
    let cancelled = false;

    const fetchLocation = async () => {
      const cleanedCode = postalCodeValue.replace(/\D/g, '');
      const isValidFormat = isValidSwedishPostalCode(cleanedCode);
      setIsValid(isValidFormat);

      if (!postalCodeValue.trim()) {
        setFoundLocation(null);
        setIsLoading(false);
        onLocationChange('', undefined, undefined, undefined, 'user');
        return;
      }

      if (!isValidFormat || cleanedCode.length !== 5) {
        setFoundLocation(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const cachedCleanedCode = cachedInfo?.postalCode.replace(/\D/g, '');
        const location: PostalCodeResponse | null = cachedInfo && cachedCleanedCode === cleanedCode
          ? {
              postalCode: cachedInfo.postalCode,
              city: cachedInfo.city,
              municipality: cachedInfo.municipality,
              county: cachedInfo.county,
            }
          : await getCachedPostalCodeInfo(cleanedCode);

        if (cancelled) return;
        setFoundLocation(location);

        if (location) {
          const source = cleanedCode === lastUserEditedPostalCodeRef.current ? 'user' : 'auto';
          onLocationChange(location.city, cleanedCode, location.municipality, location.county || '', source);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching postal code:', error);
        setFoundLocation(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchLocation, 200);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [postalCodeValue, onLocationChange, cachedInfo]);

  const handlePostalCodeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatPostalCodeInput(value);
    lastUserEditedPostalCodeRef.current = formatted.replace(/\s+/g, '');
    onPostalCodeChange(formatted);

    const digits = formatted.replace(/\D/g, '');
    // När användaren skriver 1–4 siffror: rensa omedelbart tidigare träff så att varningen visas
    if (digits.length > 0 && digits.length < 5) {
      setFoundLocation(null);
      setIsValid(false);
      setIsLoading(false);
    } else if (digits.length === 0) {
      setFoundLocation(null);
      setIsValid(false);
      setIsLoading(false);
    }
  }, [onPostalCodeChange]);

  const handleCityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow letters (including Swedish åäöÅÄÖ), spaces, and hyphens - filter out numbers
    const filtered = value.replace(/[^a-zA-ZåäöÅÄÖ\s-]/g, '');
    onLocationChange(filtered, undefined, undefined, undefined, 'user');
  }, [onLocationChange]);

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      {/* Postnummer input */}
      <div className="space-y-2 md:space-y-1.5">
        <Label className="text-white text-sm">Postnummer<RequiredMark filled={postalCodeValue.replace(/\D/g, '').length === 5} /></Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white z-10" />
          <Input
            value={postalCodeValue}
            onChange={handlePostalCodeChange}
            placeholder="XXX XX"
            inputMode="numeric"
            className="bg-white/5 backdrop-blur-sm border-white/10 text-white placeholder:text-white h-11 !min-h-0 text-sm pl-10 transition-colors duration-150 hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 focus:ring-0 focus:outline-none focus:border-white/50"
            maxLength={6}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
          )}
        </div>
        
        {/* Validering meddelande - visa endast när 1-4 siffror */}
        {postalCodeValue && 
         !isLoading && 
         !foundLocation &&
         postalCodeValue.replace(/\D/g, '').length > 0 && 
         postalCodeValue.replace(/\D/g, '').length < 5 && (
          <p className="text-sm text-red-300 mt-1">
            Postnummer ska vara 5 siffror (t.ex. 111 11)
          </p>
        )}
      </div>

      {/* Ort input */}
      <div className="space-y-2 md:space-y-1.5">
        <Label className="text-white text-sm">Ort<RequiredMark filled={!!cityValue.trim()} /></Label>
        <Input
          value={cityValue}
          onChange={handleCityChange}
          placeholder={
            isValid && !foundLocation && !isLoading && postalCodeValue.replace(/\D/g, '').length === 5
              ? "Ange ort manuellt"
              : "Fylls i automatiskt"
          }
          className="bg-white/5 backdrop-blur-sm border-white/10 text-white placeholder:text-white h-11 !min-h-0 text-sm transition-colors duration-150 hover:bg-white/10 hover:border-white/50 md:hover:border-white/50 focus:ring-0 focus:outline-none focus:border-white/50"
          readOnly={foundLocation !== null}
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
        />
      </div>

      {/* Resultat-kort när location hittas */}
      {foundLocation && isValid && !isLoading && (
        <Card className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 animate-fade-in col-span-2">
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
                  <span className="text-white">, {foundLocation.county}</span>
                )}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Om postnummer är giltigt men inte hittat */}
      {isValid && !foundLocation && !isLoading && postalCodeValue && postalCodeValue.replace(/\D/g, '').length === 5 && (
        <Card className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 col-span-2">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm text-white font-medium">
                Postnummer {postalCodeValue} hittades inte
              </p>
              <p className="text-sm text-white mt-0.5">
                Du kan ange orten manuellt ovan
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Loading state med proffsig indikator */}
      {isLoading && (
        <Card className="bg-white/5 backdrop-blur-sm border border-white/10 p-3 col-span-2">
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">
                Söker i svensk postnummerdatabas...
              </p>
              <p className="text-sm text-white mt-0.5">
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
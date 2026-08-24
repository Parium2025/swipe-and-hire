import { useEffect, useState } from 'react';
import { MapPin, Loader2, Crosshair } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { geocodeCity, getManualLocation, setManualLocation } from '@/lib/weatherApi';

interface WeatherLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** City currently shown in the header, used as the input's starting value. */
  currentCity?: string;
}

/**
 * Lets the user correct the weather location. Needed because desktop browsers
 * without wifi positioning fall back to the ISP's IP address, which can point
 * at a completely different city.
 */
export function WeatherLocationDialog({ open, onOpenChange, currentCity }: WeatherLocationDialogProps) {
  const [value, setValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasManual = Boolean(getManualLocation());

  useEffect(() => {
    if (open) {
      setValue(getManualLocation()?.city ?? currentCity ?? '');
      setError(null);
    }
  }, [open, currentCity]);

  const handleSave = async () => {
    const city = value.trim();
    if (!city) return;
    setIsSaving(true);
    setError(null);
    try {
      const geo = await geocodeCity(city);
      setManualLocation({ lat: geo.lat, lon: geo.lon, city: geo.name });
      onOpenChange(false);
    } catch {
      setError('Hittade ingen plats med det namnet. Prova stavningen igen.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseAutomatic = () => {
    setManualLocation(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Välj plats för vädret
          </DialogTitle>
          <DialogDescription>
            Visar din dator fel stad? Då saknar webbläsaren exakt position och gissar utifrån
            internetleverantören. Skriv in din ort så används den i stället.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSave();
            }}
            placeholder="T.ex. Haninge"
            autoFocus
            className="text-base"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            {hasManual && (
              <Button variant="ghost" onClick={handleUseAutomatic} className="sm:mr-auto">
                <Crosshair className="mr-2 h-4 w-4" />
                Använd min plats automatiskt
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving || !value.trim()}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Spara plats
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

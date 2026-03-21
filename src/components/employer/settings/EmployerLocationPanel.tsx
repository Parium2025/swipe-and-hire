import { MapPin, Smartphone } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import SettingsPanel from './SettingsPanel';

interface EmployerLocationPanelProps {
  isNativeApp: boolean;
  backgroundLocationEnabled: boolean;
  savingBackgroundLocation: boolean;
  onToggle: (enabled: boolean) => void;
}

const EmployerLocationPanel = ({
  isNativeApp,
  backgroundLocationEnabled,
  savingBackgroundLocation,
  onToggle,
}: EmployerLocationPanelProps) => {
  return (
    <SettingsPanel>
      <div className="space-y-5 md:space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-white" />
          <h3 className="text-sm font-medium text-white">Platsinställningar</h3>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Label className="text-sm text-white">Bakgrundsplats för väder</Label>
            <p className="text-sm text-white">
              {isNativeApp
                ? 'Uppdatera vädret automatiskt även när appen är i bakgrunden'
                : 'Aktiveras endast i native-appen (iOS/Android)'}
            </p>
            {!isNativeApp && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-white">
                <Smartphone className="h-3 w-3" />
                <span>Tillgänglig i mobilappen</span>
              </div>
            )}
          </div>
          <Switch
            checked={backgroundLocationEnabled}
            onCheckedChange={onToggle}
            disabled={savingBackgroundLocation || !isNativeApp}
          />
        </div>
      </div>
    </SettingsPanel>
  );
};

export default EmployerLocationPanel;
import { memo, useState } from 'react';
import WeatherEffects from '@/components/WeatherEffects';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface WeatherType {
  code: number;
  name: string;
  emoji: string;
  hasAnimation: boolean;
}

const weatherTypes: WeatherType[] = [
  { code: 0, name: 'Klart', emoji: '☀️', hasAnimation: false },
  { code: 1, name: 'Mestadels klart', emoji: '🌤️', hasAnimation: false },
  { code: 2, name: 'Halvklart', emoji: '⛅', hasAnimation: false },
  { code: 3, name: 'Molnigt', emoji: '☁️', hasAnimation: false },
  { code: 45, name: 'Dimma', emoji: '🌫️', hasAnimation: false },
  { code: 61, name: 'Regn', emoji: '🌧️', hasAnimation: true },
  { code: 71, name: 'Snö', emoji: '❄️', hasAnimation: true },
  { code: 80, name: 'Regnskurar', emoji: '🌦️', hasAnimation: true },
  { code: 85, name: 'Snöbyar', emoji: '🌨️', hasAnimation: true },
  { code: 95, name: 'Åska', emoji: '⛈️', hasAnimation: false },
];

interface WeatherPreviewProps {
  onClose: () => void;
}

const WeatherPreview = memo(({ onClose }: WeatherPreviewProps) => {
  const [selectedCode, setSelectedCode] = useState<number | null>(71); // Start with snow

  return (
    <>
      {/* Weather effect in background */}
      <WeatherEffects weatherCode={selectedCode} isLoading={false} />
      
      {/* Control panel */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/20 p-4 shadow-2xl max-w-md w-[calc(100%-2rem)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-sm">Väder-preview</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="grid grid-cols-5 gap-2">
          {weatherTypes.map((weather) => (
            <button
              key={weather.code}
              onClick={() => setSelectedCode(weather.code)}
              className={`
                flex flex-col items-center gap-1 p-2 rounded-xl transition-all
                ${selectedCode === weather.code 
                  ? 'bg-white/20 ring-2 ring-white/40' 
                  : 'bg-white/5 hover:bg-white/10'
                }
              `}
            >
              <span className="text-xl">{weather.emoji}</span>
              <span className="text-[10px] text-white/70 text-center leading-tight">{weather.name}</span>
              {weather.hasAnimation && (
                <span className="text-[8px] text-emerald-400 font-medium">ANIM</span>
              )}
            </button>
          ))}
        </div>
        
        <p className="text-xs text-white/50 text-center mt-3">
          {selectedCode !== null && weatherTypes.find(w => w.code === selectedCode)?.hasAnimation 
            ? '✨ Denna vädertyp har animation' 
            : 'Ingen animation för denna vädertyp'
          }
        </p>
      </div>
    </>
  );
});

WeatherPreview.displayName = 'WeatherPreview';

export default WeatherPreview;

import { memo, useState, useEffect } from 'react';
import WeatherEffects from '@/components/WeatherEffects';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface WeatherType {
  code: number;
  name: string;
  emoji: string;
}

const weatherTypes: WeatherType[] = [
  { code: 0, name: 'Klart', emoji: '☀️' },
  { code: 1, name: 'Mestadels klart', emoji: '🌤️' },
  { code: 2, name: 'Halvklart', emoji: '⛅' },
  { code: 3, name: 'Molnigt', emoji: '☁️' },
  { code: 45, name: 'Dimma', emoji: '🌫️' },
  { code: 61, name: 'Regn', emoji: '🌧️' },
  { code: 71, name: 'Snö', emoji: '❄️' },
  { code: 80, name: 'Regnskurar', emoji: '🌦️' },
  { code: 85, name: 'Snöbyar', emoji: '🌨️' },
  { code: 95, name: 'Åska', emoji: '⛈️' },
];

interface WeatherPreviewProps {
  onClose: () => void;
  onEmojiChange?: (emoji: string) => void;
}

const WeatherPreview = memo(({ onClose, onEmojiChange }: WeatherPreviewProps) => {
  const [selectedCode, setSelectedCode] = useState<number>(71); // Start with snow

  // Notify parent when emoji changes
  useEffect(() => {
    const selectedWeather = weatherTypes.find(w => w.code === selectedCode);
    if (selectedWeather && onEmojiChange) {
      onEmojiChange(selectedWeather.emoji);
    }
  }, [selectedCode, onEmojiChange]);

  const handleSelect = (code: number) => {
    setSelectedCode(code);
  };

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
              onClick={() => handleSelect(weather.code)}
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
            </button>
          ))}
        </div>
        
        <p className="text-xs text-white/50 text-center mt-3">
          Alla vädertyper har nu animation ✨
        </p>
      </div>
    </>
  );
});

WeatherPreview.displayName = 'WeatherPreview';

export default WeatherPreview;

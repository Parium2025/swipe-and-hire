import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  useStageSettings, 
  AVAILABLE_ICONS, 
  AVAILABLE_COLORS,
} from '@/hooks/useStageSettings';
import { toast } from 'sonner';

interface CreateStageDialogProps {
  trigger?: React.ReactNode;
}

export function CreateStageDialog({ trigger }: CreateStageDialogProps) {
  const { createCustomStage } = useStageSettings();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[4].value); // Red
  const [selectedIcon, setSelectedIcon] = useState('flag');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const handleCreate = async () => {
    if (!label.trim()) return;
    
    try {
      await createCustomStage.mutateAsync({
        label: label.trim(),
        color: selectedColor,
        iconName: selectedIcon,
      });
      setOpen(false);
      setLabel('');
      setSelectedColor(AVAILABLE_COLORS[4].value);
      setSelectedIcon('flag');
      setShowColorPicker(false);
      toast.success('Nytt steg skapat');
    } catch (error) {
      toast.error('Kunde inte skapa steg');
    }
  };

  // Check if selected color is one of the presets
  const isPresetColor = AVAILABLE_COLORS.some(c => c.value === selectedColor);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) setShowColorPicker(false);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-white/70 hover:text-white hover:bg-white/10"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nytt steg
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-card-parium border-white/20 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Skapa nytt steg</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="new-stage-label" className="text-white/70">Namn</Label>
            <Input
              id="new-stage-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="T.ex. Referenskontroll"
              className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          {/* Color picker */}
          <div className="space-y-2">
            <Label className="text-white/70">Färg</Label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => {
                    setSelectedColor(color.value);
                    setShowColorPicker(false);
                  }}
                  className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 relative"
                  style={{ 
                    backgroundColor: color.value,
                    borderColor: selectedColor === color.value ? 'white' : 'transparent'
                  }}
                  title={color.label}
                >
                  {selectedColor === color.value && (
                    <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                  )}
                </button>
              ))}
              {/* Custom color button */}
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 relative overflow-hidden ${
                  showColorPicker || (!isPresetColor && selectedColor) ? 'border-white' : 'border-transparent'
                }`}
                style={{ 
                  background: !isPresetColor && selectedColor 
                    ? selectedColor 
                    : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                }}
                title="Välj egen färg"
              >
                {!isPresetColor && selectedColor && (
                  <Check className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow-md" />
                )}
              </button>
            </div>
            
            {/* HexColorPicker */}
            {showColorPicker && (
              <div className="mt-3 flex justify-center">
                <HexColorPicker 
                  color={selectedColor} 
                  onChange={setSelectedColor}
                />
              </div>
            )}
          </div>

          {/* Icon picker */}
          <div className="space-y-2">
            <Label className="text-white/70">Ikon</Label>
            <div className="grid grid-cols-10 gap-1">
              {AVAILABLE_ICONS.map(({ name, Icon, label: iconLabel }) => (
                <button
                  key={name}
                  onClick={() => setSelectedIcon(name)}
                  className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                    selectedIcon === name 
                      ? 'bg-white/20 text-white' 
                      : 'hover:bg-white/10 text-white/70'
                  }`}
                  title={iconLabel}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-white/70">Förhandsvisning</Label>
            <div 
              className="rounded-md px-3 py-2 ring-1 ring-inset ring-white/20 backdrop-blur-sm inline-flex items-center gap-2"
              style={{ backgroundColor: `${selectedColor}33` }}
            >
              {(() => {
                const IconComponent = AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.Icon || AVAILABLE_ICONS[0].Icon;
                return <IconComponent className="h-4 w-4 text-white" />;
              })()}
              <span className="font-medium text-sm text-white">{label || 'Nytt steg'}</span>
              <span 
                className="text-white text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${selectedColor}66` }}
              >
                0
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            Avbryt
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!label.trim() || createCustomStage.isPending}
            className="bg-primary hover:bg-primary/90"
          >
            Skapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
      toast.success('Nytt steg skapat');
    } catch (error) {
      toast.error('Kunde inte skapa steg');
    }
  };

  const IconComponent = AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.Icon || AVAILABLE_ICONS[0].Icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="bg-card-parium border-white/20 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Skapa nytt steg</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="new-stage-label" className="text-white">Namn</Label>
            <Input
              id="new-stage-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="T.ex. Referenskontroll"
              maxLength={20}
              className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          {/* Color picker and Icon picker side by side */}
          <div className="flex gap-3">
            {/* Color picker */}
            <div className="space-y-2">
              <Label className="text-white">Färg</Label>
              <div className="[&_.react-colorful]:w-[170px] [&_.react-colorful]:h-[170px]">
                <HexColorPicker 
                  color={selectedColor} 
                  onChange={setSelectedColor}
                />
              </div>
            </div>

            {/* Icon picker */}
            <div className="flex-1 space-y-2">
              <Label className="text-white">Ikon</Label>
              <div className="grid grid-cols-5 gap-0">
                {AVAILABLE_ICONS.map(({ name, Icon, label: iconLabel }) => (
                  <button
                    key={name}
                    onClick={() => setSelectedIcon(name)}
                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                      selectedIcon === name 
                        ? 'bg-white/20 text-white' 
                        : 'hover:bg-white/10 text-white'
                    }`}
                    title={iconLabel}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview - centered */}
          <div className="space-y-2 pt-2 flex flex-col items-center">
            <Label className="text-white self-start">Förhandsvisning</Label>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div 
                    className="rounded-md px-3 py-2 ring-1 ring-inset ring-white/20 backdrop-blur-sm inline-flex items-center gap-2 transition-colors max-w-full cursor-default"
                    style={{ backgroundColor: `${selectedColor}33` }}
                  >
                    <IconComponent className="h-4 w-4 text-white flex-shrink-0" />
                    <span className="font-medium text-sm text-white truncate max-w-[200px]">{label || 'Nytt steg'}</span>
                    <span 
                      className="text-white text-[10px] px-1.5 py-0.5 rounded-full transition-colors flex-shrink-0"
                      style={{ backgroundColor: `${selectedColor}66` }}
                    >
                      0
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p>{label || 'Nytt steg'}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <DialogFooter className="flex justify-between gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="bg-white/5 backdrop-blur-sm border-white/20 text-white px-4 py-2 transition-colors duration-150 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white disabled:opacity-30 touch-border-white [&_svg]:text-white hover:[&_svg]:text-white md:hover:[&_svg]:text-white focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            Avbryt
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!label.trim() || createCustomStage.isPending}
            className="bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-8 py-2 touch-border-white transition-colors duration-150 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          >
            Skapa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

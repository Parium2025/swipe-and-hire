import React, { useState } from 'react';
import { Plus, Check } from 'lucide-react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  useStageSettings, 
  AVAILABLE_ICONS, 
  PREMIUM_GRADIENTS,
  getGradientPreset,
} from '@/hooks/useStageSettings';
import { toast } from 'sonner';
import { MAX_KANBAN_STAGES } from '@/hooks/useKanbanLayout';

interface CreateStageDialogProps {
  trigger?: React.ReactNode;
  currentStageCount?: number;
}

export function CreateStageDialog({ trigger, currentStageCount = 0 }: CreateStageDialogProps) {
  const { createCustomStage, stageOrder } = useStageSettings();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [selectedColor, setSelectedColor] = useState('coral'); // Default to coral
  const [selectedIcon, setSelectedIcon] = useState('flag');

  // Use passed count or get from hook - max 5 stages
  const stageCount = currentStageCount || stageOrder.length;
  const canCreateMore = stageCount < MAX_KANBAN_STAGES;

  const selectedGradient = getGradientPreset(selectedColor);

  const handleCreate = async () => {
    if (!label.trim()) return;
    
    if (!canCreateMore) {
      toast.error(`Max ${MAX_KANBAN_STAGES} steg tillåtna`);
      return;
    }
    
    try {
      await createCustomStage.mutateAsync({
        label: label.trim(),
        color: selectedColor,
        iconName: selectedIcon,
      });
      setOpen(false);
      setLabel('');
      setSelectedColor('coral');
      setSelectedIcon('flag');
      toast.success('Nytt steg skapat');
    } catch (error) {
      toast.error('Kunde inte skapa steg');
    }
  };

  const IconComponent = AVAILABLE_ICONS.find(i => i.name === selectedIcon)?.Icon || AVAILABLE_ICONS[0].Icon;

  // Don't render if max stages reached
  if (!canCreateMore) {
    return null;
  }

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
      <DialogContentNoFocus className="bg-card-parium border-white/20 sm:max-w-lg">
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
              className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          {/* Color picker and Icon picker side by side */}
          <div className="flex gap-4">
            {/* Premium gradient picker */}
            <div className="space-y-2">
              <Label className="text-white">Färg</Label>
              <div className="grid grid-cols-4 gap-2">
                {PREMIUM_GRADIENTS.map((preset) => {
                  const isSelected = selectedColor === preset.id;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setSelectedColor(preset.id)}
                      className={`relative w-10 h-10 rounded-lg transition-all duration-200 ${
                        isSelected 
                          ? 'ring-2 ring-white scale-110 shadow-lg' 
                          : 'ring-1 ring-white/20 hover:ring-white/40 hover:scale-105'
                      }`}
                      style={{ background: preset.gradient }}
                      title={preset.label}
                    >
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Check className="h-4 w-4 text-white drop-shadow-md" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Icon picker */}
            <div className="flex-1 space-y-2">
              <Label className="text-white">Ikon</Label>
              <div className="grid grid-cols-5 gap-0.5">
                {AVAILABLE_ICONS.map(({ name, Icon, label: iconLabel }) => (
                  <button
                    key={name}
                    onClick={() => setSelectedIcon(name)}
                    className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                      selectedIcon === name 
                        ? 'bg-white/30 text-white' 
                        : 'hover:bg-white/20 text-white'
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
                    className="relative overflow-hidden rounded-xl px-3 py-2.5 ring-1 ring-inset ring-white/20 inline-flex items-center gap-2 transition-colors max-w-full cursor-default group"
                    style={{ background: selectedGradient?.gradient || selectedColor }}
                  >
                    {/* Glass overlay */}
                    <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
                    
                    {/* Decorative elements */}
                    <div className="absolute -right-2 -top-2 w-8 h-8 bg-white/10 rounded-full blur-lg" />
                    <div className="absolute -left-2 -bottom-2 w-6 h-6 bg-white/10 rounded-full blur-md" />
                    
                    <div className="relative flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-white/10 backdrop-blur-sm">
                        <IconComponent className="h-3.5 w-3.5 text-white" strokeWidth={1.5} />
                      </div>
                      <span className="font-semibold text-sm text-white truncate max-w-[200px] drop-shadow-sm">{label || 'Nytt steg'}</span>
                      <span className="text-white text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/20 backdrop-blur-sm">
                        0
                      </span>
                    </div>
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
      </DialogContentNoFocus>
    </Dialog>
  );
}

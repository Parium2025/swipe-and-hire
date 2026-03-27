import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
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
  AVAILABLE_COLORS,
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
  const [selectedColor, setSelectedColor] = useState(AVAILABLE_COLORS[4].value); // Red
  const [selectedIcon, setSelectedIcon] = useState('flag');

  // Use passed count or get from hook - max 5 stages
  const stageCount = currentStageCount || stageOrder.length;
  const canCreateMore = stageCount < MAX_KANBAN_STAGES;

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
      setSelectedColor(AVAILABLE_COLORS[4].value);
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
      <DialogContentNoFocus className="bg-card-parium border-white/20 sm:max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle className="text-white">Skapa nytt steg</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="new-stage-label" className="text-white">Namn</Label>
            <Input
              id="new-stage-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="T.ex. Referenskontroll"
              className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 h-12 text-base"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
          </div>

          {/* Color picker — full width */}
          <div className="space-y-2">
            <Label className="text-white">Färg</Label>
            <div className="[&_.react-colorful]:!w-full [&_.react-colorful]:!h-[180px]">
              <HexColorPicker 
                color={selectedColor} 
                onChange={setSelectedColor}
              />
            </div>
          </div>

          {/* Icon picker — full width, below color */}
          <div className="space-y-2">
            <Label className="text-white">Ikon</Label>
            <div className="grid grid-cols-8 gap-1">
              {AVAILABLE_ICONS.map(({ name, Icon, label: iconLabel }) => (
                <button
                  key={name}
                  onClick={() => setSelectedIcon(name)}
                  onMouseDown={(e) => e.currentTarget.blur()}
                  onMouseUp={(e) => e.currentTarget.blur()}
                  className={`h-11 w-full rounded-lg flex items-center justify-center transition-colors duration-150 focus:outline-none focus:ring-0 active:scale-95 touch-manipulation ${
                    selectedIcon === name 
                      ? 'bg-white/30 text-white ring-1 ring-white/40' 
                      : 'bg-white/5 hover:bg-white/15 text-white/70'
                  }`}
                  title={iconLabel}
                >
                  <Icon className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>

          {/* Preview - centered */}
          <div className="space-y-2 pt-1 flex flex-col items-center">
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
        <DialogFooter className="flex gap-2 pt-2">
          <Button
            variant="glass"
            onClick={() => setOpen(false)}
            onMouseDown={(e) => e.currentTarget.blur()}
            onMouseUp={(e) => e.currentTarget.blur()}
            className="min-h-[44px] rounded-full"
          >
            Avbryt
          </Button>
          <Button
            variant="glass"
            onClick={handleCreate}
            onMouseDown={(e) => e.currentTarget.blur()}
            onMouseUp={(e) => e.currentTarget.blur()}
            disabled={!label.trim() || createCustomStage.isPending}
            className={`flex-1 min-h-[44px] rounded-full transition-colors duration-150 active:scale-95 ${
              !createCustomStage.isPending && label.trim() ? 'border border-white/30' : 'border border-transparent'
            }`}
          >
            Skapa steg
          </Button>
        </DialogFooter>
      </DialogContentNoFocus>
    </Dialog>
  );
}

import React, { useState } from 'react';
import { MoreVertical, Pencil, Palette, Image, RotateCcw, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  useStageSettings, 
  AVAILABLE_ICONS, 
  AVAILABLE_COLORS,
  getIconByName,
  type CandidateStage,
} from '@/hooks/useStageSettings';
import { toast } from 'sonner';

interface StageSettingsMenuProps {
  stageKey: CandidateStage;
}

export function StageSettingsMenu({ stageKey }: StageSettingsMenuProps) {
  const { stageConfig, updateStageSetting, resetStageSetting, getDefaultConfig } = useStageSettings();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  
  const currentConfig = stageConfig[stageKey];
  const defaultConfig = getDefaultConfig(stageKey);

  const handleOpenRenameDialog = () => {
    setNewLabel(currentConfig.label);
    setRenameDialogOpen(true);
  };

  const handleRename = async () => {
    if (!newLabel.trim()) return;
    
    try {
      await updateStageSetting.mutateAsync({
        stageKey,
        label: newLabel.trim(),
      });
      setRenameDialogOpen(false);
      toast.success('Namn uppdaterat');
    } catch (error) {
      toast.error('Kunde inte uppdatera namn');
    }
  };

  const handleColorChange = async (color: string) => {
    try {
      await updateStageSetting.mutateAsync({ stageKey, color });
      toast.success('Färg uppdaterad');
    } catch (error) {
      toast.error('Kunde inte uppdatera färg');
    }
  };

  const handleIconChange = async (iconName: string) => {
    try {
      await updateStageSetting.mutateAsync({ stageKey, iconName });
      toast.success('Ikon uppdaterad');
    } catch (error) {
      toast.error('Kunde inte uppdatera ikon');
    }
  };

  const handleReset = async () => {
    try {
      await resetStageSetting.mutateAsync(stageKey);
      toast.success('Återställt till standard');
    } catch (error) {
      toast.error('Kunde inte återställa');
    }
  };

  const CurrentIcon = getIconByName(currentConfig.iconName);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1 rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100">
            <MoreVertical className="h-4 w-4 text-white/70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-slate-800 border-white/10">
          <DropdownMenuItem 
            onClick={handleOpenRenameDialog}
            className="text-white hover:bg-white/10 cursor-pointer"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Byt namn
          </DropdownMenuItem>
          
          {/* Color submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-white hover:bg-white/10 cursor-pointer">
              <Palette className="h-4 w-4 mr-2" />
              Välj färg
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="bg-slate-800 border-white/10">
                <div className="grid grid-cols-5 gap-1 p-2">
                  {AVAILABLE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => handleColorChange(color.value)}
                      className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 relative"
                      style={{ 
                        backgroundColor: color.value,
                        borderColor: currentConfig.color === color.value ? 'white' : 'transparent'
                      }}
                      title={color.label}
                    >
                      {currentConfig.color === color.value && (
                        <Check className="h-3 w-3 text-white absolute inset-0 m-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          {/* Icon submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-white hover:bg-white/10 cursor-pointer">
              <Image className="h-4 w-4 mr-2" />
              Välj ikon
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="bg-slate-800 border-white/10 w-56">
                <div className="grid grid-cols-5 gap-1 p-2">
                  {AVAILABLE_ICONS.map(({ name, Icon, label }) => (
                    <button
                      key={name}
                      onClick={() => handleIconChange(name)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                        currentConfig.iconName === name 
                          ? 'bg-white/20 text-white' 
                          : 'hover:bg-white/10 text-white/70'
                      }`}
                      title={label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  ))}
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuSeparator className="bg-white/10" />
          
          <DropdownMenuItem 
            onClick={handleReset}
            className="text-white/70 hover:bg-white/10 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Återställ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-slate-900 border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Byt namn på steg</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="stage-label" className="text-white/70">Nytt namn</Label>
              <Input
                id="stage-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={defaultConfig.label}
                className="bg-white/5 border-white/20 text-white"
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameDialogOpen(false)}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Avbryt
            </Button>
            <Button
              onClick={handleRename}
              disabled={!newLabel.trim() || updateStageSetting.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

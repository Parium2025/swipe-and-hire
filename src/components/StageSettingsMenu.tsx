import React, { useState, useRef } from 'react';
import { MoreVertical, Pencil, Palette, Image, RotateCcw, Trash2 } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  useStageSettings, 
  AVAILABLE_ICONS, 
  getIconByName,
} from '@/hooks/useStageSettings';
import { toast } from 'sonner';

interface StageSettingsMenuProps {
  stageKey: string;
  onDelete?: () => void;
}

export function StageSettingsMenu({ stageKey, onDelete }: StageSettingsMenuProps) {
  const { stageConfig, updateStageSetting, resetStageSetting, deleteCustomStage, getDefaultConfig, isDefaultStage } = useStageSettings();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [tempColor, setTempColor] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const colorDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const currentConfig = stageConfig[stageKey];
  const defaultConfig = getDefaultConfig(stageKey);
  const isCustom = currentConfig?.isCustom ?? false;

  const handleColorPickerOpen = () => {
    setTempColor(currentConfig?.color || '#0EA5E9');
    setColorPickerOpen(true);
  };

  const handleColorPickerChange = (color: string) => {
    setTempColor(color);
    
    // Debounce the save to avoid too many API calls while dragging
    if (colorDebounceRef.current) {
      clearTimeout(colorDebounceRef.current);
    }
    colorDebounceRef.current = setTimeout(() => {
      handleColorChange(color);
    }, 300);
  };

  const handleOpenRenameDialog = () => {
    setNewLabel(currentConfig?.label || '');
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

  const handleDelete = async () => {
    try {
      await deleteCustomStage.mutateAsync(stageKey);
      setDeleteDialogOpen(false);
      toast.success('Steg borttaget');
      onDelete?.();
    } catch (error) {
      toast.error('Kunde inte ta bort steg');
    }
  };

  if (!currentConfig) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1 rounded hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100">
            <MoreVertical className="h-4 w-4 text-white" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            onClick={handleOpenRenameDialog}
            className="cursor-pointer"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Byt namn
          </DropdownMenuItem>
          
          {/* Color picker with popover */}
          <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
            <PopoverTrigger asChild>
              <DropdownMenuItem 
                className="cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault();
                  handleColorPickerOpen();
                }}
              >
                <Palette className="h-4 w-4 mr-2" />
                <span className="flex-1">Välj färg</span>
                <div 
                  className="w-5 h-5 rounded-full border border-white/30"
                  style={{ backgroundColor: currentConfig.color }}
                />
              </DropdownMenuItem>
            </PopoverTrigger>
            <PopoverContent 
              side="left" 
              align="start"
              className="w-auto p-3 bg-card border-white/20"
              sideOffset={8}
            >
              <HexColorPicker 
                color={tempColor || currentConfig.color} 
                onChange={handleColorPickerChange}
              />
            </PopoverContent>
          </Popover>

          {/* Icon submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Image className="h-4 w-4 mr-2" />
              Välj ikon
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-56">
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

          <DropdownMenuSeparator />
          
          {isCustom ? (
            <DropdownMenuItem 
              onClick={() => setDeleteDialogOpen(true)}
              className="text-red-400 cursor-pointer focus:text-red-400"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Ta bort steg
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem 
              onClick={handleReset}
              className="text-white/70 cursor-pointer"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Återställ
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-card-parium border-white/20 sm:max-w-md">
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
                placeholder={defaultConfig?.label || 'Ange namn'}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/50 focus:border-white/40"
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

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContentNoFocus className="bg-card-parium border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Ta bort steg</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              Är du säker på att du vill ta bort steget "{currentConfig.label}"? 
              Kandidater i detta steg kommer att flyttas till "Att kontakta".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500/80 hover:bg-red-500 text-white border-none"
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
}

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
  onLiveColorChange?: (color: string | null) => void;
}

export function StageSettingsMenu({ stageKey, onDelete, onLiveColorChange }: StageSettingsMenuProps) {
  const { stageConfig, updateStageSetting, resetStageSetting, deleteCustomStage, getDefaultConfig, isDefaultStage } = useStageSettings();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [liveColor, setLiveColor] = useState<string | null>(null);
  const colorDebounceRef = useRef<NodeJS.Timeout | null>(null);
  
  const currentConfig = stageConfig[stageKey];
  const defaultConfig = getDefaultConfig(stageKey);
  const isCustom = currentConfig?.isCustom ?? false;
  
  // Use liveColor while dragging, fall back to saved color
  const displayColor = liveColor ?? currentConfig?.color ?? '#0EA5E9';

  const handleColorPickerChange = (color: string) => {
    // Update display immediately - both local and parent
    setLiveColor(color);
    onLiveColorChange?.(color);
    
    // Debounce the save to avoid too many API calls while dragging
    if (colorDebounceRef.current) {
      clearTimeout(colorDebounceRef.current);
    }
    colorDebounceRef.current = setTimeout(async () => {
      try {
        await updateStageSetting.mutateAsync({ stageKey, color });
        // Don't clear liveColor here - let React Query update handle it naturally
        // The liveColor will be cleared when the dropdown closes or user picks another color
      } catch (error) {
        toast.error('Kunde inte uppdatera färg');
        // On error, revert to saved color
        setLiveColor(null);
        onLiveColorChange?.(null);
      }
    }, 500);
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
          
          {/* Color picker as submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <Palette className="h-4 w-4 mr-2" />
              <span className="flex-1">Välj färg</span>
              <div 
                className="w-5 h-5 rounded-full border border-white/30 ml-2"
                style={{ backgroundColor: `${displayColor}99` }}
              />
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent 
                className="p-3"
                sideOffset={8}
              >
                <HexColorPicker 
                  color={displayColor} 
                  onChange={handleColorPickerChange}
                />
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

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
          <DialogFooter className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              className="bg-white/5 backdrop-blur-sm border-white/20 text-white px-4 py-2 transition-colors duration-150 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-0"
            >
              Avbryt
            </Button>
            <Button
              onClick={handleRename}
              disabled={!newLabel.trim() || updateStageSetting.isPending}
              className="bg-primary hover:bg-primary/90 text-white px-8 py-2 transition-colors duration-150 focus:outline-none focus:ring-0"
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

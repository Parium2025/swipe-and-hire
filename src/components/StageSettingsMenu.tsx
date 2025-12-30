import React, { useState, useRef } from 'react';
import { MoreVertical, Pencil, Palette, Image, Trash2, AlertTriangle, Info } from 'lucide-react';
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
  candidateCount?: number;
  totalStageCount?: number;
  targetStageKey?: string; // The stage to move candidates to (next stage if first, first stage otherwise)
  targetStageLabel?: string;
  onDelete?: () => void;
  onMoveCandidatesAndDelete?: (fromStage: string, toStage: string) => Promise<void>;
  onLiveColorChange?: (color: string | null) => void;
}

export function StageSettingsMenu({ stageKey, candidateCount = 0, totalStageCount = 1, targetStageKey, targetStageLabel, onDelete, onMoveCandidatesAndDelete, onLiveColorChange }: StageSettingsMenuProps) {
  const { stageConfig, updateStageSetting, resetStageSetting, deleteStage, getDefaultConfig, isDefaultStage } = useStageSettings();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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

  // Check if we can delete this stage (must have at least 1 stage left)
  const canDelete = totalStageCount > 1;
  const hasCandidates = candidateCount > 0;
  
  const handleDeleteClick = () => {
    if (totalStageCount <= 1) {
      toast.error('Du måste ha minst ett steg kvar');
      return;
    }
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      if (hasCandidates && onMoveCandidatesAndDelete && targetStageKey) {
        // Move candidates to target stage before deleting
        await onMoveCandidatesAndDelete(stageKey, targetStageKey);
      } else {
        await deleteStage.mutateAsync(stageKey);
      }
      setDeleteDialogOpen(false);
      toast.success('Steg borttaget');
      onDelete?.();
    } catch (error) {
      toast.error('Kunde inte ta bort steg');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!currentConfig) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-1 rounded hover:bg-white/20 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100">
            <MoreVertical className="h-4 w-4 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]" />
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
                          ? 'bg-white/30 text-white' 
                          : 'hover:bg-white/20 text-white'
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
          
          {canDelete ? (
            <DropdownMenuItem 
              onClick={handleDeleteClick}
              className={`cursor-pointer ${hasCandidates ? 'text-orange-400 focus:text-orange-400' : 'text-red-400 focus:text-red-400'}`}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Ta bort steg
              {candidateCount > 0 && (
                <span className="ml-auto text-xs text-white/40">({candidateCount})</span>
              )}
            </DropdownMenuItem>
          ) : (
            <div className="px-2 py-1.5 text-white/40">
              <div className="flex items-center gap-2 text-sm">
                <Trash2 className="h-4 w-4" />
                Ta bort steg
              </div>
              <p className="text-xs text-white/30 mt-1 ml-6">
                Det måste alltid finnas minst ett steg för att organisera dina kandidater.
              </p>
            </div>
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
              className="bg-white/5 backdrop-blur-sm border-white/20 text-white px-4 py-2 transition-colors duration-150 hover:bg-white/10 md:hover:bg-white/10 hover:text-white md:hover:text-white disabled:opacity-30 touch-border-white [&_svg]:text-white hover:[&_svg]:text-white md:hover:[&_svg]:text-white focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Avbryt
            </Button>
            <Button
              onClick={handleRename}
              disabled={!newLabel.trim() || updateStageSetting.isPending}
              className="bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-8 py-2 touch-border-white transition-colors duration-150 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContentNoFocus 
          className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] max-h-[calc(100vh-4rem)] overflow-y-auto p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
        >
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="bg-red-500/20 p-2 rounded-full">
                <AlertTriangle className="h-4 w-4 text-red-400" />
              </div>
              <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
                Ta bort steg
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-white text-sm leading-relaxed break-words">
              {hasCandidates ? (
                <>
                  Det finns <span className="font-semibold text-orange-400">{candidateCount} kandidat{candidateCount > 1 ? 'er' : ''}</span> i detta steg. 
                  De kommer att flyttas till <span className="font-semibold text-white">"{targetStageLabel}"</span> när du tar bort steget.
                </>
              ) : (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white break-words">"{currentConfig?.label}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-[0.6] mt-0 flex items-center justify-center bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              variant="destructiveSoft"
              disabled={isDeleting}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-[0.4] text-sm flex items-center justify-center"
            >
              <Trash2 className="h-4 w-4 mr-1.5" />
              {isDeleting ? 'Tar bort...' : 'Ta bort'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
}

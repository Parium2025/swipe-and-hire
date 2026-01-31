import { useState, useEffect, useRef } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
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
import { MoreVertical, Pencil, Palette, Trash2, Image, AlertTriangle } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { toast } from 'sonner';
import { useJobStageSettings, JOB_STAGE_ICONS, getJobStageIconByName } from '@/hooks/useJobStageSettings';

interface JobStageSettingsMenuProps {
  jobId: string;
  stageKey: string;
  candidateCount?: number;
  totalStageCount?: number;
  targetStageKey?: string;
  targetStageLabel?: string;
  onMoveCandidatesAndDelete?: () => Promise<void>;
  onLiveColorChange?: (color: string | null) => void;
}

export function JobStageSettingsMenu({ 
  jobId,
  stageKey, 
  candidateCount = 0,
  totalStageCount = 1,
  targetStageKey,
  targetStageLabel,
  onMoveCandidatesAndDelete,
  onLiveColorChange,
}: JobStageSettingsMenuProps) {
  const { stageSettings, updateStage, deleteStage } = useJobStageSettings(jobId);
  const settings = stageSettings[stageKey];
  
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [newLabel, setNewLabel] = useState(settings?.label || '');
  const [liveColor, setLiveColor] = useState<string | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Use liveColor while dragging, fall back to saved color
  const displayColor = liveColor ?? settings?.color ?? '#0EA5E9';
  
  // Update newLabel when settings change
  useEffect(() => {
    if (settings?.label) {
      setNewLabel(settings.label);
    }
  }, [settings?.label]);

  const handleOpenRenameDialog = () => {
    setNewLabel(settings?.label || '');
    setRenameDialogOpen(true);
  };

  const handleRename = () => {
    if (newLabel.trim()) {
      updateStage({ stageKey, updates: { label: newLabel.trim() } });
      toast.success('Steg uppdaterat');
    }
    setRenameDialogOpen(false);
  };

  const handleColorChange = (color: string) => {
    setLiveColor(color);
    onLiveColorChange?.(color);
    
    // Debounce the actual save
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      updateStage({ stageKey, updates: { color } });
    }, 300);
  };

  const handleIconChange = (iconName: string) => {
    updateStage({ stageKey, updates: { iconName } });
    toast.success('Ikon uppdaterad');
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
      if (onMoveCandidatesAndDelete && candidateCount > 0) {
        await onMoveCandidatesAndDelete();
      }
      deleteStage(stageKey);
      setDeleteDialogOpen(false);
      toast.success('Steg borttaget');
    } catch (error) {
      toast.error('Kunde inte ta bort steg');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-0.5 rounded hover:bg-white/20 transition-colors text-white/70 hover:text-white">
            <MoreVertical className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="end" 
          className="w-48 border-white/20"
        >
          <DropdownMenuItem 
            onClick={handleOpenRenameDialog}
            className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Byt namn
          </DropdownMenuItem>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer">
              <Palette className="h-4 w-4 mr-2" />
              <span className="flex-1">Välj färg</span>
              <div 
                className="w-5 h-5 rounded-full border border-white/30 ml-2"
                style={{ backgroundColor: `${displayColor}99` }}
              />
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent 
                className="p-3 bg-card-parium border-white/20"
                sideOffset={8}
              >
                <HexColorPicker 
                  color={displayColor} 
                  onChange={handleColorChange}
                />
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer">
              <Image className="h-4 w-4 mr-2" />
              Välj ikon
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent 
                className="bg-card-parium border-white/20 w-56"
              >
                <div className="grid grid-cols-5 gap-1 p-2">
                  {JOB_STAGE_ICONS.map(({ name, Icon, label }) => (
                    <button
                      key={name}
                      onClick={() => handleIconChange(name)}
                      className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
                        settings?.iconName === name 
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
          
          <DropdownMenuSeparator className="bg-white/10" />
          
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
            <div className="px-2 py-1.5">
              <div className="flex items-center gap-2 text-sm text-white/40">
                <Trash2 className="h-4 w-4" />
                Ta bort steg
              </div>
              <p className="text-xs text-white mt-1 ml-6">
                Det måste alltid finnas minst ett steg för att organisera kandidater.
              </p>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContentNoFocus className="bg-card-parium border-white/20 sm:max-w-md">
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
                placeholder="Ange namn"
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
              disabled={!newLabel.trim()}
              className="bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-8 py-2 touch-border-white transition-colors duration-150 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Spara
            </Button>
          </DialogFooter>
        </DialogContentNoFocus>
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
            <AlertDialogDescription className="text-white text-sm leading-relaxed">
              {hasCandidates ? (
                <>
                  Det finns <span className="font-semibold text-orange-400">{candidateCount} kandidat{candidateCount > 1 ? 'er' : ''}</span> i detta steg. 
                  De kommer att flyttas till <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">"{targetStageLabel}"</span> när du tar bort steget.
                </>
              ) : (
                <>
                  Är du säker på att du vill ta bort <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">"{settings?.label}"</span>? Denna åtgärd går inte att ångra.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
            <AlertDialogCancel 
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              variant="destructiveSoft"
              disabled={isDeleting}
              style={{ height: '44px', minHeight: '44px', padding: '0 1rem' }}
              className="flex-1 text-sm flex items-center justify-center rounded-full"
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

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
import { useIsMobile } from '@/hooks/use-mobile';
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
  const isMobile = useIsMobile();
  
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [colorDialogOpen, setColorDialogOpen] = useState(false);
  const [iconDialogOpen, setIconDialogOpen] = useState(false);
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
    setIconDialogOpen(false);
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
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button 
            className="p-2.5 -m-1.5 rounded-full md:hover:bg-white/20 active:bg-white/15 transition-colors text-white/70 active:text-white touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
            onMouseDown={(e) => e.preventDefault()}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent 
          align="center" 
          sideOffset={8}
          className="w-40 border-white/20 py-1"
        >
          <DropdownMenuItem 
            onSelect={() => {
              setTimeout(handleOpenRenameDialog, 100);
            }}
            className="text-white md:hover:bg-white/10 focus:bg-white/10 active:bg-white/15 cursor-pointer text-xs py-1.5 px-2 min-h-0 transition-colors duration-100"
          >
            <Pencil className="h-3 w-3 mr-1.5 flex-shrink-0" />
            Byt namn
          </DropdownMenuItem>
          
          {/* Color picker: dialog on mobile, submenu on desktop */}
          {isMobile ? (
            <DropdownMenuItem 
              onSelect={() => { setTimeout(() => setColorDialogOpen(true), 100); }}
              className="text-white md:hover:bg-white/10 focus:bg-white/10 active:bg-white/15 cursor-pointer text-xs py-1.5 px-2 min-h-0 transition-colors duration-100"
            >
              <Palette className="h-3 w-3 mr-1.5 flex-shrink-0" />
              <span className="flex-1">Välj färg</span>
              <div 
                className="w-4 h-4 rounded-full border border-white/30 ml-1.5 flex-shrink-0"
                style={{ backgroundColor: `${displayColor}99` }}
              />
            </DropdownMenuItem>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-white md:hover:bg-white/10 focus:bg-white/10 active:bg-white/15 cursor-pointer text-xs py-1.5 px-2 transition-colors duration-100">
                <Palette className="h-3 w-3 mr-1.5 flex-shrink-0" />
                <span className="flex-1">Välj färg</span>
                <div 
                  className="w-4 h-4 rounded-full border border-white/30 ml-1.5 flex-shrink-0"
                  style={{ backgroundColor: `${displayColor}99` }}
                />
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent 
                  className="p-2 bg-card-parium border-white/20"
                  sideOffset={4}
                >
                  <HexColorPicker 
                    color={displayColor} 
                    onChange={handleColorChange}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          )}
          
          {/* Icon picker: dialog on mobile, submenu on desktop */}
          {isMobile ? (
            <DropdownMenuItem 
              onSelect={() => { setTimeout(() => setIconDialogOpen(true), 100); }}
              className="text-white md:hover:bg-white/10 focus:bg-white/10 active:bg-white/15 cursor-pointer text-xs py-1.5 px-2 min-h-0 transition-colors duration-100"
            >
              <Image className="h-3 w-3 mr-1.5 flex-shrink-0" />
              Välj ikon
            </DropdownMenuItem>
          ) : (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-white md:hover:bg-white/10 focus:bg-white/10 active:bg-white/15 cursor-pointer text-xs py-1.5 px-2 transition-colors duration-100">
                <Image className="h-3 w-3 mr-1.5 flex-shrink-0" />
                Välj ikon
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent 
                  className="bg-card-parium border-white/20 w-48"
                >
                  <div className="grid grid-cols-5 gap-0.5 p-1.5">
                    {JOB_STAGE_ICONS.map(({ name, Icon, label }) => (
                      <button
                        key={name}
                        onClick={() => handleIconChange(name)}
                        className={`w-8 h-8 rounded-md flex items-center justify-center transition-all duration-100 touch-manipulation active:scale-90 ${
                          settings?.iconName === name 
                            ? 'bg-white/30 text-white ring-1 ring-white/40' 
                            : 'md:hover:bg-white/20 active:bg-white/15 text-white/80'
                        }`}
                        title={label}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
          )}
          
          <DropdownMenuSeparator className="bg-white/10 my-0.5" />
          
          {canDelete ? (
            <DropdownMenuItem 
              onSelect={() => { setTimeout(handleDeleteClick, 100); }}
              className={`cursor-pointer text-xs py-1.5 px-2 min-h-0 transition-colors duration-100 active:bg-white/10 ${hasCandidates ? 'text-orange-400 focus:text-orange-400' : 'text-red-400 focus:text-red-400'}`}
            >
              <Trash2 className="h-3 w-3 mr-1.5 flex-shrink-0" />
              Ta bort steg
              {candidateCount > 0 && (
                <span className="ml-auto text-[10px] text-white/40">({candidateCount})</span>
              )}
            </DropdownMenuItem>
          ) : (
            <div className="px-2 py-1">
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <Trash2 className="h-3 w-3 flex-shrink-0" />
                Ta bort steg
              </div>
              <p className="text-[10px] text-white mt-0.5 ml-5 leading-tight">
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

      {/* Color picker dialog (mobile only) */}
      <Dialog open={colorDialogOpen} onOpenChange={setColorDialogOpen}>
        <DialogContentNoFocus className="bg-card-parium border-white/20 sm:max-w-xs w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Välj färg
            </DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-4">
            <HexColorPicker 
              color={displayColor} 
              onChange={handleColorChange}
              style={{ width: '100%', maxWidth: '260px' }}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => setColorDialogOpen(false)}
              className="bg-primary hover:bg-primary/90 md:hover:bg-primary/90 text-white px-8 py-2 w-full touch-border-white transition-colors duration-150 focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            >
              Klar
            </Button>
          </DialogFooter>
        </DialogContentNoFocus>
      </Dialog>

      {/* Icon picker dialog (mobile only) */}
      <Dialog open={iconDialogOpen} onOpenChange={setIconDialogOpen}>
        <DialogContentNoFocus className="bg-card-parium border-white/20 sm:max-w-xs w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Image className="h-4 w-4" />
              Välj ikon
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-1.5 py-4">
            {JOB_STAGE_ICONS.map(({ name, Icon, label }) => (
              <button
                key={name}
                onClick={() => handleIconChange(name)}
                className={`w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-100 touch-manipulation active:scale-90 ${
                  settings?.iconName === name 
                    ? 'bg-white/30 text-white ring-1 ring-white/40' 
                    : 'bg-white/5 active:bg-white/15 text-white/80'
                }`}
                title={label}
              >
                <Icon className="h-5 w-5" />
              </button>
            ))}
          </div>
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

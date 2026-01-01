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
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { MoreVertical, Pencil, Palette, Trash2, Image } from 'lucide-react';
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
  const [newLabel, setNewLabel] = useState(settings?.label || '');
  const [liveColor, setLiveColor] = useState<string | null>(null);
  
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update newLabel when settings change
  useEffect(() => {
    if (settings?.label) {
      setNewLabel(settings.label);
    }
  }, [settings?.label]);

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

  const handleDelete = async () => {
    if (onMoveCandidatesAndDelete && candidateCount > 0) {
      await onMoveCandidatesAndDelete();
    }
    deleteStage(stageKey);
    setDeleteDialogOpen(false);
    toast.success('Steg borttaget');
  };

  // Only custom stages can be deleted, and only if there's more than one stage
  const canDelete = settings?.isCustom && totalStageCount > 1;

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
            onClick={() => setRenameDialogOpen(true)}
            className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer"
          >
            <Pencil className="h-4 w-4 mr-2" />
            Byt namn
          </DropdownMenuItem>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer">
              <Palette className="h-4 w-4 mr-2" />
              Välj färg
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent 
              className="p-3 bg-card-parium border-white/20"
            >
              <HexColorPicker 
                color={liveColor || settings?.color || '#0EA5E9'} 
                onChange={handleColorChange}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="text-white hover:bg-white/10 focus:bg-white/10 cursor-pointer">
              <Image className="h-4 w-4 mr-2" />
              Välj ikon
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent 
              className="bg-card-parium border-white/20 p-2 w-56"
            >
              <div className="grid grid-cols-5 gap-1">
                {JOB_STAGE_ICONS.map(({ name, Icon, label }) => (
                  <button
                    key={name}
                    onClick={() => handleIconChange(name)}
                    className={`p-2 rounded hover:bg-white/20 transition-colors ${
                      settings?.iconName === name ? 'bg-white/20 ring-1 ring-white/40' : ''
                    }`}
                    title={label}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </button>
                ))}
              </div>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          
          {canDelete && (
            <>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem 
                onClick={() => setDeleteDialogOpen(true)}
                className="text-red-400 hover:bg-red-500/10 focus:bg-red-500/10 cursor-pointer"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Ta bort steg
                {candidateCount > 0 && (
                  <span className="ml-auto text-xs text-white/50">({candidateCount})</span>
                )}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContentNoFocus className="bg-card-parium border-white/20 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Byt namn på steg</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Stegnamn"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameDialogOpen(false)}
              className="text-white hover:bg-white/10"
            >
              Avbryt
            </Button>
            <Button
              onClick={handleRename}
              className="bg-primary hover:bg-primary/90"
            >
              Spara
            </Button>
          </DialogFooter>
        </DialogContentNoFocus>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContentNoFocus className="bg-card-parium border-white/20 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Ta bort steg?</AlertDialogTitle>
            <AlertDialogDescription className="text-white/70">
              {candidateCount > 0 && targetStageLabel
                ? `${candidateCount} kandidat(er) kommer flyttas till "${targetStageLabel}".`
                : 'Detta steg kommer tas bort permanent.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/10 border-white/20 text-white hover:bg-white/20">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
}

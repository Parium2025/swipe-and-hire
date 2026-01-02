import { useState } from 'react';
import { Dialog, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HexColorPicker } from 'react-colorful';
import { toast } from 'sonner';
import { useJobStageSettings, JOB_STAGE_ICONS } from '@/hooks/useJobStageSettings';

const MAX_STAGES = 6;

interface CreateJobStageDialogProps {
  jobId: string;
  trigger?: React.ReactNode;
  currentStageCount?: number;
}

export function CreateJobStageDialog({ jobId, trigger, currentStageCount = 0 }: CreateJobStageDialogProps) {
  const { createStage, isCreating, orderedStages } = useJobStageSettings(jobId);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [color, setColor] = useState('#0EA5E9');
  const [iconName, setIconName] = useState('phone');

  // Use passed count or get from hook
  const stageCount = currentStageCount || orderedStages.length;
  const canCreateMore = stageCount < MAX_STAGES;

  const handleCreate = async () => {
    if (!label.trim()) {
      toast.error('Ange ett namn för steget');
      return;
    }

    if (!canCreateMore) {
      toast.error(`Max ${MAX_STAGES} steg tillåtna`);
      return;
    }

    try {
      await createStage({ label: label.trim(), color, iconName });
      toast.success('Nytt steg skapat');
      setOpen(false);
      setLabel('');
      setColor('#0EA5E9');
      setIconName('phone');
    } catch (error) {
      console.error('Error creating stage:', error);
      toast.error('Kunde inte skapa steg');
    }
  };

  // Don't render if max stages reached
  if (!canCreateMore) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10">
            + Nytt steg
          </Button>
        </DialogTrigger>
      )}
      <DialogContentNoFocus className="bg-card-parium border-white/20 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Skapa nytt steg</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-white">Namn</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="t.ex. Referenskoll"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />
          </div>
          
          <div className="space-y-2">
            <Label className="text-white">Färg</Label>
            <div className="flex gap-4">
              <HexColorPicker color={color} onChange={setColor} />
              <div 
                className="w-12 h-12 rounded-lg ring-1 ring-white/20"
                style={{ backgroundColor: color }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label className="text-white">Ikon</Label>
            <div className="grid grid-cols-10 gap-1 p-2 bg-white/5 rounded-lg">
              {JOB_STAGE_ICONS.map(({ name, Icon, label: iconLabel }) => (
                <button
                  key={name}
                  onClick={() => setIconName(name)}
                  className={`p-2 rounded hover:bg-white/20 transition-colors ${
                    iconName === name ? 'bg-white/20 ring-1 ring-white/40' : ''
                  }`}
                  title={iconLabel}
                >
                  <Icon className="h-4 w-4 text-white" />
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="text-white hover:bg-white/10"
          >
            Avbryt
          </Button>
          <Button
            onClick={handleCreate}
            disabled={isCreating || !label.trim()}
            className="bg-primary hover:bg-primary/90"
          >
            {isCreating ? 'Skapar...' : 'Skapa steg'}
          </Button>
        </div>
      </DialogContentNoFocus>
    </Dialog>
  );
}

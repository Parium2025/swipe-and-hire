import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProfileVideoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string;
  coverImageUrl?: string;
}

const ProfileVideoDialog = ({ open, onOpenChange, videoUrl, coverImageUrl }: ProfileVideoDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-black border-none">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 z-50 text-white hover:bg-white/20 rounded-full"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-5 w-5" />
        </Button>
        <div className="aspect-[9/16] max-h-[80vh] w-full flex items-center justify-center">
          <video
            src={videoUrl}
            poster={coverImageUrl}
            controls
            autoPlay
            className="w-full h-full object-contain"
            playsInline
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileVideoDialog;

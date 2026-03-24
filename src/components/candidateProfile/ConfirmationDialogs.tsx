import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface DeleteNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export const DeleteNoteDialog = ({ open, onOpenChange, onConfirm }: DeleteNoteDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContentNoFocus
      className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
    >
      <AlertDialogHeader className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <div className="bg-red-500/20 p-2 rounded-full">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
            Ta bort anteckning
          </AlertDialogTitle>
        </div>
        <AlertDialogDescription className="text-white text-sm leading-relaxed">
          Är du säker på att du vill ta bort denna anteckning? Denna åtgärd går inte att ångra.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
        <AlertDialogCancel
          onClick={() => onOpenChange(false)}
          className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
        >
          Avbryt
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          variant="destructiveSoft"
          className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Ta bort
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContentNoFocus>
  </AlertDialog>
);

interface RemoveCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateName: string;
  onConfirm: () => void;
}

export const RemoveCandidateDialog = ({ open, onOpenChange, candidateName, onConfirm }: RemoveCandidateDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContentNoFocus
      className="border-white/20 text-white w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-md sm:w-[28rem] p-4 sm:p-6 bg-white/10 backdrop-blur-sm rounded-xl shadow-lg mx-0"
    >
      <AlertDialogHeader className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-2.5">
          <div className="bg-red-500/20 p-2 rounded-full">
            <AlertTriangle className="h-4 w-4 text-white" />
          </div>
          <AlertDialogTitle className="text-white text-base md:text-lg font-semibold">
            Ta bort kandidat
          </AlertDialogTitle>
        </div>
        <AlertDialogDescription className="text-white text-sm leading-relaxed">
          Är du säker på att du vill ta bort{' '}
          <span className="font-semibold text-white inline-block max-w-[200px] truncate align-bottom">
            &quot;{candidateName}&quot;
          </span>
          ? Denna åtgärd går inte att ångra.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center">
        <AlertDialogCancel
          onClick={() => onOpenChange(false)}
          className="btn-dialog-action flex-1 mt-0 flex items-center justify-center rounded-full bg-white/10 border-white/20 text-white text-sm transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50"
        >
          Avbryt
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          variant="destructiveSoft"
          className="btn-dialog-action flex-1 text-sm flex items-center justify-center rounded-full"
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Ta bort
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContentNoFocus>
  </AlertDialog>
);

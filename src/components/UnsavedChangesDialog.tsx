import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onSaveAndLeave?: () => Promise<void>;
  isSaving?: boolean;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  onSaveAndLeave,
  isSaving = false,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-lg overflow-hidden">
        <AlertDialogHeader className="text-center">
          <AlertDialogTitle className="text-center">Osparade ändringar</AlertDialogTitle>
          <AlertDialogDescription className="text-white text-center">
            Du har osparade ändringar. Vad vill du göra?
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/* All buttons in one row with smaller sizing */}
        <div className="flex flex-row gap-2 justify-center pt-2">
          <AlertDialogCancel 
            onClick={onCancel} 
            disabled={isSaving}
            className="px-3 py-2 text-sm bg-white/10 border-white/30 text-white transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50 mt-0"
          >
            Avbryt
          </AlertDialogCancel>
          {onSaveAndLeave && (
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                onSaveAndLeave();
              }}
              disabled={isSaving}
              className="px-3 py-2 text-sm bg-cyan-500/20 text-white border border-cyan-500/40 md:hover:bg-cyan-500/30 md:hover:border-cyan-500/50 transition-all whitespace-nowrap"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Sparar...
                </>
              ) : (
                "Spara och lämna"
              )}
            </AlertDialogAction>
          )}
          <AlertDialogAction 
            onClick={onConfirm} 
            disabled={isSaving}
            className="px-3 py-2 text-sm bg-red-500/20 text-white border border-red-500/40 md:hover:bg-red-500/30 md:hover:border-red-500/50 transition-all whitespace-nowrap"
          >
            Lämna utan att spara
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

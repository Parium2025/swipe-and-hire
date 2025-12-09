import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
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
      <AlertDialogContent className="max-w-md bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Osparade ändringar</AlertDialogTitle>
          <AlertDialogDescription className="text-white">
            Du har osparade ändringar. Vad vill du göra?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:justify-center">
          <AlertDialogCancel 
            onClick={onCancel} 
            disabled={isSaving}
            className="bg-white/10 border-white/30 text-white transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50 m-0"
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
              className="bg-green-500/20 text-white border border-green-500/40 md:hover:bg-green-500/30 md:hover:border-green-500/50 md:hover:shadow-lg md:hover:scale-[1.02] transition-all m-0"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
            className="bg-red-500/20 text-white border border-red-500/40 md:hover:bg-red-500/30 md:hover:border-red-500/50 md:hover:shadow-lg md:hover:scale-[1.02] transition-all m-0"
          >
            Lämna utan att spara
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

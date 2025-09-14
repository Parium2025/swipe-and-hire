import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogPortal,
  AlertDialogOverlay,
} from "@/components/ui/alert-dialog";

interface UnsavedChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogOverlay className="fixed inset-0 z-50 bg-black/20 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <AlertDialogContent className="max-w-md bg-white/20 backdrop-blur-md border-white/30 text-white shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">Osparade ändringar</AlertDialogTitle>
            <AlertDialogDescription className="text-white/90">
              Du har osparade ändringar. Är du säker på att du vill lämna sidan utan att spara?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={onCancel} className="bg-white/10 border-white/30 text-white hover:bg-white/20">
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction onClick={onConfirm} className="bg-red-500/80 text-white hover:bg-red-500/90 border-red-500/50">
              Lämna utan att spara
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogPortal>
    </AlertDialog>
  );
}
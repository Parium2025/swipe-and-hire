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
      <AlertDialogContent className="max-w-md bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Osparade ändringar</AlertDialogTitle>
          <AlertDialogDescription className="text-white">
            Du har osparade ändringar. Är du säker på att du vill lämna sidan utan att spara?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:justify-center">
          <AlertDialogCancel onClick={onCancel} className="bg-white/10 border-white/30 text-white transition-all duration-300 md:hover:bg-white/20 md:hover:text-white md:hover:border-white/50 m-0">
            Avbryt
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-red-600/90 hover:bg-red-600 text-white border-0 transition-all duration-300 m-0">
            Lämna utan att spara
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
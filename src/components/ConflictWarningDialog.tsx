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
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ConflictWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReload: () => void;
  onOverwrite: () => void;
  modifiedBy?: string;
  modifiedAt?: string;
}

export const ConflictWarningDialog = ({
  open,
  onOpenChange,
  onReload,
  onOverwrite,
  modifiedBy,
  modifiedAt,
}: ConflictWarningDialogProps) => {
  const formatTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString('sv-SE', {
        hour: '2-digit',
        minute: '2-digit',
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="bg-slate-900 border-amber-500/50 text-white max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/20 rounded-full">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
            </div>
            <AlertDialogTitle className="text-white text-lg">
              Ändringar upptäckta
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-white/70 text-sm leading-relaxed">
            Någon annan har gjort ändringar i detta utkast medan du redigerade.
            {modifiedBy && (
              <span className="block mt-2 text-white/60">
                Ändrad av: <span className="text-white">{modifiedBy}</span>
                {modifiedAt && <span> ({formatTime(modifiedAt)})</span>}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel 
            onClick={onReload}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Ladda om deras ändringar
          </AlertDialogCancel>
          <AlertDialogAction 
            onClick={onOverwrite}
            className="bg-amber-500 text-white hover:bg-amber-600"
          >
            Skriv över med mina ändringar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ConflictWarningDialog;

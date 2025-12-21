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
import type { MouseEvent, TouchEvent } from "react";

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
  const blurActiveElement = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Prevent "focus ring flash" on mouse/touch interaction.
  const handleButtonMouseDown = (e: MouseEvent<HTMLButtonElement>) => {
    // Prevent focus from being applied on mouse down
    e.preventDefault();
    blurActiveElement();
  };

  const handleButtonTouchStart = (_e: TouchEvent<HTMLButtonElement>) => {
    blurActiveElement();
  };

  const handleGapMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) blurActiveElement();
  };

  const handleGapTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) blurActiveElement();
  };

  const noFocusRing =
    "outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={(e) => {
          // Radix auto-focuses the cancel button by default; prevent that to avoid focus-ring/double-border.
          e.preventDefault();
          blurActiveElement();
        }}
        onCloseAutoFocus={(e) => {
          // Avoid returning focus to the trigger (which can also flash a focus ring)
          e.preventDefault();
          blurActiveElement();
        }}
        className="max-w-lg bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-lg overflow-hidden"
      >
        <AlertDialogHeader className="text-center">
          <AlertDialogTitle className="text-center">Osparade ändringar</AlertDialogTitle>
          <AlertDialogDescription className="text-white text-center">
            Du har osparade ändringar. Vad vill du göra?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* All buttons in one row with smaller sizing */}
        <div
          className="flex flex-row gap-2 justify-center pt-2"
          onMouseDown={handleGapMouseDown}
          onTouchStart={handleGapTouchStart}
        >
          <AlertDialogCancel
            onMouseDown={handleButtonMouseDown}
            onTouchStart={handleButtonTouchStart}
            onClick={(e) => {
              e.currentTarget.blur();
              onCancel();
            }}
            disabled={isSaving}
            className={`rounded-full px-3 py-2 text-sm bg-white/5 backdrop-blur-[2px] border-white/20 text-white transition-all duration-300 md:hover:bg-white/15 md:hover:text-white md:hover:border-white/50 mt-0 ${noFocusRing}`}
          >
            Avbryt
          </AlertDialogCancel>

          {onSaveAndLeave && (
            <AlertDialogAction
              onMouseDown={handleButtonMouseDown}
              onTouchStart={handleButtonTouchStart}
              onClick={(e) => {
                e.preventDefault();
                e.currentTarget.blur();
                void onSaveAndLeave();
              }}
              disabled={isSaving}
              className={`rounded-full px-3 py-2 text-sm bg-amber-500/20 backdrop-blur-sm text-white border border-amber-500/40 md:hover:bg-amber-500/30 md:hover:border-amber-500/50 transition-all duration-300 whitespace-nowrap ${noFocusRing}`}
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
            onMouseDown={handleButtonMouseDown}
            onTouchStart={handleButtonTouchStart}
            onClick={(e) => {
              e.currentTarget.blur();
              onConfirm();
            }}
            disabled={isSaving}
            className={`rounded-full px-3 py-2 text-sm bg-red-500/20 backdrop-blur-sm text-white border border-red-500/40 md:hover:bg-red-500/30 md:hover:border-red-500/50 transition-all duration-300 whitespace-nowrap ${noFocusRing}`}
          >
            Lämna utan att spara
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}


import { useState } from 'react';
import { Images, Trash2, Check, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AlertDialogContentNoFocus } from '@/components/ui/alert-dialog-no-focus';
import { useToast } from '@/hooks/use-toast';
import { useOrgImageLibrary, type LibraryImage } from '@/hooks/useOrgImageLibrary';

interface ImageLibraryPickerProps {
  /** Anropas med bildens lagringssökväg när en bild väljs. */
  onSelect: (storagePath: string) => void;
}

const noFocusRing =
  'outline-none focus:outline-none focus:ring-0 focus:ring-offset-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0';

/**
 * Knapp + galleri för bolagets gemensamma bildbibliotek (Växa och Pro).
 * Renderar ingenting för användare utan åtkomst.
 */
export function ImageLibraryPicker({ onSelect }: ImageLibraryPickerProps) {
  const { hasAccess, images, loading, removeFromLibrary } = useOrgImageLibrary();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LibraryImage | null>(null);

  if (!hasAccess) return null;

  const handleDelete = async () => {
    const target = pendingDelete;
    setPendingDelete(null);
    if (!target) return;
    try {
      await removeFromLibrary(target.id);
      toast({ title: 'Bild borttagen', description: 'Bilden är borttagen från bildbiblioteket.' });
    } catch {
      toast({ title: 'Kunde inte ta bort bilden', description: 'Försök igen.', variant: 'destructive' });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.currentTarget.blur(); setOpen(true); }}
        className={`mt-3 w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/20 text-white text-sm transition-colors duration-150 md:hover:bg-white/10 touch-border-white [-webkit-tap-highlight-color:transparent] ${noFocusRing}`}
      >
        <Images className="h-4 w-4" />
        <span>Välj från bildbiblioteket{images.length > 0 ? ` (${images.length})` : ''}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] max-h-[85dvh] flex flex-col bg-white/10 backdrop-blur-md border-white/20 text-white shadow-lg rounded-2xl p-4 sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="text-white flex items-center gap-2">
              <Images className="h-5 w-5" />
              Bildbibliotek
            </DialogTitle>
            <DialogDescription className="text-white text-sm">
              Bilder som du och dina kollegor har laddat upp. Välj en bild för att använda den i annonsen.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto -mx-1 px-1 pt-2">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] rounded-xl bg-white/10 animate-pulse" />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-12 gap-3">
                <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center">
                  <Images className="h-6 w-6 text-white" />
                </div>
                <p className="text-white text-sm max-w-xs">
                  Biblioteket är tomt. Bilder som laddas upp till annonser sparas här automatiskt.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img) => (
                  <div key={img.id} className="group relative aspect-[4/3] rounded-xl overflow-hidden border border-white/20 bg-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(img.storage_path);
                        setOpen(false);
                      }}
                      className={`absolute inset-0 w-full h-full ${noFocusRing}`}
                      aria-label="Använd bilden"
                    >
                      <img src={img.url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 md:group-hover:bg-black/35 transition-colors duration-200">
                        <span className="opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground">
                          <Check className="h-3.5 w-3.5" />
                          Använd
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingDelete(img)}
                      aria-label="Ta bort från bildbiblioteket"
                      className={`absolute top-2 right-2 h-8 w-8 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white transition-colors duration-200 md:hover:bg-red-500/80 ${noFocusRing}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContentNoFocus className="max-w-md bg-white/10 backdrop-blur-sm border-white/20 text-white shadow-lg overflow-hidden">
          <AlertDialogHeader className="text-center items-center">
            <div className="h-11 w-11 rounded-full bg-red-500/20 flex items-center justify-center mb-1">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <AlertDialogTitle className="text-center">Ta bort bilden</AlertDialogTitle>
            <AlertDialogDescription className="text-white text-center">
              Bilden tas bort från bildbiblioteket för hela bolaget. Annonser som redan använder den påverkas inte.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-center pt-2 w-full">
            <AlertDialogCancel
              className={`w-full sm:w-auto min-h-[44px] rounded-full px-4 py-2 text-sm bg-white/5 border-white/20 text-white md:hover:bg-white/15 md:hover:text-white mt-0 ${noFocusRing}`}
            >
              Avbryt
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={`w-full sm:w-auto min-h-[44px] rounded-full px-4 py-2 text-sm border-0 bg-red-500/80 text-white md:hover:!bg-red-500 ${noFocusRing}`}
            >
              Ta bort
            </AlertDialogAction>
          </div>
        </AlertDialogContentNoFocus>
      </AlertDialog>
    </>
  );
}

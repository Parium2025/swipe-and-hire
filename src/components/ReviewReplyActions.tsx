import { useState } from 'react';
import { AlertTriangle, Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog';

export function ReviewReplyActions({ onEdit, onDelete, removesThread = false, disabled = false }: {
  onEdit?: () => void;
  onDelete: () => Promise<boolean>;
  removesThread?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const confirm = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      if (await onDelete()) setOpen(false);
    } finally {
      setDeleting(false);
    }
  };
  return (
    <>
      <div className="flex items-center gap-2">
        {onEdit && <Button type="button" variant="glass" size="icon" className="h-9 w-9 md:hover:bg-pure-white/20 active:scale-90" aria-label="Redigera svar" disabled={disabled || deleting} onClick={onEdit}><Pencil /></Button>}
        <Button type="button" variant="glass" size="icon" className="h-9 w-9 bg-destructive/20 border-destructive/40 text-pure-white md:hover:bg-destructive/30 active:scale-90" aria-label="Ta bort svar" disabled={disabled || deleting} onClick={() => setOpen(true)}><Trash2 /></Button>
      </div>
      <AlertDialog open={open} onOpenChange={(next) => { if (!deleting) setOpen(next); }}>
        <AlertDialogContent elevated className="w-[calc(100vw-2rem)] max-w-md rounded-lg bg-pure-white/10 border-pure-white/20 text-pure-white backdrop-blur-sm p-4 sm:p-6">
          <AlertDialogHeader className="space-y-4 text-center">
            <div className="flex items-center justify-center gap-2.5">
              <div className="rounded-full bg-destructive/20 p-2"><AlertTriangle className="h-4 w-4 text-pure-white" /></div>
              <AlertDialogTitle className="text-base md:text-lg">Ta bort svaret</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-pure-white text-sm leading-relaxed">
              {removesThread ? 'Svaret och alla efterföljande inlägg i tråden tas bort. Det går inte att ångra.' : 'Svaret tas bort för alla som kan läsa tråden. Det går inte att ångra.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-center sm:space-x-0">
            <AlertDialogCancel disabled={deleting} className={buttonVariants({ variant: 'glass', className: 'flex-1 mt-0 h-11' })}>Avbryt</AlertDialogCancel>
            <Button type="button" variant="destructiveSoft" className="flex-1 h-11" disabled={deleting} onClick={() => void confirm()}>{deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}Ta bort</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
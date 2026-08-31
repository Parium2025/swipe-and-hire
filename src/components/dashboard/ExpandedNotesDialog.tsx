import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { FileText, X } from 'lucide-react';
import { RichNotesEditor, NotesToolbar } from '@/components/RichNotesEditor';
import { useCustomScrollbar } from '@/hooks/useCustomScrollbar';
import type { Editor } from '@tiptap/react';

interface ExpandedNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  onChange: (val: string) => void;
  placeholder: string;
  isSaving: boolean;
  saveFailed: boolean;
  lastSaved: Date | null;
}

export const ExpandedNotesDialog = memo(({
  open,
  onOpenChange,
  content,
  onChange,
  placeholder,
  isSaving,
  saveFailed,
  lastSaved,
}: ExpandedNotesDialogProps) => {
  const [editor, setEditor] = useState<Editor | null>(null);
  const { scrollRef, trackRef, thumbRef, update: updateScrollbar } = useCustomScrollbar(open);

  const handleEditorReady = useCallback((e: Editor) => setEditor(e), []);
  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (open) {
      updateScrollbar();
      const t = setTimeout(updateScrollbar, 100);
      return () => clearTimeout(t);
    }
  }, [content, open, updateScrollbar]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onOpenChange(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange]);

  const textStats = useMemo(() => {
    const text = content.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const chars = text.length;
    const words = text ? text.split(/\s+/).length : 0;
    return { chars, words };
  }, [content]);

  const saveIndicator = (
    <span className="text-[11px] text-white font-medium">
      {isSaving ? (
        <span className="animate-pulse">Sparar...</span>
      ) : saveFailed ? (
        <span className="text-red-300">Kunde inte spara ✗</span>
      ) : lastSaved ? (
        'Sparat ✓'
      ) : null}
    </span>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-4xl w-[calc(100%-2rem)] h-[90dvh] sm:h-[80vh] bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 border-0 p-0 !flex !flex-col overflow-hidden"
      >
        <VisuallyHidden>
          <DialogTitle>Anteckningar</DialogTitle>
        </VisuallyHidden>
        <div className="absolute inset-0 bg-white/5 pointer-events-none" />
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col flex-1 min-h-0 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10">
                <FileText className="h-5 w-5 text-white" strokeWidth={1.5} />
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-white">Anteckningar</h2>
            </div>
            <div className="flex items-center gap-3">
              {saveIndicator}
              <button
                onClick={handleClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
          </div>

          <div className="mb-3 pb-2 border-b border-white/10 shrink-0">
            <NotesToolbar editor={editor} large />
          </div>

          <div className="flex-1 min-h-0 relative bg-white/10 rounded-lg overflow-hidden">
            <div
              ref={scrollRef}
              className="absolute inset-0 overflow-y-auto overscroll-contain touch-auto [-webkit-overflow-scrolling:touch] pr-3"
            >
              <RichNotesEditor
                value={content}
                onChange={onChange}
                placeholder={placeholder}
                hideToolbar
                externalScroll
                onEditorReady={handleEditorReady}
              />
            </div>
            <div
              ref={trackRef}
              className="absolute right-1 top-1 bottom-1 w-1 rounded-full bg-white/10 pointer-events-none"
              aria-hidden="true"
              style={{ display: 'none' }}
            >
              <div ref={thumbRef} className="absolute w-full rounded-full bg-white/40" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-4 mt-2 pt-2 border-t border-white/10 shrink-0">
            <span className="text-xs text-pure-white">
              {textStats.words} ord · {textStats.chars} tecken
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

ExpandedNotesDialog.displayName = 'ExpandedNotesDialog';

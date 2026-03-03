import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { useCustomScrollbar } from '@/hooks/useCustomScrollbar';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, X, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { RichNotesEditor, NotesToolbar } from '@/components/RichNotesEditor';
import type { Editor } from '@tiptap/react';
import { useNotesSync } from '@/hooks/useNotesSync';

const GRADIENTS_NOTES = 'from-violet-500/90 via-purple-600/80 to-purple-700/90';

export const EmployerNotesCard = memo(() => {
  const { content, isSaving, saveFailed, lastSaved, handleChange } = useNotesSync({
    table: 'employer_notes',
    ownerColumn: 'employer_id',
    cachePrefix: 'employer_notes_cache',
    queryKey: 'employer-notes',
  });

  const [notesEditor, setNotesEditor] = useState<Editor | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<Editor | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const { scrollRef: expandedScrollRef, trackRef: expandedTrackRef, thumbRef: expandedThumbRef, update: updateExpandedScrollbar } = useCustomScrollbar(isExpanded);

  const handleEditorReady = useCallback((editor: Editor) => { setNotesEditor(editor); }, []);
  const handleExpandedEditorReady = useCallback((editor: Editor) => { setExpandedEditor(editor); }, []);
  const handleExpand = useCallback(() => { setIsExpanded(true); }, []);
  const handleCloseExpanded = useCallback(() => { setIsExpanded(false); }, []);

  useEffect(() => {
    if (isExpanded) {
      updateExpandedScrollbar();
      const t = setTimeout(updateExpandedScrollbar, 100);
      return () => clearTimeout(t);
    }
  }, [content, isExpanded, updateExpandedScrollbar]);

  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsExpanded(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  const textStats = useMemo(() => {
    const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    const charCount = plainText.length;
    const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
    return { charCount, wordCount };
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
    <>
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS_NOTES} border-0 shadow-lg dashboard-card-height`}>
        <div className="absolute inset-0 bg-white/5" />
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />

        <CardContent className="relative p-3 sm:p-4 h-full flex flex-col">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-white/10">
                <FileText className="h-5 w-5 text-white" strokeWidth={1.5} />
              </div>
              <button
                onClick={handleExpand}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
              >
                <Maximize2 className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              {saveIndicator}
              <span className="text-[10px] text-white uppercase tracking-wider font-medium">ANTECKNINGAR</span>
            </div>
          </div>

          <div className="mb-2 pb-1.5 border-b border-white/10">
            <NotesToolbar editor={notesEditor} compact showUndoRedo={false} />
          </div>

          <div className="flex-1 min-h-0 relative">
            <RichNotesEditor
              value={content}
              onChange={handleChange}
              placeholder="Skriv påminnelser och anteckningar..."
              hideToolbar
              onEditorReady={handleEditorReady}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none rounded-b-lg"
              style={{ background: 'linear-gradient(to top, rgba(124, 58, 237, 0.7), transparent)' }}
            />
          </div>
        </CardContent>
      </Card>

      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent
          hideClose
          className="max-w-4xl w-[calc(100%-2rem)] h-[90dvh] sm:h-[80vh] bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 border-0 p-0 !flex !flex-col overflow-hidden"
        >
          <VisuallyHidden>
            <DialogTitle>Anteckningar</DialogTitle>
          </VisuallyHidden>
          <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] pointer-events-none" />
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
                  onClick={handleCloseExpanded}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
                >
                  <X className="h-4 w-4 text-white" />
                </button>
              </div>
            </div>

            <div className="mb-3 pb-2 border-b border-white/10 shrink-0">
              <NotesToolbar editor={expandedEditor} />
            </div>

            <div className="flex-1 min-h-0 relative bg-white/10 rounded-lg overflow-hidden">
              <div
                ref={expandedScrollRef}
                className="absolute inset-0 overflow-y-auto overscroll-contain touch-auto [-webkit-overflow-scrolling:touch] pr-3"
              >
                <RichNotesEditor
                  value={content}
                  onChange={handleChange}
                  placeholder="Skriv påminnelser och anteckningar..."
                  hideToolbar
                  externalScroll
                  onEditorReady={handleExpandedEditorReady}
                />
              </div>
              <div
                ref={expandedTrackRef}
                className="absolute right-1 top-1 bottom-1 w-1 rounded-full bg-white/10 pointer-events-none"
                aria-hidden="true"
                style={{ display: 'none' }}
              >
                <div ref={expandedThumbRef} className="absolute w-full rounded-full bg-white/40" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 mt-2 pt-2 border-t border-white/10 shrink-0">
              <span className="text-xs text-pure-white">
                {textStats.charCount} tecken · {textStats.wordCount} ord
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

EmployerNotesCard.displayName = 'EmployerNotesCard';

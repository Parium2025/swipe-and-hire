import { memo, useState, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Maximize2 } from 'lucide-react';
import { RichNotesEditor, NotesToolbar } from '@/components/RichNotesEditor';
import type { Editor } from '@tiptap/react';
import { useNotesSync } from '@/hooks/useNotesSync';
import { GRADIENTS } from './dashboardConstants';
import { ExpandedNotesDialog } from './ExpandedNotesDialog';

function countWordsAndChars(html: string) {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const chars = text.length;
  const words = text ? text.split(/\s+/).length : 0;
  return { words, chars };
}

export const JobSeekerNotesCard = memo(() => {
  const { content, isSaving, saveFailed, lastSaved, handleChange } = useNotesSync({
    table: 'jobseeker_notes',
    ownerColumn: 'user_id',
    cachePrefix: 'jobseeker_notes_cache',
    queryKey: 'jobseeker-notes',
  });

  const [notesEditor, setNotesEditor] = useState<Editor | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleEditorReady = useCallback((editor: Editor) => { setNotesEditor(editor); }, []);

  const { words, chars } = useMemo(() => countWordsAndChars(content), [content]);

  return (
    <>
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.notes} border-0 shadow-lg dashboard-card-height [contain:layout_paint] [transform:translateZ(0)] [backface-visibility:hidden]`}>
        <div className="absolute inset-0 bg-white/5" />
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />

        <CardContent className="relative p-3 sm:p-4 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1">
              <div className="p-2 rounded-xl bg-white/10">
                <FileText className="h-5 w-5 text-white" strokeWidth={1.5} />
              </div>
              <button
                onClick={() => setIsExpanded(true)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
              >
                <Maximize2 className="h-5 w-5 text-white" />
              </button>
              <div className="border-l border-white/15 h-5 mx-px" />
              <NotesToolbar editor={notesEditor} compact />
            </div>
            <span className="text-[10px] text-white uppercase tracking-wider font-medium flex-shrink-0">ANTECKNINGAR</span>
          </div>

          {/* Editor */}
          <div className="flex-1 min-h-0 relative">
            {!notesEditor && content && (
              <div
                className="absolute inset-0 bg-white/10 rounded-lg p-2 pr-4 text-sm leading-relaxed text-pure-white overflow-hidden pointer-events-none"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
            {!notesEditor && !content && (
              <div className="absolute inset-0 bg-white/10 rounded-lg p-2 pr-4 text-sm leading-relaxed text-pure-white/40 pointer-events-none">
                Skriv karriärmål, påminnelser...
              </div>
            )}
            <div className={notesEditor ? 'visible h-full' : 'invisible h-full'}>
              <RichNotesEditor
                value={content}
                onChange={handleChange}
                placeholder="Skriv karriärmål, påminnelser..."
                hideToolbar
                onEditorReady={handleEditorReady}
              />
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none rounded-b-lg"
              style={{ background: 'linear-gradient(to top, rgba(124, 58, 237, 0.7), transparent)' }}
            />
          </div>

          {/* Footer: save status left, word/char count right */}
          <div className="flex items-center justify-between mt-1 min-h-[16px]">
            <span className="text-[11px] text-white font-medium">
              {isSaving ? (
                <span className="animate-pulse">Sparar...</span>
              ) : saveFailed ? (
                <span className="text-red-300">Kunde inte spara ✗</span>
              ) : lastSaved ? (
                'Sparat ✓'
              ) : null}
            </span>
            <span className="text-[11px] text-white font-medium tabular-nums">
              {words} ord · {chars} tecken
            </span>
          </div>
        </CardContent>
      </Card>

      <ExpandedNotesDialog
        open={isExpanded}
        onOpenChange={setIsExpanded}
        content={content}
        onChange={handleChange}
        placeholder="Skriv karriärmål, påminnelser..."
        isSaving={isSaving}
        saveFailed={saveFailed}
        lastSaved={lastSaved}
      />
    </>
  );
});

JobSeekerNotesCard.displayName = 'JobSeekerNotesCard';

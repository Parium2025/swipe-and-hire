import { memo, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, Maximize2 } from 'lucide-react';
import { RichNotesEditor, NotesToolbar } from '@/components/RichNotesEditor';
import type { Editor } from '@tiptap/react';
import { useNotesSync } from '@/hooks/useNotesSync';
import { GRADIENTS } from './dashboardConstants';
import { ExpandedNotesDialog } from './ExpandedNotesDialog';

export const EmployerNotesCard = memo(() => {
  const { content, isSaving, saveFailed, lastSaved, handleChange } = useNotesSync({
    table: 'employer_notes',
    ownerColumn: 'employer_id',
    cachePrefix: 'employer_notes_cache',
    queryKey: 'employer-notes',
  });

  const [notesEditor, setNotesEditor] = useState<Editor | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleEditorReady = useCallback((editor: Editor) => { setNotesEditor(editor); }, []);

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
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.notes} border-0 shadow-lg dashboard-card-height`}>
        <div className="absolute inset-0 bg-white/5" />
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />

        <CardContent className="relative p-3 sm:p-4 h-full flex flex-col">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <div className="p-1.5 rounded-lg bg-white/10">
                <FileText className="h-4 w-4 text-white" strokeWidth={1.5} />
              </div>
              <button
                onClick={() => setIsExpanded(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
              >
                <Maximize2 className="h-3.5 w-3.5 text-white" />
              </button>
              <div className="border-l border-white/15 h-5 mx-0.5" />
              <NotesToolbar editor={notesEditor} compact />
            </div>
            <div className="flex items-center gap-2">
              {saveIndicator}
              <span className="text-[10px] text-white uppercase tracking-wider font-medium">ANTECKNINGAR</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 relative">
            {!notesEditor && content && (
              <div
                className="absolute inset-0 bg-white/10 rounded-lg p-2 pr-4 text-sm leading-relaxed text-pure-white overflow-hidden pointer-events-none"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
            {!notesEditor && !content && (
              <div className="absolute inset-0 bg-white/10 rounded-lg p-2 pr-4 text-sm leading-relaxed text-pure-white/40 pointer-events-none">
                Skriv påminnelser och anteckningar...
              </div>
            )}
            <div className={notesEditor ? 'visible h-full' : 'invisible h-full'}>
              <RichNotesEditor
                value={content}
                onChange={handleChange}
                placeholder="Skriv påminnelser och anteckningar..."
                hideToolbar
                onEditorReady={handleEditorReady}
              />
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none rounded-b-lg"
              style={{ background: 'linear-gradient(to top, rgba(124, 58, 237, 0.7), transparent)' }}
            />
          </div>
        </CardContent>
      </Card>

      <ExpandedNotesDialog
        open={isExpanded}
        onOpenChange={setIsExpanded}
        content={content}
        onChange={handleChange}
        placeholder="Skriv påminnelser och anteckningar..."
        isSaving={isSaving}
        saveFailed={saveFailed}
        lastSaved={lastSaved}
      />
    </>
  );
});

EmployerNotesCard.displayName = 'EmployerNotesCard';

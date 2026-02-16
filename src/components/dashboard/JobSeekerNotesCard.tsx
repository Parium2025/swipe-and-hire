import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, X } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { RichNotesEditor, NotesToolbar } from '@/components/RichNotesEditor';
import type { Editor } from '@tiptap/react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GRADIENTS } from './dashboardConstants';

type NoteData = { id: string; user_id: string; content: string | null; created_at: string; updated_at: string } | null;

export const JobSeekerNotesCard = memo(() => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasLocalEditsRef = useRef(false);
  const [notesEditor, setNotesEditor] = useState<Editor | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<Editor | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const cacheKey = user?.id ? `jobseeker_notes_cache_${user.id}` : 'jobseeker_notes_cache';

  const [content, setContent] = useState(() => {
    if (typeof window === 'undefined') return '';
    if (user?.id) {
      return localStorage.getItem(`jobseeker_notes_cache_${user.id}`) || '';
    }
    return localStorage.getItem('jobseeker_notes_cache') || '';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // When user becomes available, load their specific cache
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    const cached = localStorage.getItem(cacheKey);
    if (cached !== null && !hasLocalEditsRef.current) {
      setContent(cached);
    }
  }, [cacheKey, user?.id]);

  // Cross-tab sync via localStorage
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === cacheKey && typeof e.newValue === 'string') {
        if (!hasLocalEditsRef.current) {
          setContent(e.newValue);
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [cacheKey, user?.id]);

  // Fetch existing note
  const { data: noteData, isFetched } = useQuery<NoteData>({
    queryKey: ['jobseeker-notes', user?.id],
    queryFn: async (): Promise<NoteData> => {
      const { data, error } = await supabase
        .from('jobseeker_notes')
        .select('id, user_id, content, created_at, updated_at')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as NoteData;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Sync server value into cache
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    if (!noteData) return;
    const serverContent = noteData.content ?? '';
    localStorage.setItem(cacheKey, serverContent);
    if (!hasLocalEditsRef.current) {
      setContent(serverContent);
    }
  }, [noteData, cacheKey, user?.id]);

  const handleChange = useCallback(
    (next: string) => {
      hasLocalEditsRef.current = true;
      setContent(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, next);
      }
    },
    [cacheKey]
  );

  const handleEditorReady = useCallback((editor: Editor) => { setNotesEditor(editor); }, []);
  const handleExpandedEditorReady = useCallback((editor: Editor) => { setExpandedEditor(editor); }, []);
  const handleExpand = useCallback(() => { setIsExpanded(true); }, []);
  const handleCloseExpanded = useCallback(() => { setIsExpanded(false); }, []);

  // Escape key to close fullscreen
  useEffect(() => {
    if (!isExpanded) return;
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsExpanded(false); };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Character and word count
  const textStats = useMemo(() => {
    const plainText = content.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    const charCount = plainText.length;
    const wordCount = plainText.trim() ? plainText.trim().split(/\s+/).length : 0;
    return { charCount, wordCount };
  }, [content]);

  // Auto-save with debounce
  useEffect(() => {
    if (!user?.id || !isFetched) return;
    const serverContent = noteData?.content ?? '';
    if (content === serverContent) return;

    const timer = setTimeout(async () => {
      if (!navigator.onLine) { console.log('Offline - skipping note save'); return; }
      setIsSaving(true);
      try {
        if (noteData?.id) {
          await supabase.from('jobseeker_notes').update({ content }).eq('id', noteData.id);
        } else {
          await supabase.from('jobseeker_notes').insert({ user_id: user.id, content });
        }
        hasLocalEditsRef.current = false;
        setLastSaved(new Date());
        queryClient.invalidateQueries({ queryKey: ['jobseeker-notes', user.id] });
      } catch (err) {
        console.error('Failed to save note:', err);
      } finally {
        setIsSaving(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [content, user?.id, isFetched, noteData, queryClient]);

  return (
    <>
      <Card className={`relative overflow-hidden bg-gradient-to-br ${GRADIENTS.notes} border-0 shadow-lg dashboard-card-height`}>
        <div className="absolute inset-0 bg-white/5" />
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
        
        <CardContent className="relative p-3 sm:p-4 h-full flex flex-col">
          {/* Header with toolbar */}
           <div className="flex items-center justify-between mb-2 min-w-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="p-2 rounded-xl bg-white/10 flex-shrink-0">
                <FileText className="h-5 w-5 text-white" strokeWidth={1.5} />
              </div>
              <NotesToolbar editor={notesEditor} onExpand={handleExpand} compact />
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {isSaving && (
                <span className="text-[10px] text-white animate-pulse">Sparar...</span>
              )}
              {!isSaving && lastSaved && (
                <span className="text-[10px] text-white">Sparat</span>
              )}
              <span className="text-[10px] text-white uppercase tracking-wider font-medium">
                ANTECKNINGAR
              </span>
            </div>
          </div>
          
          {/* Notes editor */}
          <div className="flex-1 min-h-0 relative">
            <RichNotesEditor
              value={content}
              onChange={handleChange}
              placeholder="Skriv karriärmål, påminnelser..."
              hideToolbar
              onEditorReady={handleEditorReady}
            />
            {/* Soft fade at the bottom instead of hard clip */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-purple-600/80 to-transparent pointer-events-none rounded-b-lg" />
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Notes Dialog */}
      <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
        <DialogContent 
          hideClose 
          className="max-w-4xl h-[80vh] bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 border-0 p-0 overflow-hidden"
        >
          <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] pointer-events-none" />
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative flex flex-col h-full p-4 sm:p-6">
            {/* Header */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/10">
                    <FileText className="h-5 w-5 text-white" strokeWidth={1.5} />
                  </div>
                  <h2 className="text-lg sm:text-xl font-semibold text-white">Anteckningar</h2>
                </div>
                <div className="flex items-center gap-3">
                  {isSaving && (
                    <span className="text-xs text-white/80 animate-pulse">Sparar...</span>
                  )}
                  {!isSaving && lastSaved && (
                    <span className="text-xs text-white/80">Sparat</span>
                  )}
                  <button
                    onClick={handleCloseExpanded}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 md:bg-transparent md:hover:bg-white/20 transition-colors"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
              <div className="flex items-center">
                <NotesToolbar editor={expandedEditor} />
              </div>
            </div>
            
            {/* Editor */}
            <div className="flex-1 min-h-0 overflow-hidden">
              <RichNotesEditor
                value={content}
                onChange={handleChange}
                placeholder="Skriv karriärmål, påminnelser..."
                hideToolbar
                onEditorReady={handleExpandedEditorReady}
                className="h-full [&_.ProseMirror]:min-h-[300px]"
              />
            </div>
            
            {/* Character/word counter */}
            <div className="flex items-center justify-end gap-4 mt-3 pt-3 border-t border-white/10">
              <span className="text-xs text-white">
                {textStats.charCount} tecken
              </span>
              <span className="text-xs text-white">
                {textStats.wordCount} ord
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

JobSeekerNotesCard.displayName = 'JobSeekerNotesCard';

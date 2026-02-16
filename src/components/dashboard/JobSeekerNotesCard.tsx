import { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, X, Maximize2 } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { RichNotesEditor, NotesToolbar } from '@/components/RichNotesEditor';
import type { Editor } from '@tiptap/react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GRADIENTS } from './dashboardConstants';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

type NoteData = { id: string; user_id: string; content: string | null; created_at: string; updated_at: string } | null;

export const JobSeekerNotesCard = memo(() => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasLocalEditsRef = useRef(false);
  const [notesEditor, setNotesEditor] = useState<Editor | null>(null);
  const [expandedEditor, setExpandedEditor] = useState<Editor | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const expandedScrollRef = useRef<HTMLDivElement>(null);
  const expandedTrackRef = useRef<HTMLDivElement>(null);
  const expandedThumbRef = useRef<HTMLDivElement>(null);
  const expandedRafRef = useRef<number>(0);

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

  // Expanded scrollbar tracking
  const updateExpandedScrollbar = useCallback(() => {
    const el = expandedScrollRef.current;
    const track = expandedTrackRef.current;
    const thumb = expandedThumbRef.current;
    if (!el || !track || !thumb) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const hasScroll = scrollHeight > clientHeight + 5;
    track.style.display = hasScroll ? '' : 'none';
    if (!hasScroll) return;
    const thumbH = Math.max((clientHeight / scrollHeight) * 100, 20);
    const maxScroll = scrollHeight - clientHeight;
    const thumbTop = maxScroll > 0 ? (scrollTop / maxScroll) * (100 - thumbH) : 0;
    thumb.style.top = `${thumbTop}%`;
    thumb.style.height = `${thumbH}%`;
  }, []);

  useEffect(() => {
    if (!isExpanded) return;
    const el = expandedScrollRef.current;
    if (!el) return;
    const handler = () => {
      cancelAnimationFrame(expandedRafRef.current);
      expandedRafRef.current = requestAnimationFrame(updateExpandedScrollbar);
    };
    el.addEventListener('scroll', handler, { passive: true });
    // Initial + delayed update
    updateExpandedScrollbar();
    const t = setTimeout(updateExpandedScrollbar, 200);
    return () => {
      el.removeEventListener('scroll', handler);
      cancelAnimationFrame(expandedRafRef.current);
      clearTimeout(t);
    };
  }, [isExpanded, updateExpandedScrollbar]);

  // Update scrollbar when content changes in expanded mode
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

  const saveIndicator = (
    <span className="text-[11px] text-white/70 font-medium">
      {isSaving ? (
        <span className="animate-pulse">Sparar...</span>
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
          {/* Row 1: Title + save status + expand */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-white/10 flex-shrink-0">
                <FileText className="h-4 w-4 text-white" strokeWidth={1.5} />
              </div>
              <span className="text-xs text-white/80 uppercase tracking-wider font-semibold">
                Anteckningar
              </span>
            </div>
            <div className="flex items-center gap-2">
              {saveIndicator}
              <button
                onClick={handleExpand}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 transition-all"
              >
                <Maximize2 className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          </div>

          {/* Row 2: Toolbar - full width, no cramming */}
          <div className="mb-2 pb-1.5 border-b border-white/10">
            <NotesToolbar editor={notesEditor} compact showUndoRedo={false} />
          </div>
          
          {/* Editor area */}
          <div className="flex-1 min-h-0 relative">
            <RichNotesEditor
              value={content}
              onChange={handleChange}
              placeholder="Skriv karriärmål, påminnelser..."
              hideToolbar
              onEditorReady={handleEditorReady}
            />
            {/* Soft fade at bottom */}
            <div 
              className="absolute bottom-0 left-0 right-0 h-6 pointer-events-none rounded-b-lg"
              style={{ background: 'linear-gradient(to top, rgba(124, 58, 237, 0.7), transparent)' }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Fullscreen Notes Dialog — true fullscreen on mobile */}
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
            {/* Header */}
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

            {/* Toolbar */}
            <div className="mb-3 pb-2 border-b border-white/10 shrink-0">
              <NotesToolbar editor={expandedEditor} />
            </div>
            
            {/* Editor — scrollable wrapper with mini scrollbar */}
            <div className="flex-1 min-h-0 relative">
              <div 
                ref={expandedScrollRef}
                className="absolute inset-0 overflow-y-auto overscroll-contain touch-auto [-webkit-overflow-scrolling:touch] bg-white/10 rounded-lg pr-3"
              >
                <RichNotesEditor
                  value={content}
                  onChange={handleChange}
                  placeholder="Skriv karriärmål, påminnelser..."
                  hideToolbar
                  externalScroll
                  onEditorReady={handleExpandedEditorReady}
                />
              </div>
              {/* Mini scrollbar indicator */}
              <div 
                ref={expandedTrackRef}
                className="absolute right-1 top-1 bottom-1 w-1 rounded-full bg-white/10 pointer-events-none"
                aria-hidden="true"
                style={{ display: 'none' }}
              >
                <div 
                  ref={expandedThumbRef}
                  className="absolute w-full rounded-full bg-white/40"
                />
              </div>
            </div>
            
            {/* Character/word counter */}
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

JobSeekerNotesCard.displayName = 'JobSeekerNotesCard';

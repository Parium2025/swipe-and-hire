/**
 * useCandidateNotes — encapsulates all note CRUD for a candidate profile.
 *
 * Features:
 * - 3-layer caching (memory → localStorage → DB)
 * - Optimistic updates for save, edit, and delete
 * - Activity logging on every mutation
 * - Automatic rollback on failure
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useCandidateActivities } from '@/hooks/useCandidateActivities';
import {
  notesCache,
  getPersistedNotes,
  setPersistedNotes,
} from '@/components/candidateProfile/candidateProfileCache';
import type { CandidateNote } from '@/components/candidateProfile/candidateProfileCache';

interface UseCandidateNotesOptions {
  applicantId: string | null;
  jobId: string | null;
}

export function useCandidateNotes({ applicantId, jobId }: UseCandidateNotesOptions) {
  const { user } = useAuth();
  const { logActivity, deleteNoteActivities } = useCandidateActivities(applicantId);

  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);

  // ─── Shared DB fetch ────────────────────────────────────────────
  const fetchNotesFromDb = useCallback(async (id: string): Promise<CandidateNote[]> => {
    const { data, error } = await supabase
      .from('candidate_notes')
      .select(`
        id, note, created_at, updated_at, employer_id,
        profiles!candidate_notes_employer_id_fkey(first_name, last_name)
      `)
      .eq('applicant_id', id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((note: any) => ({
      id: note.id,
      note: note.note,
      created_at: note.created_at,
      updated_at: note.updated_at || note.created_at,
      employer_id: note.employer_id,
      author_name: note.profiles
        ? `${note.profiles.first_name || ''} ${note.profiles.last_name || ''}`.trim() || 'Okänd'
        : 'Okänd',
    }));
  }, []);

  // Background-only refresh (no loading state)
  const refreshInBackground = useCallback(async (id: string) => {
    try {
      const fresh = await fetchNotesFromDb(id);
      notesCache.set(id, fresh);
      setPersistedNotes(id, fresh);
      setNotes(fresh);
    } catch {
      // Silently fail — cached data is already rendered
    }
  }, [fetchNotesFromDb]);

  // ─── Fetch (cache-first) ────────────────────────────────────────
  const fetchNotes = useCallback(async (forceRefresh = false) => {
    if (!applicantId || !user) return;

    if (!forceRefresh) {
      const cached = notesCache.get(applicantId);
      if (cached) { setNotes(cached); return; }

      const persisted = getPersistedNotes(applicantId);
      if (persisted) {
        notesCache.set(applicantId, persisted);
        setNotes(persisted);
        refreshInBackground(applicantId);
        return;
      }
    }

    setLoadingNotes(true);
    try {
      const fresh = await fetchNotesFromDb(applicantId);
      notesCache.set(applicantId, fresh);
      setPersistedNotes(applicantId, fresh);
      setNotes(fresh);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  }, [applicantId, user?.id, fetchNotesFromDb, refreshInBackground]);

  // ─── Helpers to persist optimistic changes ──────────────────────
  const persistOptimistic = useCallback((id: string, updated: CandidateNote[]) => {
    notesCache.set(id, updated);
    setPersistedNotes(id, updated);
    setNotes(updated);
  }, []);

  const rollback = useCallback((id: string, previous: CandidateNote[]) => {
    notesCache.set(id, previous);
    setPersistedNotes(id, previous);
    setNotes(previous);
  }, []);

  // ─── Save ───────────────────────────────────────────────────────
  const saveNote = useCallback(async (noteText: string, clearDraft: () => void) => {
    if (!noteText.trim() || !applicantId || !user) return;
    const nowISO = new Date().toISOString();
    const optimisticNote: CandidateNote = {
      id: `temp-${Date.now()}`,
      note: noteText.trim(),
      created_at: nowISO,
      updated_at: nowISO,
      employer_id: user.id,
      author_name: 'Du',
    };
    const previous = [...notes];
    persistOptimistic(applicantId, [optimisticNote, ...notes]);
    clearDraft();
    setSavingNote(true);

    try {
      const { error } = await supabase
        .from('candidate_notes')
        .insert({
          employer_id: user.id,
          applicant_id: applicantId,
          job_id: jobId,
          note: noteText.trim(),
        });

      if (error) throw error;

      logActivity.mutate({
        applicantId,
        activityType: 'note_added',
        newValue: noteText.trim().substring(0, 100),
        metadata: { job_id: jobId },
      });

      toast.success('Anteckning sparad');
      // Background refresh to get real ID
      refreshInBackground(applicantId);
    } catch (error) {
      console.error('Error saving note:', error);
      toast.error('Kunde inte spara anteckning');
      rollback(applicantId, previous);
    } finally {
      setSavingNote(false);
    }
  }, [applicantId, jobId, user, notes, logActivity, persistOptimistic, rollback, refreshInBackground]);

  // ─── Delete (optimistic) ────────────────────────────────────────
  const deleteNote = useCallback(async (noteId: string) => {
    if (!applicantId) return;
    const previous = [...notes];
    persistOptimistic(applicantId, notes.filter(n => n.id !== noteId));
    setDeletingNoteId(null);

    try {
      const { error } = await supabase
        .from('candidate_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      await deleteNoteActivities.mutateAsync({ applicantId });
      toast.success('Anteckning borttagen');
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Kunde inte ta bort anteckning');
      rollback(applicantId, previous);
    }
  }, [applicantId, notes, deleteNoteActivities, persistOptimistic, rollback]);

  // ─── Edit (optimistic) ─────────────────────────────────────────
  const [originalNoteText, setOriginalNoteText] = useState('');

  const startEditing = useCallback((note: CandidateNote) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note);
    setOriginalNoteText(note.note);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingNoteId(null);
    setEditingNoteText('');
  }, []);

  const updateNote = useCallback(async () => {
    if (!editingNoteId || !editingNoteText.trim() || !applicantId) return;
    if (editingNoteText.trim() === originalNoteText.trim()) {
      cancelEditing();
      return;
    }

    const previous = [...notes];
    const trimmed = editingNoteText.trim();
    const nowISO = new Date().toISOString();
    const updatedNotes = notes.map(n =>
      n.id === editingNoteId ? { ...n, note: trimmed, updated_at: nowISO } : n
    ).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    persistOptimistic(applicantId, updatedNotes);

    const noteId = editingNoteId;
    setEditingNoteId(null);
    setEditingNoteText('');
    setSavingNote(true);

    try {
      const { error } = await supabase
        .from('candidate_notes')
        .update({ note: trimmed })
        .eq('id', noteId);

      if (error) throw error;

      logActivity.mutate({
        applicantId,
        activityType: 'note_edited',
        newValue: trimmed.substring(0, 100),
        metadata: { job_id: jobId },
      });

      toast.success('Anteckning uppdaterad');
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Kunde inte uppdatera anteckning');
      rollback(applicantId, previous);
      setEditingNoteId(noteId);
      setEditingNoteText(trimmed);
    } finally {
      setSavingNote(false);
    }
  }, [editingNoteId, editingNoteText, applicantId, jobId, notes, logActivity, persistOptimistic, rollback]);

  // ─── Reset (call when candidate changes) ────────────────────────
  const reset = useCallback(() => {
    setNotes([]);
    setEditingNoteId(null);
    setEditingNoteText('');
    setDeletingNoteId(null);
  }, []);

  return {
    notes,
    loadingNotes,
    savingNote,
    editingNoteId,
    editingNoteText,
    originalNoteText,
    deletingNoteId,
    setEditingNoteText,
    setDeletingNoteId,
    fetchNotes,
    saveNote,
    deleteNote,
    startEditing,
    cancelEditing,
    updateNote,
    reset,
  };
}

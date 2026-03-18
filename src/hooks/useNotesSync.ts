import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

type NoteTable = 'employer_notes' | 'jobseeker_notes';
type OwnerColumn = 'employer_id' | 'user_id';

interface UseNotesSyncOptions {
  table: NoteTable;
  ownerColumn: OwnerColumn;
  cachePrefix: string;
  queryKey: string;
}

interface NotesSyncResult {
  content: string;
  isSaving: boolean;
  saveFailed: boolean;
  lastSaved: Date | null;
  handleChange: (next: string) => void;
  noteData: { id: string; content: string | null } | null;
  isFetched: boolean;
}

export function useNotesSync({ table, ownerColumn, cachePrefix, queryKey }: UseNotesSyncOptions): NotesSyncResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasLocalEditsRef = useRef(false);
  const contentRef = useRef('');
  const noteDataRef = useRef<{ id: string; content: string | null } | null>(null);

  const cacheKey = user?.id ? `${cachePrefix}_${user.id}` : cachePrefix;

  const [content, setContent] = useState(() => {
    if (typeof window === 'undefined') return '';
    if (user?.id) {
      return localStorage.getItem(`${cachePrefix}_${user.id}`) || '';
    }
    return localStorage.getItem(cachePrefix) || '';
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Keep ref in sync for beforeunload
  useEffect(() => { contentRef.current = content; }, [content]);

  // When user becomes available, load their specific cache
  useEffect(() => {
    if (typeof window === 'undefined' || !user?.id) return;
    const cached = localStorage.getItem(cacheKey);
    if (cached !== null && !hasLocalEditsRef.current) {
      setContent(cached);
    }
  }, [cacheKey, user?.id]);

  // Cross-tab sync via localStorage events
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
  const { data: noteData, isFetched } = useQuery({
    queryKey: [queryKey, user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from(table) as any)
        .select('id, content')
        .eq(ownerColumn, user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; content: string | null } | null;
    },
    enabled: !!user?.id,
    staleTime: 30000,
  });

  // Keep noteData ref in sync for beforeunload
  useEffect(() => { noteDataRef.current = noteData ?? null; }, [noteData]);

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

  // Realtime sync — listen for changes from other devices
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`${table}-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${ownerColumn}=eq.${user.id}`,
        },
        (payload) => {
          if (!hasLocalEditsRef.current) {
            const newContent = (payload.new as any)?.content ?? '';
            setContent(newContent);
            if (typeof window !== 'undefined') {
              localStorage.setItem(cacheKey, newContent);
            }
          }
          queryClient.invalidateQueries({ queryKey: [queryKey, user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, cacheKey, queryClient, table, ownerColumn, queryKey]);

  // Synchronous save function (used by both debounce and beforeunload)
  const saveToDb = useCallback(async (contentToSave: string) => {
    if (!user?.id || !getIsOnline()) return false;
    const nd = noteDataRef.current;

    try {
      let saveError;
      if (nd?.id) {
        const { error } = await (supabase
          .from(table) as any)
          .update({ content: contentToSave })
          .eq('id', nd.id);
        saveError = error;
      } else {
        const { error } = await (supabase
          .from(table) as any)
          .insert({ [ownerColumn]: user.id, content: contentToSave });
        saveError = error;
      }
      if (saveError) {
        console.error(`❌ ${table} save failed:`, saveError.message);
        return false;
      }
      console.log(`✅ ${table} saved to database`);
      return true;
    } catch (err) {
      console.error(`Failed to save ${table}:`, err);
      return false;
    }
  }, [user?.id, table, ownerColumn]);

  const handleChange = useCallback(
    (next: string) => {
      hasLocalEditsRef.current = true;
      setSaveFailed(false);
      setContent(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem(cacheKey, next);
      }
    },
    [cacheKey]
  );

  // Auto-save with debounce
  useEffect(() => {
    if (!user?.id || !isFetched) return;
    const serverContent = noteData?.content ?? '';
    if (content === serverContent) return;

    const timer = setTimeout(async () => {
      if (!navigator.onLine) {
        console.log('Offline - skipping note save');
        return;
      }
      setIsSaving(true);
      const success = await saveToDb(content);
      if (success) {
        hasLocalEditsRef.current = false;
        setSaveFailed(false);
        setLastSaved(new Date());
        queryClient.invalidateQueries({ queryKey: [queryKey, user.id] });
      } else {
        setSaveFailed(true);
      }
      setIsSaving(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [content, user?.id, isFetched, noteData, queryClient, queryKey, saveToDb]);

  // Retry queued save when coming back online
  useEffect(() => {
    if (!user?.id) return;
    const handleOnline = async () => {
      if (!hasLocalEditsRef.current) return;
      console.log(`🔄 Back online — retrying ${table} save`);
      setIsSaving(true);
      const success = await saveToDb(contentRef.current);
      if (success) {
        hasLocalEditsRef.current = false;
        setSaveFailed(false);
        setLastSaved(new Date());
        queryClient.invalidateQueries({ queryKey: [queryKey, user.id] });
      } else {
        setSaveFailed(true);
      }
      setIsSaving(false);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user?.id, saveToDb, queryClient, queryKey, table]);

  // Keep a ref to the latest access token for beforeunload (avoids async in sync handler)
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    const sync = async () => {
      const { data } = await supabase.auth.getSession();
      accessTokenRef.current = data.session?.access_token ?? null;
    };
    sync();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, [user?.id]);

  // beforeunload — flush unsaved changes immediately when closing tab
  useEffect(() => {
    if (!user?.id) return;
    const handleBeforeUnload = () => {
      if (!hasLocalEditsRef.current) return;
      const token = accessTokenRef.current;
      if (!token) return; // No valid session — localStorage already has the content
      const nd = noteDataRef.current;
      const body = nd?.id
        ? JSON.stringify({ content: contentRef.current })
        : JSON.stringify({ [ownerColumn]: user.id, content: contentRef.current });

      const url = nd?.id
        ? `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${table}?id=eq.${nd.id}`
        : `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/${table}`;

      const headers = {
        'Content-Type': 'application/json',
        'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=minimal',
      };

      try {
        if (nd?.id) {
          fetch(url, {
            method: 'PATCH',
            headers,
            body,
            keepalive: true,
          });
        } else {
          const blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon(url + `?apikey=${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`, blob);
        }
      } catch {
        // localStorage already has the latest content as fallback
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user?.id, table, ownerColumn]);

  return { content, isSaving, saveFailed, lastSaved, handleChange, noteData: noteData ?? null, isFetched };
}

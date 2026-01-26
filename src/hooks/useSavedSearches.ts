import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useOnline } from '@/hooks/useOnlineStatus';

const CACHE_KEY = 'parium_saved_searches_cache';

// Hämta cache från localStorage för instant-load
const getCachedSearches = (userId: string): SavedSearch[] | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { userId: cachedUserId, searches, timestamp } = JSON.parse(cached);
    
    // Kontrollera att cache tillhör rätt användare och inte är för gammal (24h)
    if (cachedUserId !== userId) return null;
    if (Date.now() - timestamp > 24 * 60 * 60 * 1000) return null;
    
    return searches;
  } catch {
    return null;
  }
};

// Spara till cache
const setCachedSearches = (userId: string, searches: SavedSearch[]) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      userId,
      searches,
      timestamp: Date.now()
    }));
  } catch {
    // Ignorera localStorage-fel
  }
};

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  search_query: string | null;
  city: string | null;
  county: string | null;
  employment_types: string[] | null;
  category: string | null;
  salary_min: number | null;
  salary_max: number | null;
  new_matches_count: number;
  last_checked_at: string;
  last_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SearchCriteria {
  search_query?: string;
  city?: string;
  county?: string;
  employment_types?: string[];
  category?: string;
  salary_min?: number;
  salary_max?: number;
}

export const useSavedSearches = () => {
  const { user } = useAuth();
  const { isOnline, showOfflineToast } = useOnline();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(() => {
    // Instant-load: populera direkt från cache
    if (user) {
      return getCachedSearches(user.id) || [];
    }
    return [];
  });
  const [isLoading, setIsLoading] = useState(true);
  const [totalNewMatches, setTotalNewMatches] = useState(0);
  const hasFetchedRef = useRef(false);

  // Hydrerar state från cache vid user-ändring
  useEffect(() => {
    if (user) {
      const cached = getCachedSearches(user.id);
      if (cached && cached.length > 0) {
        setSavedSearches(cached);
        const total = cached.reduce((sum, s) => sum + (s.new_matches_count || 0), 0);
        setTotalNewMatches(total);
        setIsLoading(false);
      }
    }
  }, [user]);

  const fetchSavedSearches = useCallback(async () => {
    if (!user) {
      setSavedSearches([]);
      setTotalNewMatches(0);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const searches = (data || []) as SavedSearch[];
      setSavedSearches(searches);
      
      // Spara till cache för instant-load vid nästa navigation
      setCachedSearches(user.id, searches);
      
      // Calculate total new matches
      const total = searches.reduce((sum, s) => sum + (s.new_matches_count || 0), 0);
      setTotalNewMatches(total);
    } catch (err) {
      console.error('Error fetching saved searches:', err);
    } finally {
      setIsLoading(false);
      hasFetchedRef.current = true;
    }
  }, [user]);

  // Fetch on mount - men bara om vi inte redan har cachad data
  useEffect(() => {
    // Hämta alltid i bakgrunden för att synka, men cache ger instant-load
    fetchSavedSearches();
  }, [fetchSavedSearches]);

  // Realtime subscription for updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`saved-searches-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_searches',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchSavedSearches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSavedSearches]);

  const saveSearch = useCallback(async (name: string, criteria: SearchCriteria) => {
    if (!user) {
      toast.error('Du måste vara inloggad för att spara sökningar');
      return null;
    }

    if (!isOnline) {
      showOfflineToast();
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .insert({
          user_id: user.id,
          name,
          search_query: criteria.search_query || null,
          city: criteria.city || null,
          county: criteria.county || null,
          employment_types: criteria.employment_types?.length ? criteria.employment_types : null,
          category: criteria.category || null,
          salary_min: criteria.salary_min || null,
          salary_max: criteria.salary_max || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Sökning sparad! Du får notiser när nya jobb matchar.');
      await fetchSavedSearches();
      return data as SavedSearch;
    } catch (err) {
      console.error('Error saving search:', err);
      toast.error('Kunde inte spara sökningen');
      return null;
    }
  }, [user, isOnline, showOfflineToast, fetchSavedSearches]);

  const deleteSearch = useCallback(async (searchId: string) => {
    if (!user) return false;

    if (!isOnline) {
      showOfflineToast();
      return false;
    }

    try {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', searchId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Sparad sökning borttagen');
      await fetchSavedSearches();
      return true;
    } catch (err) {
      console.error('Error deleting saved search:', err);
      toast.error('Kunde inte ta bort sökningen');
      return false;
    }
  }, [user, isOnline, showOfflineToast, fetchSavedSearches]);

  const clearNewMatches = useCallback(async (searchId?: string) => {
    if (!user) return false;

    try {
      if (searchId) {
        // Clear for specific search
        const { error } = await supabase
          .from('saved_searches')
          .update({ new_matches_count: 0 })
          .eq('id', searchId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Clear all
        const { error } = await supabase
          .from('saved_searches')
          .update({ new_matches_count: 0 })
          .eq('user_id', user.id);

        if (error) throw error;
      }

      await fetchSavedSearches();
      return true;
    } catch (err) {
      console.error('Error clearing new matches:', err);
      return false;
    }
  }, [user, fetchSavedSearches]);

  const hasActiveFilters = useCallback((criteria: SearchCriteria) => {
    return !!(
      criteria.search_query ||
      criteria.city ||
      criteria.county ||
      (criteria.employment_types && criteria.employment_types.length > 0) ||
      criteria.category ||
      criteria.salary_min ||
      criteria.salary_max
    );
  }, []);

  return {
    savedSearches,
    isLoading,
    totalNewMatches,
    saveSearch,
    deleteSearch,
    clearNewMatches,
    hasActiveFilters,
    refetch: fetchSavedSearches,
  };
};

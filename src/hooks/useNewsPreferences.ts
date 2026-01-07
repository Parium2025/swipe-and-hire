import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY_READ = 'hr-news-read-articles';
const STORAGE_KEY_PREFERENCES = 'hr-news-category-preferences';

interface CategoryPreferences {
  [category: string]: number; // Click count per category
}

export interface NewsPreferences {
  readArticles: Set<string>;
  categoryPreferences: CategoryPreferences;
  markAsRead: (articleId: string) => void;
  isRead: (articleId: string) => boolean;
  trackCategoryClick: (category: string) => void;
  getCategoryScore: (category: string) => number;
}

export const useNewsPreferences = (): NewsPreferences => {
  const [readArticles, setReadArticles] = useState<Set<string>>(new Set());
  const [categoryPreferences, setCategoryPreferences] = useState<CategoryPreferences>({});

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedRead = localStorage.getItem(STORAGE_KEY_READ);
      if (storedRead) {
        const parsed = JSON.parse(storedRead);
        // Only keep articles from last 7 days
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const filtered = Object.entries(parsed)
          .filter(([, timestamp]) => (timestamp as number) > sevenDaysAgo)
          .map(([id]) => id);
        setReadArticles(new Set(filtered));
      }

      const storedPrefs = localStorage.getItem(STORAGE_KEY_PREFERENCES);
      if (storedPrefs) {
        setCategoryPreferences(JSON.parse(storedPrefs));
      }
    } catch (e) {
      console.error('Failed to load news preferences:', e);
    }
  }, []);

  const markAsRead = useCallback((articleId: string) => {
    setReadArticles(prev => {
      const next = new Set(prev);
      next.add(articleId);
      
      // Save to localStorage with timestamps
      try {
        const storedRead = localStorage.getItem(STORAGE_KEY_READ);
        const existing = storedRead ? JSON.parse(storedRead) : {};
        existing[articleId] = Date.now();
        localStorage.setItem(STORAGE_KEY_READ, JSON.stringify(existing));
      } catch (e) {
        console.error('Failed to save read status:', e);
      }
      
      return next;
    });
  }, []);

  const isRead = useCallback((articleId: string) => {
    return readArticles.has(articleId);
  }, [readArticles]);

  const trackCategoryClick = useCallback((category: string) => {
    setCategoryPreferences(prev => {
      const next = { ...prev };
      next[category] = (next[category] || 0) + 1;
      
      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY_PREFERENCES, JSON.stringify(next));
      } catch (e) {
        console.error('Failed to save category preferences:', e);
      }
      
      return next;
    });
  }, []);

  const getCategoryScore = useCallback((category: string) => {
    return categoryPreferences[category] || 0;
  }, [categoryPreferences]);

  return {
    readArticles,
    categoryPreferences,
    markAsRead,
    isRead,
    trackCategoryClick,
    getCategoryScore,
  };
};

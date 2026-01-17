import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook för att automatiskt spara och återställa formulärdata till localStorage.
 * Skyddar mot dataförlust vid sidladdning, nättappad, eller navigering.
 * 
 * @param key - Unik nyckel för att identifiera formuläret (t.ex. 'employer-profile', 'job-edit-123')
 * @param initialData - Initialvärden för formuläret
 * @param options - Konfiguration
 */

interface UseFormDraftOptions {
  /** Fördröjning innan auto-save (ms). Default: 500ms */
  debounceMs?: number;
  /** Om draft ska laddas automatiskt vid mount. Default: true */
  autoLoad?: boolean;
  /** Callback när draft återställs */
  onRestore?: (data: any) => void;
}

const STORAGE_PREFIX = 'parium_draft_';

export function useFormDraft<T extends Record<string, any>>(
  key: string,
  initialData: T,
  options: UseFormDraftOptions = {}
) {
  const { debounceMs = 500, autoLoad = true, onRestore } = options;
  
  const [data, setData] = useState<T>(initialData);
  const [hasDraft, setHasDraft] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const storageKey = `${STORAGE_PREFIX}${key}`;

  // Ladda draft från localStorage vid mount
  useEffect(() => {
    if (!autoLoad) return;
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Kontrollera att det är giltig data (inte tom)
        const hasContent = Object.values(parsed).some(
          (v) => v !== null && v !== undefined && v !== '' && 
                 (typeof v !== 'object' || (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0))
        );
        
        if (hasContent) {
          setData(parsed);
          setHasDraft(true);
          setIsRestored(true);
          onRestore?.(parsed);
          console.log(`📝 Draft restored for ${key}`);
        }
      }
    } catch (error) {
      console.warn('Failed to load draft:', error);
    }
  }, [storageKey, autoLoad]);

  // Spara till localStorage med debounce
  const saveDraft = useCallback((newData: T) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      try {
        // Spara bara om det finns verkligt innehåll
        const hasContent = Object.values(newData).some(
          (v) => v !== null && v !== undefined && v !== '' &&
                 (typeof v !== 'object' || (Array.isArray(v) ? v.length > 0 : Object.keys(v).length > 0))
        );
        
        if (hasContent) {
          localStorage.setItem(storageKey, JSON.stringify(newData));
          setHasDraft(true);
        }
      } catch (error) {
        console.warn('Failed to save draft:', error);
      }
    }, debounceMs);
  }, [storageKey, debounceMs]);

  // Uppdatera data och spara draft
  const updateData = useCallback((updates: Partial<T> | ((prev: T) => T)) => {
    setData((prev) => {
      const newData = typeof updates === 'function' ? updates(prev) : { ...prev, ...updates };
      saveDraft(newData);
      return newData;
    });
  }, [saveDraft]);

  // Uppdatera ett specifikt fält
  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setData((prev) => {
      const newData = { ...prev, [field]: value };
      saveDraft(newData);
      return newData;
    });
  }, [saveDraft]);

  // Rensa draft (anropas efter lyckad submit)
  const clearDraft = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      console.log(`🗑️ Draft cleared for ${key}`);
    } catch (error) {
      console.warn('Failed to clear draft:', error);
    }
  }, [storageKey, key]);

  // Återställ till initialvärden och rensa draft
  const reset = useCallback(() => {
    setData(initialData);
    clearDraft();
  }, [initialData, clearDraft]);

  // Cleanup vid unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    /** Aktuell formulärdata */
    data,
    /** Uppdatera hela eller delar av formuläret */
    updateData,
    /** Uppdatera ett specifikt fält */
    updateField,
    /** Sätt data direkt (utan merge) */
    setData: (newData: T) => {
      setData(newData);
      saveDraft(newData);
    },
    /** Rensa sparad draft (kör efter lyckad submit) */
    clearDraft,
    /** Återställ till initialvärden */
    reset,
    /** Om det finns en sparad draft */
    hasDraft,
    /** Om draft återställdes vid mount */
    isRestored,
  };
}

/**
 * Enkel hook för att spara enstaka värden (t.ex. en textarea)
 */
export function useFieldDraft(
  key: string,
  initialValue: string = ''
): [string, (value: string) => void, () => void, boolean] {
  const storageKey = `${STORAGE_PREFIX}field_${key}`;
  const [value, setValue] = useState(initialValue);
  const [hasDraft, setHasDraft] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Ladda vid mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && stored.trim()) {
        setValue(stored);
        setHasDraft(true);
      }
    } catch (error) {
      console.warn('Failed to load field draft:', error);
    }
  }, [storageKey]);

  // Uppdatera med debounce
  const updateValue = useCallback((newValue: string) => {
    setValue(newValue);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      try {
        if (newValue.trim()) {
          localStorage.setItem(storageKey, newValue);
          setHasDraft(true);
        } else {
          localStorage.removeItem(storageKey);
          setHasDraft(false);
        }
      } catch (error) {
        console.warn('Failed to save field draft:', error);
      }
    }, 300);
  }, [storageKey]);

  // Rensa
  const clearValue = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
    } catch (error) {
      console.warn('Failed to clear field draft:', error);
    }
  }, [storageKey]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return [value, updateValue, clearValue, hasDraft];
}

/**
 * Utility för att rensa alla drafts (t.ex. vid logout)
 */
export function clearAllDrafts() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(STORAGE_PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
    console.log(`🗑️ Cleared ${keys.length} drafts`);
  } catch (error) {
    console.warn('Failed to clear all drafts:', error);
  }
}

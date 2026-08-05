import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook för att automatiskt spara och återställa formulärdata till localStorage.
 * Skyddar mot dataförlust vid sidladdning, nättappad, eller navigering.
 * 
 * Sparar ALLA fält inklusive dropdowns, checkboxes, arrays etc.
 * 
 * @param key - Unik nyckel för att identifiera formuläret (t.ex. 'employer-profile', 'job-edit-123')
 * @param initialData - Initialvärden för formuläret
 * @param options - Konfiguration
 */

interface UseFormDraftOptions {
  /** Fördröjning innan auto-save (ms). Default: 300ms */
  debounceMs?: number;
  /** Om draft ska laddas automatiskt vid mount. Default: true */
  autoLoad?: boolean;
  /** Callback när draft återställs */
  onRestore?: (data: any) => void;
  /** Om denna draft ska ignoreras (t.ex. när man redigerar befintligt jobb) */
  disabled?: boolean;
}

const STORAGE_PREFIX = 'parium_draft_';

/**
 * Djup jämförelse för att kolla om data har ändrats från initial state
 */
function hasDataChanged<T>(current: T, initial: T): boolean {
  if (current === initial) return false;
  if (current === null || initial === null) return current !== initial;
  if (typeof current !== typeof initial) return true;
  
  if (Array.isArray(current) && Array.isArray(initial)) {
    if (current.length !== initial.length) return true;
    return current.some((item, i) => hasDataChanged(item, initial[i]));
  }
  
  if (typeof current === 'object') {
    const currentKeys = Object.keys(current as object);
    const initialKeys = Object.keys(initial as object);
    if (currentKeys.length !== initialKeys.length) return true;
    return currentKeys.some(key => 
      hasDataChanged((current as any)[key], (initial as any)[key])
    );
  }
  
  return current !== initial;
}

/**
 * Kontrollera om data har meningsfullt innehåll (inte bara tomma värden)
 */
function hasContent(data: any): boolean {
  if (data === null || data === undefined) return false;
  if (typeof data === 'string') return data.trim().length > 0;
  if (typeof data === 'number') return true;
  if (typeof data === 'boolean') return true;
  if (Array.isArray(data)) return data.length > 0 && data.some(item => hasContent(item));
  if (typeof data === 'object') {
    return Object.values(data).some(v => hasContent(v));
  }
  return false;
}

export function useFormDraft<T extends Record<string, any>>(
  key: string,
  initialData: T,
  options: UseFormDraftOptions = {}
) {
  const { debounceMs = 300, autoLoad = true, onRestore, disabled = false } = options;
  
  const [data, setData] = useState<T>(initialData);
  const [hasDraft, setHasDraft] = useState(false);
  const [isRestored, setIsRestored] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialDataRef = useRef<T>(initialData);
  const storageKey = `${STORAGE_PREFIX}${key}`;

  // Uppdatera initial data referens
  useEffect(() => {
    initialDataRef.current = initialData;
  }, [initialData]);

  // Ladda draft från localStorage vid mount
  useEffect(() => {
    if (!autoLoad || disabled) {
      setIsInitialized(true);
      return;
    }
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Handle both old format (direct data) and new format (with savedAt)
        const actualData = (parsed.formData || parsed) as T;
        
        // Kontrollera att det är giltig data med verkligt innehåll
        if (hasContent(actualData) && hasDataChanged(actualData, initialData)) {
          // Merge med initial data för att hantera nya fält
          const mergedData = { ...initialData, ...actualData };
          setData(mergedData);
          setHasDraft(true);
          setIsRestored(true);
          onRestore?.(mergedData);
          console.log(`📝 Draft restored for ${key}`);
        }
      }
    } catch (error) {
      console.warn('Failed to load draft:', error);
    }
    setIsInitialized(true);
  }, [storageKey, autoLoad, disabled]);

  // Spara till localStorage med debounce
  const saveDraft = useCallback((newData: T) => {
    if (disabled) return;
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    debounceRef.current = setTimeout(() => {
      try {
        // Spara bara om det finns verkligt innehåll som skiljer sig från initial
        if (hasContent(newData) && hasDataChanged(newData, initialDataRef.current)) {
          localStorage.setItem(storageKey, JSON.stringify({
            formData: newData,
            savedAt: Date.now()
          }));
          setHasDraft(true);
        } else {
          // Om ingen meningsfull ändring, ta bort eventuell draft
          localStorage.removeItem(storageKey);
          setHasDraft(false);
        }
      } catch (error) {
        console.warn('Failed to save draft:', error);
      }
    }, debounceMs);
  }, [storageKey, debounceMs, disabled]);

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
    /** Om hooken har initialiserats (klar att använda) */
    isInitialized,
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ladda vid mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && stored.trim()) {
        // Handle both old format (plain string) and new format (with savedAt)
        try {
          const parsed = JSON.parse(stored);
          if (parsed.value !== undefined) {
            setValue(parsed.value);
          } else {
            // Old format - plain string that happens to be valid JSON
            setValue(stored);
          }
        } catch {
          // Old format - plain string
          setValue(stored);
        }
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
          localStorage.setItem(storageKey, JSON.stringify({
            value: newValue,
            savedAt: Date.now()
          }));
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
    // Välkomstunnelns uppladdningsmetadata ligger i sessionStorage och är
    // konto-prefixad. Den måste rensas samtidigt så samma konto aldrig får
    // tillbaka övergiven media efter en utloggning i samma flik.
    const mediaKeys = Object.keys(sessionStorage).filter((k) =>
      k.startsWith('parium_welcome_local_media_')
    );
    mediaKeys.forEach((k) => sessionStorage.removeItem(k));
    console.log(`🗑️ Cleared ${keys.length} drafts and ${mediaKeys.length} media drafts`);
  } catch (error) {
    console.warn('Failed to clear all drafts:', error);
  }
}

/**
 * Rensa en specifik draft
 */
export function clearDraftByKey(key: string) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    localStorage.removeItem(`${STORAGE_PREFIX}field_${key}`);
  } catch (error) {
    console.warn('Failed to clear draft:', error);
  }
}

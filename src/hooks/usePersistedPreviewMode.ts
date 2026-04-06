import { useEffect, useState } from 'react';
import { getDevice } from '@/hooks/use-device';

export type PersistedPreviewMode = 'mobile' | 'desktop';

function isPreviewMode(value: string | null): value is PersistedPreviewMode {
  return value === 'mobile' || value === 'desktop';
}

function getDefaultPreviewMode(): PersistedPreviewMode {
  return getDevice() === 'mobile' ? 'mobile' : 'desktop';
}

export function usePersistedPreviewMode(storageKey: string) {
  const [previewMode, setPreviewMode] = useState<PersistedPreviewMode>(() => {
    if (typeof window === 'undefined') {
      return getDefaultPreviewMode();
    }

    try {
      const storedMode = window.sessionStorage.getItem(storageKey);
      return isPreviewMode(storedMode) ? storedMode : getDefaultPreviewMode();
    } catch {
      return getDefaultPreviewMode();
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.sessionStorage.setItem(storageKey, previewMode);
    } catch {
      // Ignore storage write failures and keep the current in-memory mode.
    }
  }, [storageKey, previewMode]);

  return [previewMode, setPreviewMode] as const;
}

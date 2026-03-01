import { useState, useCallback, useEffect, useMemo } from 'react';

/**
 * Encapsulates selection-mode state (multi-select, ESC to exit, toggle all).
 * Keeps MyCandidates.tsx lean and focused on layout.
 */
export function useSelectionMode(allVisibleCandidateIds: string[]) {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(new Set());

  const toggleCandidateSelection = useCallback((candidateId: string) => {
    setSelectedCandidateIds(prev => {
      const next = new Set(prev);
      if (next.has(candidateId)) next.delete(candidateId);
      else next.add(candidateId);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedCandidateIds(new Set());
  }, []);

  // ESC to exit
  useEffect(() => {
    if (!isSelectionMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitSelectionMode();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isSelectionMode, exitSelectionMode]);

  const allVisibleSelected = useMemo(() => {
    return (
      allVisibleCandidateIds.length > 0 &&
      allVisibleCandidateIds.every(id => selectedCandidateIds.has(id))
    );
  }, [allVisibleCandidateIds, selectedCandidateIds]);

  const toggleAllVisible = useCallback(() => {
    setSelectedCandidateIds(prev => {
      const allSelected =
        allVisibleCandidateIds.length > 0 &&
        allVisibleCandidateIds.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(allVisibleCandidateIds);
    });
  }, [allVisibleCandidateIds]);

  return {
    isSelectionMode,
    setIsSelectionMode,
    selectedCandidateIds,
    toggleCandidateSelection,
    exitSelectionMode,
    allVisibleSelected,
    toggleAllVisible,
  };
}

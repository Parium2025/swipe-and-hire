import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useDevice } from './use-device';

interface KanbanLayoutContextType {
  stageCount: number;
  setStageCount: (count: number) => void;
  shouldCollapseSidebar: boolean;
  columnWidth: { min: string; max: string };
}

const KanbanLayoutContext = createContext<KanbanLayoutContextType | null>(null);

export function KanbanLayoutProvider({ children }: { children: ReactNode }) {
  const [stageCount, setStageCount] = useState(0);
  const device = useDevice();

  // Calculate if sidebar should be collapsed based on stage count and screen size
  const shouldCollapseSidebar = (() => {
    if (device === 'mobile') return true; // Always collapsed on mobile
    if (stageCount === 0) return false; // No stages loaded yet, keep open
    
    // Desktop/tablet logic based on stage count
    if (device === 'tablet') {
      return stageCount >= 4; // Collapse on tablet with 4+ stages
    }
    
    // Desktop: collapse with 5+ stages
    return stageCount >= 5;
  })();

  // Dynamic column widths based on stage count and screen size
  const columnWidth = (() => {
    if (device === 'mobile') {
      return { min: '280px', max: '320px' };
    }
    
    if (device === 'tablet') {
      if (stageCount <= 3) return { min: '200px', max: '280px' };
      if (stageCount <= 4) return { min: '180px', max: '240px' };
      return { min: '160px', max: '220px' };
    }
    
    // Desktop: more generous widths
    if (stageCount <= 3) return { min: '260px', max: '360px' };
    if (stageCount <= 4) return { min: '220px', max: '300px' };
    if (stageCount <= 5) return { min: '180px', max: '260px' };
    return { min: '160px', max: '240px' };
  })();

  return (
    <KanbanLayoutContext.Provider value={{ stageCount, setStageCount, shouldCollapseSidebar, columnWidth }}>
      {children}
    </KanbanLayoutContext.Provider>
  );
}

export function useKanbanLayout() {
  const context = useContext(KanbanLayoutContext);
  if (!context) {
    // Return safe defaults if used outside provider
    return {
      stageCount: 0,
      setStageCount: () => {},
      shouldCollapseSidebar: false,
      columnWidth: { min: '180px', max: '260px' },
    };
  }
  return context;
}

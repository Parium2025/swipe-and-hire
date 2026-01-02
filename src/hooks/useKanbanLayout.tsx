import { createContext, useContext, useState, ReactNode } from 'react';
import { useDevice } from './use-device';

// Max 5 stages allowed
export const MAX_KANBAN_STAGES = 5;

interface KanbanLayoutContextType {
  stageCount: number;
  setStageCount: (count: number) => void;
  shouldCollapseSidebar: boolean;
  columnMinWidth: string;
}

const KanbanLayoutContext = createContext<KanbanLayoutContextType | null>(null);

export function KanbanLayoutProvider({ children }: { children: ReactNode }) {
  const [stageCount, setStageCount] = useState(0);
  const device = useDevice();

  // Smart sidebar collapse based on stage count and device
  // Goal: fit all columns without horizontal scrolling
  const shouldCollapseSidebar = (() => {
    if (device === 'mobile') return true; // Always collapsed on mobile
    if (stageCount === 0) return false; // No stages loaded yet
    
    // Tablet: collapse with 4+ stages
    if (device === 'tablet') {
      return stageCount >= 4;
    }
    
    // Desktop: collapse with 5 stages, open with 4 or fewer
    return stageCount >= 5;
  })();

  // Minimum column width - columns will expand with flex-1 to fill space
  // This ensures names are readable while columns expand to fit
  const columnMinWidth = (() => {
    if (device === 'mobile') {
      return '280px';
    }
    
    if (device === 'tablet') {
      if (stageCount <= 3) return '220px';
      if (stageCount <= 4) return '200px';
      return '180px';
    }
    
    // Desktop: generous minimum widths, flex-1 will expand them
    if (stageCount <= 3) return '280px';
    if (stageCount <= 4) return '240px';
    return '200px'; // 5 stages
  })();

  return (
    <KanbanLayoutContext.Provider value={{ stageCount, setStageCount, shouldCollapseSidebar, columnMinWidth }}>
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
      columnMinWidth: '200px',
    };
  }
  return context;
}

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

// Max 5 stages allowed
export const MAX_KANBAN_STAGES = 5;

// Minimum column width to prevent truncation (in pixels)
const MIN_COLUMN_WIDTH = 280;
// Sidebar widths
const SIDEBAR_OPEN_WIDTH = 256; // 16rem = 256px
const SIDEBAR_COLLAPSED_WIDTH = 56; // ~3.5rem
// Extra padding/gaps in the layout
const LAYOUT_PADDING = 48; // gaps between columns + container padding

interface KanbanLayoutContextType {
  stageCount: number;
  setStageCount: (count: number) => void;
  shouldCollapseSidebar: boolean;
}

const KanbanLayoutContext = createContext<KanbanLayoutContextType | null>(null);

export function KanbanLayoutProvider({ children }: { children: ReactNode }) {
  const [stageCount, setStageCount] = useState(0);
  const [windowWidth, setWindowWidth] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth : 1200
  );

  // Track window width for smart calculations
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Smart sidebar collapse based on actual screen width and stage count
  // Goal: NEVER truncate columns - collapse sidebar proactively instead
  const shouldCollapseSidebar = (() => {
    // Mobile: always collapsed
    if (windowWidth < 768) return true;
    
    // No stages loaded yet - keep sidebar open
    if (stageCount === 0) return false;
    
    // Calculate available width for columns with sidebar OPEN
    const availableWithSidebarOpen = windowWidth - SIDEBAR_OPEN_WIDTH - LAYOUT_PADDING;
    const requiredWidth = stageCount * MIN_COLUMN_WIDTH;
    
    // If columns won't fit with sidebar open, collapse it
    if (requiredWidth > availableWithSidebarOpen) {
      return true;
    }
    
    // Extra safety margin for smaller screens - be more aggressive about collapsing
    // On screens under 1400px, collapse earlier to ensure comfortable viewing
    if (windowWidth < 1400 && stageCount >= 4) {
      return true;
    }
    
    // On screens under 1200px, collapse with 3+ stages
    if (windowWidth < 1200 && stageCount >= 3) {
      return true;
    }
    
    // On screens under 1024px (tablet), collapse with 2+ stages
    if (windowWidth < 1024 && stageCount >= 2) {
      return true;
    }
    
    return false;
  })();

  return (
    <KanbanLayoutContext.Provider value={{ stageCount, setStageCount, shouldCollapseSidebar }}>
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
    };
  }
  return context;
}

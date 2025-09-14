import { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  checkBeforeNavigation: (targetUrl: string) => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const lastSafePathRef = useRef<string>(location.pathname);

  // Track the last safe path (where the user currently is) to return on cancel
  useEffect(() => {
    lastSafePathRef.current = location.pathname;
  }, [location.pathname]);

  const checkBeforeNavigation = (targetUrl: string): boolean => {
    console.log('checkBeforeNavigation called, hasUnsavedChanges:', hasUnsavedChanges);
    if (hasUnsavedChanges) {
      setPendingNavigation(targetUrl);
      
      // Show toast with action buttons
      toast({
        title: "Osparade ändringar",
        description: "Du har osparade ändringar. Vill du spara innan du lämnar?",
        action: (
          <div className="flex gap-2">
            <button
              onClick={() => {
                // Navigate without saving
                if (targetUrl) {
                  window.dispatchEvent(new CustomEvent('unsaved-confirm'));
                  setHasUnsavedChanges(false);
                  navigate(targetUrl);
                }
                setPendingNavigation(null);
              }}
              className="bg-red-500/80 hover:bg-red-500/90 text-white px-3 py-1 rounded text-sm"
            >
              Lämna utan att spara
            </button>
            <button
              onClick={() => {
                // Cancel and stay on current page
                setPendingNavigation(null);
                window.dispatchEvent(new CustomEvent('unsaved-cancel'));
                if (location.pathname !== '/profile') {
                  navigate('/profile', { replace: true });
                }
              }}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-sm border border-white/30"
            >
              Stanna och spara
            </button>
          </div>
        ),
      });
      
      return false; // Block navigation initially
    }
    return true;
  };

  return (
    <UnsavedChangesContext.Provider value={{
      hasUnsavedChanges,
      setHasUnsavedChanges,
      checkBeforeNavigation
    }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (context === undefined) {
    throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
  }
  return context;
}
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
      
      // Show a custom notice in the sidebar instead of toast
      window.dispatchEvent(new CustomEvent('show-unsaved-notice', {
        detail: {
          onConfirm: () => {
            if (targetUrl) {
              window.dispatchEvent(new CustomEvent('unsaved-confirm'));
              setHasUnsavedChanges(false);
              navigate(targetUrl);
            }
            setPendingNavigation(null);
            window.dispatchEvent(new CustomEvent('hide-unsaved-notice'));
          },
          onCancel: () => {
            setPendingNavigation(null);
            window.dispatchEvent(new CustomEvent('unsaved-cancel'));
            window.dispatchEvent(new CustomEvent('hide-unsaved-notice'));
            if (location.pathname !== '/profile') {
              navigate('/profile', { replace: true });
            }
          }
        }
      }));
      
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
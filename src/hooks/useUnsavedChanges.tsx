import { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog';

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  checkBeforeNavigation: (targetUrl: string) => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [hasUnsavedChanges, _setHasUnsavedChanges] = useState(false);
  const hasUnsavedChangesRef = useRef(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  // Track current and previous safe paths so "Avbryt" can return the user
  // to the page where the unsaved changes actually live (e.g. when a browser
  // back-gesture has already navigated away before the dialog opens).
  const currentSafePathRef = useRef<string>(location.pathname + location.search);
  const previousSafePathRef = useRef<string>(location.pathname + location.search);

  const setHasUnsavedChanges = (value: boolean) => {
    hasUnsavedChangesRef.current = value;
    _setHasUnsavedChanges(value);
  };

  // Update path tracking on every navigation (when dialog is closed).
  // When the dialog opens we freeze these refs so we can recover the origin path.
  useEffect(() => {
    if (!showUnsavedDialog) {
      const newPath = location.pathname + location.search;
      if (newPath !== currentSafePathRef.current) {
        previousSafePathRef.current = currentSafePathRef.current;
        currentSafePathRef.current = newPath;
      }
    }
  }, [location.pathname, location.search, showUnsavedDialog]);

  const checkBeforeNavigation = (targetUrl: string): boolean => {
    if (hasUnsavedChangesRef.current) {
      setPendingNavigation(targetUrl);
      setShowUnsavedDialog(true);
      return false; // Block navigation initially
    }
    return true;
  };

  const handleConfirmLeave = () => {
    const target = pendingNavigation;

    // Close dialog first
    setShowUnsavedDialog(false);
    setPendingNavigation(null);

    // Notify listeners (e.g., forms) to reset their state
    window.dispatchEvent(new CustomEvent('unsaved-confirm'));

    // Ensure navigation isn't blocked a second time (state updates are async)
    setHasUnsavedChanges(false);

    if (target) {
      navigate(target);
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    // Notify listeners (e.g., sidebar) to close on cancel
    window.dispatchEvent(new CustomEvent('unsaved-cancel'));

    // If a browser back/forward gesture already navigated us away from the
    // page that holds the unsaved changes, return the user to that origin page.
    const currentPath = location.pathname + location.search;
    const originPath = previousSafePathRef.current;
    if (originPath && originPath !== currentPath) {
      navigate(originPath);
    }
  };

  return (
    <UnsavedChangesContext.Provider value={{
      hasUnsavedChanges,
      setHasUnsavedChanges,
      checkBeforeNavigation,
    }}>
      {children}
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onOpenChange={setShowUnsavedDialog}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
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
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
  const lastSafePathRef = useRef<string>(location.pathname);

  const setHasUnsavedChanges = (value: boolean) => {
    hasUnsavedChangesRef.current = value;
    _setHasUnsavedChanges(value);
  };

  // Track the last safe path (where the user currently is) to return on cancel
  useEffect(() => {
    if (!showUnsavedDialog) {
      lastSafePathRef.current = location.pathname;
    }
  }, [location.pathname, showUnsavedDialog]);

  const checkBeforeNavigation = (targetUrl: string): boolean => {
    console.log('checkBeforeNavigation called, hasUnsavedChanges:', hasUnsavedChangesRef.current);
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
    console.log('Cancel button clicked - staying on current page');
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    // Notify listeners (e.g., sidebar) to close on cancel
    window.dispatchEvent(new CustomEvent('unsaved-cancel'));
    // Don't navigate anywhere - just stay on the current page with unsaved changes
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
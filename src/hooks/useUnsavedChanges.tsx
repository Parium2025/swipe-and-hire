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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const lastSafePathRef = useRef<string>(location.pathname);

  // Track the last safe path (where the user currently is) to return on cancel
  useEffect(() => {
    if (!showUnsavedDialog) {
      lastSafePathRef.current = location.pathname;
    }
  }, [location.pathname, showUnsavedDialog]);

  const checkBeforeNavigation = (targetUrl: string): boolean => {
    console.log('checkBeforeNavigation called, hasUnsavedChanges:', hasUnsavedChanges);
    if (hasUnsavedChanges) {
      setPendingNavigation(targetUrl);
      setShowUnsavedDialog(true);
      return false; // Block navigation initially
    }
    return true;
  };

  const handleConfirmLeave = () => {
    if (pendingNavigation) {
      // Notify listeners (e.g., forms) to reset their state
      window.dispatchEvent(new CustomEvent('unsaved-confirm'));
      setHasUnsavedChanges(false);
      navigate(pendingNavigation);
    }
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
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
      checkBeforeNavigation
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
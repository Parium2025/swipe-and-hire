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
  // Snapshot of the path at the moment the dialog opened. If the URL has
  // changed by the time the user clicks "Avbryt" (e.g. browser back/forward
  // already navigated away), we restore this path so the user returns to the
  // page that actually holds their unsaved changes.
  const pathAtDialogOpenRef = useRef<string | null>(null);

  const setHasUnsavedChanges = (value: boolean) => {
    hasUnsavedChangesRef.current = value;
    _setHasUnsavedChanges(value);
  };

  const checkBeforeNavigation = (targetUrl: string): boolean => {
    if (hasUnsavedChangesRef.current) {
      // Snapshot current path BEFORE blocking — this is the page with unsaved changes
      pathAtDialogOpenRef.current = location.pathname + location.search;
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
    pathAtDialogOpenRef.current = null;

    // Notify listeners (e.g., forms) to reset their state
    window.dispatchEvent(new CustomEvent('unsaved-confirm'));

    // Ensure navigation isn't blocked a second time (state updates are async)
    setHasUnsavedChanges(false);

    if (target) {
      navigate(target);
    }
  };

  const handleCancelLeave = () => {
    const originPath = pathAtDialogOpenRef.current;
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    pathAtDialogOpenRef.current = null;
    // Notify listeners (e.g., sidebar) to close on cancel
    window.dispatchEvent(new CustomEvent('unsaved-cancel'));

    // Only navigate back if the URL actually changed since the dialog opened
    // (e.g. a browser back/forward gesture pulled the user away).
    const currentPath = location.pathname + location.search;
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
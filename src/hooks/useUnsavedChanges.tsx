import { createContext, useContext, useState, ReactNode, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useBlocker } from 'react-router-dom';
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
  const blocker = useBlocker(hasUnsavedChanges);

  const setHasUnsavedChanges = (value: boolean) => {
    hasUnsavedChangesRef.current = value;
    _setHasUnsavedChanges(value);
  };

  // React Router blocker catches browser back/forward and any navigation that
  // bypasses our manual checkBeforeNavigation helper.
  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    const targetPath = `${blocker.location.pathname}${blocker.location.search}`;
    const currentPath = `${location.pathname}${location.search}`;

    // Ignore no-op navigations to the same URL.
    if (targetPath === currentPath) {
      blocker.reset();
      return;
    }

    setPendingNavigation(targetPath);
    setShowUnsavedDialog(true);
  }, [blocker, location.pathname, location.search]);

  const checkBeforeNavigation = (targetUrl: string): boolean => {
    if (hasUnsavedChangesRef.current) {
      setPendingNavigation(targetUrl);
      setShowUnsavedDialog(true);
      return false;
    }
    return true;
  };

  const handleConfirmLeave = () => {
    const target = pendingNavigation;

    setShowUnsavedDialog(false);
    setPendingNavigation(null);

    window.dispatchEvent(new CustomEvent('unsaved-confirm'));
    setHasUnsavedChanges(false);

    if (blocker.state === 'blocked') {
      blocker.proceed();
      return;
    }

    if (target) {
      navigate(target);
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    window.dispatchEvent(new CustomEvent('unsaved-cancel'));

    if (blocker.state === 'blocked') {
      blocker.reset();
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

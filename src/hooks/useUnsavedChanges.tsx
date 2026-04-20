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
  const showUnsavedDialogRef = useRef(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const pendingNavigationSourceRef = useRef<'app' | 'browser-pop' | null>(null);
  const skipNextPopRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPathRef = useRef(`${location.pathname}${location.search}`);

  const setHasUnsavedChanges = (value: boolean) => {
    hasUnsavedChangesRef.current = value;
    _setHasUnsavedChanges(value);
  };

  useEffect(() => {
    currentPathRef.current = `${location.pathname}${location.search}`;
  }, [location.pathname, location.search]);

  useEffect(() => {
    showUnsavedDialogRef.current = showUnsavedDialog;
  }, [showUnsavedDialog]);

  useEffect(() => {
    const handlePopState = () => {
      if (skipNextPopRef.current) {
        skipNextPopRef.current = false;
        return;
      }

      if (!hasUnsavedChangesRef.current || showUnsavedDialogRef.current) {
        return;
      }

      const originPath = currentPathRef.current;
      const targetPath = `${window.location.pathname}${window.location.search}`;

      if (targetPath === originPath) {
        return;
      }

      pendingNavigationSourceRef.current = 'browser-pop';
      setPendingNavigation(targetPath);
      setShowUnsavedDialog(true);

      // BrowserRouter cannot truly block browser-back/forward, so we immediately
      // step back to the origin to keep the user on the editing page while the
      // dialog is open. Using pushState avoids the brief URL flicker that
      // history.go(1) can cause and works for both back and forward gestures.
      skipNextPopRef.current = true;
      window.history.pushState(null, '', originPath);
    };

    // Guard against tab close / reload while there are unsaved changes.
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        // Required for legacy browsers to actually show the prompt.
        e.returnValue = '';
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const checkBeforeNavigation = (targetUrl: string): boolean => {
    if (hasUnsavedChangesRef.current) {
      pendingNavigationSourceRef.current = 'app';
      setPendingNavigation(targetUrl);
      setShowUnsavedDialog(true);
      return false;
    }
    return true;
  };

  const handleConfirmLeave = () => {
    const target = pendingNavigation;
    const source = pendingNavigationSourceRef.current;

    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    pendingNavigationSourceRef.current = null;

    window.dispatchEvent(new CustomEvent('unsaved-confirm'));
    setHasUnsavedChanges(false);

    if (target) {
      navigate(target, { replace: source === 'browser-pop' });
    }
  };

  const handleCancelLeave = () => {
    setShowUnsavedDialog(false);
    setPendingNavigation(null);
    pendingNavigationSourceRef.current = null;
    window.dispatchEvent(new CustomEvent('unsaved-cancel'));
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


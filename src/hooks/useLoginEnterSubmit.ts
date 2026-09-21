import { useEffect, type RefObject } from 'react';

interface UseLoginEnterSubmitOptions {
  active: boolean;
  loading: boolean;
  formRef: RefObject<HTMLFormElement>;
}

export const useLoginEnterSubmit = ({ active, loading, formRef }: UseLoginEnterSubmitOptions) => {
  useEffect(() => {
    if (!active) return;

    const handleEnter = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.isComposing || event.defaultPrevented || loading) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const form = formRef.current;
      if (!form) return;

      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLButtonElement ||
        target instanceof HTMLAnchorElement ||
        target?.isContentEditable
      ) {
        return;
      }

      // Never hijack Enter from another form, such as password recovery.
      if (target instanceof HTMLInputElement && target.form && target.form !== form) return;

      event.preventDefault();
      event.stopPropagation();
      form.requestSubmit();
    };

    // Capture the key before browser/field-specific handlers. This also makes
    // physical keyboards behave consistently on iOS and Android.
    window.addEventListener('keydown', handleEnter, true);
    return () => window.removeEventListener('keydown', handleEnter, true);
  }, [active, formRef, loading]);
};
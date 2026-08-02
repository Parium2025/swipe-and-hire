import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type EmailAvailability = {
  /** true = adressen har redan ett konto */
  taken: boolean;
  /** true medan kontrollen pågår */
  checking: boolean;
  /** rollen på det befintliga kontot, om känd */
  existingRole: 'job_seeker' | 'employer' | null;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEBOUNCE_MS = 900;

const cache = new Map<string, { exists: boolean; role: 'job_seeker' | 'employer' | null }>();

/**
 * Kontrollerar debouncat om en e-postadress redan är registrerad,
 * så registreringsformuläret kan visa en tydlig varning direkt.
 * Kontrollen sker bara när `enabled` är true (dvs. i registreringsläget).
 */
export function useEmailAvailability(email: string, enabled: boolean): EmailAvailability {
  const [state, setState] = useState<EmailAvailability>({
    taken: false,
    checking: false,
    existingRole: null,
  });
  const requestId = useRef(0);

  useEffect(() => {
    const normalized = email.trim().toLowerCase();

    if (!enabled || !EMAIL_RE.test(normalized)) {
      setState({ taken: false, checking: false, existingRole: null });
      return;
    }

    const cached = cache.get(normalized);
    if (cached) {
      setState({ taken: cached.exists, checking: false, existingRole: cached.role });
      return;
    }

    setState({ taken: false, checking: true, existingRole: null });
    const id = ++requestId.current;

    const timer = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('check-email-availability', {
          body: { email: normalized },
        });
        if (id !== requestId.current) return;

        if (error || !data?.checked) {
          setState({ taken: false, checking: false, existingRole: null });
          return;
        }

        const role = (data.role === 'employer' || data.role === 'job_seeker') ? data.role : null;
        cache.set(normalized, { exists: !!data.exists, role });
        setState({ taken: !!data.exists, checking: false, existingRole: role });
      } catch {
        if (id !== requestId.current) return;
        setState({ taken: false, checking: false, existingRole: null });
      }
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [email, enabled]);

  return state;
}

/**
 * Textvarning som visas under e-postfältet.
 * Rollen avslöjas medvetet INTE — annars kan vem som helst ta reda på om en
 * adress tillhör en arbetsgivare eller en jobbsökande.
 */
export function emailTakenMessage(_existingRole?: 'job_seeker' | 'employer' | null): string {
  return 'Den här e-postadressen är redan registrerad. Logga in istället.';
}

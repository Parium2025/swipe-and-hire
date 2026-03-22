import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OutreachTemplate } from '@/lib/outreach';
import { readCachedOutreachTemplates, writeCachedOutreachTemplates } from '@/lib/outreachStudioCache';
import { useAuth } from '@/hooks/useAuth';
import {
  getManualOutreachTemplateGroups,
  type ManualOutreachActionKey,
} from '@/lib/outreachManualActions';

export function useOutreachManualActions(enabled = true) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<OutreachTemplate[]>(() => (user ? readCachedOutreachTemplates(user.id) ?? [] : []));
  const [loading, setLoading] = useState(() => enabled && templates.length === 0);

  useEffect(() => {
    if (!enabled || !user) return;

    let cancelled = false;
    const cached = readCachedOutreachTemplates(user.id);

    if (cached && cached.length > 0) {
      setTemplates(cached);
      setLoading(false);
    }

    const fetchTemplates = async () => {
      if (!cached?.length) setLoading(true);
      const { data, error } = await supabase
        .from('outreach_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!cancelled && !error) {
        const filtered = (data ?? []).filter((template) => ['chat', 'email', 'push'].includes(template.channel)) as OutreachTemplate[];
        setTemplates(filtered);
        writeCachedOutreachTemplates(user.id, filtered);
      }

      if (!cancelled) setLoading(false);
    };

    void fetchTemplates();

    return () => {
      cancelled = true;
    };
  }, [enabled, user]);

  const groups = useMemo(() => getManualOutreachTemplateGroups(templates), [templates]);

  const hasAction = (action: ManualOutreachActionKey) => groups[action].channels.length > 0;

  return {
    loading,
    groups,
    hasAction,
  };
}

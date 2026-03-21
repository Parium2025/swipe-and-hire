import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { OutreachTemplate } from '@/lib/outreach';
import {
  getManualOutreachTemplateGroups,
  type ManualOutreachActionKey,
} from '@/lib/outreachManualActions';

export function useOutreachManualActions(enabled = true) {
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const fetchTemplates = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('outreach_templates')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!cancelled && !error) {
        setTemplates((data ?? []).filter((template) => ['chat', 'email', 'push'].includes(template.channel)) as OutreachTemplate[]);
      }

      if (!cancelled) setLoading(false);
    };

    void fetchTemplates();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const groups = useMemo(() => getManualOutreachTemplateGroups(templates), [templates]);

  const hasAction = (action: ManualOutreachActionKey) => groups[action].channels.length > 0;

  return {
    loading,
    groups,
    hasAction,
  };
}

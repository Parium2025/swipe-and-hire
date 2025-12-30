import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { StageSettings, DEFAULT_STAGE_KEYS, getIconByName } from '@/hooks/useStageSettings';

// Default settings for built-in stages
const DEFAULT_STAGES: Record<string, StageSettings> = {
  to_contact: { label: 'Att kontakta', color: '#0EA5E9', iconName: 'phone', isCustom: false, orderIndex: 0 },
  interview: { label: 'Intervju', color: '#8B5CF6', iconName: 'calendar', isCustom: false, orderIndex: 1 },
  offer: { label: 'Erbjudande', color: '#F59E0B', iconName: 'gift', isCustom: false, orderIndex: 2 },
  hired: { label: 'Anställd', color: '#10B981', iconName: 'star', isCustom: false, orderIndex: 3 },
};

interface DbStageSetting {
  id: string;
  user_id: string;
  stage_key: string;
  custom_label: string | null;
  color: string | null;
  icon_name: string | null;
  is_custom: boolean;
  order_index: number;
}

/**
 * Hook to fetch a colleague's stage settings.
 * Used when viewing another team member's candidate list.
 */
export function useColleagueStageSettings(colleagueId: string | null) {
  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ['colleague-stage-settings', colleagueId],
    queryFn: async () => {
      if (!colleagueId) return [];
      
      const { data, error } = await supabase
        .from('user_stage_settings')
        .select('*')
        .eq('user_id', colleagueId)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return (data || []) as DbStageSetting[];
    },
    enabled: !!colleagueId,
    staleTime: 5 * 60 * 1000,
  });

  // Get deleted default stages (marked with __DELETED__)
  const deletedDefaultStages = new Set(
    (dbSettings || [])
      .filter(s => s.custom_label === '__DELETED__' && !s.is_custom)
      .map(s => s.stage_key)
  );

  // Get all stage keys in order (default + custom), excluding deleted stages
  const stageOrder: string[] = (() => {
    const defaultKeys = [...DEFAULT_STAGE_KEYS].filter(k => !deletedDefaultStages.has(k));
    const customKeys = (dbSettings || [])
      .filter(s => s.is_custom)
      .sort((a, b) => a.order_index - b.order_index)
      .map(s => s.stage_key);
    
    // Insert custom stages at their order positions
    const allStages: string[] = [];
    let customIdx = 0;
    
    for (let i = 0; i < defaultKeys.length + customKeys.length; i++) {
      const dbSetting = dbSettings?.find(s => s.order_index === i && s.is_custom);
      if (dbSetting?.is_custom) {
        allStages.push(dbSetting.stage_key);
        customIdx++;
      } else {
        const defaultIdx = i - customIdx;
        if (defaultIdx < defaultKeys.length) {
          allStages.push(defaultKeys[defaultIdx]);
        }
      }
    }
    
    // Fallback: if no custom ordering, just append custom stages after defaults
    if (allStages.length === 0) {
      return [...defaultKeys, ...customKeys];
    }
    
    // Make sure all stages are included
    const allKeys = new Set([...defaultKeys, ...customKeys]);
    allStages.forEach(k => allKeys.delete(k));
    return [...allStages, ...Array.from(allKeys)];
  })();

  // Merge DB settings with defaults (excluding deleted stages)
  const stageConfig: Record<string, StageSettings> = (() => {
    const config: Record<string, StageSettings> = {};
    
    // Add default stages (not deleted)
    Object.keys(DEFAULT_STAGES).forEach((key, idx) => {
      if (deletedDefaultStages.has(key)) return; // Skip deleted stages
      
      const dbSetting = dbSettings?.find(s => s.stage_key === key && s.custom_label !== '__DELETED__');
      const defaultConfig = DEFAULT_STAGES[key];
      
      config[key] = {
        label: dbSetting?.custom_label || defaultConfig.label,
        color: dbSetting?.color || defaultConfig.color,
        iconName: dbSetting?.icon_name || defaultConfig.iconName,
        isCustom: false,
        orderIndex: dbSetting?.order_index ?? idx,
      };
    });
    
    // Add custom stages
    (dbSettings || [])
      .filter(s => s.is_custom)
      .forEach(s => {
        config[s.stage_key] = {
          label: s.custom_label || s.stage_key,
          color: s.color || '#6366F1',
          iconName: s.icon_name || 'flag',
          isCustom: true,
          orderIndex: s.order_index,
        };
      });
    
    return config;
  })();

  return {
    stageConfig,
    stageOrder,
    isLoading,
  };
}

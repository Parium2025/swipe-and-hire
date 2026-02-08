import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Phone, Calendar, Gift, Star, UserCheck, MessageCircle, 
  Clock, CheckCircle, Award, Heart, ThumbsUp, Briefcase,
  Users, Target, Zap, Mail, FileText, Smile, Flag, Trophy
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type CandidateStage = string;

export interface StageSettings {
  label: string;
  color: string;
  iconName: string;
  isCustom: boolean;
  orderIndex: number;
}

// Default settings for built-in stages
const DEFAULT_STAGES: Record<string, StageSettings> = {
  to_contact: { label: 'Att kontakta', color: '#0EA5E9', iconName: 'phone', isCustom: false, orderIndex: 0 },
  interview: { label: 'Intervju', color: '#8B5CF6', iconName: 'calendar', isCustom: false, orderIndex: 1 },
  offer: { label: 'Erbjudande', color: '#F59E0B', iconName: 'gift', isCustom: false, orderIndex: 2 },
  hired: { label: 'Anställd', color: '#10B981', iconName: 'star', isCustom: false, orderIndex: 3 },
};

export const DEFAULT_STAGE_KEYS = ['to_contact', 'interview', 'offer', 'hired'] as const;

// Available icons for selection
export const AVAILABLE_ICONS: { name: string; Icon: LucideIcon; label: string }[] = [
  { name: 'phone', Icon: Phone, label: 'Telefon' },
  { name: 'calendar', Icon: Calendar, label: 'Kalender' },
  { name: 'gift', Icon: Gift, label: 'Present' },
  { name: 'star', Icon: Star, label: 'Stjärna' },
  { name: 'user-check', Icon: UserCheck, label: 'Godkänd' },
  { name: 'message-circle', Icon: MessageCircle, label: 'Meddelande' },
  { name: 'clock', Icon: Clock, label: 'Klocka' },
  { name: 'check-circle', Icon: CheckCircle, label: 'Check' },
  { name: 'award', Icon: Award, label: 'Utmärkelse' },
  { name: 'heart', Icon: Heart, label: 'Hjärta' },
  { name: 'thumbs-up', Icon: ThumbsUp, label: 'Tumme upp' },
  { name: 'briefcase', Icon: Briefcase, label: 'Portfölj' },
  { name: 'users', Icon: Users, label: 'Användare' },
  { name: 'target', Icon: Target, label: 'Mål' },
  { name: 'zap', Icon: Zap, label: 'Blixt' },
  { name: 'mail', Icon: Mail, label: 'Mail' },
  { name: 'file-text', Icon: FileText, label: 'Dokument' },
  { name: 'smile', Icon: Smile, label: 'Leende' },
  { name: 'flag', Icon: Flag, label: 'Flagga' },
  { name: 'trophy', Icon: Trophy, label: 'Trofé' },
];

// Available colors for selection
export const AVAILABLE_COLORS = [
  { value: '#0EA5E9', label: 'Blå' },
  { value: '#8B5CF6', label: 'Lila' },
  { value: '#F59E0B', label: 'Orange' },
  { value: '#10B981', label: 'Grön' },
  { value: '#EF4444', label: 'Röd' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#6366F1', label: 'Indigo' },
  { value: '#14B8A6', label: 'Turkos' },
  { value: '#84CC16', label: 'Lime' },
  { value: '#F97316', label: 'Mörk orange' },
];

// Get icon component by name
export function getIconByName(iconName: string): LucideIcon {
  const found = AVAILABLE_ICONS.find(i => i.name === iconName);
  return found?.Icon || Phone;
}

interface DbStageSetting {
  id: string;
  user_id: string;
  stage_key: string;
  custom_label: string | null;
  color: string | null;
  icon_name: string | null;
  is_custom: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

// LocalStorage caching for instant display (no flash of default stages)
const STAGE_SETTINGS_CACHE_KEY = 'stage_settings_cache_';
// No expiry — realtime subscriptions keep data fresh

interface CachedStageSettings {
  settings: DbStageSetting[];
  timestamp: number;
}

function readCachedSettings(userId: string): DbStageSetting[] | null {
  try {
    const key = STAGE_SETTINGS_CACHE_KEY + userId;
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const cached: CachedStageSettings = JSON.parse(raw);
    // No expiry — realtime subscriptions keep data fresh
    return cached.settings;
  } catch (parseError) {
    console.warn('Failed to parse cached stage settings:', parseError);
    return null;
  }
}

function writeCachedSettings(userId: string, settings: DbStageSetting[]): void {
  try {
    const key = STAGE_SETTINGS_CACHE_KEY + userId;
    const cached: CachedStageSettings = {
      settings,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(cached));
  } catch (cacheError) {
    console.warn('Failed to cache stage settings:', cacheError);
  }
}

export function useStageSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Check if we have cached data BEFORE the query runs
  const hasCachedData = user ? readCachedSettings(user.id) !== null : false;

  const { data: dbSettings, isLoading: queryLoading } = useQuery({
    queryKey: ['stage-settings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_stage_settings')
        .select('*')
        .eq('user_id', user.id)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      const settings = (data || []) as DbStageSetting[];
      
      // Cache for instant display on next visit
      writeCachedSettings(user.id, settings);
      
      return settings;
    },
    enabled: !!user,
    staleTime: Infinity,
    // Use cached data as initial data for instant display
    initialData: () => {
      if (!user) return undefined;
      const cached = readCachedSettings(user.id);
      return cached ?? undefined;
    },
    // If we have cached data, don't show loading state initially
    initialDataUpdatedAt: () => {
      if (!user) return undefined;
      const cached = readCachedSettings(user.id);
      return cached ? Date.now() - 1000 : undefined; // Trigger background refetch
    },
  });

  // 📡 REALTIME: Prenumerera på stage settings-ändringar
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`stage-settings-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_stage_settings',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['stage-settings', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  // CRITICAL: Only show loading if we DON'T have cached data
  // This prevents the "default stages flash" when cached data exists
  const isLoading = queryLoading && !hasCachedData;

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

  const updateStageSetting = useMutation({
    mutationFn: async ({
      stageKey,
      label,
      color,
      iconName,
    }: {
      stageKey: string;
      label?: string;
      color?: string;
      iconName?: string;
    }) => {
      if (!navigator.onLine) throw new Error('Du är offline');
      if (!user) throw new Error('Not authenticated');

      const existingSetting = dbSettings?.find(s => s.stage_key === stageKey);
      
      if (existingSetting) {
        const { error } = await supabase
          .from('user_stage_settings')
          .update({
            custom_label: label ?? existingSetting.custom_label,
            color: color ?? existingSetting.color,
            icon_name: iconName ?? existingSetting.icon_name,
          })
          .eq('id', existingSetting.id);
        
        if (error) throw error;
      } else {
        const defaultConfig = DEFAULT_STAGES[stageKey];
        const { error } = await supabase
          .from('user_stage_settings')
          .insert({
            user_id: user.id,
            stage_key: stageKey,
            custom_label: label || null,
            color: color || defaultConfig?.color || null,
            icon_name: iconName || defaultConfig?.iconName || null,
            is_custom: false,
            order_index: defaultConfig?.orderIndex ?? 0,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-settings', user?.id] });
    },
  });

  const createCustomStage = useMutation({
    mutationFn: async ({
      label,
      color,
      iconName,
    }: {
      label: string;
      color: string;
      iconName: string;
    }) => {
      if (!navigator.onLine) throw new Error('Du är offline');
      if (!user) throw new Error('Not authenticated');

      // Generate unique stage key
      const stageKey = `custom_${Date.now()}`;
      
      // Get next order index
      const maxOrderIndex = Math.max(
        ...Object.values(stageConfig).map(s => s.orderIndex),
        DEFAULT_STAGE_KEYS.length - 1
      );

      const { error } = await supabase
        .from('user_stage_settings')
        .insert({
          user_id: user.id,
          stage_key: stageKey,
          custom_label: label,
          color: color,
          icon_name: iconName,
          is_custom: true,
          order_index: maxOrderIndex + 1,
        });
      
      if (error) throw error;
      return stageKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-settings', user?.id] });
    },
  });

  const deleteCustomStage = useMutation({
    mutationFn: async (stageKey: string) => {
      if (!navigator.onLine) throw new Error('Du är offline');
      if (!user) throw new Error('Not authenticated');

      // Verify it's a custom stage
      const setting = dbSettings?.find(s => s.stage_key === stageKey && s.is_custom);
      if (!setting) throw new Error('Cannot delete default stages');

      const { error } = await supabase
        .from('user_stage_settings')
        .delete()
        .eq('id', setting.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-settings', user?.id] });
    },
  });

  // Delete any stage (custom or default) - for when stage is empty
  const deleteStage = useMutation({
    mutationFn: async (stageKey: string) => {
      if (!navigator.onLine) throw new Error('Du är offline');
      if (!user) throw new Error('Not authenticated');

      const isDefault = DEFAULT_STAGE_KEYS.includes(stageKey as any);
      
      if (isDefault) {
        // For default stages, we mark them as "deleted" by inserting a special setting
        // We'll store a flag that indicates this stage should be hidden
        const existingSetting = dbSettings?.find(s => s.stage_key === stageKey);
        
        if (existingSetting) {
          // Delete the setting to mark it as removed
          const { error } = await supabase
            .from('user_stage_settings')
            .delete()
            .eq('id', existingSetting.id);
          if (error) throw error;
        }
        
        // Insert a marker setting to indicate this default stage is deleted
        const { error } = await supabase
          .from('user_stage_settings')
          .insert({
            user_id: user.id,
            stage_key: stageKey,
            custom_label: '__DELETED__',
            color: null,
            icon_name: null,
            is_custom: false,
            order_index: -1, // Special marker
          });
        
        if (error) throw error;
      } else {
        // For custom stages, just delete
        const setting = dbSettings?.find(s => s.stage_key === stageKey && s.is_custom);
        if (!setting) throw new Error('Stage not found');

        const { error } = await supabase
          .from('user_stage_settings')
          .delete()
          .eq('id', setting.id);
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-settings', user?.id] });
    },
  });

  // Restore a deleted default stage
  const restoreDefaultStage = useMutation({
    mutationFn: async (stageKey: string) => {
      if (!user) throw new Error('Not authenticated');
      
      // Remove the deleted marker
      const { error } = await supabase
        .from('user_stage_settings')
        .delete()
        .eq('user_id', user.id)
        .eq('stage_key', stageKey)
        .eq('custom_label', '__DELETED__');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-settings', user?.id] });
    },
  });

  const resetStageSetting = useMutation({
    mutationFn: async (stageKey: string) => {
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('user_stage_settings')
        .delete()
        .eq('user_id', user.id)
        .eq('stage_key', stageKey);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-settings', user?.id] });
    },
  });

  return {
    stageConfig,
    stageOrder,
    isLoading,
    updateStageSetting,
    createCustomStage,
    deleteCustomStage,
    deleteStage,
    restoreDefaultStage,
    resetStageSetting,
    getDefaultConfig: (stageKey: string) => DEFAULT_STAGES[stageKey],
    isDefaultStage: (stageKey: string) => DEFAULT_STAGE_KEYS.includes(stageKey as any),
    deletedDefaultStages,
  };
}

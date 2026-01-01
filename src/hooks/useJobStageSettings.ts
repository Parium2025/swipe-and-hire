import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Phone, Calendar, Gift, Star, Inbox, Eye,
  Clock, CheckCircle, Award, Heart, ThumbsUp, Briefcase,
  Users, Target, Zap, Mail, FileText, Smile, Flag, Trophy, PartyPopper
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type JobStage = string;

export interface JobStageSettings {
  label: string;
  color: string;
  iconName: string;
  isCustom: boolean;
  orderIndex: number;
}

// Default settings for job application stages (matching job_applications.status)
const DEFAULT_JOB_STAGES: Record<string, JobStageSettings> = {
  pending: { label: 'Inkorg', color: '#EAB308', iconName: 'inbox', isCustom: false, orderIndex: 0 },
  reviewing: { label: 'Granskar', color: '#3B82F6', iconName: 'eye', isCustom: false, orderIndex: 1 },
  interview: { label: 'Intervju', color: '#8B5CF6', iconName: 'calendar', isCustom: false, orderIndex: 2 },
  offered: { label: 'Erbjuden', color: '#22C55E', iconName: 'gift', isCustom: false, orderIndex: 3 },
  hired: { label: 'Anställd', color: '#10B981', iconName: 'party-popper', isCustom: false, orderIndex: 4 },
};

export const DEFAULT_JOB_STAGE_KEYS = ['pending', 'reviewing', 'interview', 'offered', 'hired'] as const;

// Available icons for selection
export const JOB_STAGE_ICONS: { name: string; Icon: LucideIcon; label: string }[] = [
  { name: 'inbox', Icon: Inbox, label: 'Inkorg' },
  { name: 'eye', Icon: Eye, label: 'Ögon' },
  { name: 'phone', Icon: Phone, label: 'Telefon' },
  { name: 'calendar', Icon: Calendar, label: 'Kalender' },
  { name: 'gift', Icon: Gift, label: 'Present' },
  { name: 'star', Icon: Star, label: 'Stjärna' },
  { name: 'party-popper', Icon: PartyPopper, label: 'Fest' },
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

// Get icon component by name
export function getJobStageIconByName(iconName: string): LucideIcon {
  const found = JOB_STAGE_ICONS.find(i => i.name === iconName);
  return found?.Icon || Inbox;
}

interface DbJobStageSetting {
  id: string;
  job_id: string;
  stage_key: string;
  custom_label: string | null;
  color: string | null;
  icon_name: string | null;
  is_custom: boolean;
  order_index: number;
}

export function useJobStageSettings(jobId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch stage settings for this job
  const { data: dbSettings = [], isLoading } = useQuery({
    queryKey: ['job-stage-settings', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('job_stage_settings')
        .select('*')
        .eq('job_id', jobId)
        .order('order_index');
      
      if (error) throw error;
      return (data || []) as DbJobStageSetting[];
    },
    enabled: !!user && !!jobId,
  });

  // Merge DB settings with defaults
  const stageSettings: Record<string, JobStageSettings> = {};
  const orderedStages: string[] = [];

  // Start with defaults
  DEFAULT_JOB_STAGE_KEYS.forEach((key, index) => {
    stageSettings[key] = { ...DEFAULT_JOB_STAGES[key], orderIndex: index };
  });

  // Apply DB overrides
  if (dbSettings.length > 0) {
    // Clear and rebuild from DB
    Object.keys(stageSettings).forEach(key => delete stageSettings[key]);
    
    dbSettings.forEach(setting => {
      const defaultSetting = DEFAULT_JOB_STAGES[setting.stage_key];
      stageSettings[setting.stage_key] = {
        label: setting.custom_label || defaultSetting?.label || setting.stage_key,
        color: setting.color || defaultSetting?.color || '#0EA5E9',
        iconName: setting.icon_name || defaultSetting?.iconName || 'inbox',
        isCustom: setting.is_custom,
        orderIndex: setting.order_index,
      };
    });
  }

  // Build ordered stages array
  const sortedEntries = Object.entries(stageSettings).sort((a, b) => a[1].orderIndex - b[1].orderIndex);
  sortedEntries.forEach(([key]) => orderedStages.push(key));

  // Update stage setting
  const updateStageMutation = useMutation({
    mutationFn: async ({ 
      stageKey, 
      updates 
    }: { 
      stageKey: string; 
      updates: Partial<{ label: string; color: string; iconName: string }> 
    }) => {
      if (!jobId) throw new Error('No job ID');

      const existing = dbSettings.find(s => s.stage_key === stageKey);
      
      if (existing) {
        const { error } = await supabase
          .from('job_stage_settings')
          .update({
            custom_label: updates.label,
            color: updates.color,
            icon_name: updates.iconName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        
        if (error) throw error;
      } else {
        // Create new setting
        const defaultSetting = DEFAULT_JOB_STAGES[stageKey] || {
          label: stageKey,
          color: '#0EA5E9',
          iconName: 'inbox',
          orderIndex: Object.keys(stageSettings).length,
        };

        const { error } = await supabase
          .from('job_stage_settings')
          .insert({
            job_id: jobId,
            stage_key: stageKey,
            custom_label: updates.label || defaultSetting.label,
            color: updates.color || defaultSetting.color,
            icon_name: updates.iconName || defaultSetting.iconName,
            is_custom: !DEFAULT_JOB_STAGE_KEYS.includes(stageKey as any),
            order_index: defaultSetting.orderIndex,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-stage-settings', jobId] });
    },
  });

  // Create new stage
  const createStageMutation = useMutation({
    mutationFn: async ({ 
      label, 
      color, 
      iconName 
    }: { 
      label: string; 
      color: string; 
      iconName: string; 
    }) => {
      if (!jobId) throw new Error('No job ID');

      // Generate unique stage key
      const stageKey = `custom_${Date.now()}`;
      const newOrderIndex = Object.keys(stageSettings).length;

      // First, ensure all default stages exist in DB if not already
      const existingKeys = dbSettings.map(s => s.stage_key);
      const missingDefaults = DEFAULT_JOB_STAGE_KEYS.filter(key => !existingKeys.includes(key));

      if (missingDefaults.length > 0) {
        const defaultInserts = missingDefaults.map((key, index) => ({
          job_id: jobId,
          stage_key: key,
          custom_label: DEFAULT_JOB_STAGES[key].label,
          color: DEFAULT_JOB_STAGES[key].color,
          icon_name: DEFAULT_JOB_STAGES[key].iconName,
          is_custom: false,
          order_index: DEFAULT_JOB_STAGES[key].orderIndex,
        }));

        const { error: defaultError } = await supabase
          .from('job_stage_settings')
          .insert(defaultInserts);
        
        if (defaultError) throw defaultError;
      }

      // Insert new custom stage
      const { error } = await supabase
        .from('job_stage_settings')
        .insert({
          job_id: jobId,
          stage_key: stageKey,
          custom_label: label,
          color: color,
          icon_name: iconName,
          is_custom: true,
          order_index: newOrderIndex,
        });
      
      if (error) throw error;
      return stageKey;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-stage-settings', jobId] });
    },
  });

  // Delete stage
  const deleteStageMutation = useMutation({
    mutationFn: async (stageKey: string) => {
      if (!jobId) throw new Error('No job ID');

      const { error } = await supabase
        .from('job_stage_settings')
        .delete()
        .eq('job_id', jobId)
        .eq('stage_key', stageKey);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-stage-settings', jobId] });
    },
  });

  return {
    stageSettings,
    orderedStages,
    isLoading,
    updateStage: updateStageMutation.mutate,
    createStage: createStageMutation.mutateAsync,
    deleteStage: deleteStageMutation.mutate,
    isUpdating: updateStageMutation.isPending,
    isCreating: createStageMutation.isPending,
    isDeleting: deleteStageMutation.isPending,
  };
}

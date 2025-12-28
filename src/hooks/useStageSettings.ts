import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Phone, Calendar, Gift, Star, UserCheck, MessageCircle, 
  Clock, CheckCircle, Award, Heart, ThumbsUp, Briefcase,
  Users, Target, Zap, Mail, FileText, Smile, Flag, Trophy
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type CandidateStage = 'to_contact' | 'interview' | 'offer' | 'hired';

export interface StageSettings {
  label: string;
  color: string;
  iconName: string;
}

// Default settings for each stage
const DEFAULT_STAGE_CONFIG: Record<CandidateStage, StageSettings> = {
  to_contact: { label: 'Att kontakta', color: '#0EA5E9', iconName: 'phone' },
  interview: { label: 'Intervju', color: '#8B5CF6', iconName: 'calendar' },
  offer: { label: 'Erbjudande', color: '#F59E0B', iconName: 'gift' },
  hired: { label: 'Anställd', color: '#10B981', iconName: 'star' },
};

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
  created_at: string;
  updated_at: string;
}

export function useStageSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: dbSettings, isLoading } = useQuery({
    queryKey: ['stage-settings', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('user_stage_settings')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return (data || []) as DbStageSetting[];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Merge DB settings with defaults
  const stageConfig: Record<CandidateStage, StageSettings> = Object.keys(DEFAULT_STAGE_CONFIG).reduce(
    (acc, key) => {
      const stageKey = key as CandidateStage;
      const dbSetting = dbSettings?.find(s => s.stage_key === stageKey);
      const defaultConfig = DEFAULT_STAGE_CONFIG[stageKey];
      
      acc[stageKey] = {
        label: dbSetting?.custom_label || defaultConfig.label,
        color: dbSetting?.color || defaultConfig.color,
        iconName: dbSetting?.icon_name || defaultConfig.iconName,
      };
      
      return acc;
    },
    {} as Record<CandidateStage, StageSettings>
  );

  const updateStageSetting = useMutation({
    mutationFn: async ({
      stageKey,
      label,
      color,
      iconName,
    }: {
      stageKey: CandidateStage;
      label?: string;
      color?: string;
      iconName?: string;
    }) => {
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
        const { error } = await supabase
          .from('user_stage_settings')
          .insert({
            user_id: user.id,
            stage_key: stageKey,
            custom_label: label || null,
            color: color || null,
            icon_name: iconName || null,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stage-settings', user?.id] });
    },
  });

  const resetStageSetting = useMutation({
    mutationFn: async (stageKey: CandidateStage) => {
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
    isLoading,
    updateStageSetting,
    resetStageSetting,
    getDefaultConfig: (stageKey: CandidateStage) => DEFAULT_STAGE_CONFIG[stageKey],
  };
}

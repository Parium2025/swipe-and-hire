import type { Database } from '@/integrations/supabase/types';

export type OutreachChannel = Database['public']['Enums']['outreach_channel'];
export type OutreachTrigger = Database['public']['Enums']['outreach_trigger'];
export type OutreachRecipient = Database['public']['Enums']['outreach_recipient'];

export type OutreachTemplate = Database['public']['Tables']['outreach_templates']['Row'];
export type OutreachAutomation = Database['public']['Tables']['outreach_automations']['Row'];
export type OutreachDispatchLog = Database['public']['Tables']['outreach_dispatch_logs']['Row'];

export interface OutreachAutomationWithTemplate extends OutreachAutomation {
  template?: OutreachTemplate | null;
}

export interface OutreachVariableDefinition {
  key: string;
  label: string;
}

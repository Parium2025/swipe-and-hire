/**
 * Barrel re-export — all outreach utilities in one import path.
 *
 * The actual code lives in focused modules:
 *   outreachTypes.ts      — DB-derived type aliases & interfaces
 *   outreachConstants.ts   — label arrays & variable definitions
 *   outreachHelpers.ts     — rendering, formatting & label lookups
 *   outreachDefaults.ts    — seed data for templates & automations
 */

// Types & interfaces
export type {
  OutreachChannel,
  OutreachTrigger,
  OutreachRecipient,
  OutreachTemplate,
  OutreachAutomation,
  OutreachDispatchLog,
  OutreachAutomationWithTemplate,
  OutreachVariableDefinition,
} from '@/lib/outreachTypes';

// Constants
export {
  OUTREACH_VARIABLES,
  OUTREACH_CHANNEL_OPTIONS,
  OUTREACH_TRIGGER_OPTIONS,
  OUTREACH_RECIPIENT_OPTIONS,
} from '@/lib/outreachConstants';

// Helpers
export {
  getOutreachChannelLabel,
  getOutreachTriggerLabel,
  getOutreachRecipientLabel,
  getOutreachSubjectLabel,
  renderOutreachText,
  formatOutreachDate,
  formatOutreachTime,
} from '@/lib/outreachHelpers';

// Default seed data
export {
  DEFAULT_OUTREACH_TEMPLATES,
  DEFAULT_OUTREACH_AUTOMATIONS,
} from '@/lib/outreachDefaults';

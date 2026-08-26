/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { template as applicationConfirmation } from './application-confirmation.tsx'
import { template as interviewInvitation } from './interview-invitation.tsx'
import { template as jobExpiration } from './job-expiration.tsx'
import { template as jobClosedCandidate } from './job-closed-candidate.tsx'
import { template as supportTicketAlert } from './support-ticket-alert.tsx'
import { template as adminAlert } from './admin-alert.tsx'
import { template as accountConfirmation } from './account-confirmation.tsx'
import { template as employerAccountConfirmation } from './employer-account-confirmation.tsx'
import { template as passwordReset } from './password-reset.tsx'
import { template as outreachMessage } from './outreach-message.tsx'
import { template as accountInactivityWarning } from './account-inactivity-warning.tsx'
import { template as teamInvitation } from './team-invitation.tsx'

export interface TemplateEntry {
  component: (props: any) => React.ReactElement
  subject: string | ((data: any) => string)
  displayName?: string
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'application-confirmation': applicationConfirmation,
  'interview-invitation': interviewInvitation,
  'job-expiration': jobExpiration,
  'job-closed-candidate': jobClosedCandidate,
  'support-ticket-alert': supportTicketAlert,
  'admin-alert': adminAlert,
  'account-confirmation': accountConfirmation,
  'employer-account-confirmation': employerAccountConfirmation,
  'password-reset': passwordReset,
  'outreach-message': outreachMessage,
  'account-inactivity-warning': accountInactivityWarning,
  'team-invitation': teamInvitation,
}

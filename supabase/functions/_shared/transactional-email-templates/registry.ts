/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { template as applicationConfirmation } from './application-confirmation.tsx'
import { template as interviewInvitation } from './interview-invitation.tsx'
import { template as jobExpiration } from './job-expiration.tsx'
import { template as supportTicketAlert } from './support-ticket-alert.tsx'
import { template as adminAlert } from './admin-alert.tsx'

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
  'support-ticket-alert': supportTicketAlert,
  'admin-alert': adminAlert,
}

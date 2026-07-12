/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  ticket_id?: string
  category?: string
  subject?: string
  from_name?: string
  created_at?: string
  message?: string
}

const SupportTicketAlertEmail = ({
  ticket_id = '',
  category = '—',
  subject = 'Nytt supportärende',
  from_name = 'Okänd användare',
  created_at = '',
  message = '',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{`Nytt supportärende: ${subject}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>Parium · Support</Text>
        </Section>
        <Heading style={h1}>Nytt supportärende 📩</Heading>
        <Section style={metaCard}>
          <Text style={metaRow}><strong>Ämne:</strong> {subject}</Text>
          <Text style={metaRow}><strong>Kategori:</strong> {category}</Text>
          <Text style={metaRow}><strong>Från:</strong> {from_name}</Text>
          <Text style={metaRow}><strong>Skapad:</strong> {created_at}</Text>
          {ticket_id ? <Text style={{ ...metaRow, color: '#94a3b8', fontSize: '12px' }}>ID: {ticket_id}</Text> : null}
        </Section>
        <Hr style={hr} />
        <Text style={sectionLabel}>Meddelande</Text>
        <Section style={messageBox}>
          <Text style={{ ...messageText, whiteSpace: 'pre-line' as const }}>{message}</Text>
        </Section>
        <Text style={footer}>Logga in på admin-panelen för att svara på ärendet.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SupportTicketAlertEmail,
  subject: (data: Props) => `Nytt supportärende: ${data.subject || 'okänt'}`,
  displayName: 'Supportärende (admin-notis)',
  previewData: {
    ticket_id: '00000000-0000-0000-0000-000000000000',
    category: 'Teknik',
    subject: 'Kan inte ladda upp CV',
    from_name: 'Anna Andersson',
    created_at: '2026-07-12 14:32',
    message: 'Hej, jag försöker ladda upp mitt CV men det händer inget…',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px' }
const brand = { fontSize: '20px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#001F3D', margin: '0 0 20px', letterSpacing: '-0.3px' }
const metaCard = { backgroundColor: '#F0F9FF', borderLeft: '4px solid #001F3D', padding: '14px 20px', borderRadius: '0 8px 8px 0', margin: '0 0 20px' }
const metaRow = { margin: '3px 0', fontSize: '14px', color: '#111827', lineHeight: '1.6' }
const sectionLabel = { fontSize: '13px', color: '#6B7280', fontWeight: 600 as const, margin: '20px 0 8px' }
const messageBox = { backgroundColor: '#F8FAFC', padding: '16px 18px', borderRadius: '8px', border: '1px solid #E2E8F0' }
const messageText = { margin: 0, fontSize: '14px', color: '#334155', lineHeight: '1.6' }
const hr = { borderColor: '#e2e8f0', margin: '8px 0 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', paddingTop: '20px', textAlign: 'center' as const }

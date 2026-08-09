/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Img, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  body?: string
  company_name?: string
  subject?: string
  tracking_url?: string
}

const OutreachMessageEmail = ({
  body = '',
  company_name = 'företaget',
  subject,
  tracking_url,
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{subject || `Meddelande från ${company_name}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={card}>
          {/* Bibehåller radbrytningar från arbetsgivarens meddelande */}
          <Text style={messageText}>{body}</Text>
        </Section>
        <Text style={footer}>Skickat av {company_name} via Parium</Text>
        <Text style={noReply}>
          Svara inte på detta mejl. Det är skickat från en automatisk utgående adress.
        </Text>
        {tracking_url ? (
          <Img src={tracking_url} alt="" width="1" height="1" style={pixel} />
        ) : null}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: OutreachMessageEmail,
  subject: (data: Props) => data.subject || `Meddelande från ${data.company_name || 'företaget'}`,
  displayName: 'Mejl från arbetsgivare (arbetsgivarens egen text)',
  previewData: {
    body: 'Hej Anna,\n\nTack för din ansökan till Butikssäljare hos Parium AB. Vi har tagit emot din ansökan och återkommer så snart vi kan.\n\nVänliga hälsningar,\nParium AB',
    company_name: 'Parium AB',
    subject: 'Vi har tagit emot din ansökan till Butikssäljare',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '600px' }
const card = { backgroundColor: '#ffffff', padding: '28px 32px', borderRadius: '8px', border: '1px solid #e2e8f0' }
const messageText = { margin: 0, fontSize: '15px', lineHeight: '1.7', color: '#334155', whiteSpace: 'pre-line' as const }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '20px 0 0', textAlign: 'center' as const }
const noReply = { fontSize: '11px', color: '#6B7280', margin: '8px 0 0', textAlign: 'center' as const, fontStyle: 'italic' as const }
const pixel = { display: 'block', width: '1px', height: '1px', opacity: 0, border: 0, overflow: 'hidden' as const }

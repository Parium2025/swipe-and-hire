/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Field {
  label: string
  value: string
}

interface Props {
  alert_title?: string
  alert_emoji?: string
  severity?: 'info' | 'warning' | 'critical'
  timestamp?: string
  summary?: string
  fields?: Field[]
  error_message?: string
}

const severityAccent = (s: Props['severity']) => {
  if (s === 'critical') return '#DC2626'
  if (s === 'warning') return '#D97706'
  return '#001F3D'
}

const AdminAlertEmail = ({
  alert_title = 'Systemvarning',
  alert_emoji = '⚠️',
  severity = 'warning',
  timestamp = '',
  summary = '',
  fields = [],
  error_message = '',
}: Props) => {
  const accent = severityAccent(severity)
  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>{`${alert_emoji} ${alert_title}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandSection}>
            <Text style={brand}>Parium · System</Text>
          </Section>
          <Heading style={{ ...h1, color: accent }}>
            {alert_emoji} {alert_title}
          </Heading>
          {timestamp ? <Text style={smallMeta}>{timestamp}</Text> : null}
          {summary ? <Text style={text}>{summary}</Text> : null}

          {fields.length > 0 ? (
            <Section style={{ ...card, borderLeftColor: accent }}>
              {fields.map((f, i) => (
                <Text key={i} style={row}><strong>{f.label}:</strong> {f.value}</Text>
              ))}
            </Section>
          ) : null}

          {error_message ? (
            <>
              <Text style={sectionLabel}>Felmeddelande</Text>
              <Section style={errorBox}>
                <Text style={{ ...errorText, whiteSpace: 'pre-line' as const }}>{error_message}</Text>
              </Section>
            </>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>Parium · Automatisk systemvarning</Text>
          <Text style={noReply}>
            Svara inte på detta mejl — det är skickat från en automatisk utgående adress.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: AdminAlertEmail,
  subject: (data: Props) => `${data.alert_emoji || '⚠️'} ${data.alert_title || 'Systemvarning'}`,
  displayName: 'Adminvarning',
  previewData: {
    alert_title: 'RSS-källa nere: Arbetsförmedlingen',
    alert_emoji: '⚠️',
    severity: 'warning',
    timestamp: '2026-07-12 14:32',
    summary: 'En RSS-källa har misslyckats 5 gånger i rad.',
    fields: [
      { label: 'Källa', value: 'Arbetsförmedlingen' },
      { label: 'Misslyckanden', value: '5' },
    ],
    error_message: 'Connection timeout after 30s',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 20px' }
const brand = { fontSize: '18px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const h1 = { fontSize: '22px', fontWeight: 700 as const, margin: '0 0 6px', letterSpacing: '-0.3px' }
const smallMeta = { fontSize: '12px', color: '#94a3b8', margin: '0 0 18px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 18px' }
const sectionLabel = { fontSize: '13px', color: '#6B7280', fontWeight: 600 as const, margin: '20px 0 8px' }
const card = { backgroundColor: '#F8FAFC', borderLeft: '4px solid #001F3D', padding: '14px 20px', borderRadius: '0 8px 8px 0', margin: '10px 0' }
const row = { margin: '3px 0', fontSize: '14px', color: '#111827', lineHeight: '1.6' }
const errorBox = { backgroundColor: '#FEF2F2', padding: '14px 18px', borderRadius: '8px', border: '1px solid #FECACA' }
const errorText = { margin: 0, fontSize: '13px', color: '#991B1B', lineHeight: '1.6', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0 8px' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '12px 0 0', textAlign: 'center' as const }
const noReply = { fontSize: '11px', color: '#6B7280', margin: '8px 0 0', textAlign: 'center' as const, fontStyle: 'italic' as const }

/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipient_name?: string
  company_name?: string
  job_title?: string
  date_str?: string
  time_str?: string
  duration_minutes?: number
  location_type?: 'video' | 'office'
  location_details?: string
  message?: string
  google_calendar_url?: string
  ics_url?: string
  maps_url?: string
  is_employer?: boolean
  accept_url?: string
  decline_url?: string
}

const InterviewInvitationEmail = ({
  recipient_name = 'där',
  company_name = 'företaget',
  job_title = 'tjänsten',
  date_str = '',
  time_str = '',
  duration_minutes = 30,
  location_type = 'video',
  location_details = '',
  message = '',
  ics_url = '',
  maps_url = '',
  is_employer = false,
  accept_url,
  decline_url,
}: Props) => {
  const locationLabel = location_type === 'video' ? 'Videointervju' : 'På plats'
  
  // Split location_details into address and instructions (separated by \n\n)
  const parts = (location_details || '').split('\n\n')
  const address = parts[0] || ''
  const instructions = parts.slice(1).join('\n\n').trim()
  
  const isVideoLink = location_type === 'video' && address.startsWith('http')
  const greeting = is_employer
    ? `Hej ${recipient_name}, du har bokat en intervju för ${job_title}.`
    : `Hej ${recipient_name}, du är kallad till intervju för ${job_title}.`
  const messageLabel = is_employer
    ? 'Ditt meddelande till kandidaten:'
    : `Meddelande från ${company_name} inför intervjun:`

  return (
    <Html lang="sv" dir="ltr">
      <Head>
      <meta charSet="utf-8" />
      <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
    </Head>
      <Preview>{`Intervju: ${job_title} – ${date_str} ${time_str}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandSection}>
            <Text style={brand}>{company_name}</Text>
            <Section style={accentBar} />
          </Section>
          <Text style={subjectLine}>Intervjukallelse · {job_title}</Text>
          <Section style={card}>
            <Text style={text}>{greeting}</Text>
            <Text style={row}><strong>Datum:</strong> {date_str}</Text>
            <Text style={row}><strong>Tid:</strong> {time_str} · {duration_minutes} min</Text>
            
            {/* Address Row */}
            <Text style={row}>
              <strong>{locationLabel}:</strong>{' '}
              {isVideoLink ? (
                <Link href={address} style={link}>{address}</Link>
              ) : maps_url ? (
                <Link href={maps_url} style={link}>{address}</Link>
              ) : (
                address || 'Information meddelas'
              )}
            </Text>

            {/* Separate Instructions Row */}
            {location_type === 'office' && instructions ? (
              <Text style={{ ...row, marginTop: '8px' }}>
                <strong>Instruktioner:</strong>{' '}
                <span style={{ whiteSpace: 'pre-line' }}>{instructions}</span>
              </Text>
            ) : null}

            {message ? (
              <Section style={messageSection}>
              <Text style={smallLabel}>{messageLabel}</Text>
              <Text style={{ ...text, whiteSpace: 'pre-line' as const }}>{message}</Text>
              </Section>
            ) : null}
          </Section>

          {!is_employer && accept_url && decline_url ? (
            <Section style={answerSection}>
              <Text style={answerLabel}>Kan du komma?</Text>
              <Button href={accept_url} style={acceptButton}>Ja, jag kommer</Button>
              <Button href={decline_url} style={declineButton}>Nej, jag kan inte</Button>
              <Text style={answerHint}>Ditt svar skickas direkt till {company_name}. Du kan också svara inne i Parium.</Text>
            </Section>
          ) : null}

          {isVideoLink ? (
            <Section style={{ textAlign: 'center' as const, margin: '28px 0 20px' }}>
              <Button style={button} href={address}>Anslut till videomötet</Button>
            </Section>
          ) : null}

          {ics_url ? (
            <Section style={{ textAlign: 'center' as const, margin: '20px 0 8px' }}>
              <Button style={secondaryButton} href={ics_url}>📅 Lägg till i kalender</Button>
            </Section>
          ) : null}


          <Text style={footer}>Skickat av {company_name} via Parium</Text>
          <Text style={noReply}>
            Svara inte på detta mejl — det är skickat från en automatisk utgående adress.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}


export const template = {
  component: InterviewInvitationEmail,
  subject: (data: Props) =>
    data.is_employer
      ? `Intervju bokad: ${data.job_title || 'tjänsten'}`
      : `Intervjukallelse: ${data.job_title || 'tjänsten'} – ${data.company_name || ''}`,
  displayName: 'Intervjukallelse',
  previewData: {
    recipient_name: 'Anna',
    company_name: 'Parium AB',
    job_title: 'Frontend-utvecklare',
    date_str: 'måndag 15 juli 2026',
    time_str: '14:00',
    duration_minutes: 45,
    location_type: 'video',
    location_details: 'https://meet.google.com/abc-defg-hij',
    message: 'Vi ser fram emot att träffa dig!',
    google_calendar_url: 'https://calendar.google.com/',
    is_employer: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px' }
const brand = { fontSize: '22px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const accentBar = { width: '44px', height: '3px', backgroundColor: '#1E4B8A', borderRadius: '2px', margin: '10px 0 0' }
const subjectLine = { fontSize: '15px', fontWeight: 600 as const, color: '#1E4B8A', margin: '14px 0 20px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 12px' }
const smallLabel = { fontSize: '13px', color: '#6B7280', fontWeight: 600 as const, margin: '0 0 8px' }
const card = { backgroundColor: '#f8fafc', padding: '28px 32px', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '0' }
const messageSection = { borderTop: '1px solid #e2e8f0', margin: '20px 0 0', padding: '20px 0 0' }
const row = { margin: '4px 0', fontSize: '14px', color: '#111827', lineHeight: '1.6' }
const link = { color: '#001F3D', textDecoration: 'underline', wordBreak: 'break-all' as const }
const answerSection = { margin: '24px 0 0', textAlign: 'center' as const }
const answerLabel = { fontSize: '14px', fontWeight: 600 as const, color: '#001F3D', margin: '0 0 14px' }
const acceptButton = { backgroundColor: '#1E4B8A', color: '#ffffff', fontSize: '15px', fontWeight: 600 as const, padding: '12px 24px', borderRadius: '999px', textDecoration: 'none', display: 'inline-block', margin: '0 6px 10px' }
const declineButton = { backgroundColor: '#ffffff', color: '#1E4B8A', fontSize: '15px', fontWeight: 600 as const, padding: '11px 23px', borderRadius: '999px', border: '1px solid #cbd5e1', textDecoration: 'none', display: 'inline-block', margin: '0 6px 10px' }
const answerHint = { fontSize: '12px', color: '#94a3b8', margin: '6px 0 0' }
const button = {
  backgroundColor: '#001F3D',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '10px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const secondaryButton = {
  backgroundColor: '#ffffff',
  color: '#001F3D',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '10px',
  padding: '13px 26px',
  textDecoration: 'none',
  display: 'inline-block',
  border: '1.5px solid #001F3D',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', paddingTop: '20px', textAlign: 'center' as const }
const noReply = { fontSize: '11px', color: '#6B7280', margin: '8px 0 0', textAlign: 'center' as const, fontStyle: 'italic' as const }

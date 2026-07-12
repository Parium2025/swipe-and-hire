/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text, Hr,
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
  google_calendar_url = '#',
  ics_url = '',
  maps_url = '',
  is_employer = false,
}: Props) => {
  const locationLabel = location_type === 'video' ? 'Videointervju' : 'På plats'
  const isVideoLink = location_type === 'video' && location_details.startsWith('http')
  const greeting = is_employer
    ? `Hej ${recipient_name}, du har bokat en intervju för ${job_title}.`
    : `Hej ${recipient_name}, du är kallad till intervju för ${job_title}.`
  const messageLabel = is_employer
    ? 'Ditt meddelande till kandidaten:'
    : `Meddelande från ${company_name} inför intervjun:`

  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>{`Intervju: ${job_title} – ${date_str} ${time_str}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandSection}>
            <Text style={brand}>Parium</Text>
          </Section>
          <Heading style={h1}>Intervjukallelse 📅</Heading>
          <Text style={text}>{greeting}</Text>

          <Section style={card}>
            <Text style={row}><strong>Datum:</strong> {date_str}</Text>
            <Text style={row}><strong>Tid:</strong> {time_str} · {duration_minutes} min</Text>
            <Text style={row}>
              <strong>{locationLabel}:</strong>{' '}
              {isVideoLink ? (
                <Link href={location_details} style={link}>{location_details}</Link>
              ) : maps_url ? (
                <Link href={maps_url} style={link}>{location_details}</Link>
              ) : (
                location_details || 'Information meddelas'
              )}
            </Text>
          </Section>

          {message ? (
            <>
              <Text style={smallLabel}>{messageLabel}</Text>
              <Text style={{ ...text, whiteSpace: 'pre-line' as const }}>{message}</Text>
            </>
          ) : null}

          {isVideoLink ? (
            <Section style={{ textAlign: 'center' as const, margin: '28px 0 20px' }}>
              <Button style={button} href={location_details}>Anslut till videomötet</Button>
            </Section>
          ) : null}

          {ics_url ? (
            <Section style={{ textAlign: 'center' as const, margin: '20px 0 8px' }}>
              <Button style={secondaryButton} href={ics_url}>📅 Lägg till i kalender</Button>
            </Section>
          ) : null}

          <Section style={{ textAlign: 'center' as const, margin: '4px 0 8px' }}>
            <Link href={google_calendar_url} style={calendarLink}>Eller lägg till i Google Kalender</Link>
          </Section>

          <Hr style={hr} />
          <Text style={footer}>Parium AB · Stockholm</Text>
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
const brand = { fontSize: '20px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#001F3D', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 12px' }
const smallLabel = { fontSize: '13px', color: '#6B7280', fontWeight: 600 as const, margin: '16px 0 4px' }
const card = { backgroundColor: '#F0F9FF', borderLeft: '4px solid #001F3D', padding: '16px 20px', borderRadius: '0 8px 8px 0', margin: '20px 0' }
const row = { margin: '4px 0', fontSize: '14px', color: '#111827', lineHeight: '1.6' }
const link = { color: '#001F3D', textDecoration: 'underline', wordBreak: 'break-all' as const }
const calendarLink = { color: '#6B7280', textDecoration: 'underline', fontSize: '13px' }
const hr = { borderColor: '#e2e8f0', margin: '24px 0 8px' }
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
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', borderTop: '1px solid #e2e8f0', paddingTop: '20px', textAlign: 'center' as const }

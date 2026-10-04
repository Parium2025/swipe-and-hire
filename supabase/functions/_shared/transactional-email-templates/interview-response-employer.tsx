/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipient_name?: string
  company_name?: string
  candidate_name?: string
  job_title?: string
  date_str?: string
  time_str?: string
  accepted?: boolean
}

const InterviewResponseEmployerEmail = ({
  recipient_name = 'där',
  company_name = 'Parium',
  candidate_name = 'Kandidaten',
  job_title = 'tjänsten',
  date_str = '',
  time_str = '',
  accepted = true,
}: Props) => {
  const headline = accepted
    ? `${candidate_name} har tackat ja`
    : `${candidate_name} har tackat nej`

  return (
    <Html lang="sv" dir="ltr">
      <Head>
        <meta charSet="utf-8" />
        <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
      </Head>
      <Preview>{`${headline} – ${job_title}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={brandSection}>
            <Text style={brand}>{company_name}</Text>
            <Section style={accentBar} />
          </Section>
          <Text style={subjectLine}>Svar på intervjun · {job_title}</Text>
          <Section style={card}>
            <Text style={text}>Hej {recipient_name},</Text>
            <Text style={text}>
              {accepted
                ? `${candidate_name} har bekräftat intervjun för ${job_title}.`
                : `${candidate_name} kan tyvärr inte komma på intervjun för ${job_title}.`}
            </Text>
            {date_str ? <Text style={row}><strong>Datum:</strong> {date_str}</Text> : null}
            {time_str ? <Text style={row}><strong>Tid:</strong> {time_str}</Text> : null}
            <Text style={hint}>
              {accepted
                ? 'Mötet ligger kvar i din kalender och intervjun visas som bekräftad i Parium.'
                : 'Mötet ligger kvar i din kalender, men är markerat som nekat i Parium. Du kan boka om eller ta bort det.'}
            </Text>
          </Section>
          <Text style={footer}>Skickat av {company_name} via Parium</Text>
          <Text style={noReply}>Svara inte på detta mejl — det är skickat från en automatisk utgående adress.</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: InterviewResponseEmployerEmail,
  subject: (data: Props) =>
    data?.accepted === false
      ? `${data?.candidate_name ?? 'Kandidaten'} tackade nej till intervjun`
      : `${data?.candidate_name ?? 'Kandidaten'} tackade ja till intervjun`,
  displayName: 'Intervjusvar till arbetsgivare',
  previewData: {
    recipient_name: 'Anna',
    company_name: 'Parium AB',
    candidate_name: 'Johan Berg',
    job_title: 'Servicetekniker',
    date_str: 'måndag 28 september',
    time_str: '10:00',
    accepted: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px' }
const brand = { fontSize: '22px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const accentBar = { width: '44px', height: '3px', backgroundColor: '#1E4B8A', borderRadius: '2px', margin: '10px 0 0' }
const subjectLine = { fontSize: '15px', fontWeight: 600 as const, color: '#1E4B8A', margin: '14px 0 20px' }
const card = { backgroundColor: '#f8fafc', padding: '28px 32px', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '0' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 12px' }
const row = { margin: '4px 0', fontSize: '14px', color: '#111827', lineHeight: '1.6' }
const hint = { fontSize: '13px', lineHeight: '1.6', color: '#64748b', margin: '12px 0 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', paddingTop: '20px', textAlign: 'center' as const }
const noReply = { fontSize: '11px', color: '#6B7280', margin: '8px 0 0', textAlign: 'center' as const, fontStyle: 'italic' as const }

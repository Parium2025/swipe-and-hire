/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  recipient_name?: string
  candidate_name?: string
  job_title?: string
  date_str?: string
  time_str?: string
  accepted?: boolean
}

const InterviewResponseEmployerEmail = ({
  recipient_name = 'där',
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
            <Text style={brand}>Parium</Text>
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
    candidate_name: 'Johan Berg',
    job_title: 'Servicetekniker',
    date_str: 'måndag 28 september',
    time_str: '10:00',
    accepted: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '32px 24px' }
const brandSection = { marginBottom: '20px' }
const brand = { fontSize: '18px', fontWeight: 700, color: '#001F3D', margin: '0' }
const accentBar = { width: '44px', height: '3px', backgroundColor: '#1E4B8A', borderRadius: '2px', marginTop: '8px' }
const subjectLine = { fontSize: '13px', color: '#64748b', margin: '0 0 12px' }
const card = { border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px' }
const text = { fontSize: '15px', lineHeight: '1.7', color: '#334155', margin: '0 0 12px' }
const row = { fontSize: '15px', lineHeight: '1.7', color: '#334155', margin: '0 0 4px' }
const hint = { fontSize: '13px', lineHeight: '1.6', color: '#64748b', margin: '12px 0 0' }

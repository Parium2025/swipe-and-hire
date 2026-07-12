/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  applicant_first_name?: string
  job_title?: string
  company_name?: string
}

const ApplicationConfirmationEmail = ({
  applicant_first_name = 'där',
  job_title = 'tjänsten',
  company_name = 'företaget',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Din ansökan till {job_title} har mottagits</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>Parium</Text>
        </Section>
        <Heading style={h1}>Ansökan mottagen 🎉</Heading>
        <Text style={text}>Hej {applicant_first_name}!</Text>
        <Text style={text}>
          Din ansökan till <strong>{job_title}</strong> hos <strong>{company_name}</strong> har mottagits.
        </Text>
        <Section style={card}>
          <Text style={cardTitle}>{job_title}</Text>
          <Text style={cardSub}>{company_name}</Text>
        </Section>
        <Text style={text}>Arbetsgivaren kommer att granska din ansökan och återkoppla.</Text>
        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button style={button} href="https://parium.se/my-applications">Se mina ansökningar</Button>
        </Section>
        <Text style={{ ...text, textAlign: 'center' as const }}>Lycka till! 🍀</Text>
        <Text style={footer}>
          Parium AB · Stockholm<br />
          Du får detta mail för att du skickat en ansökan via{' '}
          <Link href="https://parium.se" style={link}>Parium</Link>.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ApplicationConfirmationEmail,
  subject: (data: Props) => `Ansökan mottagen – ${data.job_title || 'tjänsten'}`,
  displayName: 'Ansökningsbekräftelse',
  previewData: { applicant_first_name: 'Anna', job_title: 'Frontend-utvecklare', company_name: 'Parium AB' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px' }
const brand = { fontSize: '20px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#001F3D', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#F0F9FF', borderLeft: '4px solid #001F3D', padding: '16px 20px', borderRadius: '0 8px 8px 0', margin: '24px 0' }
const cardTitle = { margin: 0, fontSize: '15px', color: '#001F3D', fontWeight: 600 as const }
const cardSub = { margin: '4px 0 0', fontSize: '14px', color: '#6B7280' }
const link = { color: '#001F3D', textDecoration: 'underline' }
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

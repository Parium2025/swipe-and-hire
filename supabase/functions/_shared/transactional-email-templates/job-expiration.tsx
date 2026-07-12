/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  first_name?: string
  job_title?: string
  time_text?: string
}

const JobExpirationEmail = ({
  first_name = 'där',
  job_title = 'din annons',
  time_text = 'snart',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{`Din annons "${job_title}" utgår om ${time_text}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>Parium</Text>
        </Section>
        <Heading style={h1}>Din annons utgår snart ⏰</Heading>
        <Text style={text}>Hej {first_name}!</Text>
        <Text style={text}>
          Din jobbannons <strong>"{job_title}"</strong> utgår om{' '}
          <strong style={{ color: '#001F3D' }}>{time_text}</strong>.
        </Text>
        <Text style={text}>
          När annonsen har utgått syns den inte längre för jobbsökare. Letar du fortfarande efter kandidater —
          skapa en ny annons på under 60 sekunder med dina jobbmallar.
        </Text>
        <Section style={tipCard}>
          <Text style={tipTitle}>💡 Snabbtips</Text>
          <Text style={tipText}>
            Välj din mall, tryck "Skapa ny annons" och sedan "Publicera". Klart.
          </Text>
        </Section>
        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button style={button} href="https://parium.se/my-jobs">Gå till Mina annonser</Button>
        </Section>
        <Text style={{ ...text, textAlign: 'center' as const }}>Lycka till med rekryteringen! 🍀</Text>
        <Text style={footer}>
          Du får detta mail eftersom du har en aktiv jobbannons på{' '}
          <Link href="https://parium.se" style={link}>Parium</Link>.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: JobExpirationEmail,
  subject: (data: Props) => `Din annons "${data.job_title || 'din annons'}" utgår snart!`,
  displayName: 'Annons utgår snart',
  previewData: { first_name: 'Anna', job_title: 'Frontend-utvecklare', time_text: '4 timmar' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px' }
const brand = { fontSize: '20px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#001F3D', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const tipCard = { backgroundColor: '#F0F9FF', borderLeft: '4px solid #001F3D', padding: '16px 20px', borderRadius: '0 8px 8px 0', margin: '24px 0' }
const tipTitle = { margin: 0, fontSize: '14px', color: '#001F3D', fontWeight: 700 as const }
const tipText = { margin: '6px 0 0', fontSize: '14px', color: '#334155', lineHeight: '1.5' }
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

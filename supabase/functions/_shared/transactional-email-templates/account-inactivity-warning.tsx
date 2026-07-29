/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  first_name?: string
  delete_date?: string
  days_left?: string
}

const AccountInactivityWarningEmail = ({
  first_name = 'där',
  delete_date = 'om 30 dagar',
  days_left = '30',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{`Ditt Parium-konto raderas ${delete_date} om du inte loggar in`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>Parium</Text>
        </Section>
        <Heading style={h1}>Ditt konto raderas snart</Heading>
        <Text style={text}>Hej {first_name}!</Text>
        <Text style={text}>
          Du har inte använt Parium på 24 månader. Enligt vår integritetspolicy och GDPR
          sparar vi inte personuppgifter längre än nödvändigt — därför raderas ditt konto
          automatiskt <strong style={{ color: '#001F3D' }}>{delete_date}</strong>
          {' '}(om {days_left} dagar).
        </Text>
        <Section style={tipCard}>
          <Text style={tipTitle}>Vill du behålla kontot?</Text>
          <Text style={tipText}>
            Logga bara in en gång före dess — då avbryts raderingen automatiskt.
          </Text>
        </Section>
        <Text style={text}>
          Om du inte gör något raderas ditt konto, din profil, ditt CV, dina ansökningar
          och dina meddelanden permanent. Det går inte att återskapa.
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button style={button} href="https://parium.se/auth">Logga in och behåll kontot</Button>
        </Section>
        <Text style={footer}>
          Du får detta mejl eftersom du har ett konto på{' '}
          <Link href="https://parium.se" style={link}>Parium</Link>.
        </Text>
        <Text style={noReply}>
          Svara inte på detta mejl — det är skickat från en automatisk utgående adress.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AccountInactivityWarningEmail,
  subject: () => 'Ditt Parium-konto raderas om 30 dagar',
  displayName: 'Inaktivt konto – varning före radering',
  previewData: { first_name: 'Anna', delete_date: '2026-09-01', days_left: '30' },
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
const noReply = { fontSize: '11px', color: '#6B7280', margin: '8px 0 0', textAlign: 'center' as const, fontStyle: 'italic' as const }

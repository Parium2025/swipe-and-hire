/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  reset_url?: string
}

const PasswordResetEmail = ({ reset_url = 'https://parium.se' }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Återställ ditt Parium-lösenord – länken gäller i 1 timme</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>Parium</Text>
          <Text style={brandSub}>Återställ ditt lösenord</Text>
        </Section>

        <Heading style={h1}>Återställ ditt lösenord</Heading>

        <Text style={text}>
          Vi har fått en begäran om att återställa lösenordet för ditt Parium-konto.
        </Text>
        <Text style={text}>
          Klicka på knappen nedan för att skapa ett nytt lösenord.
        </Text>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0 20px' }}>
          <Button style={button} href={reset_url}>Återställ lösenord</Button>
          <Text style={validityNote}>Länken gäller i 1 timme och kan användas en gång.</Text>
        </Section>

        <Section style={securityCard}>
          <Text style={securityTitle}>🔒 Säkerhetsnotis</Text>
          <Text style={securityBody}>
            Om du inte begärde en lösenordsåterställning kan du ignorera detta meddelande – ditt lösenord förblir oförändrat och ditt konto säkert.
          </Text>
        </Section>

        <Section style={fallbackCard}>
          <Text style={fallbackTitle}>Fungerar inte knappen?</Text>
          <Text style={fallbackBody}>
            <Link href={reset_url} style={fallbackLink}>Öppna din säkra återställningslänk</Link>
          </Text>
          <Text style={fallbackHint}>
            Länken öppnar parium.se och är personlig – dela den inte med någon.
          </Text>
        </Section>

        <Text style={footer}>
          Parium AB · Stockholm<br />
          Du får detta mail för att du begärde en lösenordsåterställning i{' '}
          <Link href="https://parium.se" style={link}>Parium-appen</Link>.
        </Text>
        <Text style={noReply}>
          Svara inte på detta mejl — det är skickat från en automatisk utgående adress.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PasswordResetEmail,
  subject: 'Återställ ditt lösenord – Parium',
  displayName: 'Lösenordsåterställning',
  previewData: { reset_url: 'https://parium.se/auth?type=recovery&access_token=test' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px', padding: '24px', backgroundColor: '#001F3D', borderRadius: '12px', textAlign: 'center' as const }
const brand = { fontSize: '22px', fontWeight: 700 as const, color: '#ffffff', margin: 0, letterSpacing: '-0.3px' }
const brandSub = { fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: '4px 0 0' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#001F3D', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const button = {
  backgroundColor: '#001F3D',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '10px',
  padding: '14px 32px',
  textDecoration: 'none',
  display: 'inline-block',
}
const securityCard = { backgroundColor: '#F0F9FF', borderLeft: '4px solid #001F3D', padding: '16px 20px', borderRadius: '0 8px 8px 0', margin: '24px 0' }
const securityTitle = { margin: 0, fontSize: '14px', color: '#001F3D', fontWeight: 600 as const }
const securityBody = { margin: '6px 0 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }
const fallbackCard = { backgroundColor: '#F9FAFB', padding: '16px 20px', borderRadius: '8px', margin: '24px 0' }
const fallbackTitle = { fontSize: '13px', color: '#6B7280', margin: '0 0 8px' }
const fallbackUrl = { fontSize: '12px', color: '#001F3D', margin: 0, wordBreak: 'break-all' as const }
const link = { color: '#001F3D', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', borderTop: '1px solid #e2e8f0', paddingTop: '20px', textAlign: 'center' as const }
const noReply = { fontSize: '11px', color: '#6B7280', margin: '8px 0 0', textAlign: 'center' as const, fontStyle: 'italic' as const }

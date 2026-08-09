/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  first_name?: string
  confirmation_url?: string
}

const AccountConfirmationEmail = ({
  first_name = 'där',
  confirmation_url = 'https://parium.se',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Bekräfta ditt Parium-konto för att komma igång</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>Parium</Text>
          <Text style={brandSub}>Framtiden börjar här</Text>
        </Section>

        <Heading style={h1}>Hej {first_name}! 👋</Heading>

        <Text style={text}>
          Välkommen till Parium, en enklare väg till rätt jobb. Upptäck tjänster som passar din roll.
          Sök smidigt och ha koll på hela processen på ett ställe.
        </Text>
        <Text style={textBold}>Med Parium kan du:</Text>
        <Text style={bullet}>• Hitta jobb som verkligen passar din profil</Text>
        <Text style={bullet}>• Söka jobb snabbt och enkelt – direkt i appen</Text>
        <Text style={bullet}>• Spara tid med verktyg som gör processen både enkel och effektiv</Text>

        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button style={button} href={confirmation_url}>Bekräfta mitt konto</Button>
        </Section>

        <Text style={text}>Tack för ditt förtroende. Det här är början på något riktigt bra!</Text>

        <Section style={fallbackCard}>
          <Text style={fallbackTitle}>Fungerar inte knappen? Kopiera länken:</Text>
          <Text style={fallbackUrl}>{confirmation_url}</Text>
        </Section>

        <Text style={footer}>
          Parium AB · Stockholm<br />
          Du får detta mail för att du registrerat ett konto på{' '}
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
  component: AccountConfirmationEmail,
  subject: 'Välkommen till Parium – Bekräfta ditt konto',
  displayName: 'Kontobekräftelse (jobbsökare)',
  previewData: {
    first_name: 'Anna',
    confirmation_url: 'https://parium.se/email-confirm?confirm=test',
  },
} satisfies TemplateEntry


const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px', padding: '24px', backgroundColor: '#001F3D', borderRadius: '12px', textAlign: 'center' as const }
const brand = { fontSize: '22px', fontWeight: 700 as const, color: '#ffffff', margin: 0, letterSpacing: '-0.3px' }
const brandSub = { fontSize: '13px', color: '#FFFFFF', margin: '4px 0 0' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#001F3D', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const textBold = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 8px', fontWeight: 600 as const }
const bullet = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 6px', paddingLeft: '8px' }
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
const fallbackCard = { backgroundColor: '#F9FAFB', padding: '16px 20px', borderRadius: '8px', margin: '24px 0' }
const fallbackTitle = { fontSize: '13px', color: '#6B7280', margin: '0 0 8px' }
const fallbackUrl = { fontSize: '12px', color: '#001F3D', margin: 0, wordBreak: 'break-all' as const }
const link = { color: '#001F3D', textDecoration: 'underline' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', borderTop: '1px solid #e2e8f0', paddingTop: '20px', textAlign: 'center' as const }
const noReply = { fontSize: '11px', color: '#6B7280', margin: '8px 0 0', textAlign: 'center' as const, fontStyle: 'italic' as const }

/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="sv" dir="ltr">
    <Head>
      <meta charSet="utf-8" />
    </Head>
    <Preview>Återställ ditt lösenord på Parium</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>Parium</Text>
        </Section>
        <Heading style={h1}>Återställ ditt lösenord</Heading>
        <Text style={text}>
          Vi fick en förfrågan om att återställa lösenordet till ditt Parium-konto.
          Klicka på knappen nedan för att välja ett nytt lösenord.
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '32px 0 20px' }}>
          <Button style={button} href={confirmationUrl}>Välj nytt lösenord</Button>
          <Text style={smallText}>Länken gäller i 1 timme och kan användas en gång.</Text>
        </Section>
        <Text style={smallText}>
          Fungerar inte knappen?{' '}
          <Link href={confirmationUrl} style={link}>Klicka här för att återställa</Link>
        </Text>
        <Text style={footer}>
          Har du inte själv begärt en återställning? Klicka inte på länken. Ditt lösenord är fortfarande oförändrat, men någon kan ha försökt komma åt ditt konto. Kontakta oss direkt på support@parium.se så hjälper vi dig att säkra kontot.
        </Text>
        <Text style={noReply}>
          Svara inte på detta mejl — det är skickat från en automatisk utgående adress.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px' }
const brand = { fontSize: '20px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#001F3D', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const smallText = { fontSize: '13px', color: '#64748b', lineHeight: '1.5', margin: '0 0 24px', wordBreak: 'break-all' as const }
const link = { color: '#001F3D', textDecoration: 'underline' }
const button = {
  backgroundColor: '#001F3D',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '8px',
  padding: '14px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }
const noReply = { fontSize: '11px', color: '#6B7280', margin: '8px 0 0', fontStyle: 'italic' as const }

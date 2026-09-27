/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  company_name?: string
  inviter_name?: string
  role_label?: string
  accept_url?: string
  expires_at?: string
}

const TeamInvitationEmail = ({
  company_name = 'Ditt företag',
  inviter_name = 'En kollega',
  role_label = 'Rekryterare',
  accept_url = 'https://parium.se',
  expires_at = '',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head>
      <meta charSet="utf-8" />
      <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
    </Head>
    <Preview>{`${inviter_name} har bjudit in dig till ${company_name} på Parium`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>{company_name}</Text>
          <Section style={accentBar} />
        </Section>
        <Text style={subjectLine}>Teaminbjudan · {role_label}</Text>
        <Section style={card}>
          <Text style={text}>
            {inviter_name} har bjudit in dig att gå med i {company_name} på Parium som{' '}
            <strong>{role_label}</strong>.
          </Text>
          {expires_at ? <Text style={row}><strong>Gäller till:</strong> {expires_at}</Text> : null}
        </Section>
        <Section style={{ textAlign: 'center' as const, margin: '28px 0 20px' }}>
          <Button style={button} href={accept_url}>Gå med i teamet</Button>
        </Section>
        <Text style={small}>Fungerar inte knappen? Kopiera och klistra in länken i webbläsaren:</Text>
        <Text style={link}>{accept_url}</Text>
        <Text style={footer}>
          Känner du inte igen inbjudan kan du ignorera mejlet. Inget händer förrän du klickar på länken och loggar in.
        </Text>
        <Text style={noReply}>
          Svara inte på detta mejl — det är skickat från en automatisk utgående adress.
        </Text>
      </Container>
    </Body>
  </Html>
)

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px' }
const brand = { fontSize: '22px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const accentBar = { width: '44px', height: '3px', backgroundColor: '#1E4B8A', borderRadius: '2px', margin: '10px 0 0' }
const subjectLine = { fontSize: '15px', fontWeight: 600 as const, color: '#1E4B8A', margin: '14px 0 20px' }
const card = { backgroundColor: '#f8fafc', padding: '28px 32px', borderRadius: '8px', border: '1px solid #e2e8f0', margin: '0' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 12px' }
const row = { margin: '4px 0', fontSize: '14px', color: '#111827', lineHeight: '1.6' }
const button = { backgroundColor: '#001F3D', color: '#ffffff', fontSize: '15px', fontWeight: 600 as const, borderRadius: '10px', padding: '14px 28px', textDecoration: 'none', display: 'inline-block' }
const small = { fontSize: '12px', color: '#6B7280', margin: '8px 0 0', textAlign: 'center' as const }
const link = { fontSize: '12px', color: '#001F3D', wordBreak: 'break-all' as const, margin: '4px 0 0', textAlign: 'center' as const }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '32px 0 0', paddingTop: '20px', textAlign: 'center' as const }
const noReply = { fontSize: '11px', color: '#6B7280', margin: '8px 0 0', textAlign: 'center' as const, fontStyle: 'italic' as const }

export const template = {
  component: TeamInvitationEmail,
  subject: (data: Props) => `Inbjudan till ${data.company_name || 'ditt team'} på Parium`,
  displayName: 'Teaminbjudan',
  previewData: {
    company_name: 'Parium AB',
    inviter_name: 'Anna Andersson',
    role_label: 'Rekryterare',
    accept_url: 'https://parium.se/team-invite?token=exempel',
    expires_at: '1 september 2026',
  },
} satisfies TemplateEntry

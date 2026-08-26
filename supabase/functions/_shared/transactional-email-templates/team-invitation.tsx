/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
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
    <Head />
    <Preview>{`${inviter_name} har bjudit in dig till ${company_name} på Parium`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>Parium</Text>
        </Section>
        <Heading style={h1}>Du är inbjuden till {company_name} 🎉</Heading>
        <Text style={paragraph}>
          {inviter_name} har bjudit in dig att gå med i {company_name} på Parium som{' '}
          <strong>{role_label}</strong>.
        </Text>
        <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
          <Button style={button} href={accept_url}>Acceptera inbjudan</Button>
        </Section>
        <Text style={small}>
          Fungerar inte knappen? Kopiera och klistra in den här länken i webbläsaren:
        </Text>
        <Text style={link}>{accept_url}</Text>
        {expires_at ? (
          <Text style={small}>Inbjudan gäller till {expires_at}.</Text>
        ) : null}
        <Hr style={hr} />
        <Text style={footer}>
          Om du inte känner igen den här inbjudan kan du ignorera mejlet — inget händer förrän
          du klickar på länken och loggar in.
        </Text>
        <Text style={noReply}>
          Svara inte på detta mejl — det är skickat från en automatisk utgående adress.
        </Text>
      </Container>
    </Body>
  </Html>
)

const main = { backgroundColor: '#0f172a', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { margin: '0 auto', padding: '32px 24px', maxWidth: '560px' }
const brandSection = { marginBottom: '16px' }
const brand = { color: '#93c5fd', fontSize: '14px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' as const, margin: 0 }
const h1 = { color: '#ffffff', fontSize: '24px', lineHeight: '1.3', margin: '0 0 16px' }
const paragraph = { color: '#ffffff', fontSize: '16px', lineHeight: '1.6', margin: '0 0 12px' }
const button = { backgroundColor: '#2563eb', color: '#ffffff', borderRadius: '10px', padding: '14px 28px', fontSize: '16px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }
const small = { color: '#cbd5e1', fontSize: '13px', lineHeight: '1.5', margin: '8px 0 0' }
const link = { color: '#93c5fd', fontSize: '13px', wordBreak: 'break-all' as const, margin: '4px 0 0' }
const hr = { borderColor: '#1e293b', margin: '24px 0' }
const footer = { color: '#cbd5e1', fontSize: '13px', lineHeight: '1.6', margin: 0 }
const noReply = { color: '#64748b', fontSize: '12px', margin: '12px 0 0' }

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

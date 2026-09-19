/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface DigestItem {
  title?: string
  subtitle?: string
}

interface Props {
  first_name?: string
  heading?: string
  intro?: string
  items?: DigestItem[]
  cta_label?: string
  cta_url?: string
  settings_note?: string
  subject_line?: string
}

const ActivityDigestEmail = ({
  first_name = 'där',
  heading = 'Nytt i Parium',
  intro = 'Här är en sammanfattning av det du missat.',
  items = [],
  cta_label = 'Öppna Parium',
  cta_url = 'https://parium.se',
  settings_note = 'Du kan stänga av det här mejlet under Aviseringar i appen.',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head>
      <meta charSet="utf-8" />
      <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
    </Head>
    <Preview>{heading}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>Parium</Text>
        </Section>
        <Heading style={h1}>{heading}</Heading>
        <Text style={text}>Hej {first_name}!</Text>
        <Text style={text}>{intro}</Text>

        {items.length > 0 && (
          <Section style={card}>
            {items.map((item, index) => (
              <Section key={index} style={index === 0 ? itemFirst : itemRow}>
                <Text style={itemTitle}>{item.title}</Text>
                {item.subtitle ? <Text style={itemSubtitle}>{item.subtitle}</Text> : null}
              </Section>
            ))}
          </Section>
        )}

        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button style={button} href={cta_url}>{cta_label}</Button>
        </Section>

        <Text style={footer}>
          {settings_note}{' '}
          <Link href="https://parium.se" style={link}>parium.se</Link>
        </Text>
        <Text style={noReply}>
          Svara inte på detta mejl — det är skickat från en automatisk utgående adress.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ActivityDigestEmail,
  subject: (data: Props) => data.subject_line || data.heading || 'Nytt i Parium',
  displayName: 'Sammanfattning (chatt & ansökningar)',
  previewData: {
    first_name: 'Anna',
    heading: '3 olästa meddelanden',
    intro: 'Du har meddelanden i Parium som du inte läst än.',
    items: [
      { title: 'Nordic Tech AB', subtitle: '2 meddelanden · Frontend-utvecklare' },
      { title: 'Vasa Bygg AB', subtitle: '1 meddelande · Platschef' },
    ],
    cta_label: 'Öppna chatten',
    cta_url: 'https://parium.se/messages',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px' }
const brand = { fontSize: '20px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#001F3D', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '4px 20px', margin: '24px 0' }
const itemRow = { borderTop: '1px solid #E2E8F0', padding: '14px 0' }
const itemFirst = { padding: '14px 0' }
const itemTitle = { margin: 0, fontSize: '15px', fontWeight: 600 as const, color: '#001F3D' }
const itemSubtitle = { margin: '4px 0 0', fontSize: '14px', color: '#475569', lineHeight: '1.5' }
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

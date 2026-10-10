/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  first_name?: string
  job_title?: string
  company_name?: string
  location?: string
  search_name?: string
  job_url?: string
}

const SavedSearchMatchEmail = ({
  first_name = 'där',
  job_title = 'Ett nytt jobb',
  company_name,
  location,
  search_name = 'din sparade sökning',
  job_url = 'https://parium.se/search-jobs',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head>
      <meta charSet="utf-8" />
      <meta httpEquiv="Content-Type" content="text/html; charset=UTF-8" />
    </Head>
    <Preview>{`Nytt jobb för ${search_name}: ${job_title}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandSection}>
          <Text style={brand}>Parium</Text>
        </Section>
        <Heading style={h1}>Nytt jobb för din sökning</Heading>
        <Text style={text}>Hej {first_name}!</Text>
        <Text style={text}>
          Ett nytt jobb stämmer med din sparade sökning <strong>"{search_name}"</strong>.
        </Text>
        <Section style={tipCard}>
          <Text style={tipTitle}>{job_title}</Text>
          {(company_name || location) && (
            <Text style={tipText}>{[company_name, location].filter(Boolean).join(' · ')}</Text>
          )}
        </Section>
        <Section style={{ textAlign: 'center' as const, margin: '32px 0' }}>
          <Button style={button} href={job_url}>Visa jobbet</Button>
        </Section>
        <Text style={footer}>
          Du får detta mejl för att du har en sparad sökning på{' '}
          <Link href="https://parium.se" style={link}>Parium</Link>. Du kan stänga av mejlen under Notiser i appen.
        </Text>
        <Text style={noReply}>
          Svara inte på detta mejl — det är skickat från en automatisk utgående adress.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SavedSearchMatchEmail,
  subject: (data: Props) => `Nytt jobb för din sökning: ${data.job_title || 'nytt jobb'}`,
  displayName: 'Sparad sökning – ny träff',
  previewData: { first_name: 'Anna', job_title: 'Lagerarbetare', company_name: 'Nordic Logistik AB', location: 'Göteborg', search_name: 'Lager Göteborg' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brandSection = { margin: '0 0 24px' }
const brand = { fontSize: '20px', fontWeight: 700 as const, color: '#001F3D', margin: 0, letterSpacing: '-0.3px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#001F3D', margin: '0 0 20px', letterSpacing: '-0.3px' }
const text = { fontSize: '15px', color: '#334155', lineHeight: '1.6', margin: '0 0 16px' }
const tipCard = { backgroundColor: '#F0F9FF', borderLeft: '4px solid #001F3D', padding: '16px 20px', borderRadius: '0 8px 8px 0', margin: '24px 0' }
const tipTitle = { margin: 0, fontSize: '16px', color: '#001F3D', fontWeight: 700 as const }
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

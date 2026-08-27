import jsPDF from 'jspdf';

/** Läsbara etiketter för sektioner i dataexporten. */
const SECTION_LABELS: Record<string, string> = {
  account: 'Konto',
  profile: 'Profil',
  roles: 'Roller och behörigheter',
  consent_log: 'Samtyckeslogg',
  job_applications: 'Jobbansökningar',
  saved_jobs: 'Sparade jobb',
  saved_searches: 'Sparade sökningar',
  swipe_actions: 'Jobb du swipat',
  job_postings: 'Jobbannonser du skapat',
  interviews: 'Intervjuer',
  conversations: 'Konversationer du deltar i',
  messages_sent: 'Meddelanden du skrivit',
  notifications: 'Notiser',
  notification_preferences: 'Notisinställningar',
  cv_analyses: 'CV-sammanfattningar',
  subscriptions: 'Abonnemang',
  purchases: 'Köp',
  push_devices: 'Enheter för pushnotiser',
  support_tickets: 'Supportärenden',
  support_messages: 'Supportmeddelanden',
  company_reviews: 'Omdömen du lämnat',
  candidate_profiles: 'Dina kandidatprofiler (CV, video, bild)',
  personal_notes: 'Dina egna anteckningar',
  employer_notes: 'Anteckningar du skrivit som arbetsgivare',
  job_views: 'Jobb du tittat på',
  data_consents: 'Dina val om datadelning',
  stage_settings: 'Egna kolumninställningar',
  inactivity_notices: 'Påminnelser om inaktivitet',
  uploaded_files: 'Uppladdade filer',
  employer_records_about_me: 'Uppgifter arbetsgivare registrerat om dig',
  notes: 'Anteckningar',
  ratings: 'Betyg',
  evaluations: 'Utvärderingar',
  ai_summaries: 'AI-sammanfattningar',
  criterion_feedback: 'Kommentarer per kriterium',
  activity_log: 'Aktivitetslogg',
  pipeline_entries: 'Kandidatlistor',
  profile_views: 'Visningar av din profil',
};

/** Läsbara etiketter för vanliga fältnamn. */
const FIELD_LABELS: Record<string, string> = {
  id: 'ID',
  user_id: 'Användar-ID',
  email: 'E-post',
  role: 'Roll',
  first_name: 'Förnamn',
  last_name: 'Efternamn',
  phone: 'Telefon',
  bio: 'Presentation',
  location: 'Ort',
  city: 'Stad',
  postal_code: 'Postnummer',
  created_at: 'Skapad',
  updated_at: 'Senast ändrad',
  accepted_at: 'Godkänt',
  consent_type: 'Typ av godkännande',
  document_version: 'Dokumentversion',
  document_url: 'Dokument',
  source: 'Registrerat via',
  status: 'Status',
  title: 'Titel',
  content: 'Innehåll',
  cover_letter: 'Personligt brev',
  applied_at: 'Ansökte',
  scheduled_at: 'Tidpunkt',
  last_sign_in_at: 'Senaste inloggning',
  terms_accepted_at: 'Godkände villkoren',
  provider: 'Inloggningsmetod',
  is_read: 'Läst',
  body: 'Text',
  summary_text: 'Sammanfattning',
  name: 'Namn',
  note: 'Anteckning',
  rating: 'Betyg',
  comment: 'Kommentar',
  applicant_id: 'Kandidat-ID',
};

/** Fält som aldrig är intressanta för en människa att läsa. */
const HIDDEN_FIELDS = new Set([
  'search_vector',
  'embedding',
  'raw_text',
  'content_fingerprint',
  'fingerprint',
]);

const label = (key: string) =>
  FIELD_LABELS[key] ?? key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

function formatValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nej';
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  }
  if (typeof value === 'object') return JSON.stringify(value);
  const str = String(value);
  // ISO-datum → svensk läsbar form
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
    const d = new Date(str);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('sv-SE', { dateStyle: 'long', timeStyle: 'short' });
    }
  }
  return str;
}

/**
 * Bygger en läsbar PDF av dataexporten (GDPR art. 15).
 * JSON-filen finns kvar separat för dataportabilitet (art. 20).
 */
export function buildDataExportPdf(payload: Record<string, unknown>, accountEmail?: string) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const writeLines = (text: string, size: number, style: 'normal' | 'bold', gap = 4) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, maxWidth) as string[];
    lines.forEach((line) => {
      ensureSpace(size + gap);
      doc.text(line, margin, y);
      y += size + gap;
    });
  };

  // ── Försättsblad ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.text('Dina uppgifter hos Parium', margin, y);
  y += 30;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const generated = new Date().toLocaleString('sv-SE', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
  writeLines(
    `Skapad: ${generated}${accountEmail ? `\nKonto: ${accountEmail}` : ''}`,
    11,
    'normal',
  );
  y += 6;
  writeLines(
    'Det här är en läsbar sammanställning av de personuppgifter Parium AB behandlar om dig, ' +
      'enligt artikel 15 i dataskyddsförordningen (GDPR). Tillsammans med den här filen får du ' +
      'även en JSON-fil — samma innehåll i maskinläsbart format, så att du kan flytta dina ' +
      'uppgifter till en annan tjänst (artikel 20).',
    10,
    'normal',
  );
  y += 4;
  writeLines(
    'Personuppgiftsansvarig: Parium AB. Frågor: support@parium.se',
    10,
    'normal',
  );
  y += 16;

  // ── Sektioner ───────────────────────────────────────────────
  const renderRecord = (record: Record<string, unknown>, index?: number) => {
    ensureSpace(30);
    if (index !== undefined) {
      writeLines(`#${index + 1}`, 10, 'bold', 3);
    }
    Object.entries(record).forEach(([key, value]) => {
      if (HIDDEN_FIELDS.has(key)) return;
      const formatted = formatValue(value);
      if (formatted === null) return;
      writeLines(`${label(key)}: ${formatted}`, 10, 'normal', 3);
    });
    y += 8;
  };

  /** True när värdet är ett objekt vars fält i sin tur är listor (t.ex. arbetsgivarmaterial). */
  const isGroup = (value: unknown) =>
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value as Record<string, unknown>).every((v) => Array.isArray(v));

  const renderSection = (
    sectionKey: string,
    sectionValue: unknown,
    level: 'main' | 'sub',
  ) => {
    const heading = SECTION_LABELS[sectionKey] ?? label(sectionKey);
    const isArray = Array.isArray(sectionValue);
    const rows = isArray
      ? (sectionValue as Record<string, unknown>[])
      : sectionValue && typeof sectionValue === 'object'
        ? [sectionValue as Record<string, unknown>]
        : [];

    ensureSpace(40);
    if (level === 'main') {
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 16;
    }
    writeLines(
      `${heading}${isArray ? ` (${rows.length})` : ''}`,
      level === 'main' ? 14 : 11,
      'bold',
      6,
    );

    if (sectionKey === 'uploaded_files' && rows.length > 0) {
      writeLines(
        'Nedladdningslänkarna nedan är säkerhetsskäl giltiga i en timme från att exporten ' +
          'skapades. Gör en ny export om du behöver hämta filerna senare.',
        9,
        'normal',
      );
      y += 4;
    }

    if (rows.length === 0) {
      writeLines('Inga uppgifter sparade.', 10, 'normal');
      y += 8;
      return;
    }

    rows.forEach((row, i) => renderRecord(row, isArray && rows.length > 1 ? i : undefined));
  };

  Object.entries(payload).forEach(([sectionKey, sectionValue]) => {
    if (sectionKey === 'export_metadata') return;

    if (isGroup(sectionValue)) {
      ensureSpace(40);
      doc.setDrawColor(200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 16;
      writeLines(SECTION_LABELS[sectionKey] ?? label(sectionKey), 14, 'bold', 6);
      Object.entries(sectionValue as Record<string, unknown>).forEach(([subKey, subValue]) =>
        renderSection(subKey, subValue, 'sub'),
      );
      return;
    }

    renderSection(sectionKey, sectionValue, 'main');
  });

  // Sidnumrering
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(130);
    doc.text(`Parium AB — sida ${i} av ${pages}`, margin, pageHeight - 24);
    doc.setTextColor(0);
  }

  return doc;
}

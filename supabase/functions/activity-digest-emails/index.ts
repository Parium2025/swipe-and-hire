// Samlade mejl-sammanfattningar för olästa chattmeddelanden och nya ansökningar.
//
// Volymskydd (viktigt): mejl skickas ALDRIG per händelse. Funktionen körs var
// 15:e minut, tar bara med sådant som är minst 15 minuter gammalt och fortfarande
// oläst/obehandlat, och skickar högst ett mejl per användare och typ per timme.
// Mejlen kräver dessutom ett aktivt val (email_enabled = true) i
// notification_preferences — utan rad skickas ingenting.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendLoggedTemplateEmail } from '../_shared/transactional-email-templates/send-logged-email.ts'
import { requireServiceRoleOrCronSecret } from '../_shared/service-auth.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const QUIET_MINUTES = 15
const MIN_INTERVAL_MINUTES = 60
const LOOKBACK_HOURS = 24
const MAX_ITEMS = 8

// SKALA: mejlen skickades ett i taget, vilket inte räcker vid tusentals
// mottagare. Nu körs 20 samtidigt, men aldrig snabbare än mejlleverantörens
// takt (10 per sekund) – annars börjar leverantören neka utskick. Kombinationen
// ger full fart utan att någon mottagare tappas.
const EMAIL_CONCURRENCY = 20
const EMAILS_PER_SECOND = 10
let nextSlot = 0
async function emailSlot() {
  const spacing = 1000 / EMAILS_PER_SECOND
  const now = Date.now()
  const slot = Math.max(now, nextSlot)
  nextSlot = slot + spacing
  const wait = slot - now
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
}

type DigestType = 'unread_messages' | 'new_applications'

interface DigestItem { title: string; subtitle?: string }

async function recipientsAllowing(type: 'new_message' | 'new_application', userIds: string[]) {
  const allowed = new Set<string>()
  if (userIds.length === 0) return allowed
  const { data } = await admin
    .from('notification_preferences')
    .select('user_id, email_enabled')
    .eq('notification_type', type)
    .in('user_id', userIds)
  for (const row of data ?? []) {
    if (row.email_enabled === true) allowed.add(row.user_id as string)
  }
  return allowed
}

async function eligibleByInterval(digestType: DigestType, userIds: string[]) {
  const eligible = new Set(userIds)
  if (userIds.length === 0) return eligible
  const cutoff = new Date(Date.now() - MIN_INTERVAL_MINUTES * 60_000).toISOString()
  const { data } = await admin
    .from('notification_digest_state')
    .select('user_id, last_sent_at')
    .eq('digest_type', digestType)
    .in('user_id', userIds)
  for (const row of data ?? []) {
    if (row.last_sent_at && (row.last_sent_at as string) > cutoff) {
      eligible.delete(row.user_id as string)
    }
  }
  return eligible
}

async function profilesFor(userIds: string[]) {
  const map = new Map<string, { email: string | null; first_name: string | null; company_name: string | null; last_name: string | null }>()
  if (userIds.length === 0) return map
  const { data } = await admin
    .from('profiles')
    .select('id, email, first_name, last_name, company_name')
    .in('id', userIds)
  for (const p of data ?? []) map.set(p.id as string, p as never)
  return map
}

/** Adresser som avregistrerat sig får aldrig app-mejl. */
async function suppressed(emails: string[]) {
  const blocked = new Set<string>()
  if (emails.length === 0) return blocked
  const { data } = await admin.from('suppressed_emails').select('email').in('email', emails)
  for (const row of data ?? []) blocked.add((row.email as string).toLowerCase())
  return blocked
}

async function markSent(userId: string, digestType: DigestType) {
  await admin.from('notification_digest_state').upsert(
    { user_id: userId, digest_type: digestType, last_sent_at: new Date().toISOString() },
    { onConflict: 'user_id,digest_type' },
  )
}

async function sendDigest(
  userId: string,
  digestType: DigestType,
  payload: Record<string, unknown>,
  email: string,
) {
  try {
    await sendLoggedTemplateEmail('activity-digest', email, {
      templateData: payload,
      idempotencyKey: `${digestType}-${userId}-${new Date().toISOString().slice(0, 13)}`,
    })
    await markSent(userId, digestType)
    return true
  } catch (error) {
    console.error('digest send failed', digestType, userId, error instanceof Error ? error.message : error)
    return false
  }
}

async function runUnreadMessages() {
  const quietCutoff = new Date(Date.now() - QUIET_MINUTES * 60_000).toISOString()
  const lookback = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000).toISOString()

  const { data: messages } = await admin
    .from('conversation_messages')
    .select('id, conversation_id, sender_id, created_at, is_system_message')
    .gte('created_at', lookback)
    .lte('created_at', quietCutoff)
    .order('created_at', { ascending: false })
    .limit(3000)

  const real = (messages ?? []).filter((m) => !m.is_system_message)
  if (real.length === 0) return 0

  const conversationIds = [...new Set(real.map((m) => m.conversation_id as string))]
  const { data: members } = await admin
    .from('conversation_members')
    .select('conversation_id, user_id, last_read_at, muted_at')
    .in('conversation_id', conversationIds)

  // recipient -> conversation -> antal olästa
  const perUser = new Map<string, Map<string, number>>()
  for (const message of real) {
    for (const member of members ?? []) {
      if (member.conversation_id !== message.conversation_id) continue
      if (member.user_id === message.sender_id) continue
      if (member.muted_at) continue
      const lastRead = member.last_read_at as string | null
      if (lastRead && lastRead >= (message.created_at as string)) continue
      const byConversation = perUser.get(member.user_id as string) ?? new Map<string, number>()
      byConversation.set(
        message.conversation_id as string,
        (byConversation.get(message.conversation_id as string) ?? 0) + 1,
      )
      perUser.set(member.user_id as string, byConversation)
    }
  }
  if (perUser.size === 0) return 0

  const userIds = [...perUser.keys()]
  const allowed = await recipientsAllowing('new_message', userIds)
  const candidates = userIds.filter((id) => allowed.has(id))
  const eligible = await eligibleByInterval('unread_messages', candidates)
  const finalIds = candidates.filter((id) => eligible.has(id))
  if (finalIds.length === 0) return 0

  // Motpartens namn per konversation.
  const neededConversations = [...new Set(finalIds.flatMap((id) => [...(perUser.get(id)?.keys() ?? [])]))]
  const senderByConversation = new Map<string, string>()
  for (const conversationId of neededConversations) {
    const senderId = real.find((m) => m.conversation_id === conversationId)?.sender_id as string | undefined
    if (senderId) senderByConversation.set(conversationId, senderId)
  }
  const senderProfiles = await profilesFor([...new Set([...senderByConversation.values()])])
  const recipientProfiles = await profilesFor(finalIds)
  const blocked = await suppressed(
    finalIds.map((id) => recipientProfiles.get(id)?.email).filter((e): e is string => !!e),
  )

  let sent = 0
  const sendOne = async (userId: string) => {
    const profile = recipientProfiles.get(userId)
    const email = profile?.email
    if (!email || blocked.has(email.toLowerCase())) return

    const conversations = perUser.get(userId)!
    const total = [...conversations.values()].reduce((a, b) => a + b, 0)
    const items: DigestItem[] = [...conversations.entries()].slice(0, MAX_ITEMS).map(([conversationId, count]) => {
      const senderId = senderByConversation.get(conversationId)
      const sender = senderId ? senderProfiles.get(senderId) : undefined
      const name =
        sender?.company_name?.trim() ||
        [sender?.first_name, sender?.last_name].filter(Boolean).join(' ').trim() ||
        'Parium'
      return { title: name, subtitle: count === 1 ? '1 oläst meddelande' : `${count} olästa meddelanden` }
    })

    const heading = total === 1 ? '1 oläst meddelande' : `${total} olästa meddelanden`
    await emailSlot()
    const ok = await sendDigest(userId, 'unread_messages', {
      first_name: profile?.first_name || 'där',
      heading,
      subject_line: `${heading} i Parium`,
      intro: 'Du har meddelanden i Parium som du inte läst än.',
      items,
      cta_label: 'Öppna chatten',
      cta_url: 'https://parium.se/messages',
      settings_note: 'Du kan stänga av påminnelser om olästa meddelanden under Aviseringar i appen.',
    }, email)
    if (ok) sent++
  }
  for (let i = 0; i < finalIds.length; i += EMAIL_CONCURRENCY) {
    await Promise.all(finalIds.slice(i, i + EMAIL_CONCURRENCY).map(sendOne))
  }
  return sent
}

async function runNewApplications() {
  const quietCutoff = new Date(Date.now() - QUIET_MINUTES * 60_000).toISOString()
  const lookback = new Date(Date.now() - LOOKBACK_HOURS * 3_600_000).toISOString()

  const { data: applications } = await admin
    .from('job_applications')
    .select('id, job_id, created_at, viewed_at')
    .gte('created_at', lookback)
    .lte('created_at', quietCutoff)
    .is('viewed_at', null)
    .limit(5000)

  if (!applications || applications.length === 0) return 0

  const jobIds = [...new Set(applications.map((a) => a.job_id as string))]
  const { data: jobs } = await admin
    .from('job_postings')
    .select('id, title, employer_id')
    .in('id', jobIds)

  const jobById = new Map((jobs ?? []).map((j) => [j.id as string, j]))
  const perEmployer = new Map<string, Map<string, number>>()
  for (const application of applications) {
    const job = jobById.get(application.job_id as string)
    if (!job?.employer_id) continue
    const byJob = perEmployer.get(job.employer_id as string) ?? new Map<string, number>()
    byJob.set(job.id as string, (byJob.get(job.id as string) ?? 0) + 1)
    perEmployer.set(job.employer_id as string, byJob)
  }
  if (perEmployer.size === 0) return 0

  const employerIds = [...perEmployer.keys()]
  const allowed = await recipientsAllowing('new_application', employerIds)
  const candidates = employerIds.filter((id) => allowed.has(id))
  const eligible = await eligibleByInterval('new_applications', candidates)
  const finalIds = candidates.filter((id) => eligible.has(id))
  if (finalIds.length === 0) return 0

  const profiles = await profilesFor(finalIds)
  const blocked = await suppressed(
    finalIds.map((id) => profiles.get(id)?.email).filter((e): e is string => !!e),
  )

  let sent = 0
  const sendOne = async (employerId: string) => {
    const profile = profiles.get(employerId)
    const email = profile?.email
    if (!email || blocked.has(email.toLowerCase())) return

    const byJob = perEmployer.get(employerId)!
    const total = [...byJob.values()].reduce((a, b) => a + b, 0)
    const items: DigestItem[] = [...byJob.entries()].slice(0, MAX_ITEMS).map(([jobId, count]) => ({
      title: (jobById.get(jobId)?.title as string) || 'Din annons',
      subtitle: count === 1 ? '1 ny ansökan' : `${count} nya ansökningar`,
    }))

    const heading = total === 1 ? '1 ny ansökan' : `${total} nya ansökningar`
    await emailSlot()
    const ok = await sendDigest(employerId, 'new_applications', {
      first_name: profile?.first_name || 'där',
      heading,
      subject_line: `${heading} i Parium`,
      intro: 'Det har kommit in nya ansökningar som du inte öppnat än.',
      items,
      cta_label: 'Visa kandidater',
      cta_url: 'https://parium.se/candidates',
      settings_note: 'Du kan stänga av sammanfattningar om nya ansökningar under Aviseringar i appen.',
    }, email)
    if (ok) sent++
  }
  for (let i = 0; i < finalIds.length; i += EMAIL_CONCURRENCY) {
    await Promise.all(finalIds.slice(i, i + EMAIL_CONCURRENCY).map(sendOne))
  }
  return sent
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders)
  if (authResp) return authResp

  try {
    const [messageEmails, applicationEmails] = await Promise.all([
      runUnreadMessages(),
      runNewApplications(),
    ])
    return new Response(
      JSON.stringify({ success: true, messageEmails, applicationEmails }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('activity-digest-emails failed', message)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

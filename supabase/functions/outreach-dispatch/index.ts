import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { Resend } from 'npm:resend@2.0.0';

type OutreachChannel = 'chat' | 'email' | 'push';
type OutreachTrigger = 'application_received' | 'application_no_response_14d' | 'interview_before' | 'interview_after' | 'job_closed' | 'interview_scheduled' | 'manual_send';

type OutreachTemplate = {
  id: string;
  owner_user_id: string;
  organization_id: string | null;
  channel: OutreachChannel;
  subject: string | null;
  body: string;
};

type OutreachLog = {
  id: string;
  owner_user_id: string;
  template_id: string | null;
  channel: OutreachChannel;
  trigger: OutreachTrigger;
  recipient_user_id: string | null;
  interview_id: string | null;
  job_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendApiKey = Deno.env.get('RESEND_API_KEY');

const admin = createClient(supabaseUrl, serviceRoleKey);
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const renderTemplate = (template: string | null | undefined, data: Record<string, string | number | null | undefined>) => {
  let output = template ?? '';
  for (const [key, value] of Object.entries(data)) {
    output = output.split(`{${key}}`).join(value == null ? '' : String(value));
  }
  return output;
};

const getPayloadObject = (payload: Record<string, unknown> | null) => {
  if (!payload || Array.isArray(payload)) return {};
  return payload;
};

const getToken = (request: Request) => {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '').trim();
};

const formatDate = (iso?: string | null) => iso ? new Date(iso).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Stockholm' }) : '';
const formatTime = (iso?: string | null) => iso ? new Date(iso).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Stockholm' }) : '';

async function getUserFromRequest(request: Request) {
  const token = getToken(request);
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error) return null;
  return data.user;
}

async function getUserOrganizationIds(userId: string) {
  const { data } = await admin.from('user_roles').select('organization_id').eq('user_id', userId).eq('is_active', true).not('organization_id', 'is', null);
  return [...new Set((data ?? []).map((row) => row.organization_id).filter(Boolean))] as string[];
}

async function ensureTemplateAccess(templateId: string, userId: string) {
  const { data: template, error } = await admin.from('outreach_templates').select('*').eq('id', templateId).maybeSingle();
  if (error || !template) throw new Error('Mallen kunde inte hittas');
  const organizationIds = await getUserOrganizationIds(userId);
  const allowed = template.owner_user_id === userId || (!!template.organization_id && organizationIds.includes(template.organization_id));
  if (!allowed) throw new Error('Ingen åtkomst till vald mall');
  return template as OutreachTemplate;
}

async function ensureConversation(ownerUserId: string, recipientUserId: string, jobId?: string | null, applicationId?: string | null) {
  const { data: memberships } = await admin.from('conversation_members').select('conversation_id').eq('user_id', ownerUserId);
  const ids = (memberships ?? []).map((row) => row.conversation_id);

  if (ids.length > 0) {
    const { data: existing } = await admin.from('conversations').select('id').eq('candidate_id', recipientUserId).in('id', ids).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    if (existing?.id) return existing.id;
  }

  const { data: conversation, error } = await admin.from('conversations').insert({
    created_by: ownerUserId,
    is_group: false,
    candidate_id: recipientUserId,
    name: null,
    job_id: jobId ?? null,
    application_id: applicationId ?? null,
  }).select('id').single();
  if (error || !conversation) throw error ?? new Error('Kunde inte skapa konversation');

  await admin.from('conversation_members').upsert([
    { conversation_id: conversation.id, user_id: ownerUserId, is_admin: true },
    { conversation_id: conversation.id, user_id: recipientUserId, is_admin: false },
  ], { onConflict: 'conversation_id,user_id' });

  return conversation.id;
}

async function buildContext(log: OutreachLog) {
  const [{ data: ownerProfile }, { data: recipientProfile }, { data: job }, { data: interview }, { data: application }] = await Promise.all([
    admin.from('profiles').select('company_name').eq('user_id', log.owner_user_id).maybeSingle(),
    log.recipient_user_id ? admin.from('profiles').select('first_name, last_name, email').eq('user_id', log.recipient_user_id).maybeSingle() : Promise.resolve({ data: null }),
    log.job_id ? admin.from('job_postings').select('title').eq('id', log.job_id).maybeSingle() : Promise.resolve({ data: null }),
    log.interview_id ? admin.from('interviews').select('scheduled_at, duration_minutes, location_details, message').eq('id', log.interview_id).maybeSingle() : Promise.resolve({ data: null }),
    log.recipient_user_id && log.job_id ? admin.from('job_applications').select('id, email, first_name, last_name').eq('applicant_id', log.recipient_user_id).eq('job_id', log.job_id).order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const candidateName = [application?.first_name, application?.last_name].filter(Boolean).join(' ') || [recipientProfile?.first_name, recipientProfile?.last_name].filter(Boolean).join(' ') || 'Kandidat';

  return {
    companyName: ownerProfile?.company_name || 'Parium',
    candidateName,
    firstName: application?.first_name || recipientProfile?.first_name || 'där',
    recipientEmail: application?.email || recipientProfile?.email || null,
    applicationId: application?.id ?? null,
    jobTitle: job?.title || (log.payload?.job_title as string | undefined) || 'din process',
    scheduledDate: formatDate(interview?.scheduled_at),
    scheduledTime: formatTime(interview?.scheduled_at),
    durationMinutes: interview?.duration_minutes ?? '',
    locationDetails: interview?.location_details ?? '',
    message: (log.payload?.custom_message as string | undefined) ?? interview?.message ?? '',
  };
}

async function dispatchLog(log: OutreachLog) {
  const template = log.template_id ? ((await admin.from('outreach_templates').select('*').eq('id', log.template_id).maybeSingle()).data as OutreachTemplate | null) : null;
  const context = await buildContext(log);
  const data = {
    candidate_name: context.candidateName,
    first_name: context.firstName,
    company_name: context.companyName,
    job_title: context.jobTitle,
    scheduled_date: context.scheduledDate,
    scheduled_time: context.scheduledTime,
    duration_minutes: context.durationMinutes,
    location_type: (log.payload?.location_type as string | undefined) ?? '',
    location_details: context.locationDetails,
    message: context.message,
  };

  const subject = renderTemplate(template?.subject ?? String(log.payload?.custom_subject ?? ''), data);
  const body = renderTemplate(template?.body ?? String(log.payload?.custom_body ?? ''), data);

  if (!body.trim()) return { skipped: true };

  try {
    if (log.channel === 'chat') {
      if (!log.recipient_user_id) throw new Error('Saknar mottagare för chat');
      const conversationId = await ensureConversation(log.owner_user_id, log.recipient_user_id, log.job_id, context.applicationId);
      const { error } = await admin.from('conversation_messages').insert({ conversation_id: conversationId, sender_id: log.owner_user_id, content: body });
      if (error) throw error;
      await admin.from('outreach_dispatch_logs').update({ status: 'sent', sent_at: new Date().toISOString(), conversation_id: conversationId, error_message: null }).eq('id', log.id);
      return { conversationId };
    }

    if (log.channel === 'email') {
      if (!context.recipientEmail) throw new Error('Kandidaten saknar e-postadress');
      if (!resend) {
        console.warn(`[outreach-dispatch] E-postkanal hoppad för logg ${log.id} — RESEND_API_KEY är inte konfigurerad.`);
        await admin.from('outreach_dispatch_logs').update({ status: 'failed', error_message: 'E-post ej konfigurerad: RESEND_API_KEY saknas. Kontakta support.' }).eq('id', log.id);
        return { error: 'RESEND_API_KEY saknas' };
      }
      const trackingUrl = `${supabaseUrl}/functions/v1/outreach-open-track?logId=${encodeURIComponent(log.id)}`;
      const result = await resend.emails.send({
        from: `${context.companyName} via Parium <noreply@parium.se>`,
        to: [context.recipientEmail],
        subject: subject || `Meddelande från ${context.companyName}`,
        html: `<div style="font-family:Arial,sans-serif;background:#071733;padding:32px;color:#fff"><div style="max-width:640px;margin:0 auto;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:24px;padding:32px"><h1 style="margin-top:0;font-size:24px">${subject || 'Meddelande från Parium'}</h1><p style="line-height:1.7;white-space:pre-line">${body}</p></div><img src="${trackingUrl}" alt="" width="1" height="1" style="display:block;width:1px;height:1px;opacity:0;border:0;overflow:hidden" /></div>`,
      });
      if ((result as { error?: unknown }).error) throw new Error('E-postutskicket misslyckades');
      const emailMessageId = (result as { data?: { id?: string }; id?: string }).data?.id ?? (result as { id?: string }).id ?? null;
      await admin.from('outreach_dispatch_logs').update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        recipient_email: context.recipientEmail,
        payload: {
          ...getPayloadObject(log.payload),
          tracking_url: trackingUrl,
          email_message_id: emailMessageId,
        },
        error_message: null,
      }).eq('id', log.id);
      return {};
    }

    if (log.channel === 'push') {
      if (!log.recipient_user_id) throw new Error('Saknar mottagare för push');
      const response = await fetch(`${supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ recipient_id: log.recipient_user_id, title: subject || context.companyName, body }),
      });
      if (!response.ok) throw new Error(await response.text());
      await admin.from('outreach_dispatch_logs').update({ status: 'sent', sent_at: new Date().toISOString(), error_message: null }).eq('id', log.id);
      return {};
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Okänt fel';
    await admin.from('outreach_dispatch_logs').update({ status: 'failed', error_message: message }).eq('id', log.id);
    return { error: message };
  }

  return {};
}

async function processPending(filters: { ownerUserId?: string; trigger?: OutreachTrigger; interviewId?: string | null } = {}) {
  let query = admin.from('outreach_dispatch_logs').select('*').eq('status', 'pending').order('created_at', { ascending: true }).limit(30);
  if (filters.ownerUserId) query = query.eq('owner_user_id', filters.ownerUserId);
  if (filters.trigger) query = query.eq('trigger', filters.trigger);
  if (filters.interviewId) query = query.eq('interview_id', filters.interviewId);

  const { data, error } = await query;
  if (error) throw error;

  let processedCount = 0;
  let chatConversationId: string | null = null;
  for (const row of (data ?? []) as OutreachLog[]) {
    const result = await dispatchLog(row);
    if (!('skipped' in result)) processedCount += 1;
    if ('conversationId' in result && result.conversationId) chatConversationId = result.conversationId;
  }

  return { processedCount, chatConversationId };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const user = await getUserFromRequest(request);
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    if ((body as { mode?: string }).mode === 'manual') {
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const manual = body as {
        recipientUserId: string;
        applicationId?: string | null;
        jobId?: string | null;
        sends: Array<{ channel: OutreachChannel; templateId?: string | null; customBody?: string | null }>;
      };

      for (const send of manual.sends) {
        const template = send.templateId ? await ensureTemplateAccess(send.templateId, user.id) : null;
        await admin.from('outreach_dispatch_logs').insert({
          owner_user_id: user.id,
          organization_id: template?.organization_id ?? null,
          automation_id: null,
          template_id: template?.id ?? null,
          trigger: 'manual_send',
          channel: send.channel,
          recipient_user_id: manual.recipientUserId,
          interview_id: null,
          job_id: manual.jobId ?? null,
          payload: { custom_body: send.customBody ?? null, custom_message: send.customBody ?? null },
          status: 'pending',
        });
      }

      const result = await processPending({ ownerUserId: user.id, trigger: 'manual_send' });
      return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const result = await processPending({ ownerUserId: user?.id, trigger: (body as { trigger?: OutreachTrigger }).trigger, interviewId: (body as { interviewId?: string | null }).interviewId ?? null });
    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
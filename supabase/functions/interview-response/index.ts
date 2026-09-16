// Publik svarssida för intervjuinbjudan: kandidaten tackar ja eller nej
// direkt från mejlet. GET visar en bekräftelsesida (så att mejlklienters
// länkskanning aldrig svarar åt kandidaten), POST registrerar svaret.
import { createClient } from 'npm:@supabase/supabase-js@2'

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

function page(title: string, body: string, extra = ''): Response {
  const html = `<!DOCTYPE html>
<html lang="sv">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<title>${escapeHtml(title)} – Parium</title>
<style>
  body { margin:0; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif; color:#0f172a; }
  .wrap { max-width:520px; margin:0 auto; padding:48px 20px; }
  .card { background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:32px 28px; }
  h1 { font-size:22px; color:#001F3D; margin:0 0 8px; letter-spacing:-0.3px; }
  .bar { width:44px; height:3px; background:#1E4B8A; border-radius:2px; margin:0 0 20px; }
  p { font-size:15px; line-height:1.7; color:#334155; margin:0 0 16px; }
  .actions { display:flex; gap:12px; flex-wrap:wrap; margin-top:24px; }
  button { font-size:15px; font-weight:600; padding:12px 22px; border-radius:999px; border:1px solid transparent; cursor:pointer; }
  .yes { background:#1E4B8A; color:#ffffff; }
  .no { background:#ffffff; color:#1E4B8A; border-color:#cbd5e1; }
  .foot { font-size:12px; color:#94a3b8; text-align:center; margin-top:20px; }
</style>
</head>
<body><div class="wrap"><div class="card">
<h1>${escapeHtml(title)}</h1><div class="bar"></div>
${body}
</div>${extra}<p class="foot">Parium</p></div></body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

// Svarssidan ligger på parium.se; den anropar den här funktionen med JSON.
function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const url = new URL(req.url)
  let token = url.searchParams.get('token') ?? ''
  let answer = url.searchParams.get('answer') ?? ''
  let wantsJson = false

  if (req.method === 'POST') {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      wantsJson = true
      const body = await req.json().catch(() => null) as Record<string, unknown> | null
      if (body) {
        token = String(body.token ?? token)
        answer = String(body.answer ?? answer)
      }
    } else {
      const form = await req.formData().catch(() => null)
      if (form) {
        token = String(form.get('token') ?? token)
        answer = String(form.get('answer') ?? answer)
      }
    }
  }

  if (!UUID_RE.test(token) || (answer !== 'yes' && answer !== 'no')) {
    if (wantsJson) return json({ ok: false, reason: 'invalid' }, 400)
    return page('Länken fungerar inte', '<p>Länken är ofullständig eller felaktig. Logga in i Parium för att svara på intervjun.</p>')
  }

  const accept = answer === 'yes'

  if (req.method !== 'POST') {
    return page(
      accept ? 'Tacka ja till intervjun' : 'Tacka nej till intervjun',
      `<p>Bekräfta ditt svar så meddelas arbetsgivaren direkt.</p>
       <form method="POST">
         <input type="hidden" name="token" value="${escapeHtml(token)}" />
         <input type="hidden" name="answer" value="${escapeHtml(answer)}" />
         <div class="actions">
           <button class="${accept ? 'yes' : 'no'}" type="submit">${accept ? 'Ja, jag kommer' : 'Nej, jag kan inte'}</button>
         </div>
       </form>`,
    )
  }

  const { data, error } = await admin.rpc('respond_to_interview_by_token', {
    p_token: token,
    p_accept: accept,
  })

  if (error) {
    console.error('interview-response failed:', error.message)
    return page('Något gick fel', '<p>Svaret kunde inte registreras just nu. Försök igen om en stund eller svara inne i Parium.</p>')
  }

  const result = (data ?? {}) as Record<string, unknown>

  if (!result.ok) {
    const reason = String(result.reason ?? '')
    const text = reason === 'expired'
      ? 'Länken har gått ut. Logga in i Parium för att svara på intervjun.'
      : reason === 'closed'
        ? 'Intervjun är inte längre öppen för svar. Logga in i Parium för att se vad som gäller.'
        : 'Länken fungerar inte längre. Logga in i Parium för att svara på intervjun.'
    return page('Svaret kunde inte registreras', `<p>${text}</p>`)
  }

  const jobTitle = typeof result.job_title === 'string' ? result.job_title : ''
  const suffix = jobTitle ? ` för ${escapeHtml(jobTitle)}` : ''
  const already = result.already === true

  return accept
    ? page('Tack – du är anmäld', `<p>${already ? 'Du hade redan tackat ja' : 'Du har tackat ja'} till intervjun${suffix}. Arbetsgivaren har fått besked.</p><p>Du hittar tid och plats under Mina ansökningar i Parium.</p>`)
    : page('Tack för ditt besked', `<p>${already ? 'Du hade redan tackat nej' : 'Du har tackat nej'} till intervjun${suffix}. Arbetsgivaren har fått besked.</p>`)
})

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

const TOKEN = 'parium-outreach-preview-2026'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.headers.get('x-dev-test-token') !== TOKEN) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const payload = await req.json()
  const { to, body, company_name, subject } = payload ?? {}
  if (typeof to !== 'string' || typeof body !== 'string') {
    return new Response(JSON.stringify({ error: 'invalid payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const result = await sendTemplateEmail('outreach-message', to, {
    templateData: { body, company_name, subject },
  })
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

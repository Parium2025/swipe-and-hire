import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { sendTemplateEmail } from '../_shared/transactional-email-templates/send-email.ts'

// Temporary internal test sender — gated by LOVABLE_API_KEY.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const token = req.headers.get('x-dev-test-token')
  if (token !== 'parium-outreach-preview-2026') {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const payload = await req.json()
  const result = await sendTemplateEmail('outreach-message', payload.to, {
    templateData: payload.templateData ?? {},
    idempotencyKey: crypto.randomUUID(),
  })

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})

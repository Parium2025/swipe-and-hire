import { createClient } from 'npm:@supabase/supabase-js@2'
import { getEmailUnsubscribe, setEmailUnsubscribe } from 'npm:@lovable.dev/email-js@0.1.0'
import { verifyCaller } from '../_shared/service-auth.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Avregistreringen är kopplad till avsändardomänens apex, inte per mall.
const EMAIL_DOMAIN = 'parium.se'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const caller = await verifyCaller(req, corsHeaders)
    if (caller instanceof Response) return caller

    const recipient = (caller.email ?? '').trim().toLowerCase()
    if (!recipient) return json({ error: 'Ingen e-postadress på kontot' }, 400)

    const apiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!apiKey) return json({ error: 'Server configuration error' }, 500)

    let action: 'status' | 'resubscribe' | 'unsubscribe' = 'status'
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      const requested = String((body as any)?.action ?? 'status')
      if (requested === 'resubscribe' || requested === 'unsubscribe' || requested === 'status') {
        action = requested
      } else {
        return json({ error: 'Ogiltig åtgärd' }, 400)
      }
    }

    if (action === 'status') {
      const state = await getEmailUnsubscribe({ recipient, domain: EMAIL_DOMAIN }, { apiKey })
      return json({ recipient, subscribed: state.subscribed })
    }

    const subscribed = action === 'resubscribe'
    const state = await setEmailUnsubscribe(
      { recipient, domain: EMAIL_DOMAIN, subscribed },
      { apiKey },
    )

    // Rensa/återställ även den äldre lokala spärrlistan så inget gammalt hindrar utskick.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (subscribed && supabaseUrl && serviceKey) {
      try {
        const admin = createClient(supabaseUrl, serviceKey)
        await admin.from('suppressed_emails').delete().eq('email', recipient)
      } catch (cleanupErr) {
        console.warn('suppressed_emails cleanup failed', cleanupErr)
      }
    }

    return json({ recipient, subscribed: state.subscribed })
  } catch (error: any) {
    console.error('email-subscription failed:', error?.message ?? error)
    return json({ error: 'Kunde inte uppdatera e-poststatus' }, 500)
  }
})

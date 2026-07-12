// Shared auth helpers for edge functions.
//
// ⚠️ SECURITY: never trust JWT claims from a base64 decode alone — the payload
// is trivially forgeable when verify_jwt=false. We only accept:
//   • the literal SUPABASE_SERVICE_ROLE_KEY string (cron / pg_net / server code), OR
//   • a JWT that Supabase auth cryptographically verifies (getClaims).
//
// Never re-introduce a plain base64 role check.

import { createClient } from 'npm:@supabase/supabase-js@2'

function unauthorized(status: number, message: string, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function extractBearer(req: Request): string | null {
  const h = req.headers.get('Authorization')
  if (!h?.startsWith('Bearer ')) return null
  const t = h.slice('Bearer '.length).trim()
  return t.length > 0 ? t : null
}

/**
 * Cron / internal only. Accepts ONLY the literal service-role key.
 * A signed user JWT — even one with role=service_role in claims — is rejected,
 * because there is no scenario where an end-user should trigger these paths.
 */
export function requireServiceRole(req: Request, corsHeaders: Record<string, string> = {}): Response | null {
  const token = extractBearer(req)
  if (!token) return unauthorized(401, 'Unauthorized', corsHeaders)
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceKey && token === serviceKey) return null
  return unauthorized(403, 'Forbidden - service role required', corsHeaders)
}

export interface VerifiedCaller {
  /** True when the request came in with the literal service-role key. */
  isServiceRole: boolean
  /** auth.uid() of the caller. Null iff isServiceRole. */
  userId: string | null
  /** Email from the verified JWT if present. */
  email: string | null
}

/**
 * Cryptographically verify the caller. Returns a Response on failure, or a
 * VerifiedCaller on success. Callers must NEVER trust JWT contents that
 * bypass this function.
 */
export async function verifyCaller(req: Request, corsHeaders: Record<string, string> = {}): Promise<Response | VerifiedCaller> {
  const token = extractBearer(req)
  if (!token) return unauthorized(401, 'Unauthorized', corsHeaders)

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceKey && token === serviceKey) {
    return { isServiceRole: true, userId: null, email: null }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return unauthorized(500, 'Server misconfigured', corsHeaders)

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await client.auth.getClaims(token)
  if (error || !data?.claims?.sub) {
    return unauthorized(401, 'Invalid authentication', corsHeaders)
  }
  const claims = data.claims as Record<string, unknown>
  return {
    isServiceRole: false,
    userId: claims.sub as string,
    email: typeof claims.email === 'string' ? (claims.email as string).toLowerCase() : null,
  }
}

/**
 * Accept service_role OR a cryptographically-verified authenticated user.
 * Backwards-compatible wrapper around verifyCaller — returns null on success.
 */
export async function requireAuthenticated(req: Request, corsHeaders: Record<string, string> = {}): Promise<Response | null> {
  const result = await verifyCaller(req, corsHeaders)
  if (result instanceof Response) return result
  return null
}

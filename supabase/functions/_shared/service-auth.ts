// Shared helpers for authorizing internal / cron-only edge functions.

export function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    const payload = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')
    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

function unauthorized(status: number, message: string, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

/**
 * Require the request to be authorized as service_role (cron / internal only).
 * Returns null when authorized, or a 401/403 Response.
 */
export function requireServiceRole(req: Request, corsHeaders: Record<string, string> = {}): Response | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return unauthorized(401, 'Unauthorized', corsHeaders)
  }
  const token = authHeader.slice('Bearer '.length).trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceKey && token === serviceKey) return null
  const claims = parseJwtClaims(token)
  if (claims?.role !== 'service_role') {
    return unauthorized(403, 'Forbidden - service role required', corsHeaders)
  }
  return null
}

/**
 * Require the request to be either service_role OR an authenticated user (any sub).
 * Returns null when authorized, or a 401 Response. Anonymous callers are rejected.
 */
export function requireAuthenticated(req: Request, corsHeaders: Record<string, string> = {}): Response | null {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return unauthorized(401, 'Unauthorized', corsHeaders)
  }
  const token = authHeader.slice('Bearer '.length).trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceKey && token === serviceKey) return null
  const claims = parseJwtClaims(token)
  if (!claims) return unauthorized(401, 'Invalid token', corsHeaders)
  if (claims.role === 'service_role') return null
  if (typeof claims.sub === 'string' && claims.sub.length > 0) return null
  return unauthorized(401, 'Authentication required', corsHeaders)
}

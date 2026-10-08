// Structural contract keeps this pure handler testable without Deno imports.
interface VerifiedCaller {
  isServiceRole: boolean;
  userId: string | null;
  email: string | null;
}

interface Dependencies {
  verifyCaller: (request: Request, headers: Record<string, string>) => Promise<Response | VerifiedCaller>;
  dispatch: () => Promise<Response>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Existing clients only wake persisted employer events. Empty, locked or
 * delayed batches must never create a second confirmation email.
 */
export function createApplicationConfirmationHandler({ verifyCaller, dispatch }: Dependencies) {
  const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    try {
      const caller = await verifyCaller(request, corsHeaders);
      if (caller instanceof Response) return caller;
      const body = await request.json();
      const recipient = typeof body?.applicant_email === 'string' ? body.applicant_email.toLowerCase() : '';
      if (!caller.isServiceRole && (!caller.email || recipient !== caller.email.toLowerCase())) {
        return json({ error: 'Recipient must match caller' }, 403);
      }
      // Rules, preferences, branding and dedupe belong to the persisted event,
      // never to browser-provided company/job text or a global batch count.
      const response = await dispatch();
      if (!response.ok) return json({ error: 'Kunde inte starta utskicket just nu.' }, 502);
      const result = await response.json().catch(() => ({}));
      return json({ success: true, mode: 'outreach_automation', processedCount: Number(result?.processedCount ?? 0) });
    } catch (error) {
      console.error('Application outreach wake-up failed:', error instanceof Error ? error.message : 'Unknown error');
      return json({ error: 'Kunde inte starta utskicket just nu.' }, 500);
    }
  };
}
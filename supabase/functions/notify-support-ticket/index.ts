import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { verifyCaller } from "../_shared/service-auth.ts";
import { sendLoggedTemplateEmail } from '../_shared/transactional-email-templates/send-logged-email.ts'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.25.76';

// Läses från secrets (samma mönster som send-admin-alert) så adressen kan bytas
// utan kodändring och inte ligger i repo-historiken.
const ADMIN_EMAIL = Deno.env.get("ADMIN_ALERT_EMAIL") ?? "fredrikandits@hotmail.com";

const categoryLabels: Record<string, string> = {
  technical: 'Teknisk support',
  billing: 'Fakturering',
  account: 'Kontofrågor',
  other: 'Övrigt',
  feature: 'Funktionsfrågor',
};

const notificationSchema = z.object({ ticketId: z.string().uuid() });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const caller = await verifyCaller(req, corsHeaders);
  if (caller instanceof Response) return caller;

  try {
    const parsed = notificationSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "A valid ticketId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const { ticketId } = parsed.data;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) throw new Error('Server configuration error');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('Support ticket lookup failed', { code: ticketError?.code, message: ticketError?.message });
      throw new Error('Ticket not found');
    }

    // Only the ticket owner (or service role / admin) may trigger notifications
    if (!caller.isServiceRole) {
      const isOwner = caller.userId && ticket.user_id === caller.userId;
      let isAdmin = false;
      if (!isOwner && caller.userId) {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', caller.userId)
          .eq('role', 'admin')
          .is('organization_id', null)
          .eq('is_active', true)
          .maybeSingle();
        isAdmin = !!roleRow;
      }
      if (!isOwner && !isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // support_tickets references auth.users, not profiles: fetch public names separately.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('user_id', ticket.user_id)
      .maybeSingle();
    if (profileError) throw new Error('Support sender lookup failed');
    const fromName = [profile?.first_name, profile?.last_name]
      .filter(Boolean).join(' ') || 'Okänd användare';

    const data = await sendLoggedTemplateEmail('support-ticket-alert', ADMIN_EMAIL, {
      idempotencyKey: `support-ticket-${ticket.id}`,
      templateData: {
        ticket_id: ticket.id,
        category: categoryLabels[ticket.category] || ticket.category || '—',
        subject: ticket.subject || 'Nytt supportärende',
        from_name: fromName,
        created_at: new Date(ticket.created_at).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }),
        message: ticket.message || '',
      },
    });

    console.log("Support notification result", { sent: data.sent });

    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in notify-support-ticket:", error);
    return new Response(
      JSON.stringify({ error: "Kunde inte skicka supportmeddelandet just nu." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

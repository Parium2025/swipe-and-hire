import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { verifyCaller } from "../_shared/service-auth.ts";
import { sendLoggedTemplateEmail } from '../_shared/transactional-email-templates/send-logged-email.ts'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Läses från secrets (samma mönster som send-admin-alert) så adressen kan bytas
// utan kodändring och inte ligger i repo-historiken.
const ADMIN_EMAIL = Deno.env.get("ADMIN_ALERT_EMAIL") ?? "fredrikandits@hotmail.com";

interface NotificationRequest {
  ticketId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const caller = await verifyCaller(req, corsHeaders);
  if (caller instanceof Response) return caller;

  try {
    const { ticketId }: NotificationRequest = await req.json();
    if (!ticketId) {
      return new Response(JSON.stringify({ error: "ticketId required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select(`*, profiles:user_id (first_name, last_name)`)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
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

    const fromName = [ticket.profiles?.first_name, ticket.profiles?.last_name]
      .filter(Boolean).join(' ') || 'Okänd användare';

    const data = await sendLoggedTemplateEmail('support-ticket-alert', ADMIN_EMAIL, {
      idempotencyKey: `support-ticket-${ticket.id}`,
      templateData: {
        ticket_id: ticket.id,
        category: ticket.category || '—',
        subject: ticket.subject || 'Nytt supportärende',
        from_name: fromName,
        created_at: new Date(ticket.created_at).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }),
        message: ticket.message || '',
      },
    });

    console.log("Support notification sent");

    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in notify-support-ticket:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);

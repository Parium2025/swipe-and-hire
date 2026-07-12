import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.3';
import { requireAuthenticated } from "../_shared/service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "fredrikandits@hotmail.com";

interface NotificationRequest {
  ticketId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const authResp = await requireAuthenticated(req, corsHeaders);
  if (authResp) return authResp;



  try {
    const { ticketId }: NotificationRequest = await req.json();

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

    const fromName = [ticket.profiles?.first_name, ticket.profiles?.last_name]
      .filter(Boolean).join(' ') || 'Okänd användare';

    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'support-ticket-alert',
        recipientEmail: ADMIN_EMAIL,
        idempotencyKey: `support-ticket-${ticket.id}`,
        templateData: {
          ticket_id: ticket.id,
          category: ticket.category || '—',
          subject: ticket.subject || 'Nytt supportärende',
          from_name: fromName,
          created_at: new Date(ticket.created_at).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' }),
          message: ticket.message || '',
        },
      },
    });

    if (error) throw error;
    console.log("Support notification enqueued:", data);

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

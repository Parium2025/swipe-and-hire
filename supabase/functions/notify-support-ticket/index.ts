import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  ticketId: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId }: NotificationRequest = await req.json();
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select(`
        *,
        profiles:user_id (first_name, last_name)
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Ticket not found');
    }

    // Initialize Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // Send notification email to admin
    const emailResponse = await resend.emails.send({
      from: "Parium Support <support@parium.se>",
      to: ["fredrikandits@hotmail.com"],
      subject: `Nytt supportärende: ${ticket.subject}`,
      html: `
        <h2>Nytt supportärende</h2>
        <p><strong>ID:</strong> ${ticket.id}</p>
        <p><strong>Kategori:</strong> ${ticket.category}</p>
        <p><strong>Ämne:</strong> ${ticket.subject}</p>
        <p><strong>Från:</strong> ${ticket.profiles?.first_name} ${ticket.profiles?.last_name}</p>
        <p><strong>Skapad:</strong> ${new Date(ticket.created_at).toLocaleString('sv-SE')}</p>
        
        <h3>Meddelande:</h3>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
          ${ticket.message.replace(/\n/g, '<br>')}
        </div>
        
        <p>Logga in på admin-panelen för att svara på ärendet.</p>
      `,
    });

    console.log("Support notification sent:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in notify-support-ticket function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
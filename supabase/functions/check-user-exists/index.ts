import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CheckUserRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email }: CheckUserRequest = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ 
        error: "Email krävs" 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log(`Checking if user exists: ${email}`);

    // Kolla om användaren finns i auth.users
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const existingUser = listData.users.find(u => u.email === email);

    if (!existingUser) {
      console.log(`User not found: ${email}`);
      return new Response(JSON.stringify({ 
        userExists: false,
        isConfirmed: false,
        message: "Användare finns inte"
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const isConfirmed = !!existingUser.email_confirmed_at;
    console.log(`User found: ${email}, confirmed: ${isConfirmed}`);

    return new Response(JSON.stringify({ 
      userExists: true,
      isConfirmed: isConfirmed,
      userId: existingUser.id,
      message: isConfirmed ? "Användare finns och är bekräftad" : "Användare finns men är inte bekräftad"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in check-user-exists:", error);
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
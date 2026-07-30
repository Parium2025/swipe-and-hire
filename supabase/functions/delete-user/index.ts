import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.53.0";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { purgeUserData } from "../_shared/user-purge.ts";

// Service role client for admin operations
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Restricted CORS - endast Pariums egna domäner
const ALLOWED_ORIGINS = [
  "https://parium.se",
  "https://www.parium.se",
  "https://parium-ab.lovable.app",
];
function corsFor(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

interface DeleteUserRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = corsFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: endast global plattformsadmin (ägarkontot) får radera andra användare.
    const adminError = await requireAdmin(req, corsHeaders);
    if (adminError) return adminError;

    const { email }: DeleteUserRequest = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ 
        error: "E-post krävs" 
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log("Admin user deletion started", { hasEmail: true });

    // 1. Hitta alla användare med denna e-post (även obekräftade)
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const userToDelete = users.users.find(user => user.email?.toLowerCase() === normalizedEmail);
    
    if (!userToDelete) {
      console.log('User not found in auth.users');
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Användaren fanns inte" 
      }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    const stats = await purgeUserData(supabaseAdmin, userToDelete.id, userToDelete.email ?? normalizedEmail);
    console.log("Admin user deletion completed", { userId: userToDelete.id, stats });

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Användaren har tagits bort helt",
      deletedUserId: userToDelete.id,
      stats,
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in delete-user:", error);
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
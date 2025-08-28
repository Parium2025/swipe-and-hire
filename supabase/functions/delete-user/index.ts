import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

// Service role client for admin operations
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Restricted CORS - only allow trusted domains
const corsHeaders = {
  "Access-Control-Allow-Origin": "https://09c4e686-17a9-467e-89b1-3cf832371d49.sandbox.lovable.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DeleteUserRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // SECURITY: Only allow super admins to delete users
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ 
        error: "Authentication required" 
      }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Create client with user's JWT to check permissions
    const userSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Check if user is super admin
    const { data: userRoles, error: roleError } = await userSupabase
      .from('user_roles')
      .select('role')
      .eq('is_active', true);

    if (roleError || !userRoles?.some(r => r.role === 'super_admin')) {
      console.log('Delete attempt by non-admin user');
      return new Response(JSON.stringify({ 
        error: "Insufficient permissions" 
      }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

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

    console.log(`Attempting to delete user with email: ${email}`);

    // 1. Hitta alla användare med denna e-post (även obekräftade)
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const userToDelete = users.users.find(user => user.email === email);
    
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

    console.log(`Found user with ID: ${userToDelete.id}`);

    // 2. Ta bort från relaterade tabeller först
    const { error: confirmationError } = await supabaseAdmin
      .from('email_confirmations')
      .delete()
      .eq('user_id', userToDelete.id);

    if (confirmationError) {
      console.error('Error deleting confirmations:', confirmationError);
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', userToDelete.id);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
    }

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userToDelete.id);

    if (roleError) {
      console.error('Error deleting roles:', roleError);
    }

    // 3. Ta bort användaren från auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.id);

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError);
      throw deleteError;
    }

    console.log(`Successfully deleted user: ${email}`);

    return new Response(JSON.stringify({ 
      success: true, 
      message: `Användare ${email} har tagits bort helt`,
      deletedUserId: userToDelete.id
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
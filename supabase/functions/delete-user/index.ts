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

interface DeleteUserRequest {
  email: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
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
    const { error: confirmationError } = await supabase
      .from('email_confirmations')
      .delete()
      .eq('user_id', userToDelete.id);

    if (confirmationError) {
      console.error('Error deleting confirmations:', confirmationError);
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('user_id', userToDelete.id);

    if (profileError) {
      console.error('Error deleting profile:', profileError);
    }

    const { error: roleError } = await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userToDelete.id);

    if (roleError) {
      console.error('Error deleting roles:', roleError);
    }

    // 3. Ta bort användaren från auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userToDelete.id);

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
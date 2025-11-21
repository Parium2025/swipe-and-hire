import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting cleanup of all users");

    // Service role client for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all users
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      throw listError;
    }

    const users = usersData.users;
    console.log(`Found ${users.length} users to delete`);

    const deletedUsers = [];
    const errors = [];

    // Delete each user
    for (const user of users) {
      try {
        console.log(`Deleting user: ${user.email} (${user.id})`);
        
        // Delete from email_confirmations
        await supabaseAdmin
          .from('email_confirmations')
          .delete()
          .eq('user_id', user.id);

        // Delete from profiles
        await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('user_id', user.id);

        // Delete from user_roles
        await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', user.id);

        // Delete from auth
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          console.error(`Error deleting user ${user.email}:`, deleteError);
          errors.push({ email: user.email, error: deleteError.message });
        } else {
          deletedUsers.push(user.email);
          console.log(`Successfully deleted user: ${user.email}`);
        }
      } catch (error: any) {
        console.error(`Error processing user ${user.email}:`, error);
        errors.push({ email: user.email, error: error.message });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      deletedUsers,
      deletedCount: deletedUsers.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Raderade ${deletedUsers.length} användare`
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error("Error in cleanup-all-users:", error);
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

import { verifyCaller } from "../_shared/service-auth.ts";
import { createApplicationConfirmationHandler } from "./handler.ts";

Deno.serve(createApplicationConfirmationHandler({
  verifyCaller,
  dispatch: async () => {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Server configuration error");
    return fetch(`${url}/functions/v1/outreach-dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ trigger: "application_received" }),
    });
  },
}));

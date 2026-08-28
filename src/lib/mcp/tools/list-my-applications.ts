import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_applications",
  title: "Mina ansökningar",
  description: "Listar den inloggade jobbsökarens egna ansökningar och deras status.",
  inputSchema: {
    limit: z.number().int().optional().describe("Max antal ansökningar, 1–100. Standard 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Inte inloggad." }], isError: true };
    }
    const take = Math.min(100, Math.max(1, Math.trunc(limit ?? 25)));
    const supabase = supabaseForUser(ctx);

    const { data, error } = await supabase
      .from("job_applications")
      .select("id, job_id, status, applied_at, updated_at, candidate_profile_label")
      .eq("applicant_id", ctx.getUserId())
      .order("applied_at", { ascending: false })
      .limit(take);

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { applications: data ?? [] },
    };
  },
});

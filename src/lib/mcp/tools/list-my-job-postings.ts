import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_job_postings",
  title: "Mina jobbannonser",
  description: "Listar den inloggade arbetsgivarens egna jobbannonser med antal ansökningar och visningar.",
  inputSchema: {
    only_active: z.boolean().optional().describe("Visa endast aktiva annonser. Standard false."),
    limit: z.number().int().optional().describe("Max antal annonser, 1–100. Standard 20."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ only_active, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Inte inloggad." }], isError: true };
    }
    const take = Math.min(100, Math.max(1, Math.trunc(limit ?? 20)));
    const supabase = supabaseForUser(ctx);

    let request = supabase
      .from("job_postings")
      .select(
        "id, title, occupation, location, is_active, applications_count, views_count, published_at, expires_at, created_at",
      )
      .eq("employer_id", ctx.getUserId())
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(take);

    if (only_active) request = request.eq("is_active", true);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { jobs: data ?? [] },
    };
  },
});

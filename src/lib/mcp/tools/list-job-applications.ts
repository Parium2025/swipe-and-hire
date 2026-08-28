import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_job_applications",
  title: "Ansökningar till en annons",
  description: "Listar ansökningar till en av arbetsgivarens egna jobbannonser.",
  inputSchema: {
    job_id: z.string().describe("Annonsens id (uuid)."),
    status: z.string().optional().describe("Filtrera på status, till exempel pending eller interview."),
    limit: z.number().int().optional().describe("Max antal ansökningar, 1–100. Standard 25."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ job_id, status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Inte inloggad." }], isError: true };
    }
    const take = Math.min(100, Math.max(1, Math.trunc(limit ?? 25)));
    const supabase = supabaseForUser(ctx);

    let request = supabase
      .from("job_applications")
      .select(
        "id, job_id, status, first_name, last_name, location, employment_status, availability, work_schedule, applied_at, viewed_at",
      )
      .eq("job_id", job_id)
      .order("applied_at", { ascending: false })
      .limit(take);

    if (status?.trim()) request = request.eq("status", status.trim());

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { applications: data ?? [] },
    };
  },
});

import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_job",
  title: "Hämta jobbannons",
  description: "Hämtar detaljer om en jobbannons på Parium via dess id.",
  inputSchema: {
    job_id: z.string().describe("Annonsens id (uuid)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ job_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Inte inloggad." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("job_postings")
      .select(
        "id, title, pitch, description, requirements, benefits, occupation, category, employment_type, work_schedule, work_location_type, remote_work_possible, location, workplace_name, workplace_city, workplace_municipality, workplace_county, salary_min, salary_max, salary_type, salary_transparency, positions_count, start_date, published_at, expires_at, is_active",
      )
      .eq("id", job_id)
      .maybeSingle();

    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) {
      return { content: [{ type: "text", text: "Annonsen hittades inte." }], isError: true };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { job: data },
    };
  },
});

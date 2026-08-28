import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

const JOB_FIELDS =
  "id, title, occupation, category, employment_type, location, workplace_city, workplace_municipality, workplace_county, work_location_type, remote_work_possible, salary_min, salary_max, salary_type, published_at, expires_at";

export default defineTool({
  name: "search_jobs",
  title: "Sök jobb",
  description: "Söker bland aktiva jobbannonser på Parium efter titel, yrke eller ort.",
  inputSchema: {
    query: z.string().optional().describe("Fritext som matchas mot annonsens titel eller yrke."),
    city: z.string().optional().describe("Ort eller kommun att filtrera på."),
    limit: z.number().int().optional().describe("Max antal träffar, 1–50. Standard 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, city, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Inte inloggad." }], isError: true };
    }
    const take = Math.min(50, Math.max(1, Math.trunc(limit ?? 10)));
    const supabase = supabaseForUser(ctx);

    let request = supabase
      .from("job_postings")
      .select(JOB_FIELDS)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("published_at", { ascending: false })
      .limit(take);

    const trimmedQuery = query?.trim();
    if (trimmedQuery) {
      const like = `%${trimmedQuery.replace(/[%,]/g, " ")}%`;
      request = request.or(`title.ilike.${like},occupation.ilike.${like}`);
    }
    const trimmedCity = city?.trim();
    if (trimmedCity) {
      const like = `%${trimmedCity.replace(/[%,]/g, " ")}%`;
      request = request.or(
        `workplace_city.ilike.${like},workplace_municipality.ilike.${like},location.ilike.${like}`,
      );
    }

    const { data, error } = await request;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { jobs: data ?? [] },
    };
  },
});

import { createFileRoute } from "@tanstack/react-router";
import PublicJobPage from "@/pages/PublicJobPage";

const BASE = "https://www.parium.se";

// Speglar PublicJobPage.tsx:s meta-komposition exakt, men körs på servern så
// att varje delad annonslänk (Messenger, WhatsApp, LinkedIn, QR) får UNIK
// titel, beskrivning och bild i förhandsvisningen — det var hela poängen med
// SSR-uppgraderingen.
type PublicJob = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  workplace_city: string | null;
  workplace_name: string | null;
  company_logo_url: string | null;
  job_image_url: string | null;
} & Record<string, unknown>;

const resolveStorageImageUrl = (
  raw: string | null | undefined,
  bucket: "job-images" | "company-logos",
  supabaseUrl: string,
): string | null => {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${trimmed}`;
};

async function fetchPublicJob(jobId: string): Promise<PublicJob | null> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
    if (!supabaseUrl || !anonKey) return null;

    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_job`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ p_job_id: jobId }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PublicJob | PublicJob[] | null;
    const job = Array.isArray(data) ? data[0] : data;
    return job && job.id ? job : null;
  } catch {
    // Metadata-hämtningen får ALDRIG fälla sidan — klienten hämtar och
    // renderar annonsen själv precis som förut.
    return null;
  }
}

export const Route = createFileRoute("/annons/$jobId")({
  loader: async ({ params }) => {
    // Endast servern behöver jobbet för <head>-metadatan; klienten har redan
    // sin egen hämtning i PublicJobPage (retry, expired-hantering, m.m.).
    if (typeof window !== "undefined") return { job: null as PublicJob | null };
    const job = await fetchPublicJob(params.jobId);
    return { job };
  },
  head: ({ loaderData, params }) => {
    const job = loaderData?.job;
    if (!job) return {};

    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
    const city = job.workplace_city || job.location || "Sverige";
    const canonical = `${BASE}/annons/${job.id}`;
    const titleSuffix = ` – ${city} | Parium`;
    const maxJobTitle = Math.max(20, 60 - titleSuffix.length);
    const shortJobTitle =
      job.title.length > maxJobTitle ? `${job.title.slice(0, maxJobTitle - 1).trimEnd()}…` : job.title;
    const title = `${shortJobTitle}${titleSuffix}`;
    const rawDesc = (job.description || "").replace(/\s+/g, " ").trim();
    const description = (
      rawDesc.slice(0, 155) ||
      `Lediga jobb som ${job.title} ${city ? "i " + city : ""}. Ansök direkt i Parium-appen.`
    ).slice(0, 158);
    const ogImage =
      resolveStorageImageUrl(job.job_image_url, "job-images", supabaseUrl) ||
      resolveStorageImageUrl(job.company_logo_url, "company-logos", supabaseUrl);

    void params;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: job.title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "article" },
        { name: "twitter:title", content: job.title },
        { name: "twitter:description", content: description },
        ...(ogImage
          ? [
              { property: "og:image", content: ogImage },
              { name: "twitter:image", content: ogImage },
            ]
          : []),
        { name: "robots", content: "index,follow,max-image-preview:large" },
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: PublicJobPage,
});

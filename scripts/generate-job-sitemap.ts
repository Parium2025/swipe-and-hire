import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE_URL = "https://www.parium.se";
const OUTPUT_PATH = resolve("public/sitemap-jobs.xml");

type JobRow = {
  id: string;
  updated_at: string | null;
  created_at: string | null;
  expires_at: string | null;
};

type PublicJobFacetsResponse = {
  jobs?: JobRow[];
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const readDotEnv = (key: string) => {
  try {
    const envFile = readFileSync(resolve(".env"), "utf8");
    const match = envFile.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match?.[1]?.trim().replace(/^['\"]|['\"]$/g, "");
  } catch {
    return undefined;
  }
};

const getEnv = (key: string) => process.env[key] || readDotEnv(key);

const generateSitemap = (jobs: JobRow[]) => {
  const urls = jobs
    .map((job) => {
      const lastmod = (job.updated_at || job.created_at || "").slice(0, 10);
      return [
        "  <url>",
        `    <loc>${BASE_URL}/annons/${escapeXml(job.id)}</loc>`,
        lastmod ? `    <lastmod>${escapeXml(lastmod)}</lastmod>` : null,
        "    <changefreq>daily</changefreq>",
        "    <priority>0.8</priority>",
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
  ].join("\n");
};

async function main() {
  const supabaseUrl = getEnv("VITE_SUPABASE_URL") || getEnv("SUPABASE_URL");
  const anonKey = getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") || getEnv("VITE_SUPABASE_ANON_KEY") || getEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.warn("Skipping job sitemap generation: secure backend build env vars are unavailable.");
    return;
  }

  // Anonym direktläsning av job_postings är avsiktligt stängd. Sitemap skapas
  // endast i betrodd CI/buildmiljö med service_role och publicerar en statisk XML.
  const now = new Date().toISOString();
  const params = new URLSearchParams({
    select: "id,updated_at,created_at,expires_at",
    is_active: "eq.true",
    deleted_at: "is.null",
    or: `(expires_at.is.null,expires_at.gt.${now})`,
    order: "created_at.desc",
    limit: "45000",
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/job_postings?${params}`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    const details = await response.text();
    console.warn(`Skipping job sitemap generation: ${response.status} ${details}`);
    return;
  }

  const jobs = (await response.json()) as JobRow[];
  writeFileSync(OUTPUT_PATH, generateSitemap(jobs));
  console.log(`sitemap-jobs.xml written (${jobs.length} active jobs)`);
}

main().catch((error) => {
  console.warn("Skipping job sitemap generation:", error instanceof Error ? error.message : error);
});
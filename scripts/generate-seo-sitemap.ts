// Genererar public/sitemap-static.xml från scripts/sitemap-static.source.xml.
// Kombinationssidor (/jobb/{stad}/{yrke}) utan aktiva annonser utesluts, så att
// Google slipper "Soft 404" och crawl-budgeten går till sidor med innehåll.
// Sidorna kommer automatiskt tillbaka i sitemap när det finns jobb igen.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE_PATH = resolve("scripts/sitemap-static.source.xml");
const OUTPUT_PATH = resolve("public/sitemap-static.xml");

const readDotEnv = (key: string) => {
  try {
    const envFile = readFileSync(resolve(".env"), "utf8");
    const match = envFile.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match?.[1]?.trim().replace(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
};

const getEnv = (key: string) => process.env[key] || readDotEnv(key);

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/å/g, "a")
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

async function fetchComboCounts(): Promise<Set<string> | null> {
  const supabaseUrl = getEnv("VITE_SUPABASE_URL") || getEnv("SUPABASE_URL");
  const anonKey =
    getEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("VITE_SUPABASE_ANON_KEY") ||
    getEnv("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/get_public_job_facets`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) return null;

  const rows = (await response.json()) as Array<{
    city: string | null;
    occupation: string | null;
    job_count: number;
  }>;

  const withJobs = new Set<string>();
  for (const row of rows) {
    if ((Number(row.job_count) || 0) <= 0) continue;
    const city = row.city ? slugify(row.city) : "";
    const occ = row.occupation ? slugify(row.occupation) : "";
    if (city && occ) withJobs.add(`${city}/${occ}`);
  }
  return withJobs;
}

async function main() {
  const source = readFileSync(SOURCE_PATH, "utf8");
  const withJobs = await fetchComboCounts();

  if (!withJobs) {
    // Ingen tillförlitlig data — publicera den kompletta listan oförändrad.
    writeFileSync(OUTPUT_PATH, source);
    console.warn("sitemap-static.xml written unfiltered (job facets unavailable)");
    return;
  }

  let removed = 0;
  const filtered = source.replace(/ {2}<url>[\s\S]*?<\/url>\n?/g, (block) => {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1] ?? "";
    const path = loc.replace(/^https?:\/\/[^/]+/, "");
    const combo = path.match(/^\/jobb\/([^/]+)\/([^/]+)\/?$/);
    if (!combo) return block;
    if (withJobs.has(`${combo[1]}/${combo[2]}`)) return block;
    removed += 1;
    return "";
  });

  writeFileSync(OUTPUT_PATH, filtered);
  console.log(`sitemap-static.xml written (${removed} empty city/occupation pages excluded)`);
}

main().catch((error) => {
  console.warn("Skipping SEO sitemap filtering:", error instanceof Error ? error.message : error);
});

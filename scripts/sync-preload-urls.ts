/**
 * Håller <link rel="preload">-URL:erna i index.html synkade med assets.
 *
 * Bakgrund: index.html är statisk och kan inte importera `*.asset.json`, så
 * varje video-/poster-URL står hårdkodad där. När en fil kodas om får den ett
 * nytt asset-ID → preload-länken pekar på den GAMLA filen. Browsern hämtar då
 * en oanvänd master i högsta prioritet och laddar sedan den riktiga filen igen:
 * dubbel nedladdning och långsammare kallstart.
 *
 * Skriptet läser alla `src/assets/**\/*.asset.json`, matchar på filnamnet i
 * URL:en och skriver om asset-ID:t när det skiljer sig. Endast ID:t ändras —
 * ingen selektionslogik, inga Windows-/Apple-vägar rörs.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = 'src/assets';
const INDEX = 'index.html';

type Asset = { url?: string; original_filename?: string };

const byFilename = new Map<string, string>();

const walk = (dir: string) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.endsWith('.asset.json')) continue;
    try {
      const asset = JSON.parse(readFileSync(full, 'utf8')) as Asset;
      if (!asset.url) continue;
      const filename = asset.url.split('/').pop();
      if (filename) byFilename.set(filename, asset.url);
    } catch {
      /* trasig/ofullständig asset-fil ignoreras */
    }
  }
};

walk(ASSETS_DIR);

const html = readFileSync(INDEX, 'utf8');
const changes: string[] = [];
const missing: string[] = [];

const next = html.replace(/\/__l5e\/assets-v1\/[0-9a-f-]{36}\/([^"'\s)]+)/g, (match, filename: string) => {
  const correct = byFilename.get(filename);
  if (!correct) {
    if (!missing.includes(filename)) missing.push(filename);
    return match;
  }
  if (correct !== match) changes.push(`${filename}\n    ${match}\n → ${correct}`);
  return correct;
});

if (missing.length) {
  console.warn(`[preload-sync] Ingen asset hittad för: ${missing.join(', ')} (lämnas orörd)`);
}

if (next !== html) {
  writeFileSync(INDEX, next);
  console.log(`[preload-sync] Uppdaterade ${changes.length} preload-URL:er:\n  - ${changes.join('\n  - ')}`);
} else {
  console.log('[preload-sync] Alla preload-URL:er är redan aktuella.');
}

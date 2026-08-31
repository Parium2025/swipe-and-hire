import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';

const DIST_DIR = resolve(process.cwd(), 'dist');
const WORKER_PATH = join(DIST_DIR, 'sw.js');
const MAX_PRECACHE_BYTES = 8 * 1024 * 1024;

const fail = (message) => {
  throw new Error(`[offline-precache] ${message}`);
};

if (!existsSync(WORKER_PATH)) fail('dist/sw.js saknas; kör produktionsbygget först.');

const listFiles = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const absolute = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(absolute) : [absolute];
  });

const toDistPath = (absolutePath) => relative(DIST_DIR, absolutePath).split(sep).join('/');
const allDistFiles = listFiles(DIST_DIR).map(toDistPath);
const homeEntries = allDistFiles.filter((file) => /^assets\/Index-[^/]+\.js$/.test(file));
if (homeEntries.length === 0) fail('ingen byggd Jobseeker Home-entry (assets/Index-*.js) hittades.');

const staticImportPattern = /\b(?:import|export)(?:[^"'`]*?\bfrom\s*)?["'](\.[^"']+\.js)["']/g;
const closure = new Set();
const queue = [...homeEntries];

while (queue.length > 0) {
  const file = queue.shift();
  if (!file || closure.has(file)) continue;
  closure.add(file);

  const absolute = join(DIST_DIR, file);
  if (!existsSync(absolute)) fail(`statisk Home-import saknas i dist: ${file}`);
  const source = readFileSync(absolute, 'utf8');
  for (const match of source.matchAll(staticImportPattern)) {
    const imported = normalize(join(dirname(file), match[1])).split(sep).join('/');
    if (imported.startsWith('../')) fail(`Home-import lämnar dist: ${file} -> ${match[1]}`);
    queue.push(imported);
  }
}

const workerSource = readFileSync(WORKER_PATH, 'utf8');
const missingFromPrecache = [...closure].filter((file) => !workerSource.includes(file));
if (missingFromPrecache.length > 0) {
  fail(`Home:s statiska importkedja saknas i precache: ${missingFromPrecache.join(', ')}`);
}

const precacheUrls = new Set(
  [...workerSource.matchAll(/["']?url["']?:["']([^"']+)["']/g)]
    .map((match) => match[1].replace(/^\//, '').split('?')[0])
    .filter((url) => url && existsSync(join(DIST_DIR, url))),
);
const precacheBytes = [...precacheUrls]
  .reduce((total, url) => total + statSync(join(DIST_DIR, url)).size, 0);

if (precacheBytes > MAX_PRECACHE_BYTES) {
  fail(
    `precache är ${(precacheBytes / 1024 / 1024).toFixed(2)} MiB; budgeten är ` +
      `${(MAX_PRECACHE_BYTES / 1024 / 1024).toFixed(2)} MiB.`,
  );
}

console.log(
  `[offline-precache] OK: ${closure.size} Home-moduler, ${precacheUrls.size} filer, ` +
    `${(precacheBytes / 1024 / 1024).toFixed(2)} MiB.`,
);

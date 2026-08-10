/**
 * Build-gate: index.html:s hero-preload MÅSTE peka på exakt samma filer som
 * `src/lib/heroVideoSource.ts`. Går de isär hämtar browsern två videofiler och
 * spelar bara den ena — osynligt i preview, dyrt i produktion.
 *
 * Körs i predev/prebuild. Failar bygget vid avvikelse.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir ?? process.cwd(), '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

const source = read('src/lib/heroVideoSource.ts');
const html = read('index.html');

const pick = (re: RegExp, label: string, text: string) => {
  const m = text.match(re);
  if (!m) throw new Error(`verify-hero-preload: hittade inte ${label}`);
  return m[1];
};

const assetPointerPath = 'src/assets/hero-video-v9.mp4.asset.json';
const asset = JSON.parse(read(assetPointerPath)) as { url: string };
const asset1080Path = 'src/assets/hero-video-1080-v9.mp4.asset.json';
const asset1080 = JSON.parse(read(asset1080Path)) as { url: string };

const asset1440Path = 'src/assets/hero-video-1440-v9.mp4.asset.json';
const asset1440 = JSON.parse(read(asset1440Path)) as { url: string };

const src1080 = asset1080.url;
if (!/HERO_VIDEO_1440 = hero1440\.url/.test(source)) {
  throw new Error('verify-hero-preload: HERO_VIDEO_1440 pekar inte på 1440p-pointern');
}
if (!/HERO_VIDEO_1080 = hero1080\.url/.test(source)) {
  throw new Error('verify-hero-preload: HERO_VIDEO_1080 pekar inte på 1080p-pointern');
}
const poster = pick(/HERO_POSTER = '([^']+)'/, 'HERO_POSTER', source);
const query = pick(/HERO_DESKTOP_QUERY = '([^']+)'/, 'HERO_DESKTOP_QUERY', source);

const errors: string[] = [];

if (!html.includes(asset.url)) {
  errors.push(`index.html saknar 4K-URL:en från ${assetPointerPath} (${asset.url})`);
}
if (!html.includes(asset1440.url)) {
  errors.push(`index.html saknar 1440p-källan ${asset1440.url}`);
}
if (!html.includes(src1080)) {
  errors.push(`index.html saknar 1080p-källan ${src1080}`);
}
if (!html.includes(poster)) {
  errors.push(`index.html saknar postern ${poster}`);
}
if (!html.includes(query)) {
  errors.push(`index.html använder inte breakpointen ${query}`);
}
for (const localFile of [poster]) {
  if (!existsSync(resolve(root, 'public', localFile.replace(/^\//, '')))) {
    errors.push(`Filen saknas i public/: ${localFile}`);
  }
}

if (errors.length) {
  console.error('\n✖ Hero-video: preload och källval är inte synkade\n');
  for (const e of errors) console.error(`  - ${e}`);
  console.error('\nUppdatera index.html eller src/lib/heroVideoSource.ts så de matchar.\n');
  process.exit(1);
}

console.log('✓ Hero-video: index.html och heroVideoSource.ts är synkade');

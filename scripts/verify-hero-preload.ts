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
const asset1080Path = 'src/assets/hero-video-1080-v10.mp4.asset.json';
const asset1080 = JSON.parse(read(asset1080Path)) as { url: string };

const asset1440Path = 'src/assets/hero-video-1440-v9.mp4.asset.json';
const asset1440 = JSON.parse(read(asset1440Path)) as { url: string };

const assetPortraitPath = 'src/assets/hero-portrait-v12.mp4.asset.json';
const assetPortrait = JSON.parse(read(assetPortraitPath)) as { url: string };
const assetSquarePath = 'src/assets/hero-square-v12.mp4.asset.json';
const assetSquare = JSON.parse(read(assetSquarePath)) as { url: string };
const assetSquarePosterPath = 'src/assets/hero-poster-square-v12.jpg.asset.json';
const assetSquarePoster = JSON.parse(read(assetSquarePosterPath)) as { url: string };
const assetPortraitPosterPath = 'src/assets/hero-poster-portrait-v12.jpg.asset.json';
const assetPortraitPoster = JSON.parse(read(assetPortraitPosterPath)) as { url: string };

const src1080 = asset1080.url;
if (!/HERO_VIDEO_1440 = hero1440\.url/.test(source)) {
  throw new Error('verify-hero-preload: HERO_VIDEO_1440 pekar inte på 1440p-pointern');
}
if (!/HERO_VIDEO_1080 = hero1080\.url/.test(source)) {
  throw new Error('verify-hero-preload: HERO_VIDEO_1080 pekar inte på 1080p-pointern');
}
const poster = pick(/HERO_POSTER = '([^']+)'/, 'HERO_POSTER', source);
const posterPortrait = pick(/HERO_POSTER_PORTRAIT = '([^']+)'/, 'HERO_POSTER_PORTRAIT', source);
const portraitQuery = pick(/HERO_PORTRAIT_QUERY = '([^']+)'/, 'HERO_PORTRAIT_QUERY', source);
const squareQuery = pick(/HERO_SQUARE_QUERY = '([^']+)'/, 'HERO_SQUARE_QUERY', source);
const query = pick(/HERO_DESKTOP_QUERY = '([^']+)'/, 'HERO_DESKTOP_QUERY', source);

const errors: string[] = [];

if (!html.includes(asset.url)) {
  errors.push(`index.html saknar 4K-URL:en från ${assetPointerPath} (${asset.url})`);
}
if (!html.includes(asset1440.url)) {
  errors.push(`index.html saknar 1440p-källan ${asset1440.url}`);
}
if (!html.includes(assetPortrait.url)) {
  errors.push(`index.html saknar den stående källan ${assetPortrait.url}`);
}
if (!html.includes(assetSquare.url)) {
  errors.push(`index.html saknar 4:5-källan ${assetSquare.url}`);
}
if (!html.includes(assetSquarePoster.url)) {
  errors.push(`index.html saknar 4:5-postern ${assetSquarePoster.url}`);
}
if (!html.includes(assetPortraitPoster.url)) {
  errors.push(`index.html saknar den stående postern ${assetPortraitPoster.url}`);
}
if (!html.includes(posterPortrait)) {
  errors.push(`index.html saknar den stående postern ${posterPortrait}`);
}
if (!html.includes(portraitQuery)) {
  errors.push(`index.html använder inte ${portraitQuery}`);
}
if (!html.includes(squareQuery)) {
  errors.push(`index.html använder inte ${squareQuery}`);
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

#!/usr/bin/env node
/**
 * Skriver in svenska behörighetstexter (usage descriptions) i iOS Info.plist.
 * Körs efter `npx cap add ios` / `npx cap sync ios`:
 *
 *   node scripts/ios-info-plist.mjs
 *
 * Idempotent: befintliga nycklar uppdateras, saknade läggs till.
 * Rör inget i webbappen.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const PLIST_PATH = 'ios/App/App/Info.plist';

/** Nyckel -> svensk text som visas i systemets behörighetsdialog. */
const USAGE_DESCRIPTIONS = {
  NSCameraUsageDescription:
    'Parium använder kameran när du spelar in din presentationsvideo eller tar en profilbild.',
  NSMicrophoneUsageDescription:
    'Parium använder mikrofonen när du spelar in din presentationsvideo.',
  NSPhotoLibraryUsageDescription:
    'Parium behöver tillgång till dina bilder när du vill ladda upp en profilbild, en annonsbild eller en video.',
  NSPhotoLibraryAddUsageDescription:
    'Parium sparar bilder och videor du laddar ner från appen i ditt bildbibliotek.',
  NSLocationWhenInUseUsageDescription:
    'Parium använder din plats för att visa jobb nära dig och för att fylla i arbetsplatsens adress automatiskt.',
  NSLocationAlwaysAndWhenInUseUsageDescription:
    'Parium kan använda din plats i bakgrunden för att meddela dig om nya jobb i närheten. Du kan stänga av detta när som helst.',
  NSUserTrackingUsageDescription:
    'Parium spårar dig inte i andra appar. Denna behörighet används endast om du väljer att dela statistik med oss.',
  NSFaceIDUsageDescription:
    'Parium använder Face ID för att du snabbt och säkert ska kunna logga in på ditt konto.',
};

if (!existsSync(PLIST_PATH)) {
  console.error(
    `✖ Hittar inte ${PLIST_PATH}. Kör "npx cap add ios" först och därefter detta skript igen.`
  );
  process.exit(1);
}

let plist = readFileSync(PLIST_PATH, 'utf8');

const escapeXml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

let updated = 0;
let added = 0;
const pending = [];

for (const [key, value] of Object.entries(USAGE_DESCRIPTIONS)) {
  const escaped = escapeXml(value);
  const existing = new RegExp(
    `(<key>${key}</key>\\s*<string>)([\\s\\S]*?)(</string>)`
  );

  if (existing.test(plist)) {
    plist = plist.replace(existing, `$1${escaped}$3`);
    updated += 1;
  } else {
    pending.push(`\t<key>${key}</key>\n\t<string>${escaped}</string>`);
    added += 1;
  }
}

if (pending.length > 0) {
  const closingIndex = plist.lastIndexOf('</dict>');
  if (closingIndex === -1) {
    console.error('✖ Kunde inte tolka Info.plist (saknar </dict>).');
    process.exit(1);
  }
  plist =
    plist.slice(0, closingIndex) +
    pending.join('\n') +
    '\n' +
    plist.slice(closingIndex);
}

writeFileSync(PLIST_PATH, plist, 'utf8');

console.log(
  `✔ Info.plist uppdaterad — ${added} nya behörighetstexter, ${updated} uppdaterade.`
);

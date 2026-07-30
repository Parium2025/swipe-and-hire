// 🔒 GDPR art. 17 — fullständig radering av en användares filer i storage.
//
// Varför denna fil finns: en enkel `.list(userId, { limit: 1000 })` missar
//   1) användare med fler än 1000 filer (paginering saknas)
//   2) filer som ligger i undermappar (t.ex. userId/cv/fil.pdf)
// Båda fallen lämnade kvar personuppgifter efter en "radering". Använd ALLTID
// purgeUserStorage() vid kontoradering.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const PAGE_SIZE = 1000;

/** Listar rekursivt ALLA filer under ett prefix, med paginering. */
export async function listAllFilesRecursive(
  admin: SupabaseClient,
  bucket: string,
  prefix: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 6) return []; // skydd mot oändlig rekursion
  const found: string[] = [];
  let offset = 0;

  while (true) {
    const { data: items, error } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) {
      console.warn(`⚠️ list ${bucket}/${prefix} (offset ${offset}):`, error.message);
      break;
    }
    if (!items || items.length === 0) break;

    for (const item of items) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      // Supabase markerar mappar med id === null
      if (item.id === null) {
        const nested = await listAllFilesRecursive(admin, bucket, fullPath, depth + 1);
        found.push(...nested);
      } else {
        found.push(fullPath);
      }
    }

    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return found;
}

/**
 * Raderar ALLA filer som tillhör en användare i angivna buckets.
 * Returnerar antal raderade filer. Kastar aldrig — loggar och fortsätter.
 */
export async function purgeUserStorage(
  admin: SupabaseClient,
  userId: string,
  buckets: string[],
): Promise<number> {
  let removed = 0;

  for (const bucket of buckets) {
    try {
      const paths = await listAllFilesRecursive(admin, bucket, userId);
      if (paths.length === 0) continue;

      // storage.remove() tar max ~1000 paths per anrop
      for (let i = 0; i < paths.length; i += PAGE_SIZE) {
        const chunk = paths.slice(i, i + PAGE_SIZE);
        const { error } = await admin.storage.from(bucket).remove(chunk);
        if (error) {
          console.warn(`⚠️ remove ${bucket} (${chunk.length} filer):`, error.message);
        } else {
          removed += chunk.length;
        }
      }

      // Verifiera att mappen faktiskt är tom efteråt
      const leftovers = await listAllFilesRecursive(admin, bucket, userId);
      if (leftovers.length > 0) {
        console.error(
          `❌ ${leftovers.length} filer kvar i ${bucket}/${userId} efter radering`,
          leftovers.slice(0, 10),
        );
      }
    } catch (e) {
      console.warn(`⚠️ storage cleanup ${bucket}:`, (e as Error).message);
    }
  }

  return removed;
}

/** Buckets som kan innehålla filer namngivna med användarens id. */
export const USER_STORAGE_BUCKETS = [
  'job-applications', // profilbild, profilvideo, cover, CV, ansökningsdokument
  'company-logos',
  'job-images',
  'message-attachments',
];

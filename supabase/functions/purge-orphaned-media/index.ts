// 🔒 GDPR art. 5.1.e (lagringsminimering) + art. 17 (radering)
//
// Sveper igenom bucketen `job-applications` (profilbilder, profilvideor,
// cover-bilder och CV:n) och raderar filer som INTE längre refereras någonstans
// i databasen — t.ex. gamla profilbilder som ersatts, eller CV:n som hörde till
// ansökningar som raderats av den nattliga gallringen.
//
// Säkerhetsspärrar:
//  • Endast service_role / cron-secret får anropa funktionen.
//  • Filer yngre än MIN_AGE_DAYS rörs aldrig (skyddar pågående uppladdningar).
//  • Standardläge är dry_run — riktig radering kräver { "dry_run": false }.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireServiceRoleOrCronSecret } from '../_shared/service-auth.ts'
import { listAllFilesRecursive } from '../_shared/storage-cleanup.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BUCKET = 'job-applications'
const MIN_AGE_DAYS = 7
const PAGE = 1000

function normalize(value: string | null | undefined): string | null {
  if (!value) return null
  let path = value
  if (path.startsWith('http')) {
    const match = path.match(/\/storage\/v1\/object\/(?:public|sign)\/[^/]+\/(.+?)(?:\?|$)/)
    if (!match) return null
    path = decodeURIComponent(match[1])
  }
  return path.replace(/^\/+/, '')
}

/** Hämtar alla refererade storage-paths ur databasen (paginerat). */
async function collectReferencedPaths(
  admin: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const referenced = new Set<string>()

  const sources: { table: string; columns: string[] }[] = [
    { table: 'profiles', columns: ['profile_image_url', 'video_url', 'cover_image_url', 'cv_url'] },
    {
      table: 'job_applications',
      columns: ['cv_url', 'profile_image_snapshot_url', 'video_snapshot_url'],
    },
    { table: 'profile_cv_summaries', columns: ['cv_url'] },
    { table: 'cv_analysis_queue', columns: ['cv_url'] },
  ]

  for (const { table, columns } of sources) {
    let from = 0
    while (true) {
      const { data, error } = await admin
        .from(table)
        .select(columns.join(','))
        .range(from, from + PAGE - 1)

      if (error) {
        // Om vi inte kan läsa en källa vet vi inte vad som används → avbryt helt.
        throw new Error(`Kunde inte läsa ${table}: ${error.message}`)
      }
      if (!data || data.length === 0) break

      for (const row of data as Record<string, string | null>[]) {
        for (const col of columns) {
          const p = normalize(row[col])
          if (p) referenced.add(p)
        }
      }

      if (data.length < PAGE) break
      from += PAGE
    }
  }

  return referenced
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const denied = await requireServiceRoleOrCronSecret(req, corsHeaders)
  if (denied) return denied

  let dryRun = true
  try {
    const body = await req.json()
    dryRun = body?.dry_run !== false
  } catch {
    dryRun = true
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  try {
    const referenced = await collectReferencedPaths(admin)
    const allFiles = await listAllFilesRecursive(admin, BUCKET, '')

    const cutoff = Date.now() - MIN_AGE_DAYS * 24 * 60 * 60 * 1000
    const orphans: string[] = []
    let tooYoung = 0

    // Hämta metadata (created_at) via list per mapp är dyrt — vi läser istället
    // tidsstämpeln ur filnamnet (`{userId}/{timestamp}-{rand}.ext`), som sätts av
    // mediaManager. Saknas tidsstämpel behandlas filen som gammal nog.
    for (const path of allFiles) {
      if (referenced.has(path)) continue

      const fileName = path.split('/').pop() ?? ''
      const tsMatch = fileName.match(/^(\d{13})-/)
      if (tsMatch && Number(tsMatch[1]) > cutoff) {
        tooYoung++
        continue
      }
      orphans.push(path)
    }

    let deleted = 0
    if (!dryRun && orphans.length > 0) {
      for (let i = 0; i < orphans.length; i += PAGE) {
        const chunk = orphans.slice(i, i + PAGE)
        const { error } = await admin.storage.from(BUCKET).remove(chunk)
        if (error) console.warn('⚠️ remove misslyckades:', error.message)
        else deleted += chunk.length
      }
    }

    console.log(
      `🧹 Orphan sweep (${dryRun ? 'DRY RUN' : 'SKARP'}): ${allFiles.length} filer, ` +
        `${referenced.size} refererade, ${orphans.length} föräldralösa, ${deleted} raderade`,
    )

    return new Response(
      JSON.stringify({
        dry_run: dryRun,
        total_files: allFiles.length,
        referenced: referenced.size,
        orphaned: orphans.length,
        skipped_too_young: tooYoung,
        deleted,
        sample: orphans.slice(0, 20),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('❌ purge-orphaned-media:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

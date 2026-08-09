// GDPR: automatisk hantering av inaktiva konton.
//
// Steg 1 — VARNING: konton utan aktivitet på 12 månader får ett mejl och
//          schemaläggs för radering 365 dagar senare, med påminnelser när 180,
//          90, 7 respektive 1 dag återstår.

// Steg 2 — RADERING: konton vars varningsperiod löpt ut och som fortfarande är
//          inaktiva raderas permanent (profil, data, storage, auth-konto).
// Steg 3 — ÅTERKALLNING: har personen loggat in efter varningen avbryts allt.
//
// Körs nattligt via pg_cron (04:15) → trigger_inactive_account_retention().

import { createClient } from 'npm:@supabase/supabase-js@2'
import { requireServiceRoleOrCronSecret } from '../_shared/service-auth.ts'
import { purgeUserData } from '../_shared/user-purge.ts'
import { forEachAuthUser } from '../_shared/find-user.ts'


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const INACTIVE_MONTHS = 12
// 365 dagars frist — ett helt år. Kortare frister (30/90 dagar) riskerar att
// missas vid semester, sjukdom eller föräldraledighet.
const GRACE_DAYS = 365
// Påminnelser när det återstår 180, 90, 7 respektive 1 dag (fallande ordning).
// Den sista (1 dag) är "sista chansen" — därefter raderas kontot.
const REMINDER_DAYS = [180, 90, 7, 1] as const
const REMINDER_FIELD: Record<number, string> = {
  180: 'reminder_180_sent_at',
  90: 'reminder_90_sent_at',
  7: 'reminder_7_sent_at',
  1: 'reminder_1_sent_at',
}

const WARN_BATCH = 200
const DELETE_BATCH = 50


const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

function monthsAgo(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d.toISOString()
}

/** Full radering av en användares data — samma modul som delete-my-account. */
// deno-lint-ignore no-explicit-any
async function purgeUser(admin: any, userId: string, email: string | null) {
  const stats = await purgeUserData(admin, userId, email)
  console.log(`🗑️ inaktivt konto ${userId} raderat`, stats)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const authResp = await requireServiceRoleOrCronSecret(req, corsHeaders)
  if (authResp) return authResp

  const admin = createClient(supabaseUrl, serviceKey)
  const now = new Date()
  const stats = { warned: 0, deleted: 0, cancelled: 0, orphans_deleted: 0, errors: 0 }

  try {
    // ── Steg 3: avbryt varningar för konton som blivit aktiva igen ──
    const { data: pending } = await admin
      .from('account_inactivity_notices')
      .select('id, user_id, email, warned_at, scheduled_delete_at, reminder_180_sent_at, reminder_90_sent_at, reminder_7_sent_at, reminder_1_sent_at')
      .is('deleted_at', null)
      .is('cancelled_at', null)

    const pendingList = pending ?? []
    if (pendingList.length > 0) {
      const { data: activeProfiles } = await admin
        .from('profiles')
        .select('user_id, last_active_at, first_name')
        .in('user_id', pendingList.map((p: { user_id: string }) => p.user_id))

      const activeMap = new Map(
        (activeProfiles ?? []).map((p: { user_id: string; last_active_at: string | null }) => [p.user_id, p.last_active_at]),
      )
      const nameMap = new Map(
        (activeProfiles ?? []).map((p: { user_id: string; first_name: string | null }) => [p.user_id, p.first_name]),
      )

      type Notice = {
        id: string
        user_id: string
        email: string | null
        warned_at: string
        scheduled_delete_at: string
        reminder_180_sent_at: string | null
        reminder_90_sent_at: string | null
        reminder_7_sent_at: string | null
        reminder_1_sent_at: string | null
      }

      for (const notice of pendingList as Notice[]) {
        const lastActive = activeMap.get(notice.user_id)
        if (lastActive && new Date(lastActive) > new Date(notice.warned_at)) {
          await admin
            .from('account_inactivity_notices')
            .update({ cancelled_at: now.toISOString() })
            .eq('id', notice.id)
          stats.cancelled++
          continue
        }

        // ── Påminnelser 180, 90 och 7 dagar före radering ──
        const daysLeft = Math.ceil(
          (new Date(notice.scheduled_delete_at).getTime() - now.getTime()) / 86_400_000,
        )
        if (daysLeft <= 0 || !notice.email) continue

        // Mest brådskande steg som redan passerats (minsta tröskel >= daysLeft).
        const due = REMINDER_DAYS.filter((t) => daysLeft <= t)
        if (due.length === 0) continue
        const threshold = due[due.length - 1]
        const field = REMINDER_FIELD[threshold]
        // deno-lint-ignore no-explicit-any
        if ((notice as any)[field]) continue

        // Överhoppade (större) steg markeras som skickade så att de inte
        // triggar retroaktivt om jobbet legat nere en period.
        const patch: Record<string, string> = {}
        for (const t of due) patch[REMINDER_FIELD[t]] = now.toISOString()

        // VIKTIGT: vi "checkar ut" påminnelsen i databasen INNAN mejlet skickas.
        // Om vi istället markerade efteråt och den skrivningen misslyckades
        // skulle samma påminnelse mejlas ut på nytt varje natt tills den gick
        // igenom — dvs en utskickskaskad mot samma mottagare.
        const { error: claimError } = await admin
          .from('account_inactivity_notices')
          .update(patch)
          .eq('id', notice.id)
          .is(field, null)
          .select('id')
          .maybeSingle()

        if (claimError) {
          console.error(`kunde inte reservera påminnelse ${threshold}d:`, claimError.message)
          stats.errors++
          continue
        }

        try {
          await admin.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'account-inactivity-warning',
              recipientEmail: notice.email,
              idempotencyKey: `inactivity-reminder-${threshold}-${notice.user_id}-${notice.warned_at.slice(0, 10)}`,
              templateData: {
                first_name: nameMap.get(notice.user_id) || 'där',
                delete_date: new Date(notice.scheduled_delete_at).toLocaleDateString('sv-SE'),
                days_left: String(Math.max(daysLeft, 1)),
              },
            },
          })
        } catch (e) {
          // Skicket misslyckades → släpp reservationen så att nästa körning
          // kan försöka igen. Endast det aktuella steget återställs.
          console.warn(`reminder ${threshold}d failed:`, { noticeId: notice.id, message: (e as Error).message })
          await admin
            .from('account_inactivity_notices')
            .update({ [field]: null })
            .eq('id', notice.id)
          stats.errors++
        }

      }

    }


    // ── Steg 2: radera konton vars frist löpt ut ──
    const { data: due } = await admin
      .from('account_inactivity_notices')
      .select('id, user_id, email')
      .is('deleted_at', null)
      .is('cancelled_at', null)
      .lte('scheduled_delete_at', now.toISOString())
      .limit(DELETE_BATCH)

    for (const notice of (due ?? []) as { id: string; user_id: string; email: string | null }[]) {
      try {
        await purgeUser(admin, notice.user_id, notice.email)
        await admin
          .from('account_inactivity_notices')
          .update({ deleted_at: now.toISOString(), error_message: null })
          .eq('id', notice.id)
        stats.deleted++
      } catch (e) {
        stats.errors++
        console.error(`purge failed for ${notice.user_id}:`, (e as Error).message)
        await admin
          .from('account_inactivity_notices')
          .update({ error_message: (e as Error).message })
          .eq('id', notice.id)
      }
    }

    // ── Steg 1: varna nya inaktiva konton ──
    const cutoff = monthsAgo(INACTIVE_MONTHS)
    const { data: candidates } = await admin
      .from('profiles')
      .select('user_id, email, first_name, last_active_at, created_at')
      .or(`last_active_at.lt.${cutoff},and(last_active_at.is.null,created_at.lt.${cutoff})`)
      .limit(WARN_BATCH)

    const candidateList = (candidates ?? []) as {
      user_id: string
      email: string | null
      first_name: string | null
      last_active_at: string | null
      created_at: string
    }[]

    if (candidateList.length > 0) {
      // OBS: bara PÅGÅENDE varningar räknas som "redan varnad". En användare som
      // loggade in (cancelled_at satt) och sedan blev inaktiv igen måste kunna
      // varnas på nytt — annars fastnar kontot och raderas aldrig.
      const { data: existing } = await admin
        .from('account_inactivity_notices')
        .select('user_id')
        .is('deleted_at', null)
        .is('cancelled_at', null)
        .in('user_id', candidateList.map((c) => c.user_id))
      const alreadyNoticed = new Set((existing ?? []).map((e: { user_id: string }) => e.user_id))

      const deleteAt = new Date(now.getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000)

      for (const profile of candidateList) {
        if (alreadyNoticed.has(profile.user_id)) continue

        let email = profile.email
        if (!email) {
          const { data: authUser } = await admin.auth.admin.getUserById(profile.user_id)
          email = authUser?.user?.email ?? null
        }

        // user_id är unikt — återanvänd raden vid en ny varningsomgång.
        const { error: insertErr } = await admin.from('account_inactivity_notices').upsert(
          {
            user_id: profile.user_id,
            email,
            last_active_at: profile.last_active_at ?? profile.created_at,
            warned_at: now.toISOString(),
            scheduled_delete_at: deleteAt.toISOString(),
            cancelled_at: null,
            deleted_at: null,
            error_message: null,
            reminder_180_sent_at: null,
            reminder_90_sent_at: null,
            reminder_7_sent_at: null,
            reminder_1_sent_at: null,

          },
          { onConflict: 'user_id' },
        )
        if (insertErr) {
          console.warn(`notice insert failed for ${profile.user_id}:`, insertErr.message)
          continue
        }
        stats.warned++

        if (email) {
          try {
            await admin.functions.invoke('send-transactional-email', {
              body: {
                templateName: 'account-inactivity-warning',
                recipientEmail: email,
                // datumstämpel så att en ny varningsomgång inte dedupliceras bort
                idempotencyKey: `inactivity-warning-${profile.user_id}-${now.toISOString().slice(0, 10)}`,

                templateData: {
                  first_name: profile.first_name || 'där',
                  delete_date: deleteAt.toLocaleDateString('sv-SE'),
                  days_left: String(GRACE_DAYS),
                },
              },
            })
          } catch (e) {
            console.warn('warning email failed:', { userId: profile.user_id, message: (e as Error).message })
          }
        }
      }
    }

    // ── Steg 4: föräldralösa auth-konton ──
    // Steg 1 utgår från `profiles`. Ett auth-konto utan profilrad (avbruten
    // registrering, eller en profil som raderats separat) skulle därför aldrig
    // varnas och aldrig raderas — kontot och dess e-post skulle ligga kvar för
    // alltid. Här fångas de upp: saknar profil + äldre än inaktivitetsgränsen
    // och aldrig inloggad sedan dess → radera direkt. Det finns ingen
    // användardata att varna om.
    try {
      const authUsers: { id: string; email?: string | null; created_at: string; last_sign_in_at?: string | null }[] = []
      await forEachAuthUser(admin, (u) => {
        authUsers.push(u as typeof authUsers[number])
      })
      if (authUsers.length > 0) {
        const { data: profileRows } = await admin
          .from('profiles')
          .select('user_id')
          .in('user_id', authUsers.map((u: { id: string }) => u.id))
        const hasProfile = new Set(
          (profileRows ?? []).map((p: { user_id: string }) => p.user_id),
        )

        for (const u of authUsers as {
          id: string
          email?: string | null
          created_at: string
          last_sign_in_at?: string | null
        }[]) {
          if (hasProfile.has(u.id)) continue
          const lastSeen = u.last_sign_in_at ?? u.created_at
          if (lastSeen >= cutoff) continue

          try {
            await purgeUser(admin, u.id, u.email ?? null)
            stats.orphans_deleted++
          } catch (e) {
            stats.errors++
            console.error(`orphan purge failed for ${u.id}:`, (e as Error).message)
          }
        }
      }
    } catch (e) {
      console.error('orphan sweep failed:', (e as Error).message)
    }

    console.log('inactive-account-retention done', stats)

    return new Response(JSON.stringify({ success: true, ...stats }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('inactive-account-retention error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message, ...stats }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

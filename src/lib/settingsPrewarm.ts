import { supabase } from '@/integrations/supabase/client';
import { safeSetItem } from '@/lib/safeStorage';
import { writeCachedOutreachStudio } from '@/lib/outreachStudioCache';
import type { OutreachAutomation, OutreachDispatchLog, OutreachTemplate } from '@/lib/outreach';

/**
 * Förvärmning av inställningssidan.
 *
 * Panelerna (Teamet, Automatiska utskick, Mallar) monteras först när dragspelet
 * öppnas. Utan förvärmning startar deras nätverksanrop i samma ögonblick, vilket
 * ger kallstart: "0 medlemmar" som hoppar till rätt siffra, avslagna kanaler som
 * plötsligt tänds. Här fylls exakt samma localStorage-cacher som panelerna redan
 * läser synkront vid montering – så innehållet finns på plats innan de öppnas.
 *
 * Ingen funktionalitet ändras: samma frågor, samma cachenycklar, samma format.
 */

const AUTO_RULES_CACHE_KEY = 'parium_auto_rules_cache';
const TEAM_CACHE_PREFIX = 'parium-team-cache:';
const PREWARM_TTL_MS = 60_000;

let inFlight: Promise<void> | null = null;
let lastUserId: string | null = null;
let lastRunAt = 0;

async function prewarmAutoRules(userId: string): Promise<void> {
  const [automationsRes, templatesRes] = await Promise.all([
    supabase.from('outreach_automations').select('*').eq('owner_user_id', userId),
    supabase.from('outreach_templates').select('*').eq('owner_user_id', userId),
  ]);

  if (automationsRes.error || templatesRes.error) return;

  safeSetItem(
    AUTO_RULES_CACHE_KEY,
    JSON.stringify({
      userId,
      automations: automationsRes.data ?? [],
      templates: templatesRes.data ?? [],
    }),
  );
}

async function prewarmOutreachStudio(userId: string): Promise<void> {
  const [templatesRes, automationsRes, logsRes] = await Promise.all([
    supabase.from('outreach_templates').select('*').order('created_at', { ascending: false }),
    supabase.from('outreach_automations').select('*').order('created_at', { ascending: false }),
    supabase.from('outreach_dispatch_logs').select('*').order('created_at', { ascending: false }).limit(40),
  ]);

  if (templatesRes.error || automationsRes.error || logsRes.error) return;

  writeCachedOutreachStudio(userId, {
    templates: (templatesRes.data ?? []) as OutreachTemplate[],
    automations: (automationsRes.data ?? []) as OutreachAutomation[],
    logs: (logsRes.data ?? []) as OutreachDispatchLog[],
  });
}

async function prewarmTeam(userId: string): Promise<void> {
  const { data: organizationId, error: orgError } = await supabase.rpc('get_user_organization_id', {
    p_user_id: userId,
  });

  if (orgError || !organizationId) return;

  // E-post kan inte läsas direkt ur `profiles` — samma säkra RPC som TeamManagement.
  const { data: memberRows, error: membersError } = await supabase.rpc('get_my_organization_member_profiles');

  if (membersError) return;

  const members = (memberRows ?? []).map((row) => ({
    user_id: row.user_id,
    role: row.role,
    is_active: row.is_active,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    email: row.email || null,
  }));

  safeSetItem(
    `${TEAM_CACHE_PREFIX}${userId}`,
    JSON.stringify({ userId, organizationId, members }),
  );
}

export function prewarmEmployerSettings(userId?: string | null): void {
  if (!userId) return;

  const now = Date.now();
  if (inFlight && lastUserId === userId) return;
  if (lastUserId === userId && now - lastRunAt < PREWARM_TTL_MS) return;

  lastUserId = userId;
  lastRunAt = now;

  inFlight = (async () => {
    await Promise.allSettled([
      prewarmAutoRules(userId),
      prewarmOutreachStudio(userId),
      prewarmTeam(userId),
    ]);
  })()
    .catch(() => {
      // Förvärmning är alltid bäst-möjliga-insats; panelerna hämtar själva vid behov.
    })
    .finally(() => {
      inFlight = null;
    });
}

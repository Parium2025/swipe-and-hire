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

  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id, role, is_active')
    .eq('organization_id', organizationId)
    .eq('is_active', true);

  if (rolesError) return;

  const userIds = (roles ?? []).map((role) => role.user_id);
  const { data: profileRows, error: profilesError } = userIds.length > 0
    ? await supabase
      .from('profiles')
      .select('user_id, first_name, last_name, email')
      .in('user_id', userIds)
    : { data: [], error: null };

  if (profilesError) return;

  const profilesByUser = new Map((profileRows ?? []).map((row) => [row.user_id, row]));
  const members = (roles ?? []).map((role) => {
    const profileData = profilesByUser.get(role.user_id);
    return {
      ...role,
      first_name: profileData?.first_name || null,
      last_name: profileData?.last_name || null,
      email: profileData?.email || null,
    };
  });

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

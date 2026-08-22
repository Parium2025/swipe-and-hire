import { supabase } from '@/integrations/supabase/client';
import { AUTO_RULE_CHANNELS, AUTO_RULE_EVENTS, type AutoRuleChannel } from '@/lib/outreachAutoRules';

/**
 * 🔛 STANDARD = MEJL + PUSH PÅSLAGET, CHATT AVSTÄNGT
 *
 * Nya arbetsgivare får mejl och push påslaget från start. Chatt är avstängt
 * som standard – den öppnar för dialog och ska vara ett aktivt val.
 * Sedan äger arbetsgivaren beslutet helt själv – stänger de av något så
 * skickas ingenting i den kanalen, och vi slår aldrig på det igen.
 *
 * Skydd mot dubbletter:
 *  1. `outreach_defaults_seeded.user_id` är primärnyckel → vi "claimar" raden
 *     FÖRST. Två flikar/StrictMode-mount kan alltså aldrig seeda parallellt.
 *  2. En in-flight-cache per userId i minnet gör att samma flik bara kör en gång.
 *  3. Misslyckas seedningen släpper vi claimen så att nästa försök kan köra.
 */
const inFlight = new Map<string, Promise<boolean>>();

async function runSeed(userId: string, organizationId: string | null): Promise<boolean> {
  // 1. Claima seedningen atomiskt (PK på user_id gör detta race-säkert).
  const { error: claimError } = await supabase
    .from('outreach_defaults_seeded')
    .insert({ user_id: userId });

  // Redan seedat (eller någon annan kör just nu) – rör ingenting.
  if (claimError) return false;

  const releaseClaim = async () => {
    await supabase.from('outreach_defaults_seeded').delete().eq('user_id', userId);
  };

  try {
    // 2. Har arbetsgivaren redan egna regler? Respektera dem fullt ut.
    const { data: existing, error: existingError } = await supabase
      .from('outreach_automations')
      .select('id')
      .eq('owner_user_id', userId)
      .limit(1);

    if (existingError) {
      await releaseClaim();
      return false;
    }
    if (existing && existing.length > 0) return false; // markerad som seedad, inget skapas

    const { data: templateRows, error: templatesError } = await supabase
      .from('outreach_templates')
      .select('id, name, channel')
      .eq('owner_user_id', userId);

    if (templatesError) {
      await releaseClaim();
      return false;
    }

    const cache: { id: string; name: string; channel: string }[] = (templateRows ?? []).map((t) => ({
      id: t.id as string,
      name: t.name as string,
      channel: t.channel as string,
    }));

    const templateId = async (name: string, channel: AutoRuleChannel, subject: string | null, body: string) => {
      const found = cache.find((t) => t.name === name && t.channel === channel);
      if (found) return found.id;
      const { data } = await supabase
        .from('outreach_templates')
        .insert({
          owner_user_id: userId,
          organization_id: organizationId,
          name,
          channel,
          subject,
          body,
          is_active: true,
          is_default: true,
        })
        .select('id, name, channel')
        .single();
      if (data) cache.push({ id: data.id as string, name: data.name as string, channel: data.channel as string });
      return (data?.id as string | undefined) ?? null;
    };

    const rows: Record<string, unknown>[] = [];

    for (const event of AUTO_RULE_EVENTS) {
      const groupId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${event.trigger}`;

      for (const { value: channel } of AUTO_RULE_CHANNELS) {
        const config = event.templates[channel];
        if (!config) continue;
        const id = await templateId(config.name, channel, config.subject, config.body);
        if (!id) continue;
        rows.push({
          owner_user_id: userId,
          organization_id: organizationId,
          name: event.title,
          trigger: event.trigger,
          channel,
          recipient_type: 'candidate',
          template_id: id,
          delay_minutes: event.defaultDelay,
          filters: { group_id: groupId },
          is_enabled: channel !== 'chat',
        });
      }
    }

    if (rows.length === 0) {
      await releaseClaim();
      return false;
    }

    const { error } = await supabase.from('outreach_automations').insert(rows as never);
    if (error) {
      await releaseClaim();
      return false;
    }

    return true;
  } catch {
    await releaseClaim();
    return false;
  }
}

export async function seedDefaultAutoRules(userId: string, organizationId: string | null): Promise<boolean> {
  const existing = inFlight.get(userId);
  if (existing) return existing;
  const promise = runSeed(userId, organizationId).finally(() => {
    inFlight.delete(userId);
  });
  inFlight.set(userId, promise);
  return promise;
}

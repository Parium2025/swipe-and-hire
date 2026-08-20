import { supabase } from '@/integrations/supabase/client';
import { AUTO_RULE_CHANNELS, AUTO_RULE_EVENTS, type AutoRuleChannel } from '@/lib/outreachAutoRules';

/**
 * 🔛 STANDARD = ALLT PÅSLAGET
 *
 * Nya arbetsgivare ska ha alla automatiska utskick påslagna från start.
 * Sedan äger arbetsgivaren beslutet helt själv – stänger de av något så
 * skickas ingenting i den kanalen, och vi slår aldrig på det igen.
 *
 * Markeringen i `outreach_defaults_seeded` gör att seedningen bara sker en
 * enda gång per konto.
 */
export async function seedDefaultAutoRules(userId: string, organizationId: string | null): Promise<boolean> {
  // Redan seedat? Rör ingenting.
  const { data: marker } = await supabase
    .from('outreach_defaults_seeded')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (marker) return false;

  const { data: existing } = await supabase
    .from('outreach_automations')
    .select('id')
    .eq('owner_user_id', userId)
    .limit(1);

  // Arbetsgivaren har redan egna regler – respektera dem, markera bara som seedat.
  if (existing && existing.length > 0) {
    await supabase.from('outreach_defaults_seeded').insert({ user_id: userId });
    return false;
  }

  const { data: templates } = await supabase
    .from('outreach_templates')
    .select('id, name, channel')
    .eq('owner_user_id', userId);

  const templateId = async (name: string, channel: AutoRuleChannel, subject: string | null, body: string) => {
    const found = (templates ?? []).find((t) => t.name === name && t.channel === channel);
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
    if (data) templates?.push(data);
    return data?.id ?? null;
  };

  const rows: Record<string, unknown>[] = [];

  for (const event of AUTO_RULE_EVENTS) {
    const groupId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${event.trigger}`;

    for (const { value: channel } of AUTO_RULE_CHANNELS) {
      const config = event.templates[channel];
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
        is_enabled: true,
      });
    }
  }

  if (rows.length === 0) return false;

  const { error } = await supabase.from('outreach_automations').insert(rows as never);
  if (error) return false;

  await supabase.from('outreach_defaults_seeded').insert({ user_id: userId });
  return true;
}

import { memo, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, Info, Lightbulb, CalendarCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export interface TeamMemberStats {
  user_id: string;
  name: string;
  profile_image_url: string | null;
  jobs_count: number;
  views: number;
  applications: number;
  interviews: number;
}

export interface TeamTraits {
  sample: number;
  avg_description_length: number;
  best_day_of_week: number | null;
  avg_conversion: number;
  examples: { title: string; views: number; applications: number; employer_id: string }[];
}

export interface TeamInsightsData {
  members: TeamMemberStats[];
  top_traits: TeamTraits | null;
}

const DAY_NAMES = ['söndagar', 'måndagar', 'tisdagar', 'onsdagar', 'torsdagar', 'fredagar', 'lördagar'];

const initialsOf = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';

const InfoTip = memo(({ content }: { content: string }) => (
  <Popover modal>
    <PopoverTrigger asChild>
      <button
        type="button"
        aria-label="Mer information"
        className="inline-flex items-center justify-center h-6 w-6 rounded-full text-white/60 hover:text-white transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent
      side="top"
      align="center"
      className="max-w-[280px] bg-[#0b1b33]/95 backdrop-blur-xl border-white/10 text-[12px] leading-relaxed text-white"
    >
      {content}
    </PopoverContent>
  </Popover>
));
InfoTip.displayName = 'TeamInfoTip';

export const TeamInsightsSection = memo(({ data }: { data: TeamInsightsData | null }) => {
  const members = useMemo(() => (Array.isArray(data?.members) ? data!.members : []), [data]);
  const [expanded, setExpanded] = useState(false);

  // Endast relevant för organisationer med fler än en rekryterare
  if (members.length < 2) return null;

  const maxApps = Math.max(1, ...members.map((m) => m.applications));
  const visible = expanded ? members : members.slice(0, 5);
  const traits = data?.top_traits ?? null;

  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-1.5 mb-1">
          <Users className="h-4 w-4 text-white/70 shrink-0" />
          <h3 className="text-[15px] font-semibold text-white">Lär av varandra</h3>
          <InfoTip content="Visar hur annonserna presterar per kollega i din organisation. Syftet är att se vad som fungerar bra och kopiera det – inte att ranka personer. Visningar är unika besökare. Intervjuer räknas på den kollega som bokat och håller intervjun, oavsett vem som äger annonsen. Era egna visningar, ansökningar och intervjuer räknas aldrig med." />
        </div>
        <p className="text-[12px] text-white/70 mb-4">
          Så presterar er organisations annonser – per kollega under vald period.
        </p>

        <div className="space-y-2.5">
          {visible.map((m, i) => {
            const conv = m.views > 0 ? Math.round((m.applications / m.views) * 100) : 0;
            const pct = Math.round((m.applications / maxApps) * 100);
            return (
              <motion.div
                key={m.user_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.2) }}
                className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                    {m.profile_image_url ? (
                      <img src={m.profile_image_url} alt="" className="h-full w-full object-cover" loading="eager" />
                    ) : (
                      <span className="text-[11px] font-semibold text-white">{initialsOf(m.name)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-white truncate">{m.name}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-white">
                      <span className="whitespace-nowrap">{m.jobs_count} annonser</span>
                      <span aria-hidden className="text-white/40">·</span>
                      <span className="whitespace-nowrap">{m.views} visningar</span>
                      <span aria-hidden className="text-white/40">·</span>
                      <span className="whitespace-nowrap">{m.applications} ansökningar</span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-white/[0.10] px-2 py-0.5 font-medium">
                        <CalendarCheck className="h-3 w-3 shrink-0" aria-hidden />
                        {m.interviews} intervjuer
                      </span>
                    </div>
                  </div>
                  <span className="text-[13px] font-semibold text-white shrink-0">{conv}%</span>

                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-white/50 transition-all duration-700"
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {members.length > 5 && (
          <div className="flex justify-center mt-3">
            <button
              onClick={() => setExpanded((v) => !v)}
              className="py-2 px-4 rounded-lg bg-white/[0.06] text-[12px] font-medium text-white hover:bg-white/[0.10] transition-colors active:scale-[0.97]"
            >
              {expanded ? 'Visa färre' : `Visa alla (${members.length})`}
            </button>
          </div>
        )}

        {traits && traits.sample > 0 && (
          <div className="mt-4 rounded-xl bg-white/[0.04] border border-white/[0.06] p-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Lightbulb className="h-3.5 w-3.5 text-white/70 shrink-0" />
              <p className="text-[13px] font-medium text-white">Vad era bästa annonser har gemensamt</p>
            </div>
            <p className="text-[12px] text-white leading-relaxed">
              De {traits.sample} annonser som konverterar bäst har i snitt {traits.avg_conversion}% konvertering
              {traits.avg_description_length > 0 && <> och en beskrivning på cirka {traits.avg_description_length} tecken</>}
              {traits.best_day_of_week !== null && <> – flest av dem publicerades på {DAY_NAMES[traits.best_day_of_week]}</>}.
            </p>
            {traits.examples?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {traits.examples.slice(0, 3).map((ex, idx) => (
                  <li key={`${ex.title}-${idx}`} className="text-[11px] text-white/80 truncate">
                    • {ex.title} — {ex.applications} ans. / {ex.views} vis.
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

TeamInsightsSection.displayName = 'TeamInsightsSection';

import { memo, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Users, Info, Lightbulb, CalendarCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { TruncatedText } from '@/components/ui/truncated-text';
import { TeamMemberAvatar } from '@/components/TeamMemberAvatar';

export interface TeamMemberStats {
  user_id: string;
  name: string;
  profile_image_url: string | null;
  jobs_count: number;
  views: number;
  applications: number;
  interviews: number;
  interviews_completed?: number;
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
        className="inline-flex items-center justify-center h-6 w-6 rounded-full text-white transition-colors"
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
    <Card className="glass-panel border-white/10 overflow-hidden">
      <CardHeader className="p-4 md:p-6 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-white" />
            <CardTitle className="text-lg font-semibold text-white">Teamets aktivitet</CardTitle>
          </div>
          <InfoTip content="Statistik över rekryterarnas aktivitet och resultat i rekryteringsverktyget." />
        </div>
      </CardHeader>
      <CardContent className="p-4 md:p-6 space-y-6">
        <div className="space-y-4">
          {visible.map((m) => {
            const firstName = m.name.split(' ')[0] || 'Kollega';
            const lastName = m.name.split(' ').slice(1).join(' ') || '';
            return (
              <div key={m.user_id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamMemberAvatar 
                      profileImageUrl={m.profile_image_url} 
                      firstName={firstName} 
                      lastName={lastName}
                      size="sm"
                    />
                    <TruncatedText text={m.name} className="text-white font-medium" />
                  </div>
                  <span className="text-white/60 shrink-0">{m.applications} ansökningar</span>
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(m.applications / maxApps) * 100}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {members.length > 5 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full py-2 text-sm text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            {expanded ? 'Visa färre' : `Visa alla ${members.length} medlemmar`}
          </button>
        )}

        {traits && traits.sample > 0 && (
          <div className="pt-4 border-t border-white/10 space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-400" />
              <h4 className="text-sm font-semibold text-white">Teaminsikter</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-white/5 space-y-1">
                <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Bästa tid att publicera</p>
                <p className="text-sm text-white">
                  {traits.best_day_of_week !== null 
                    ? `Era annonser får flest svar på ${DAY_NAMES[traits.best_day_of_week]}.`
                    : 'För tidigt för att se trender.'}
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-white/5 space-y-1">
                <p className="text-[10px] text-white/50 uppercase tracking-wider font-semibold">Konvertering</p>
                <p className="text-sm text-white">
                  {traits.avg_conversion > 0 
                    ? `Teamets snitt är ${traits.avg_conversion.toFixed(1)}% från vy till ansökan.`
                    : 'Ingen data för konvertering än.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
TeamInsightsSection.displayName = 'TeamInsightsSection';

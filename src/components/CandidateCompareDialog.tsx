import { Dialog, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogContentNoFocus } from '@/components/ui/dialog-no-focus';
import { MyCandidateData } from '@/hooks/useMyCandidatesData';
import { CandidateAvatar } from '@/components/CandidateAvatar';
import { Star, MapPin, Briefcase, Calendar, FileText, Clock, ArrowDown, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCompactTime } from '@/lib/date';
import { useMediaUrl } from '@/hooks/useMediaUrl';
import { useMemo } from 'react';

interface CandidateCompareDialogProps {
  candidates: MyCandidateData[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stageConfig?: Record<string, { label: string; color: string; iconName: string }>;
}

const StarRating = ({ rating = 0 }: { rating?: number }) => (
  <div className="flex gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-3.5 w-3.5 ${
          i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/20'
        }`}
      />
    ))}
  </div>
);

// Row for a comparison field
const CompareRow = ({
  label,
  icon: Icon,
  values,
  highlight = false,
}: {
  label: string;
  icon: React.ElementType;
  values: (string | null | undefined)[];
  highlight?: boolean;
}) => {
  // Determine which is "better" for highlighting
  const highlightIndex = highlight && values[0] && values[1] && values[0] !== values[1] ? -1 : -1;

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className="text-sm text-white/90 text-right truncate">
        {values[0] || <span className="text-white/30">—</span>}
      </div>
      <div className="flex items-center gap-1.5 text-white/50 min-w-[100px] justify-center">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span className="text-xs font-medium whitespace-nowrap">{label}</span>
      </div>
      <div className="text-sm text-white/90 truncate">
        {values[1] || <span className="text-white/30">—</span>}
      </div>
    </div>
  );
};

const CandidateColumn = ({ candidate, stageConfig }: { candidate: MyCandidateData; stageConfig?: Record<string, { label: string; color: string; iconName: string }> }) => {
  const stageSetting = stageConfig?.[candidate.stage];

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="h-16 w-16 [&>*:first-child]:h-16 [&>*:first-child]:w-16 [&_.h-10]:h-16 [&_.w-10]:w-16">
        <CandidateAvatar
          profileImageUrl={candidate.profile_image_url}
          videoUrl={candidate.video_url}
          isProfileVideo={candidate.is_profile_video}
          firstName={candidate.first_name}
          lastName={candidate.last_name}
        />
      </div>
      <div className="text-center">
        <p className="text-white font-semibold text-sm">
          {candidate.first_name} {candidate.last_name}
        </p>
        {candidate.job_title && (
          <p className="text-white/60 text-xs mt-0.5 truncate max-w-[140px]">{candidate.job_title}</p>
        )}
      </div>
      <StarRating rating={candidate.rating} />
      {stageSetting && (
        <Badge
          className="text-[10px] px-2 py-0.5 border-0 text-white"
          style={{ backgroundColor: `${stageSetting.color}66` }}
        >
          {stageSetting.label}
        </Badge>
      )}
    </div>
  );
};

export const CandidateCompareDialog = ({
  candidates,
  open,
  onOpenChange,
  stageConfig,
}: CandidateCompareDialogProps) => {
  const [a, b] = candidates;

  if (!a || !b) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContentNoFocus className="border-white/20 text-white w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] sm:max-w-2xl p-0 bg-white/5 backdrop-blur-xl rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-white text-base font-semibold text-center">
            Jämför kandidater
          </DialogTitle>
        </DialogHeader>

        {/* Candidate headers */}
        <div className="grid grid-cols-2 gap-4 px-4">
          <CandidateColumn candidate={a} stageConfig={stageConfig} />
          <CandidateColumn candidate={b} stageConfig={stageConfig} />
        </div>

        {/* Comparison fields */}
        <div className="px-4 pb-4">
          <div className="bg-white/5 rounded-lg ring-1 ring-inset ring-white/10 p-3">
            <CompareRow
              label="Plats"
              icon={MapPin}
              values={[a.location, b.location]}
            />
            <CompareRow
              label="Ålder"
              icon={Calendar}
              values={[
                a.age ? `${a.age} år` : null,
                b.age ? `${b.age} år` : null,
              ]}
            />
            <CompareRow
              label="Sysselsättning"
              icon={Briefcase}
              values={[a.employment_status, b.employment_status]}
            />
            <CompareRow
              label="Arbetstid"
              icon={Clock}
              values={[a.work_schedule, b.work_schedule]}
            />
            <CompareRow
              label="Tillgänglighet"
              icon={Calendar}
              values={[a.availability, b.availability]}
            />
            <CompareRow
              label="CV"
              icon={FileText}
              values={[
                a.cv_url ? 'Uppladdad' : null,
                b.cv_url ? 'Uppladdad' : null,
              ]}
            />
            <CompareRow
              label="Senaste ansökan"
              icon={ArrowDown}
              values={[
                a.latest_application_at ? formatCompactTime(a.latest_application_at) : null,
                b.latest_application_at ? formatCompactTime(b.latest_application_at) : null,
              ]}
            />
            <CompareRow
              label="Senast aktiv"
              icon={Clock}
              values={[
                a.last_active_at ? formatCompactTime(a.last_active_at) : null,
                b.last_active_at ? formatCompactTime(b.last_active_at) : null,
              ]}
            />
          </div>

          {/* Bio comparison */}
          {(a.bio || b.bio) && (
            <div className="mt-3">
              <p className="text-xs font-medium text-white/50 text-center mb-2">Beskrivning</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-lg p-3 ring-1 ring-inset ring-white/10">
                  <p className="text-xs text-white/80 line-clamp-4">
                    {a.bio || <span className="text-white/30">Ingen beskrivning</span>}
                  </p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 ring-1 ring-inset ring-white/10">
                  <p className="text-xs text-white/80 line-clamp-4">
                    {b.bio || <span className="text-white/30">Ingen beskrivning</span>}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContentNoFocus>
    </Dialog>
  );
};

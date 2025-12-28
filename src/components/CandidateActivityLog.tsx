import { useCandidateActivities, CandidateActivity } from '@/hooks/useCandidateActivities';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Star, StickyNote, Edit3, Activity } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';


interface CandidateActivityLogProps {
  applicantId: string | null;
}

const getActivityIcon = (type: string) => {
  switch (type) {
    case 'rating_changed':
      return Star;
    case 'note_added':
      return StickyNote;
    case 'note_edited':
      return Edit3;
    default:
      return Activity;
  }
};

const getActivityDescription = (activity: CandidateActivity) => {
  const name = `${activity.user_first_name || ''} ${activity.user_last_name || ''}`.trim() || 'Någon';
  
  switch (activity.activity_type) {
    case 'rating_changed':
      const oldRating = activity.old_value ? parseInt(activity.old_value) : 0;
      const newRating = activity.new_value ? parseInt(activity.new_value) : 0;
      if (oldRating === 0) {
        return (
          <span>
            <span className="font-medium text-white">{name}</span>
            <span className="text-white"> gav betyg </span>
            <span className="text-yellow-400">{newRating} ★</span>
          </span>
        );
      }
      return (
        <span>
          <span className="font-medium text-white">{name}</span>
          <span className="text-white"> ändrade betyg från </span>
          <span className="whitespace-nowrap"><span className="text-white">{oldRating}</span><span className="text-yellow-400"> ★</span></span>
          <span className="text-white"> till </span>
          <span className="whitespace-nowrap"><span className="text-white">{newRating}</span><span className="text-yellow-400"> ★</span></span>
        </span>
      );
    case 'note_added':
      return (
        <span>
          <span className="font-medium text-white">{name}</span>
          <span className="text-white"> lade till en anteckning</span>
        </span>
      );
    case 'note_edited':
      return (
        <span>
          <span className="font-medium text-white">{name}</span>
          <span className="text-white"> redigerade en anteckning</span>
        </span>
      );
    default:
      return (
        <span className="text-white">Okänd aktivitet</span>
      );
  }
};

const formatTime = (date: string) => {
  const distance = formatDistanceToNow(new Date(date), { addSuffix: true, locale: sv });
  
  // Handle "mindre än en minut sedan" -> "0 minuter sedan"
  if (distance.includes('mindre än')) {
    return '0 minuter sedan';
  }
  
  // Remove "ungefär" and "för" prefixes
  let formatted = distance
    .replace(/ungefär /gi, '')
    .replace(/^för /gi, '');
  
  // Convert Swedish number words to digits (order matters - longer words first)
  const replacements: [RegExp, string][] = [
    [/tjugo/gi, '20'],
    [/trettio/gi, '30'],
    [/fyrtio/gi, '40'],
    [/femtio/gi, '50'],
    [/nitton/gi, '19'],
    [/arton/gi, '18'],
    [/sjutton/gi, '17'],
    [/sexton/gi, '16'],
    [/femton/gi, '15'],
    [/fjorton/gi, '14'],
    [/tretton/gi, '13'],
    [/tolv/gi, '12'],
    [/elva/gi, '11'],
    [/tio/gi, '10'],
    [/nio/gi, '9'],
    [/åtta/gi, '8'],
    [/sju/gi, '7'],
    [/sex/gi, '6'],
    [/fem/gi, '5'],
    [/fyra/gi, '4'],
    [/tre/gi, '3'],
    [/två/gi, '2'],
    [/ett/gi, '1'],
    [/en /gi, '1 '],
  ];
  
  for (const [regex, replacement] of replacements) {
    formatted = formatted.replace(regex, replacement);
  }
  
  return formatted;
};

export function CandidateActivityLog({ applicantId }: CandidateActivityLogProps) {
  const { activities, isLoading } = useCandidateActivities(applicantId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full bg-white/10" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4 bg-white/10" />
              <Skeleton className="h-3 w-1/4 bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Activity className="h-8 w-8 text-white/30 mb-2" />
        <p className="text-sm text-white">Ingen aktivitet ännu</p>
      </div>
    );
  }

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const date = new Date(activity.created_at).toLocaleDateString('sv-SE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, CandidateActivity[]>);

  const dateEntries = Object.entries(groupedActivities);

  return (
    <div className="space-y-4">
      {dateEntries.map(([date, dateActivities], index) => (
        <div key={date}>
          {index > 0 && (
            <div className="h-px bg-white/20 mb-4" />
          )}
          <p className="text-xs text-white mb-2 capitalize">{date}</p>
          <div className="space-y-3">
            {dateActivities.map((activity) => {
              const Icon = getActivityIcon(activity.activity_type);
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className="flex-shrink-0 h-7 w-7 rounded-full bg-white/10 flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed">
                      {getActivityDescription(activity)}
                    </p>
                    <p className="text-[10px] text-white mt-0.5">
                      {formatTime(activity.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

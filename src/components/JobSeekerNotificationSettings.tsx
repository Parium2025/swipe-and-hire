import { Bell } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useNotificationPreferences, NotificationType } from '@/hooks/useNotificationPreferences';

const JOBSEEKER_NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string }[] = [
  { type: 'interview_scheduled', label: 'Intervjuinbjudningar', description: 'När du blir inbjuden till intervju' },
  { type: 'new_message', label: 'Meddelanden', description: 'När du får nya meddelanden' },
  { type: 'saved_search_match', label: 'Matchande jobb', description: 'När nya jobb matchar dina sparade sökningar' },
  { type: 'saved_job_expiring', label: 'Sparade jobb utgår', description: 'När ett sparat jobb snart går ut' },
  { type: 'job_closed', label: 'Avslutade annonser', description: 'När en annons du sökt stängs' },
];

export const JobSeekerNotificationSettings = () => {
  const { isEnabled, toggle, isLoading } = useNotificationPreferences();

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-lg p-6 md:p-4">
      <div className="space-y-5 md:space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Bell className="h-4 w-4 text-white" />
          <h3 className="text-sm font-medium text-white">Aviseringar</h3>
        </div>

        {JOBSEEKER_NOTIFICATION_TYPES.map(({ type, label, description }) => (
          <div key={type} className="flex items-center justify-between">
            <div>
              <Label className="text-sm text-white">{label}</Label>
              <p className="text-sm text-white/70">{description}</p>
            </div>
            <Switch
              checked={isEnabled(type)}
              onCheckedChange={(checked) => toggle(type, checked)}
              disabled={isLoading}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
